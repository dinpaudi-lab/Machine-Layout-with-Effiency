// ============ EFFICIENCY PAGE LOGIC - FINAL FIX ============
// Single load, no spam, smooth updates

let isLoading = false
let hasLoadedOnce = false // ← NEW: Track if already loaded
let lastLoadTime = 0
const LOAD_COOLDOWN = 5000

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

// ✅ THROTTLED LOAD - Only once per cooldown
async function loadAllEfficiencyData(force = false) {
  const now = Date.now()
  
  // Skip if already loaded (unless forced)
  if (hasLoadedOnce && !force) {
    console.log('ℹ️ Already loaded, skipping')
    return false
  }
  
  // Cooldown check
  if (isLoading || (now - lastLoadTime < LOAD_COOLDOWN)) {
    console.log('⏳ Cooldown active, skipping')
    return false
  }
  
  isLoading = true
  lastLoadTime = now
  
  try {
    console.log('📥 Loading from cloud...')
    
    // Load machine efficiency
    if (typeof loadEfficiencyFromCloud !== 'undefined') {
      const cloudData = await loadEfficiencyFromCloud()
      if (cloudData && Object.keys(cloudData).length > 0) {
        console.log('✅ Loaded', Object.keys(cloudData).length, 'machines')
        
        if (window.efficiencySystem) {
          window.efficiencySystem.efficiencyData = cloudData
          localStorage.setItem('machine_efficiency_v2', JSON.stringify(cloudData))
        }
      }
    }
    
    // Load global efficiency
    if (typeof loadGlobalEfficiencyFromCloud !== 'undefined') {
      const globalData = await loadGlobalEfficiencyFromCloud()
      if (globalData && Object.keys(globalData).length > 0) {
        console.log('✅ Loaded', Object.keys(globalData).length, 'dates')
        
        if (window.globalEfficiencySystem) {
          window.globalEfficiencySystem.globalEfficiencyData = globalData
          localStorage.setItem('global_efficiency_v1', JSON.stringify(globalData))
        }
      }
    }
    
    hasLoadedOnce = true
    return true
  } catch (e) {
    console.error('❌ Load error:', e.message)
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
      // CEK: Kalau lampu merah, STOP!
    if (window.importInProgress) {
      console.log('⏸️ Lagi import, skip update')
      return  // KELUAR, gak usah lanjut
    }
      clearTimeout(updateTimeout)
      updateTimeout = setTimeout(() => {
        console.log('📡 Efficiency updated')
        
        if (window.efficiencySystem) {
          window.efficiencySystem.efficiencyData = newEffData
          localStorage.setItem('machine_efficiency_v2', JSON.stringify(newEffData))
          
          renderEfficiencyGrid()
          updateBlockSummary()
          updateBlockChart()
          
          showToast('🔄 Data diperbarui', 'success')
        }
      }, 2000)
    },
    (newGlobalData) => {
      // CEK: Kalau lampu merah, STOP!
    if (window.importInProgress) {
      console.log('⏸️ Lagi import, skip update')
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
        
        // 🚫 STEP 1: Kasih tanda "lagi import, jangan render dulu"
        window.importInProgress = true
        
        // 🔄 STEP 2: Kasih loading message
        showToast('📥 Importing machine data...', 'success')
        
        // 📂 STEP 3: Import file (proses berat di sini)
        const result = await window.efficiencySystem.importEfficiencyFromExcel(e.target.files[0])
        
        // ✅ STEP 4: Import selesai, boleh render lagi
        window.importInProgress = false
        
        // 🎉 STEP 5: Kasih tau user sukses
        showToast(`✅ ${result.imported} machine records imported!`, 'success')
        
        // 🎨 STEP 6: RENDER UI SEKALI (bukan 1000x)
        renderEfficiencyGrid()
        updateBlockSummary()
        updateTrendChart()
        updateBlockChart()
        
        // 🧹 STEP 7: Reset file input
        e.target.value = ''
        
      } catch (error) {
        // ❌ Kalau error, matikan flag import juga
        window.importInProgress = false
        console.error('Import error:', error)
        showToast('❌ Import failed: ' + error.message, 'warn')
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
        
        // 🚫 Flag: lagi import global
        window.importInProgress = true
        
        // 🔄 Loading message
        showToast('📥 Importing global data...', 'success')
        
        // 📂 Import process
        const result = await window.globalEfficiencySystem.importGlobalEfficiencyFromExcel(e.target.files[0])
        
        // ✅ Import done
        window.importInProgress = false
        
        // 🎉 Success message
        showToast(`✅ ${result.imported} global records imported!`, 'success')
        
        // 🎨 Render UI SEKALI
        updateTrendChart()
        
        // 🧹 Reset
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
      manualSyncBtn.innerHTML = '🔄 Loading...'
      
      const success = await loadAllEfficiencyData(true) // force = true
      
      if (success) {
        renderEfficiencyGrid()
        updateBlockSummary()
        updateTrendChart()
        updateBlockChart()
        showToast('✅ Data refreshed', 'success')
      } else {
        showToast('❌ Sync failed', 'warn')
      }
      
      manualSyncBtn.disabled = false
      manualSyncBtn.innerHTML = '🔄 Sync Data'
    })
  }
}

// ✅ INITIALIZATION - Load ONCE
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
