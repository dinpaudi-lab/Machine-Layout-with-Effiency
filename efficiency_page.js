// ============ EFFICIENCY PAGE LOGIC - WITH SMART CACHE ============
// File: efficiency_page.js (REVISI TOTAL)

let isLoading = false
let hasLoadedOnce = false
let lastLoadTime = 0
const LOAD_COOLDOWN = 3000

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

// ✅ DETEKSI DEVICE
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

// ✅ LAZY LOAD DATE DATA (global function)
window.lazyLoadDateData = async function(date, force = false) {
  // Skip jika sudah ada di cache (kecuali force)
  if (window.dateCache && window.dateCache.hasDate(date) && !force) {
    console.log(`📅 ${date} already in cache, skipping`)
    return true
  }
  
  console.log(`📅 Loading data for: ${date}`)
  
  try {
    if (typeof supabase !== 'undefined' && window.isCloudAvailable) {
      const result = await supabase
        .from('efficiency')
        .select('*')
        .eq('date', date)
      
      if (result.data && result.data.length > 0) {
        const newData = {}
        
        result.data.forEach(eff => {
          if (!newData[eff.machine_id]) newData[eff.machine_id] = {}
          newData[eff.machine_id][date] = {
            shiftA: parseFloat(eff.shift_a),
            shiftB: parseFloat(eff.shift_b),
            shiftC: parseFloat(eff.shift_c),
            global: parseFloat(eff.global_efficiency),
            editor: eff.editor,
            timestamp: eff.timestamp
          }
        })
        
        // Merge dengan existing data
        mergeDataIntoGlobal(newData)
        
        // Mark date as cached
        if (window.dateCache) {
          window.dateCache.markDateAsCached(date)
        }
        
        console.log(`✅ Loaded ${result.data.length} records for ${date}`)
        return true
      } else {
        console.log(`📭 No data found for ${date}`)
        // Still mark as cached (even if empty) to avoid re-checking
        if (window.dateCache) {
          window.dateCache.markDateAsCached(date)
        }
        return false
      }
    }
    
    return false
  } catch (e) {
    console.error(`❌ Load error for ${date}:`, e)
    return false
  }
}

// ✅ MERGE DATA HELPER
function mergeDataIntoGlobal(newData) {
  if (!window.efficiencySystem) return
  
  const existing = window.efficiencySystem.efficiencyData || {}
  
  Object.keys(newData).forEach(machineId => {
    if (!existing[machineId]) {
      existing[machineId] = newData[machineId]
    } else {
      // Merge dates
      Object.keys(newData[machineId]).forEach(date => {
        existing[machineId][date] = newData[machineId][date]
      })
    }
  })
  
  window.efficiencySystem.efficiencyData = existing
}

// ✅ LOAD ALL EFFICIENCY DATA
async function loadAllEfficiencyData(force = false) {
  const now = Date.now()
  
  if (isLoading || (now - lastLoadTime < LOAD_COOLDOWN && !force)) {
    return false
  }
  
  isLoading = true
  lastLoadTime = now
  
  try {
    console.log('📱 Loading data...')
    
    // Load machine efficiency
    if (typeof loadEfficiencyFromCloud !== 'undefined') {
      const cloudData = await loadEfficiencyFromCloud()
      if (cloudData && Object.keys(cloudData).length > 0) {
        window.efficiencySystem.efficiencyData = cloudData
        localStorage.setItem('machine_efficiency_v2', JSON.stringify(cloudData))
        console.log('✅ Loaded', Object.keys(cloudData).length, 'machines')
      }
    }
    
    // Load global efficiency
    if (typeof loadGlobalEfficiencyFromCloud !== 'undefined') {
      const globalData = await loadGlobalEfficiencyFromCloud()
      if (globalData && Object.keys(globalData).length > 0) {
        window.globalEfficiencySystem.globalEfficiencyData = globalData
        localStorage.setItem('global_efficiency_v1', JSON.stringify(globalData))
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

// ✅ SETUP SMART DATE FILTER
function setupSmartDateFilter() {
  const dateFilter = document.getElementById('date-filter')
  if (!dateFilter) return
  
  // Set max date to today
  const today = new Date().toISOString().split('T')[0]
  dateFilter.max = today
  dateFilter.value = today
  
  // Load today's data on init
  window.lazyLoadDateData(today)
    .then(() => {
      // Prefetch dates around today
      if (window.dateCache) {
        const datesToPrefetch = window.dateCache.getDatesToPrefetch(today)
        window.dateCache.prefetchDates(datesToPrefetch)
      }
    })
  
  // Change event dengan cache management
  dateFilter.addEventListener('change', async () => {
    const selectedDate = dateFilter.value
    
    if (!selectedDate) return
    
    // Update UI immediately dengan data yang ada
    renderEfficiencyGrid()
    updateBlockSummary()
    updateBlockChart()
    
    // Check if we need to load data for this date
    if (!window.dateCache || !window.dateCache.hasDate(selectedDate)) {
      showToast(`📥 Loading data for ${selectedDate}...`, 'success')
      
      // Load data untuk tanggal yang dipilih
      const success = await window.lazyLoadDateData(selectedDate)
      
      if (success) {
        // Update UI dengan data baru
        renderEfficiencyGrid()
        updateBlockSummary()
        updateBlockChart()
        showToast(`✅ Data untuk ${selectedDate} loaded`, 'success')
      } else {
        showToast(`📭 Tidak ada data untuk ${selectedDate}`, 'warn')
      }
      
      // Prefetch dates around the selected date
      if (window.dateCache) {
        const datesToPrefetch = window.dateCache.getDatesToPrefetch(selectedDate)
        window.dateCache.prefetchDates(datesToPrefetch)
      }
    } else {
      console.log(`✅ ${selectedDate} already cached`)
    }
  })
  
  // Add date navigation buttons
  addDateNavigationButtons(dateFilter)
}

// ✅ DATE NAVIGATION BUTTONS
function addDateNavigationButtons(dateFilter) {
  const filterBar = document.querySelector('.filter-bar')
  if (!filterBar) return
  
  // Cek apakah buttons sudah ada
  if (document.getElementById('date-nav-container')) return
  
  const navContainer = document.createElement('div')
  navContainer.id = 'date-nav-container'
  navContainer.style.cssText = `
    display: flex;
    gap: 8px;
    align-items: center;
  `
  
  navContainer.innerHTML = `
    <button id="prev-date-btn" class="small-btn" style="padding: 4px 8px;">◀</button>
    <button id="next-date-btn" class="small-btn" style="padding: 4px 8px;">▶</button>
    <button id="today-btn" class="small-btn" style="padding: 4px 8px;">Hari Ini</button>
  `
  
  // Insert setelah filter bar
  filterBar.appendChild(navContainer)
  
  // Event listeners
  document.getElementById('prev-date-btn').addEventListener('click', () => {
    navigateDate(-1)
  })
  
  document.getElementById('next-date-btn').addEventListener('click', () => {
    navigateDate(1)
  })
  
  document.getElementById('today-btn').addEventListener('click', () => {
    const today = new Date().toISOString().split('T')[0]
    dateFilter.value = today
    dateFilter.dispatchEvent(new Event('change'))
  })
}

// ✅ DATE NAVIGATION
function navigateDate(delta) {
  const dateFilter = document.getElementById('date-filter')
  if (!dateFilter || !dateFilter.value) return
  
  const currentDate = new Date(dateFilter.value)
  currentDate.setDate(currentDate.getDate() + delta)
  
  const newDate = currentDate.toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]
  
  // Jangan navigate ke masa depan
  if (newDate > today) return
  
  dateFilter.value = newDate
  dateFilter.dispatchEvent(new Event('change'))
}

// ✅ RENDER EFFICIENCY GRID
function renderEfficiencyGrid() {
  const grid = document.getElementById('efficiency-grid')
  const dateFilter = document.getElementById('date-filter')
  const blockFilter = document.getElementById('block-filter')
  const sortFilter = document.getElementById('sort-filter')
  
  if (!grid) return
  
  const date = dateFilter ? dateFilter.value : new Date().toISOString().split('T')[0]
  
  if (!window.efficiencySystem) {
    grid.innerHTML = '<div class="no-data">❌ System belum di-load</div>'
    return
  }
  
  // Check cache status
  const isCached = window.dateCache ? window.dateCache.hasDate(date) : false
  
  const machinesWithData = []
  
  // Collect data untuk date tertentu
  Object.keys(window.efficiencySystem.efficiencyData || {}).forEach(machineId => {
    const machineData = window.efficiencySystem.efficiencyData[machineId]
    if (!machineData || !machineData[date]) return
    
    const eff = machineData[date]
    const block = getMachineBlock(parseInt(machineId))
    
    if (blockFilter && blockFilter.value && block !== blockFilter.value) return
    
    if (eff && eff.global > 0) {
      machinesWithData.push({
        id: parseInt(machineId),
        block: block,
        ...eff
      })
    }
  })
  
  if (machinesWithData.length === 0) {
    grid.innerHTML = `
      <div class="no-data">
        <div style="margin-bottom: 12px;">
          ${isCached ? '📭' : '⏳'} Tidak ada data untuk ${date}
        </div>
        
        ${!isCached ? `
          <button onclick="window.loadDateData('${date}')" 
                  class="chip" style="margin: 4px; background: rgba(52, 211, 153, 0.2);">
            📥 Load Data
          </button>
        ` : ''}
      </div>
    `
    return
  }
  
  // Sort data
  if (sortFilter && sortFilter.value === 'efficiency') {
    machinesWithData.sort((a, b) => b.global - a.global)
  } else if (sortFilter && sortFilter.value === 'efficiency-low') {
    machinesWithData.sort((a, b) => a.global - b.global)
  } else {
    machinesWithData.sort((a, b) => a.id - b.id)
  }
  
  // Clear grid
  grid.innerHTML = ''
  
  // Render data
  machinesWithData.forEach(machine => {
    const card = createEfficiencyCard(machine)
    grid.appendChild(card)
  })
  
  // Show cache info
  if (window.dateCache && isMobileDevice()) {
    showCacheInfo()
  }
}

// ✅ CREATE EFFICIENCY CARD
function createEfficiencyCard(machine) {
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
  
  return card
}

// ✅ LOAD DATE DATA (exposed for button)
window.loadDateData = async function(date) {
  const success = await window.lazyLoadDateData(date)
  
  if (success) {
    renderEfficiencyGrid()
    updateBlockSummary()
    updateBlockChart()
    showToast(`✅ Data untuk ${date} loaded`, 'success')
  } else {
    showToast(`📭 Tidak ada data untuk ${date}`, 'warn')
  }
}

// ✅ SHOW CACHE INFO
function showCacheInfo() {
  if (!window.dateCache) return
  
  const cacheInfo = document.getElementById('cache-info')
  if (!cacheInfo) {
    const infoDiv = document.createElement('div')
    infoDiv.id = 'cache-info'
    infoDiv.style.cssText = `
      font-size: 11px;
      color: #9aa6c0;
      margin: 8px 0;
      padding: 6px;
      background: rgba(255,255,255,0.05);
      border-radius: 6px;
      text-align: center;
    `
    const grid = document.getElementById('efficiency-grid')
    grid.parentElement.insertBefore(infoDiv, grid)
  }
  
  const cachedDates = window.dateCache.getCachedDates()
  document.getElementById('cache-info').innerHTML = `
    💾 ${cachedDates.length} dates cached | 
    Last sync: ${new Date().toLocaleTimeString()}
  `
}

// ✅ UPDATE BLOCK SUMMARY
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

// ✅ UPDATE TREND CHART
function updateTrendChart() {
  const canvas = document.getElementById('efficiency-trend-chart')
  if (!canvas || !window.globalEfficiencySystem) return
  
  const ctx = canvas.getContext('2d')
  
  const dateLabels = []
  const globalEfficiency = []
  
  // Last 30 days
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
  
  window.trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dateLabels,
      datasets: [{
        label: 'Efisiensi Global (%)',
        data: globalEfficiency,
        borderColor: '#ffd166',
        backgroundColor: 'rgba(255, 209, 102, 0.1)',
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: '#cbd5e1', maxRotation: 45, minRotation: 45, font: { size: 10 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { 
            color: '#cbd5e1',
            font: { size: 10 },
            callback: (val) => val + '%'
          },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  })
}

// ✅ UPDATE BLOCK CHART
function updateBlockChart() {
  const canvas = document.getElementById('block-efficiency-chart')
  if (!canvas || !window.efficiencySystem) return
  
  const ctx = canvas.getContext('2d')
  const dateFilter = document.getElementById('date-filter')
  const date = dateFilter ? dateFilter.value : new Date().toISOString().split('T')[0]
  
  const blockEfficiency = {
    'Blok A': window.efficiencySystem.getBlockEfficiency('A', date),
    'Blok B': window.efficiencySystem.getBlockEfficiency('B', date),
    'Blok C': window.efficiencySystem.getBlockEfficiency('C', date),
    'Blok D': window.efficiencySystem.getBlockEfficiency('D', date)
  }
  
  if (window.blockChart) {
    window.blockChart.destroy()
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
        legend: { display: false }
      },
      scales: {
        x: { 
          ticks: { color: '#cbd5e1', font: { size: 11 } }, 
          grid: { display: false } 
        },
        y: { 
          beginAtZero: true, 
          max: 100, 
          ticks: { 
            color: '#cbd5e1',
            callback: (val) => val + '%'
          }, 
          grid: { color: 'rgba(255, 255, 255, 0.05)' } 
        }
      }
    }
  })
}

// ✅ UPDATE CLOCK
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

// ✅ SHOW TOAST
function showToast(text, type = '', duration = 3000) {
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
  }, duration)
}

// ✅ ATTACH EVENT LISTENERS
function attachEventListeners() {
  // Smart date filter
  setupSmartDateFilter()
  
  // Block filter
  const blockFilter = document.getElementById('block-filter')
  if (blockFilter) {
    blockFilter.addEventListener('change', renderEfficiencyGrid)
  }
  
  // Sort filter
  const sortFilter = document.getElementById('sort-filter')
  if (sortFilter) {
    sortFilter.addEventListener('change', renderEfficiencyGrid)
  }
  
  // Import buttons
  const importBtn = document.getElementById('import-efficiency')
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      document.getElementById('efficiency-machine-file-input')?.click()
    })
  }
  
  const importGlobalBtn = document.getElementById('import-efficiency-global')
  if (importGlobalBtn) {
    importGlobalBtn.addEventListener('click', () => {
      document.getElementById('efficiency-global-file-input')?.click()
    })
  }
  
  // Sync button
  const syncBtn = document.getElementById('manual-sync-btn')
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true
      syncBtn.innerHTML = '🔄 Syncing...'
      
      try {
        // Clear cache
        if (window.dateCache) {
          window.dateCache.cache = {}
          localStorage.removeItem('date_cache_v1')
        }
        
        // Reload all data
        await loadAllEfficiencyData(true)
        
        // Reload current date
        const dateFilter = document.getElementById('date-filter')
        if (dateFilter && dateFilter.value) {
          await window.lazyLoadDateData(dateFilter.value, true)
        }
        
        // Update UI
        renderEfficiencyGrid()
        updateBlockSummary()
        updateTrendChart()
        updateBlockChart()
        
        showToast('✅ Cache refreshed!', 'success')
        
      } catch (error) {
        showToast('❌ Sync failed', 'warn')
        console.error('Sync error:', error)
      } finally {
        syncBtn.disabled = false
        syncBtn.innerHTML = '🔄 Sync Data'
      }
    })
  }
  
  // Export button
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
  
  // File inputs
  const machineFileInput = document.getElementById('efficiency-machine-file-input')
  if (machineFileInput) {
    machineFileInput.addEventListener('change', async (e) => {
      if (e.target.files[0]) {
        try {
          if (!window.efficiencySystem) throw new Error('System not loaded')
          
          const importBtn = document.getElementById('import-efficiency')
          const syncBtn = document.getElementById('manual-sync-btn')
          if (importBtn) importBtn.disabled = true
          if (syncBtn) syncBtn.disabled = true
          
          showToast('📥 Importing data...', 'success')
          
          const result = await window.efficiencySystem.importEfficiencyFromExcel(e.target.files[0])
          
          // Auto-sync setelah import
          setTimeout(async () => {
            await loadAllEfficiencyData(true)
            renderEfficiencyGrid()
            updateBlockSummary()
            updateTrendChart()
            updateBlockChart()
            
            showToast(`✅ ${result.imported} records imported!`, 'success')
          }, 1000)
          
          if (importBtn) importBtn.disabled = false
          if (syncBtn) syncBtn.disabled = false
          e.target.value = ''
          
        } catch (error) {
          console.error('Import error:', error)
          showToast('❌ Import failed: ' + error.message, 'warn')
        }
      }
    })
  }
}

// ✅ HELPER: GET MACHINE BLOCK
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

// ✅ INITIALIZE
async function initialize() {
  console.log('🚀 Initializing efficiency page...')
  
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
  
  // Setup cloud
  if (typeof supabaseInit !== 'undefined') {
    const ready = await supabaseInit()
    window.isCloudAvailable = ready
    console.log('☁️ Cloud:', ready ? 'Ready' : 'Offline')
    
    if (ready) {
      // Load initial data
      await loadAllEfficiencyData()
    }
  }
  
  // Setup event listeners
  attachEventListeners()
  
  // Initial render
  renderEfficiencyGrid()
  updateBlockSummary()
  updateTrendChart()
  updateBlockChart()
  updateClock()
  
  console.log('✅ Efficiency page initialized')
}

// Run on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  initialize()
}

// Update clock every second
setInterval(updateClock, 1000)
