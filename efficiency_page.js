// ============ EFFICIENCY PAGE LOGIC - FINAL FIX ============
// Single load, no spam, smooth updates

let isLoading = false
let lastLoadTime = 0
const LOAD_COOLDOWN = 5000
let lastFocusTime = 0
const FOCUS_RELOAD_COOLDOWN = 10000 // Reload data when returning from focus

const BLOCKS = {
  A: [{start: 1, end: 160}],
  B: [
    {start: 201, end: 220}, {start: 261, end: 280}, {start: 321, end: 340},
    {start: 381, end: 400}, {start: 441, end: 460}, {start: 501, end: 520},
    {start: 561, end: 580}, {start: 621, end: 640}
  ],
  C: [
    {start: 181, end: 200}, {start: 241, end: 260}, {start: 301, end: 320},
    {start: 361, end: 380}, {start: 421, end: 440}, {start: 481, end: 500},
    {start: 541, end: 560}, {start: 601, end: 620}
  ],
  D: [
    {start: 161, end: 180}, {start: 221, end: 240}, {start: 281, end: 300},
    {start: 341, end: 360}, {start: 401, end: 420}, {start: 461, end: 480},
    {start: 521, end: 540}, {start: 581, end: 600}
  ]
}

window.BLOCKS = BLOCKS

function getMachineBlock(machineNum) {
  for (const [blockName, ranges] of Object.entries(BLOCKS)) {
    for (const range of ranges) {
      if (machineNum >= range.start && machineNum <= range.end) {
        return blockName
      }
    }
  }
  return '?'
}

// ✅ THROTTLED LOAD - Load from cloud with multi-device support
async function loadAllEfficiencyData(force = false) {
  const now = Date.now()
  
  // Cooldown check
  if (isLoading || (now - lastLoadTime < LOAD_COOLDOWN && !force)) {
    console.log('⏳ Cooldown active, skipping')
    return false
  }
  
  isLoading = true
  lastLoadTime = now
  
  try {
    console.log('☁️ Loading from cloud...')
    
    let cloudDataLoaded = false
    
    // Load machine efficiency
    if (typeof loadEfficiencyFromCloud !== 'undefined') {
      const cloudData = await loadEfficiencyFromCloud()
      if (cloudData && Object.keys(cloudData).length > 0) {
        console.log('✅ Loaded', Object.keys(cloudData).length, 'machines from cloud')
        
        if (window.efficiencySystem) {
          window.efficiencySystem.efficiencyData = cloudData
          localStorage.setItem('machine_efficiency_v2', JSON.stringify(cloudData))
          
          // ✅ SYNC cloud data to local system
          if (typeof window.efficiencySystem.syncCloudDataToLocal === 'function') {
            window.efficiencySystem.syncCloudDataToLocal()
          }
          
          cloudDataLoaded = true
        }
      } else {
        console.log('ℹ️ No machine efficiency data in cloud, using local')
        // Fallback to localStorage
        const localData = localStorage.getItem('machine_efficiency_v2')
        if (localData && window.efficiencySystem) {
          window.efficiencySystem.efficiencyData = JSON.parse(localData)
          
          // ✅ SYNC local data to internal system
          if (typeof window.efficiencySystem.syncCloudDataToLocal === 'function') {
            window.efficiencySystem.syncCloudDataToLocal()
          }
        }
      }
    }
    
    // Load global efficiency
    if (typeof loadGlobalEfficiencyFromCloud !== 'undefined') {
      const globalData = await loadGlobalEfficiencyFromCloud()
      if (globalData && Object.keys(globalData).length > 0) {
        console.log('✅ Loaded', Object.keys(globalData).length, 'dates from cloud')
        
        if (window.globalEfficiencySystem) {
          window.globalEfficiencySystem.globalEfficiencyData = globalData
          localStorage.setItem('global_efficiency_v1', JSON.stringify(globalData))
          cloudDataLoaded = true
        }
      } else {
        console.log('ℹ️ No global efficiency data in cloud, using local')
        // Fallback to localStorage
        const localData = localStorage.getItem('global_efficiency_v1')
        if (localData && window.globalEfficiencySystem) {
          window.globalEfficiencySystem.globalEfficiencyData = JSON.parse(localData)
        }
      }
    }
    
    return cloudDataLoaded
  } catch (e) {
    console.error('❌ Load error:', e.message)
    
    // Fallback to localStorage if cloud fails
    console.log('⚠️ Falling back to local storage...')
    const localMachine = localStorage.getItem('machine_efficiency_v2')
    const localGlobal = localStorage.getItem('global_efficiency_v1')
    
    if (localMachine && window.efficiencySystem) {
      window.efficiencySystem.efficiencyData = JSON.parse(localMachine)
    }
    if (localGlobal && window.globalEfficiencySystem) {
      window.globalEfficiencySystem.globalEfficiencyData = JSON.parse(localGlobal)
    }
    
    return false
  } finally {
    isLoading = false
  }
}

// ✅ RENDER FUNCTIONS (No API calls)
function renderEfficiencyGrid() {
  const grid = document.getElementById('efficiency-grid')
  const dateFilter = document.getElementById('date-filter')
  const blockFilter = document.getElementById('block-filter')
  const sortFilter = document.getElementById('sort-filter')
  
  if (!grid) return
  
  const date = dateFilter ? dateFilter.value : new Date().toISOString().split('T')[0]
  
  if (!window.efficiencySystem) {
    grid.innerHTML = '<div class="no-data">❌ System not loaded</div>'
    return
  }
  
  const machinesWithData = []
  
  for (let i = 1; i <= 640; i++) {
    const eff = window.efficiencySystem.getMachineEfficiency(i, date)
    const block = getMachineBlock(i)
    
    if (blockFilter && blockFilter.value && block !== blockFilter.value) continue
    
    if (eff && eff.global > 0) {
      machinesWithData.push({
        id: i,
        block: block,
        ...eff
      })
    }
  }
  
  if (sortFilter && sortFilter.value === 'efficiency') {
    machinesWithData.sort((a, b) => b.global - a.global)
  } else if (sortFilter && sortFilter.value === 'efficiency-low') {
    machinesWithData.sort((a, b) => a.global - b.global)
  } else {
    machinesWithData.sort((a, b) => a.id - b.id)
  }
  
  if (machinesWithData.length === 0) {
    grid.innerHTML = `<div class="no-data">Tidak ada data untuk ${date}</div>`
    return
  }
  
  grid.innerHTML = ''
  
  machinesWithData.forEach(machine => {
    const card = document.createElement('div')
    card.className = 'efficiency-card'
    
    let effClass = 'medium'
    if (machine.global >= 80) effClass = 'high'
    else if (machine.global < 60) effClass = 'low'
    
    const timestamp = machine.timestamp ? new Date(machine.timestamp).toLocaleString('id-ID') : 'Unknown'
    
    card.innerHTML = `
      <div class="efficiency-card-header">
        <div>
          <div class="machine-number">Mesin ${machine.id}</div>
          <div style="font-size: 11px; color: #9aa6c0;">Blok ${machine.block}</div>
        </div>
        <div class="efficiency-global ${effClass}">${machine.global}%</div>
      </div>
      
      <div class="shift-data">
        <div class="shift-item">
          <div class="shift-label">Shift A</div>
          <div class="shift-value">${machine.shiftA}%</div>
        </div>
        <div class="shift-item">
          <div class="shift-label">Shift B</div>
          <div class="shift-value">${machine.shiftB}%</div>
        </div>
        <div class="shift-item">
          <div class="shift-label">Shift C</div>
          <div class="shift-value">${machine.shiftC}%</div>
        </div>
      </div>
      
      <div style="margin-top: 12px; font-size: 10px; color: #9aa6c0;">
        ${machine.editor || 'Unknown'} · ${timestamp}
      </div>
    `
    
    card.style.cursor = 'pointer'
    card.addEventListener('click', () => {
      if (window.efficiencySystem) {
        window.efficiencySystem.openEfficiencyModal(machine.id)
      }
    })
    
    grid.appendChild(card)
  })
}

function updateBlockSummary() {
  const dateFilter = document.getElementById('date-filter')
  const date = dateFilter ? dateFilter.value : new Date().toISOString().split('T')[0]
  
  if (!window.efficiencySystem) return
  
  const blockA = window.efficiencySystem.getBlockEfficiency('A', date)
  const blockB = window.efficiencySystem.getBlockEfficiency('B', date)
  const blockC = window.efficiencySystem.getBlockEfficiency('C', date)
  const blockD = window.efficiencySystem.getBlockEfficiency('D', date)
  
  const elA = document.getElementById('block-a-eff')
  const elB = document.getElementById('block-b-eff')
  const elC = document.getElementById('block-c-eff')
  const elD = document.getElementById('block-d-eff')
  
  if (elA) elA.textContent = blockA + '%'
  if (elB) elB.textContent = blockB + '%'
  if (elC) elC.textContent = blockC + '%'
  if (elD) elD.textContent = blockD + '%'
}

function updateTrendChart() {
  const canvas = document.getElementById('efficiency-trend-chart')
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  
  if (!window.globalEfficiencySystem) return
  
  const dateLabels = []
  const globalEfficiency = []

  for (let i = 29; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    
    dateLabels.push(
      date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    )
    
    const globalData = window.globalEfficiencySystem.getGlobalEfficiency(dateStr)
    globalEfficiency.push(globalData ? globalData.global : 0)
  }
  
  if (window.trendChart) {
    window.trendChart.destroy()
  }
  
  if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels)
  }
  
  window.trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dateLabels,
      datasets: [{
        label: 'Efisiensi Global (%)',
        data: globalEfficiency,
        borderColor: '#ffd166',
        backgroundColor: 'rgba(255, 209, 102, 0.1)',
        tension: 0,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#cbd5e1', font: { size: 13 } }
        },
        datalabels: typeof ChartDataLabels !== 'undefined' ? {
          display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
          color: '#ffd166',
          font: { weight: 'bold', size: 11 },
          formatter: (val) => val > 0 ? val + '%' : '',
          anchor: 'end',
          align: 'top',
          offset: 6,
          rotation: -45
        } : false
      },
      scales: {
        x: {
          ticks: { color: '#cbd5e1', maxRotation: 45, minRotation: 45, font: { size: 10 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { 
            color: '#cbd5e1', 
            font: { size: 11 },
            callback: (val) => val + '%'
          },
          grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }
        }
      }
    }
  })
}

function updateBlockChart() {
  const canvas = document.getElementById('block-efficiency-chart')
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  const dateFilter = document.getElementById('date-filter')
  const date = dateFilter ? dateFilter.value : new Date().toISOString().split('T')[0]
  
  if (!window.efficiencySystem) return
  
  const blockEfficiency = {
    'Blok A': window.efficiencySystem.getBlockEfficiency('A', date),
    'Blok B': window.efficiencySystem.getBlockEfficiency('B', date),
    'Blok C': window.efficiencySystem.getBlockEfficiency('C', date),
    'Blok D': window.efficiencySystem.getBlockEfficiency('D', date)
  }
  
  if (window.blockChart) {
    window.blockChart.destroy()
  }
  
  if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels)
  }
  
  window.blockChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(blockEfficiency),
      datasets: [{
        label: 'Efisiensi (%)',
        data: Object.values(blockEfficiency),
        backgroundColor: ['#ff6ec7', '#7c5cff', '#00ffe1', '#ffd166']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        datalabels: typeof ChartDataLabels !== 'undefined' ? {
          display: true,
          color: '#fff',
          font: { weight: 'bold', size: 14 },
          formatter: (val) => val > 0 ? val + '%' : '0%',
          anchor: 'end',
          align: 'top',
          offset: 2
        } : false
      },
      scales: {
        x: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
        y: { beginAtZero: true, max: 100, ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
      }
    }
  })
}

function updateClock() {
  const el = document.getElementById('clock')
  const de = document.getElementById('date')
  if (!el) return
  
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  el.textContent = `${hh}:${mm}:${ss}`
  
  if (de) {
    de.textContent = now.toLocaleDateString('id-ID', { 
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
    })
  }
}

function showToast(text, type = '') {
  let root = document.querySelector('.toast-root')
  if (!root) {
    root = document.createElement('div')
    root.className = 'toast-root'
    root.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:8px'
    document.body.appendChild(root)
  }
  
  const toast = document.createElement('div')
  toast.className = 'toast' + (type ? ' ' + type : '')
  toast.style.cssText = `
    padding:12px 20px;
    background:rgba(15,23,42,0.95);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:8px;
    color:#fff;
    font-size:13px;
    box-shadow:0 10px 30px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease-out;
  `
  
  if (type === 'success') {
    toast.style.borderColor = 'rgba(34,197,94,0.3)'
    toast.style.background = 'rgba(34,197,94,0.1)'
  } else if (type === 'warn') {
    toast.style.borderColor = 'rgba(251,146,60,0.3)'
    toast.style.background = 'rgba(251,146,60,0.1)'
  }
  
  toast.textContent = text
  root.appendChild(toast)
  
  setTimeout(() => {
    toast.style.transition = 'opacity .3s, transform .3s'
    toast.style.opacity = '0'
    toast.style.transform = 'translateX(20px)'
    setTimeout(() => toast.remove(), 350)
  }, 3500)
}

// ✅ REAL-TIME with debounce
let updateTimeout = null

function setupEfficiencyRealtime() {
  if (!window.isCloudAvailable || typeof setupEfficiencyRealtimeListener === 'undefined') {
    console.warn('⚠️ Real-time unavailable')
    return
  }
  
  console.log('🔄 Real-time active')
  
  setupEfficiencyRealtimeListener(
    (newEffData) => {
      // ✅ CEK: Kalau loading overlay masih ada, SKIP!
      const overlay = document.getElementById('import-loading-overlay')
      if (overlay && overlay.style.display !== 'none') {
        console.log('⏸️ Loading overlay active, skip update')
        return
      }
      
      clearTimeout(updateTimeout)
      updateTimeout = setTimeout(() => {
        console.log('📡 Efficiency updated from cloud')
        
        if (window.efficiencySystem) {
          window.efficiencySystem.efficiencyData = newEffData
          localStorage.setItem('machine_efficiency_v2', JSON.stringify(newEffData))
          
          // ✅ SYNC cloud data to internal system
          if (typeof window.efficiencySystem.syncCloudDataToLocal === 'function') {
            window.efficiencySystem.syncCloudDataToLocal()
          }
          
          renderEfficiencyGrid()
          updateBlockSummary()
          updateBlockChart()
          
          showToast('🔄 Data diperbarui', 'success')
        }
      }, 2000)
    },
    (newGlobalData) => {
      // ✅ CEK: Kalau loading overlay masih ada, SKIP!
      const overlay = document.getElementById('import-loading-overlay')
      if (overlay && overlay.style.display !== 'none') {
        console.log('⏸️ Loading overlay active, skip update')
        return
      }
      
      clearTimeout(updateTimeout)
      updateTimeout = setTimeout(() => {
        console.log('📡 Global updated')
        
        if (window.globalEfficiencySystem) {
          window.globalEfficiencySystem.globalEfficiencyData = newGlobalData
          localStorage.setItem('global_efficiency_v1', JSON.stringify(newGlobalData))
          
          updateTrendChart()
          
          showToast('🔄 Global diperbarui', 'success')
        }
      }, 2000)
    }
  )
}

// ✅ LOADING OVERLAY dengan Progress Bar (OPTIMIZED - NO LAG)
let lastProgressUpdate = 0
const PROGRESS_UPDATE_THROTTLE = 100 // Update max 10x per detik

function showLoadingOverlay(message, showProgress = false) {
  let overlay = document.getElementById('import-loading-overlay')
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = 'import-loading-overlay'
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(8px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      will-change: opacity;
    `
    overlay.innerHTML = `
      <div id="loading-icon" style="margin-bottom: 24px; font-size: 64px; will-change: transform;">⏳</div>
      <div id="loading-message" style="font-size: 18px; margin-bottom: 12px;">${message}</div>
      <div id="loading-submessage" style="font-size: 13px; color: #9aa6c0; margin-bottom: 24px;">Mohon tunggu...</div>
      
      <div id="progress-container-indeterminate" style="width: 300px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; margin-bottom: 8px;">
        <div style="height: 100%; background: linear-gradient(90deg, #ffd166, #ff6ec7, #7c5cff); will-change: transform;"></div>
      </div>
      
      <div id="progress-container-determinate" style="display: none; width: 300px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; color: #cbd5e1;">
          <span id="progress-text">0%</span>
          <span id="progress-count">0 / 0</span>
        </div>
        <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; position: relative;">
          <div id="progress-bar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #34d399, #60a5fa); border-radius: 3px; will-change: width;"></div>
        </div>
      </div>
      
      <div id="loading-tip" style="font-size: 11px; color: #64748b; margin-top: 16px; text-align: center; max-width: 320px; line-height: 1.6;">
        💡 Tip: Jangan tutup browser selama proses berlangsung
      </div>
      
      <style>
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        #progress-container-indeterminate > div {
          animation: slide 1.5s ease-in-out infinite;
        }
        #loading-icon {
          animation: bounce 1.5s ease-in-out infinite;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(10deg); }
        }
      </style>
    `
    document.body.appendChild(overlay)
  } else {
    overlay.style.display = 'flex'
    const messageEl = document.getElementById('loading-message')
    if (messageEl) messageEl.textContent = message
  }
  
  const indeterminate = document.getElementById('progress-container-indeterminate')
  const determinate = document.getElementById('progress-container-determinate')
  
  if (showProgress) {
    if (indeterminate) indeterminate.style.display = 'none'
    if (determinate) determinate.style.display = 'block'
  } else {
    if (indeterminate) indeterminate.style.display = 'block'
    if (determinate) determinate.style.display = 'none'
  }
}

function updateLoadingOverlay(message, submessage = '') {
  const now = Date.now()
  if (now - lastProgressUpdate < PROGRESS_UPDATE_THROTTLE) {
    return
  }
  lastProgressUpdate = now
  
  requestAnimationFrame(() => {
    const messageEl = document.getElementById('loading-message')
    const submessageEl = document.getElementById('loading-submessage')
    
    if (messageEl) messageEl.textContent = message
    if (submessageEl) submessageEl.textContent = submessage || 'Mohon tunggu...'
  })
}

function updateLoadingProgress(current, total) {
  const now = Date.now()
  if (now - lastProgressUpdate < PROGRESS_UPDATE_THROTTLE) {
    return
  }
  lastProgressUpdate = now
  
  requestAnimationFrame(() => {
    const progressBar = document.getElementById('progress-bar')
    const progressText = document.getElementById('progress-text')
    const progressCount = document.getElementById('progress-count')
    
    if (!progressBar || !progressText || !progressCount) return
    
    const percentage = Math.round((current / total) * 100)
    
    progressBar.style.width = percentage + '%'
    progressText.textContent = percentage + '%'
    progressCount.textContent = `${current} / ${total}`
    
    const icon = document.getElementById('loading-icon')
    if (icon) {
      if (percentage < 30) icon.textContent = '📥'
      else if (percentage < 60) icon.textContent = '⚙️'
      else if (percentage < 90) icon.textContent = '☁️'
      else icon.textContent = '✨'
    }
  })
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('import-loading-overlay')
  if (overlay) {
    overlay.style.transition = 'opacity 0.3s ease'
    overlay.style.opacity = '0'
    setTimeout(() => {
      overlay.style.display = 'none'
      overlay.style.opacity = '1'
    }, 300)
  }
}

async function progressiveRender() {
  console.log('🎨 Progressive render starting...')
  
  showLoadingOverlay('🎨 Rendering UI...', true)
  
  // ✅ SYNC cloud data to internal system first
  if (window.efficiencySystem && typeof window.efficiencySystem.syncCloudDataToLocal === 'function') {
    console.log('🔗 Syncing cloud data to internal system...')
    window.efficiencySystem.syncCloudDataToLocal()
  }
  
  const steps = [
    { name: 'Block Summary', fn: updateBlockSummary },
    { name: 'Trend Chart', fn: updateTrendChart },
    { name: 'Block Chart', fn: updateBlockChart },
    { name: 'Efficiency Grid', fn: renderEfficiencyGrid }
  ]
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    
    updateLoadingOverlay(
      `🎨 Rendering ${step.name}...`,
      `Step ${i + 1}/${steps.length}`
    )
    
    updateLoadingProgress(i, steps.length)
    
    console.log(`🎨 Rendering ${step.name}...`)
    
    await new Promise(resolve => requestAnimationFrame(resolve))
    
    try {
      step.fn()
    } catch (e) {
      console.error(`❌ Error rendering ${step.name}:`, e)
    }
    
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  updateLoadingProgress(steps.length, steps.length)
  
  await new Promise(resolve => setTimeout(resolve, 200))
  hideLoadingOverlay()
  
  console.log('✅ Progressive render complete')
}

// ✅ EVENT LISTENERS
function attachEventListeners() {
  const dateFilter = document.getElementById('date-filter')
  if (dateFilter) {
    dateFilter.value = new Date().toISOString().split('T')[0]
    dateFilter.addEventListener('change', () => {
      renderEfficiencyGrid()
      updateBlockSummary()
      updateBlockChart()
    })
  }
  
  const blockFilter = document.getElementById('block-filter')
  if (blockFilter) {
    blockFilter.addEventListener('change', renderEfficiencyGrid)
  }
  
  const sortFilter = document.getElementById('sort-filter')
  if (sortFilter) {
    sortFilter.addEventListener('change', renderEfficiencyGrid)
  }
  
  const importMachineBtn = document.getElementById('import-efficiency')
  if (importMachineBtn) {
    importMachineBtn.addEventListener('click', () => {
      document.getElementById('efficiency-machine-file-input')?.click()
    })
  }

  const importGlobalBtn = document.getElementById('import-efficiency-global')
  if (importGlobalBtn) {
    importGlobalBtn.addEventListener('click', () => {
      document.getElementById('efficiency-global-file-input')?.click()
    })
  }

  const machineFileInput = document.getElementById('efficiency-machine-file-input')
  if (machineFileInput) {
    machineFileInput.addEventListener('change', async (e) => {
      if (e.target.files[0]) {
        try {
          if (!window.efficiencySystem) throw new Error('System not loaded')
          
          // ✅ DISABLE UI selama import
          const importBtn = document.getElementById('import-efficiency')
          const syncBtn = document.getElementById('manual-sync-btn')
          if (importBtn) importBtn.disabled = true
          if (syncBtn) syncBtn.disabled = true
          
          // ✅ STEP 1: Show loading (indeterminate)
          showLoadingOverlay('📂 Reading Excel file...')
          
          // ✅ Small delay for visual feedback
          await new Promise(resolve => setTimeout(resolve, 300))
          
          // ✅ STEP 2: Import Excel (background process)
          updateLoadingOverlay('📥 Importing data...', 'Processing Excel sheets...')
          const result = await window.efficiencySystem.importEfficiencyFromExcel(e.target.files[0])
          
          // ✅ STEP 3: Cloud sync notification (happens in background)
          updateLoadingOverlay('☁️ Syncing to cloud...', 'Please wait...')
          showLoadingOverlay('☁️ Syncing to cloud...', true) // Enable progress bar
          
          // Wait for cloud sync (progress updates automatically via supabase_sync)
          await new Promise(resolve => setTimeout(resolve, 1500))
          
          // ✅ STEP 4: Success message
          updateLoadingOverlay('✅ Import Complete!', `${result.imported} records saved`)
          await new Promise(resolve => setTimeout(resolve, 800))
          
          // ✅ STEP 5: Progressive render (smooth, no lag)
          await progressiveRender()
          
          hideLoadingOverlay()
          showToast(`✅ ${result.imported} records imported & synced!`, 'success')
          
          // ✅ Re-enable UI
          if (importBtn) importBtn.disabled = false
          if (syncBtn) syncBtn.disabled = false
          
          e.target.value = ''
          
        } catch (error) {
          hideLoadingOverlay()
          console.error('Import error:', error)
          showToast('❌ Import failed: ' + error.message, 'warn')
          
          // Re-enable UI on error
          const importBtn = document.getElementById('import-efficiency')
          const syncBtn = document.getElementById('manual-sync-btn')
          if (importBtn) importBtn.disabled = false
          if (syncBtn) syncBtn.disabled = false
        }
      }
    })
  }

  const globalFileInput = document.getElementById('efficiency-global-file-input')
  if (globalFileInput) {
    globalFileInput.addEventListener('change', async (e) => {
      if (e.target.files[0]) {
        try {
          if (!window.globalEfficiencySystem) throw new Error('Global system not loaded')
          window.importInProgress = true
          showToast('📥 Importing global data...', 'success')
          const result = await window.globalEfficiencySystem.importGlobalEfficiencyFromExcel(e.target.files[0])
          window.importInProgress = false
          showToast(`✅ ${result.imported} global records imported!`, 'success')
          updateTrendChart()
          e.target.value = ''
        } catch (error) {
          window.importInProgress = false
          console.error('Import error:', error)
          showToast('❌ Import failed: ' + error.message, 'warn')
        }
      }
    })
  }

  const exportBtn = document.getElementById('export-efficiency')
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        const success = await window.efficiencySystem.exportEfficiencyToExcel()
        showToast(success ? '✅ Export berhasil' : '❌ Export gagal', success ? 'success' : 'warn')
      } catch (error) {
        showToast('❌ Export failed', 'warn')
      }
    })
  }
   
  const manualSyncBtn = document.getElementById('manual-sync-btn')
  if (manualSyncBtn) {
    manualSyncBtn.addEventListener('click', async () => {
      if (isLoading) {
        showToast('⏳ Masih loading', 'warn')
        return
      }
      
      manualSyncBtn.disabled = true
      manualSyncBtn.innerHTML = '🔄 Syncing...'
      
      try {
        // ✅ Show loading overlay
        showLoadingOverlay('🔄 Syncing from cloud...', true)
        
        // ✅ Step 1: Load efficiency data
        updateLoadingOverlay('📥 Loading machine efficiency...', 'Step 1/3')
        updateLoadingProgress(1, 3)
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const success = await loadAllEfficiencyData(true)
        
        if (success) {
          // ✅ Step 2: Load global data
          updateLoadingOverlay('📥 Loading global efficiency...', 'Step 2/3')
          updateLoadingProgress(2, 3)
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // ✅ Step 3: Update UI
          updateLoadingOverlay('🎨 Updating UI...', 'Step 3/3')
          updateLoadingProgress(3, 3)
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Progressive render
          await progressiveRender()
          
          // ✅ Show success info
          const machineCount = Object.keys(window.efficiencySystem?.efficiencyData || {}).length
          const dateCount = Object.keys(window.globalEfficiencySystem?.globalEfficiencyData || {}).length
          
          hideLoadingOverlay()
          showToast(`✅ Synced: ${machineCount} machines, ${dateCount} dates`, 'success')
        } else {
          hideLoadingOverlay()
          showToast('❌ Sync failed - check console', 'warn')
        }
      } catch (error) {
        hideLoadingOverlay()
        console.error('Sync error:', error)
        showToast('❌ Sync error: ' + error.message, 'warn')
      } finally {
        manualSyncBtn.disabled = false
        manualSyncBtn.innerHTML = '🔄 Sync Data'
      }
    })
  }
}

// ✅ INITIALIZATION - Load data on every focus
async function initialize() {
  console.log('🚀 Initializing...')
  
  // Wait for systems
  let attempts = 0
  while (attempts < 10) {
    if (window.efficiencySystem && window.globalEfficiencySystem) {
      console.log('✅ Systems ready')
      break
    }
    await new Promise(resolve => setTimeout(resolve, 500))
    attempts++
  }
  
  if (!window.efficiencySystem) {
    console.error('❌ System not loaded')
    return
  }
  
  // ✅ STEP 1: Setup Supabase (if available)
  if (typeof supabaseInit !== 'undefined') {
    const ready = await supabaseInit()
    window.isCloudAvailable = ready
    console.log('☁️ Cloud:', ready ? 'Ready' : 'Offline')
    
    if (ready) {
      // ✅ STEP 2: Load data ONCE
      await loadAllEfficiencyData()
      
      // ✅ STEP 2b: Sync cloud data to internal system
      if (window.efficiencySystem && typeof window.efficiencySystem.syncCloudDataToLocal === 'function') {
        console.log('🔗 Syncing cloud data to internal system...')
        window.efficiencySystem.syncCloudDataToLocal()
      }
      
      // ✅ STEP 3: Setup real-time listener
      setupEfficiencyRealtime()
    }
  }
  
  // ✅ STEP 4: Render UI
  attachEventListeners()
  renderEfficiencyGrid()
  updateBlockSummary()
  updateTrendChart()
  updateBlockChart()
  updateClock()
  
  console.log('✅ Initialized')
}

// ✅ AUTO-RELOAD when switching devices (detect page visibility)
document.addEventListener('visibilitychange', async () => {
  if (!document.hidden) {
    // Page became visible
    const now = Date.now()
    
    // Reload data if enough time has passed
    if (now - lastFocusTime > FOCUS_RELOAD_COOLDOWN) {
      console.log('🔄 Page focused, reloading data...')
      lastFocusTime = now
      
      // Force reload from cloud
      const success = await loadAllEfficiencyData(true)
      
      if (success) {
        console.log('✅ Data refreshed from cloud')
        renderEfficiencyGrid()
        updateBlockSummary()
        updateTrendChart()
        updateBlockChart()
        showToast('🔄 Data refreshed', 'success')
      }
    }
  }
})

// Also reload on window focus
window.addEventListener('focus', async () => {
  const now = Date.now()
  
  if (now - lastFocusTime > FOCUS_RELOAD_COOLDOWN) {
    console.log('🔄 Window focused, reloading data...')
    lastFocusTime = now
    
    // Force reload from cloud (non-blocking)
    loadAllEfficiencyData(true).then(success => {
      if (success) {
        console.log('✅ Data refreshed from cloud')
        renderEfficiencyGrid()
        updateBlockSummary()
        updateTrendChart()
        updateBlockChart()
        showToast('🔄 Data tersinkron', 'success')
      }
    })
  }
})

// Run once
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  initialize()
}

setInterval(updateClock, 1000)

window.efficiencyPage = {
  renderEfficiencyGrid,
  updateBlockSummary,
  updateTrendChart,
  updateBlockChart,
  loadAllEfficiencyData
}

console.log('✅ Efficiency page loaded (FINAL FIX)')
