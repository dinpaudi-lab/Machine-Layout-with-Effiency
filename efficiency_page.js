// ============ EFFICIENCY PAGE LOGIC - AUTO LOAD FROM CLOUD ============
// Menampilkan dan mengelola data efisiensi

// ✅ FORCE INIT SUPABASE & LOAD DATA IMMEDIATELY
(async () => {
  if (typeof supabaseInit !== 'undefined') {
    console.log('🔧 Auto-initializing Supabase...')
    const ready = await supabaseInit()
    window.isCloudAvailable = ready
    console.log('☁️ Cloud status:', ready ? '✅ Ready' : '❌ Offline')
    
    if (ready) {
      // ✅ LOAD EFFICIENCY DATA FROM CLOUD
      console.log('📥 Loading efficiency data from cloud...')
      if (typeof loadEfficiencyFromCloud !== 'undefined') {
        try {
          const cloudData = await loadEfficiencyFromCloud()
          if (cloudData && Object.keys(cloudData).length > 0) {
            console.log('✅ Loaded efficiency from cloud:', Object.keys(cloudData).length, 'machines')
            
            if (window.efficiencySystem) {
              window.efficiencySystem.efficiencyData = cloudData
              window.efficiencySystem.saveEfficiencyData() // Save to localStorage
            }
          } else {
            console.log('ℹ️ No cloud data, using local')
          }
        } catch (e) {
          console.error('❌ Failed to load efficiency from cloud:', e)
        }
      }
      
      // ✅ LOAD GLOBAL EFFICIENCY FROM CLOUD
      console.log('📥 Loading global efficiency from cloud...')
      if (typeof loadGlobalEfficiencyFromCloud !== 'undefined') {
        try {
          const globalData = await loadGlobalEfficiencyFromCloud()
          if (globalData && Object.keys(globalData).length > 0) {
            console.log('✅ Loaded global from cloud:', Object.keys(globalData).length, 'dates')
            
            if (window.globalEfficiencySystem) {
              window.globalEfficiencySystem.globalEfficiencyData = globalData
              window.globalEfficiencySystem.saveGlobalEfficiency() // Save to localStorage
            }
          } else {
            console.log('ℹ️ No global cloud data, using local')
          }
        } catch (e) {
          console.error('❌ Failed to load global from cloud:', e)
        }
      }
    }
  }
})()

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

let trendChart = null
let blockChart = null

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

// ============ RENDER FUNCTIONS ============

function renderEfficiencyGrid() {
  const grid = document.getElementById('efficiency-grid')
  const dateFilter = document.getElementById('date-filter')
  const blockFilter = document.getElementById('block-filter')
  const sortFilter = document.getElementById('sort-filter')
  
  if (!grid) {
    console.error('efficiency-grid element not found')
    return
  }
  
  const date = dateFilter ? dateFilter.value : new Date().toISOString().split('T')[0]
  
  if (!window.efficiencySystem) {
    console.error('Efficiency system not loaded')
    grid.innerHTML = '<div class="no-data">❌ Efficiency system not loaded</div>'
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
    grid.innerHTML = `<div class="no-data">Tidak ada data efisiensi untuk tanggal ${date}.</div>`
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
  
  if (!window.efficiencySystem) {
    console.error('Efficiency system not loaded')
    return
  }
  
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
  
  if (!window.globalEfficiencySystem) {
    console.error('Global efficiency system not loaded')
    return
  }
  
  const dateLabels = []
  const globalEfficiency = []

  // Get last 30 days
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
  
  if (trendChart) {
    trendChart.destroy()
  }
  
  if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels)
  }
  
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dateLabels,
      datasets: [{
        label: 'Efisiensi Global Pabrik (%)',
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
          labels: { 
            color: '#cbd5e1',
            font: { size: 13 }
          }
        },
        datalabels: typeof ChartDataLabels !== 'undefined' ? {
          display: function(context) {
            return context.dataset.data[context.dataIndex] > 0
          },
          color: '#ffd166',
          font: {
            weight: 'bold',
            size: 11
          },
          formatter: function(value) {
            return value > 0 ? value + '%' : ''
          },
          anchor: 'end',
          align: 'top',
          offset: 6,
          rotation: -45
        } : false,
        tooltip: {
          callbacks: {
            title: function(context) {
              const index = context[0].dataIndex
              const date = new Date()
              date.setDate(date.getDate() - (29 - index))
              return date.toLocaleDateString('id-ID', { 
                weekday: 'long',
                day: 'numeric', 
                month: 'long',
                year: 'numeric'
              })
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { 
            color: '#cbd5e1',
            maxRotation: 45,
            minRotation: 45,
            font: { size: 10 }
          },
          grid: { 
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { 
            color: '#cbd5e1',
            font: { size: 11 },
            callback: function(value) {
              return value + '%'
            }
          },
          grid: { 
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          }
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
  
  if (!window.efficiencySystem) {
    console.error('Efficiency system not loaded')
    return
  }
  
  const blockEfficiency = {
    'Blok A': window.efficiencySystem.getBlockEfficiency('A', date),
    'Blok B': window.efficiencySystem.getBlockEfficiency('B', date),
    'Blok C': window.efficiencySystem.getBlockEfficiency('C', date),
    'Blok D': window.efficiencySystem.getBlockEfficiency('D', date)
  }
  
  if (blockChart) {
    blockChart.destroy()
  }
  
  if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels)
  }
  
  blockChart = new Chart(ctx, {
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
          font: {
            weight: 'bold',
            size: 14
          },
          formatter: function(value) {
            return value > 0 ? value + '%' : '0%'
          },
          anchor: 'end',
          align: 'top',
          offset: 2
        } : false
      },
      scales: {
        x: {
          ticks: { color: '#cbd5e1' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { color: '#cbd5e1' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
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

// ============ EVENT LISTENERS ============

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
      const fileInput = document.getElementById('efficiency-machine-file-input')
      if (fileInput) {
        fileInput.click()
      }
    })
  }

  const importGlobalBtn = document.getElementById('import-efficiency-global')
  if (importGlobalBtn) {
    importGlobalBtn.addEventListener('click', () => {
      const fileInput = document.getElementById('efficiency-global-file-input')
      if (fileInput) {
        fileInput.click()
      }
    })
  }

  const machineFileInput = document.getElementById('efficiency-machine-file-input')
  if (machineFileInput) {
    machineFileInput.addEventListener('change', async (e) => {
      if (e.target.files[0]) {
        try {
          if (!window.efficiencySystem) {
            throw new Error('Efficiency system not loaded')
          }
          
          const result = await window.efficiencySystem.importEfficiencyFromExcel(e.target.files[0])
          showToast(`✅ Imported ${result.imported} records from ${result.sheetsProcessed} sheets`, 'success')
          
          if (result.errors.length > 0) {
            console.warn('Import errors:', result.errors)
            showToast(`⚠️ ${result.errors.length} errors during import`, 'warn')
          }
          
          renderEfficiencyGrid()
          updateBlockSummary()
          updateTrendChart()
          updateBlockChart()
          
          e.target.value = ''
        } catch (error) {
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
          if (!window.globalEfficiencySystem) {
            throw new Error('Global efficiency system not loaded')
          }
          
          const result = await window.globalEfficiencySystem.importGlobalEfficiencyFromExcel(e.target.files[0])
          showToast(`✅ Imported ${result.imported} records from ${result.sheetsProcessed} sheets`, 'success')
          
          if (result.errors.length > 0) {
            console.warn('Import errors:', result.errors)
            showToast(`⚠️ ${result.errors.length} errors during import`, 'warn')
          }
          
          updateTrendChart()
          
          e.target.value = ''
        } catch (error) {
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
        if (success) {
          showToast('✅ Export berhasil', 'success')
        } else {
          showToast('❌ Export gagal', 'warn')
        }
      } catch (error) {
        console.error('Export error:', error)
        showToast('❌ Export failed', 'warn')
      }
    })
  }
   
  // Manual sync button - RELOAD FROM CLOUD
  const manualSyncBtn = document.getElementById('manual-sync-btn')
  if (manualSyncBtn) {
    manualSyncBtn.addEventListener('click', async () => {
      manualSyncBtn.disabled = true
      manualSyncBtn.innerHTML = '🔄 Loading...'
      
      console.log('🔄 Manual sync started...')
      
      try {
        // ✅ LOAD EFFICIENCY FROM CLOUD
        if (typeof loadEfficiencyFromCloud !== 'undefined' && window.isCloudAvailable) {
          const cloudData = await loadEfficiencyFromCloud()
          if (cloudData && Object.keys(cloudData).length > 0) {
            if (window.efficiencySystem) {
              window.efficiencySystem.efficiencyData = cloudData
              window.efficiencySystem.saveEfficiencyData()
            }
            showToast('✅ Efficiency data synced from cloud', 'success')
          } else {
            showToast('ℹ️ No cloud data available', 'warn')
          }
        }
        
        // ✅ LOAD GLOBAL FROM CLOUD
        if (typeof loadGlobalEfficiencyFromCloud !== 'undefined' && window.isCloudAvailable) {
          const globalData = await loadGlobalEfficiencyFromCloud()
          if (globalData && Object.keys(globalData).length > 0) {
            if (window.globalEfficiencySystem) {
              window.globalEfficiencySystem.globalEfficiencyData = globalData
              window.globalEfficiencySystem.saveGlobalEfficiency()
            }
            showToast('✅ Global data synced from cloud', 'success')
          }
        }
        
        // Refresh UI
        renderEfficiencyGrid()
        updateBlockSummary()
        updateBlockChart()
        updateTrendChart()
        
      } catch (e) {
        console.error('Sync error:', e)
        showToast('❌ Gagal sync: ' + e.message, 'warn')
      } finally {
        manualSyncBtn.disabled = false
        manualSyncBtn.innerHTML = '🔄 Sync Data'
      }
    })
  }
}

// ============ INITIALIZATION ============

async function initialize() {
  console.log('🚀 Initializing efficiency page...')
  
  // Wait for systems to be ready
  let attempts = 0
  while (attempts < 10) {
    if (window.efficiencySystem && window.globalEfficiencySystem) {
      console.log('✅ Systems ready')
      break
    }
    console.log(`⏳ Waiting for systems... (${attempts + 1}/10)`)
    await new Promise(resolve => setTimeout(resolve, 500))
    attempts++
  }
  
  if (!window.efficiencySystem) {
    console.error('❌ Efficiency system not loaded')
    const grid = document.getElementById('efficiency-grid')
    if (grid) {
      grid.innerHTML = '<div class="no-data">❌ Efficiency system not loaded. Please check console.</div>'
    }
    return
  }
  
  attachEventListeners()
  renderEfficiencyGrid()
  updateBlockSummary()
  updateTrendChart()
  updateBlockChart()
  updateClock()
  
  console.log('✅ Efficiency page initialized')
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  initialize()
}

setInterval(updateClock, 1000)

// Auto-refresh data every 30 seconds (optional)
setInterval(() => {
  if (window.isCloudAvailable) {
    console.log('🔄 Auto-refreshing data from cloud...')
    
    // Reload from cloud in background
    if (typeof loadEfficiencyFromCloud !== 'undefined') {
      loadEfficiencyFromCloud().then(cloudData => {
        if (cloudData && window.efficiencySystem) {
          window.efficiencySystem.efficiencyData = cloudData
          window.efficiencySystem.saveEfficiencyData()
          renderEfficiencyGrid()
          updateBlockSummary()
          updateBlockChart()
        }
      }).catch(e => console.warn('Auto-refresh failed:', e))
    }
    
    if (typeof loadGlobalEfficiencyFromCloud !== 'undefined') {
      loadGlobalEfficiencyFromCloud().then(globalData => {
        if (globalData && window.globalEfficiencySystem) {
          window.globalEfficiencySystem.globalEfficiencyData = globalData
          window.globalEfficiencySystem.saveGlobalEfficiency()
          updateTrendChart()
        }
      }).catch(e => console.warn('Auto-refresh global failed:', e))
    }
  }
}, 30000) // Every 30 seconds

window.efficiencyPage = {
  renderEfficiencyGrid,
  updateBlockSummary,
  updateTrendChart,
  updateBlockChart
}

console.log('✅ Efficiency page script loaded with auto-load from cloud')
