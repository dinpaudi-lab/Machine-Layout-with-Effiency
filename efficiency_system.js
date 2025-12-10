// ============ EFFICIENCY MANAGEMENT SYSTEM - FIXED CLOUD SYNC ============
// Mengelola efisiensi mesin per shift (A, B, C)

const EFFICIENCY_KEY = 'machine_efficiency_v2'

// ============ CONFIGURATION ============
const MACHINE_CONFIG = {
  TOTAL_MACHINES: 640,
  OPERATIONAL_START: 1,
  OPERATIONAL_END: 600
}

function isMachineOperational(machineId) {
  return machineId >= MACHINE_CONFIG.OPERATIONAL_START && 
         machineId <= MACHINE_CONFIG.OPERATIONAL_END
}

let efficiencyData = {}

// ============ CLOUD SYNC HELPERS ============

// Ensure cloud is ready before operations
async function ensureCloudReady() {
  if (window.isCloudAvailable) return true
  
  if (typeof supabaseInit !== 'undefined') {
    console.log('🔧 Initializing cloud...')
    const ready = await supabaseInit()
    window.isCloudAvailable = ready
    return ready
  }
  
  return false
}

// Force sync with retry
async function forceSyncToCloud(data) {
  const MAX_RETRIES = 3
  let attempt = 0
  
  while (attempt < MAX_RETRIES) {
    try {
      attempt++
      console.log(`☁️ Sync attempt ${attempt}/${MAX_RETRIES}...`)
      
      const cloudReady = await ensureCloudReady()
      if (!cloudReady) {
        console.warn('⚠️ Cloud not available')
        return false
      }
      
      if (typeof saveEfficiencyToCloud !== 'undefined') {
        const success = await saveEfficiencyToCloud(data)
        if (success) {
          console.log('✅ Cloud sync successful')
          return true
        }
      }
      
      // Wait before retry
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    } catch (e) {
      console.error(`❌ Sync attempt ${attempt} failed:`, e)
    }
  }
  
  console.error('❌ All sync attempts failed')
  return false
}

// ============ LOAD & SAVE ============

function loadEfficiencyData() {
  try {
    const raw = localStorage.getItem(EFFICIENCY_KEY)
    if (raw) {
      efficiencyData = JSON.parse(raw)
      console.log('✅ Loaded efficiency data:', Object.keys(efficiencyData).length, 'machines')
      return efficiencyData
    }
  } catch (e) {
    console.error('❌ Error loading efficiency:', e)
  }
  efficiencyData = {}
  return efficiencyData
}

// ✅ NEW: Sync cloud data to local
function syncCloudDataToLocal() {
  if (window.efficiencySystem && window.efficiencySystem.efficiencyData) {
    const cloudData = window.efficiencySystem.efficiencyData
    
    // Merge cloud data dengan local
    Object.keys(cloudData).forEach(machineId => {
      if (!efficiencyData[machineId]) {
        efficiencyData[machineId] = {}
      }
      
      Object.keys(cloudData[machineId]).forEach(date => {
        // Cloud data has priority
        efficiencyData[machineId][date] = cloudData[machineId][date]
      })
    })
    
    // Save merged data to localStorage
    localStorage.setItem(EFFICIENCY_KEY, JSON.stringify(efficiencyData))
    console.log('✅ Cloud data synced to local:', Object.keys(efficiencyData).length, 'machines')
    return true
  }
  return false
}

async function saveEfficiencyData() {
  try {
    // 1. Save to localStorage first (fast)
    localStorage.setItem(EFFICIENCY_KEY, JSON.stringify(efficiencyData))
    console.log('💾 Efficiency saved to localStorage')
    
    // 2. Then sync to cloud (slow, non-blocking)
    const cloudReady = await ensureCloudReady()
    
    if (cloudReady && typeof saveEfficiencyToCloud !== 'undefined') {
      console.log('☁️ Starting cloud sync...')
      
      // Non-blocking cloud sync
      saveEfficiencyToCloud(efficiencyData)
        .then(() => {
          console.log('✅ Efficiency synced to cloud')
          if (typeof showToast !== 'undefined') {
            showToast('☁️ Data tersinkron ke cloud', 'success')
          }
        })
        .catch(e => {
          console.warn('⚠️ Cloud sync failed:', e)
          // Save as pending for later sync
          localStorage.setItem('pending_efficiency_sync', JSON.stringify({
            data: efficiencyData,
            timestamp: new Date().toISOString(),
            device: getDeviceId()
          }))
        })
    } else {
      console.warn('⚠️ Cloud not available, data saved locally')
    }
  } catch (e) {
    console.error('❌ Error saving efficiency:', e)
  }
}

// ============ EFFICIENCY OPERATIONS ============

function setMachineEfficiency(machineId, date, shiftA, shiftB, shiftC, editor) {
  if (!efficiencyData[machineId]) {
    efficiencyData[machineId] = {}
  }
  
  const shifts = [shiftA, shiftB, shiftC].filter(s => s !== null && s !== undefined && !isNaN(s) && s > 0)
  const global = shifts.length > 0 
    ? shifts.reduce((sum, val) => sum + val, 0) / shifts.length 
    : 0

  efficiencyData[machineId][date] = {
    shiftA: parseFloat(shiftA).toFixed(2),
    shiftB: parseFloat(shiftB).toFixed(2),
    shiftC: parseFloat(shiftC).toFixed(2),
    global: parseFloat(global).toFixed(2),
    timestamp: new Date().toISOString(),
    editor: editor || getCurrentUserId()
  }
  
  // Manual save only (no auto-save during import)
  
  console.log(`✏️ Set efficiency for machine ${machineId} on ${date}:`, efficiencyData[machineId][date])
  
  return efficiencyData[machineId][date]
}

function getMachineEfficiency(machineId, date) {
  const mId = String(machineId) // Normalize to string
  
  // Check local data first
  if (efficiencyData[mId] && efficiencyData[mId][date]) {
    const eff = efficiencyData[mId][date]
    // Ensure numeric values
    return {
      shiftA: parseFloat(eff.shiftA) || 0,
      shiftB: parseFloat(eff.shiftB) || 0,
      shiftC: parseFloat(eff.shiftC) || 0,
      global: parseFloat(eff.global) || 0,
      editor: eff.editor || 'unknown',
      timestamp: eff.timestamp || new Date().toISOString()
    }
  }
  
  // Fallback to window.efficiencySystem if available (from cloud load)
  if (window.efficiencySystem && window.efficiencySystem.efficiencyData) {
    const cloudData = window.efficiencySystem.efficiencyData
    if (cloudData[mId] && cloudData[mId][date]) {
      const eff = cloudData[mId][date]
      // Ensure numeric values
      return {
        shiftA: parseFloat(eff.shiftA) || 0,
        shiftB: parseFloat(eff.shiftB) || 0,
        shiftC: parseFloat(eff.shiftC) || 0,
        global: parseFloat(eff.global) || 0,
        editor: eff.editor || 'unknown',
        timestamp: eff.timestamp || new Date().toISOString()
      }
    }
  }
  
  return null
}

function getTodayEfficiency(machineId) {
  const today = new Date().toISOString().split('T')[0]
  return getMachineEfficiency(machineId, today)
}

function getAllMachineEfficiency(machineId) {
  return efficiencyData[machineId] || {}
}

function getBlockEfficiency(blockName, date) {
  const targetDate = date || new Date().toISOString().split('T')[0]
  const blockMachines = getMachinesInBlock(blockName)
  
  let totalGlobal = 0
  let operationalCount = 0
  
  blockMachines.forEach(machineId => {
    if (isMachineOperational(machineId)) {
      const eff = getMachineEfficiency(machineId, targetDate)
      totalGlobal += (eff && eff.global) ? parseFloat(eff.global) : 0
      operationalCount++
    }
  })
  
  return operationalCount > 0 ? parseFloat((totalGlobal / operationalCount).toFixed(2)) : 0
}

function getMachinesInBlock(blockName) {
  const machines = []
  const ranges = window.BLOCKS ? window.BLOCKS[blockName] : []
  
  if (!ranges) return machines
  
  ranges.forEach(range => {
    for (let i = range.start; i <= range.end; i++) {
      machines.push(i)
    }
  })
  
  return machines
}

function getMachinesWithEfficiency(date) {
  const targetDate = date || new Date().toISOString().split('T')[0]
  const machinesWithData = []
  
  Object.keys(efficiencyData).forEach(machineId => {
    const eff = getMachineEfficiency(machineId, targetDate)
    if (eff && eff.global > 0) {
      machinesWithData.push({
        id: parseInt(machineId),
        ...eff
      })
    }
  })
  
  return machinesWithData
}

// ============ BATCH IMPORT FROM EXCEL ============
async function importEfficiencyFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        
        let imported = 0
        
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName]
          const rows = XLSX.utils.sheet_to_json(sheet)
          
          rows.forEach(row => {
            if (row['Machine ID'] || row['Mesin']) {
              const machineId = row['Machine ID'] || row['Mesin']
              const date = row['Date'] || row['Tanggal'] || new Date().toISOString().split('T')[0]
              const shiftA = parseFloat(row['Shift A'] || row['Shift_A'] || 0)
              const shiftB = parseFloat(row['Shift B'] || row['Shift_B'] || 0)
              const shiftC = parseFloat(row['Shift C'] || row['Shift_C'] || 0)
              const editor = row['Editor'] || getCurrentUserId()
              
              setMachineEfficiency(machineId, date, shiftA, shiftB, shiftC, editor)
              imported++
            }
          })
        })
        
        if (imported > 0) {
          // Save to localStorage
          localStorage.setItem(EFFICIENCY_KEY, JSON.stringify(efficiencyData))
          console.log('💾 Saved', imported, 'records to localStorage')
          
          // ✅ STEP 3: FORCE SYNC TO CLOUD
          if (typeof window.isCloudAvailable !== 'undefined' && window.isCloudAvailable) {
            console.log('☁️ Force syncing to cloud...')
            
            const syncSuccess = await forceSyncToCloud(efficiencyData)
            
            if (syncSuccess) {
              console.log('✅✅✅ Data synced to cloud successfully!')
              if (typeof showToast !== 'undefined') {
                showToast(`✅ ${imported} data imported & synced to cloud`, 'success')
              }
            } else {
              console.error('❌ Cloud sync failed after import')
              if (typeof showToast !== 'undefined') {
                showToast('⚠️ Imported but cloud sync failed', 'warn')
              }
            }
          } else {
            console.warn('⚠️ Cloud not available')
            if (typeof showToast !== 'undefined') {
              showToast(`✅ ${imported} data imported locally`, 'success')
            }
          }
        }
        
        resolve({ imported, total: rows.length })
      } catch (error) {
        console.error('Import error:', error)
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsArrayBuffer(file)
  })
}

// ============ EXPORT TO EXCEL ============
async function exportEfficiencyToExcel() {
  try {
    if (Object.keys(efficiencyData).length === 0) {
      if (typeof showToast !== 'undefined') {
        showToast('❌ No data to export', 'warn')
      }
      return false
    }
    
    const exportData = []
    
    Object.keys(efficiencyData).forEach(machineId => {
      Object.keys(efficiencyData[machineId]).forEach(date => {
        const eff = efficiencyData[machineId][date]
        exportData.push({
          'Machine ID': machineId,
          'Date': date,
          'Shift A': eff.shiftA,
          'Shift B': eff.shiftB,
          'Shift C': eff.shiftC,
          'Global': eff.global,
          'Editor': eff.editor,
          'Timestamp': eff.timestamp
        })
      })
    })
    
    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Efficiency')
    
    const filename = `efficiency_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(workbook, filename)
    
    if (typeof showToast !== 'undefined') {
      showToast(`✅ Exported ${exportData.length} records`, 'success')
    }
    
    return true
  } catch (error) {
    console.error('Export error:', error)
    if (typeof showToast !== 'undefined') {
      showToast('❌ Export failed', 'warn')
    }
    return false
  }
}

// ============ MODAL OPERATIONS ============

function openEfficiencyModal(machineId) {
  const modal = document.getElementById('efficiency-modal')
  if (!modal) {
    console.error('Modal not found')
    return
  }
  
  const today = new Date().toISOString().split('T')[0]
  const eff = getMachineEfficiency(machineId, today) || {}
  
  document.getElementById('modal-machine-id').value = machineId
  document.getElementById('modal-date').value = today
  document.getElementById('modal-shift-a').value = eff.shiftA || ''
  document.getElementById('modal-shift-b').value = eff.shiftB || ''
  document.getElementById('modal-shift-c').value = eff.shiftC || ''
  
  modal.style.display = 'flex'
  modal.scrollIntoView({ behavior: 'smooth', block: 'center' })
  
  console.log('✅ Modal opened for machine', machineId)
}

function closeEfficiencyModal() {
  const modal = document.getElementById('efficiency-modal')
  if (modal) {
    modal.style.display = 'none'
  }
}

function saveEfficiencyFromModal() {
  const machineId = document.getElementById('modal-machine-id').value
  const date = document.getElementById('modal-date').value
  const shiftA = parseFloat(document.getElementById('modal-shift-a').value) || 0
  const shiftB = parseFloat(document.getElementById('modal-shift-b').value) || 0
  const shiftC = parseFloat(document.getElementById('modal-shift-c').value) || 0
  
  if (!machineId || !date) {
    if (typeof showToast !== 'undefined') {
      showToast('❌ Please fill machine ID and date', 'warn')
    }
    return
  }
  
  setMachineEfficiency(machineId, date, shiftA, shiftB, shiftC, getCurrentUserId())
  saveEfficiencyData()
  closeEfficiencyModal()
  
  if (typeof renderEfficiencyGrid !== 'undefined') {
    renderEfficiencyGrid()
  }
  if (typeof updateBlockSummary !== 'undefined') {
    updateBlockSummary()
  }
  if (typeof updateBlockChart !== 'undefined') {
    updateBlockChart()
  }
  
  if (typeof showToast !== 'undefined') {
    showToast('✅ Efficiency updated', 'success')
  }
}

function addEfficiencyIndicator(machineId, date) {
  const eff = getMachineEfficiency(machineId, date)
  if (!eff) return ''
  
  let color = '#FFD700'
  if (eff.global >= 80) color = '#00FF00'
  else if (eff.global < 60) color = '#FF0000'
  
  return `<span style="color: ${color}; font-weight: bold;">${eff.global}%</span>`
}

// ============ SETUP MODAL ============
function setupEfficiencyModalListeners() {
  const saveBtn = document.getElementById('save-efficiency-btn')
  if (saveBtn) {
    const newSaveBtn = saveBtn.cloneNode(true)
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn)
    newSaveBtn.addEventListener('click', saveEfficiencyFromModal)
    console.log('✅ Save button listener attached')
  }
  
  if (closeBtn) {
    const newCloseBtn = closeBtn.cloneNode(true)
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn)
    newCloseBtn.addEventListener('click', closeEfficiencyModal)
    console.log('✅ Close button listener attached')
  }
  
  const modal = document.getElementById('efficiency-modal')
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeEfficiencyModal()
      }
    })
    console.log('✅ Modal backdrop listener attached')
  }
}

// ============ HELPER ============
function getCurrentUserId() {
  return localStorage.getItem('currentUserId') || 
         localStorage.getItem('current_user') || 
         'unknown'
}

function getDeviceId() {
  let deviceId = localStorage.getItem('device_id')
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
    localStorage.setItem('device_id', deviceId)
  }
  return deviceId
}

function getDeviceName() {
  let deviceName = localStorage.getItem('device_name')
  if (!deviceName) {
    const ua = navigator.userAgent
    let osName = 'Unknown'
    if (ua.indexOf('Windows') > -1) osName = 'Windows PC'
    else if (ua.indexOf('Mac') > -1) osName = 'Mac'
    else if (ua.indexOf('Linux') > -1) osName = 'Linux'
    else if (ua.indexOf('Android') > -1) osName = 'Android'
    else if (ua.indexOf('iPhone') > -1) osName = 'iPhone'
    else if (ua.indexOf('iPad') > -1) osName = 'iPad'
    deviceName = `${osName} (${new Date().toLocaleDateString()})`
    localStorage.setItem('device_name', deviceName)
  }
  return deviceName
}

// ============ INITIALIZE ============
loadEfficiencyData()

// Expose functions globally
window.efficiencySystem = {
  setMachineEfficiency,
  getMachineEfficiency,
  getTodayEfficiency,
  getAllMachineEfficiency,
  getBlockEfficiency,
  getMachinesWithEfficiency,
  importEfficiencyFromExcel,
  exportEfficiencyToExcel,
  openEfficiencyModal,
  closeEfficiencyModal,
  saveEfficiencyFromModal,
  addEfficiencyIndicator,
  loadEfficiencyData,
  saveEfficiencyData,
  setupEfficiencyModalListeners,
  ensureCloudReady,
  forceSyncToCloud,
  syncCloudDataToLocal,
  efficiencyData,
  isMachineOperational,
  MACHINE_CONFIG
}

console.log('✅ Efficiency system loaded - Cloud sync fixed')
