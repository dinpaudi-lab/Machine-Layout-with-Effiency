// ============ EFFICIENCY MANAGEMENT SYSTEM - FIXED ============

const EFFICIENCY_KEY = 'machine_efficiency_v2'

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

// ============ CLOUD HELPERS ============

async function ensureCloudReady() {
  if (window.isCloudAvailable) return true
  
  if (typeof supabaseInit !== 'undefined') {
    const ready = await supabaseInit()
    window.isCloudAvailable = ready
    return ready
  }
  
  return false
}

async function forceSyncToCloud(data) {
  const MAX_RETRIES = 3
  let attempt = 0
  
  while (attempt < MAX_RETRIES) {
    try {
      attempt++
      const cloudReady = await ensureCloudReady()
      if (!cloudReady) return false
      
      if (typeof saveEfficiencyToCloud !== 'undefined') {
        const success = await saveEfficiencyToCloud(data)
        if (success) return true
      }
      
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    } catch (e) {
      console.error(`Sync attempt ${attempt} failed:`, e)
    }
  }
  
  return false
}

// ============ LOAD & SAVE ============

function loadEfficiencyData() {
  try {
    const raw = localStorage.getItem(EFFICIENCY_KEY)
    if (raw) {
      efficiencyData = JSON.parse(raw)
      console.log('✅ Loaded machine efficiency:', Object.keys(efficiencyData).length, 'machines')
      return efficiencyData
    }
  } catch (e) {
    console.error('Load error:', e)
  }
  efficiencyData = {}
  return efficiencyData
}

async function saveEfficiencyData() {
  try {
    localStorage.setItem(EFFICIENCY_KEY, JSON.stringify(efficiencyData))
    console.log('💾 Machine efficiency saved to localStorage')
    
    const cloudReady = await ensureCloudReady()
    
    if (cloudReady && typeof saveEfficiencyToCloud !== 'undefined') {
      saveEfficiencyToCloud(efficiencyData)
        .then(() => {
          console.log('✅ Machine efficiency synced to cloud')
          if (typeof showToast !== 'undefined') {
            showToast('☁️ Efisiensi mesin tersinkron ke cloud', 'success')
          }
        })
        .catch(e => {
          console.warn('Cloud sync failed:', e)
        })
    }
  } catch (e) {
    console.error('Save error:', e)
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
  
  return efficiencyData[machineId][date]
}

function getMachineEfficiency(machineId, date) {
  if (!efficiencyData[machineId]) return null
  return efficiencyData[machineId][date] || null
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

// ============ IMPORT EXCEL ============

async function importEfficiencyFromExcel(file) {
  return new Promise(async (resolve, reject) => {
    try {
      const cloudReady = await ensureCloudReady()
      
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          
          let imported = 0
          let errors = []
          let sheetsProcessed = 0
          
          workbook.SheetNames.forEach((sheetName) => {
            try {
              const sheet = workbook.Sheets[sheetName]
              const rows = XLSX.utils.sheet_to_json(sheet)
              
              if (rows.length === 0) return
              
              let sheetDate = null
              const dateMatch = sheetName.match(/(\d{4}-\d{2}-\d{2})|(\d{2}-\d{2}-\d{4})/)
              if (dateMatch) {
                sheetDate = dateMatch[0]
                if (sheetDate.match(/^\d{2}-\d{2}-\d{4}$/)) {
                  const parts = sheetDate.split('-')
                  sheetDate = `${parts[2]}-${parts[1]}-${parts[0]}`
                }
              }
              
              rows.forEach((row, rowIndex) => {
                try {
                  const machineId = parseInt(row['Machine ID'] || row['Mesin'] || row['ID'])
                  let date = row['Date'] || row['Tanggal'] || sheetDate
                  
                  let shiftA = parseFloat(row['Shift A'] || row['A'] || 0)
                  let shiftB = parseFloat(row['Shift B'] || row['B'] || 0)
                  let shiftC = parseFloat(row['Shift C'] || row['C'] || 0)
                  
                  if (!machineId || !date) return
                  
                  if (shiftA > 0 && shiftA <= 1) shiftA = shiftA * 100
                  if (shiftB > 0 && shiftB <= 1) shiftB = shiftB * 100
                  if (shiftC > 0 && shiftC <= 1) shiftC = shiftC * 100
                  
                  if (date instanceof Date) {
                    date = date.toISOString().split('T')[0]
                  } else if (typeof date === 'string') {
                    if (date.match(/^\d{2}[-/]\d{2}[-/]\d{4}$/)) {
                      const parts = date.split(/[-/]/)
                      date = `${parts[2]}-${parts[1]}-${parts[0]}`
                    } else if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                      date = new Date(date).toISOString().split('T')[0]
                    }
                  } else if (typeof date === 'number') {
                    date = new Date((date - 25569) * 86400 * 1000).toISOString().split('T')[0]
                  }
                  
                  if (!efficiencyData[machineId]) {
                    efficiencyData[machineId] = {}
                  }

                  const shifts = [shiftA, shiftB, shiftC].filter(s => s > 0)
                  const global = shifts.length > 0 
                    ? shifts.reduce((sum, val) => sum + val, 0) / shifts.length 
                    : 0

                  efficiencyData[machineId][date] = {
                    shiftA: parseFloat(shiftA).toFixed(2),
                    shiftB: parseFloat(shiftB).toFixed(2),
                    shiftC: parseFloat(shiftC).toFixed(2),
                    global: parseFloat(global).toFixed(2),
                    timestamp: new Date().toISOString(),
                    editor: `Excel Import (${sheetName})`
                  }

                  imported++
                } catch (err) {
                  errors.push(`Row ${rowIndex + 2}: ${err.message}`)
                }
              })
              
              sheetsProcessed++
            } catch (sheetErr) {
              errors.push(`Sheet "${sheetName}": ${sheetErr.message}`)
            }
          })
          
          localStorage.setItem(EFFICIENCY_KEY, JSON.stringify(efficiencyData))
          
          if (cloudReady) {
            await forceSyncToCloud(efficiencyData)
          }
          
          resolve({ imported, errors, sheetsProcessed })
        } catch (error) {
          reject(error)
        }
      }
      
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(file)
    } catch (error) {
      reject(error)
    }
  })
}

// ============ EXPORT EXCEL ============

async function exportEfficiencyToExcel(dateFrom, dateTo) {
  if (!window.ExcelJS && typeof XLSX === 'undefined') {
    return false
  }
  
  const pad = n => String(n).padStart(2, '0')
  const now = new Date()
  const filename = `efficiency_export_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.xlsx`
  
  const exportData = []
  
  Object.keys(efficiencyData).forEach(machineId => {
    const machineEfficiency = efficiencyData[machineId]
    Object.keys(machineEfficiency).forEach(date => {
      const eff = machineEfficiency[date]
      
      if (dateFrom && date < dateFrom) return
      if (dateTo && date > dateTo) return
      
      exportData.push({
        'Machine ID': machineId,
        'Date': date,
        'Shift A': eff.shiftA,
        'Shift B': eff.shiftB,
        'Shift C': eff.shiftC,
        'Global': eff.global,
        'Editor': eff.editor || 'Unknown',
        'Updated': eff.timestamp || ''
      })
    })
  })
  
  exportData.sort((a, b) => {
    if (a.Date !== b.Date) return a.Date.localeCompare(b.Date)
    return parseInt(a['Machine ID']) - parseInt(b['Machine ID'])
  })
  
  if (exportData.length === 0) return false
  
  if (window.ExcelJS) {
    try {
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Layout Mesin Rapier'
      wb.created = now
      
      const ws = wb.addWorksheet('Efficiency Data')
      ws.columns = [
        { header: 'Machine ID', key: 'Machine ID', width: 12 },
        { header: 'Date', key: 'Date', width: 12 },
        { header: 'Shift A (%)', key: 'Shift A', width: 12 },
        { header: 'Shift B (%)', key: 'Shift B', width: 12 },
        { header: 'Shift C (%)', key: 'Shift C', width: 12 },
        { header: 'Global (%)', key: 'Global', width: 12 },
        { header: 'Editor', key: 'Editor', width: 20 },
        { header: 'Updated', key: 'Updated', width: 22 }
      ]
      
      ws.getRow(1).font = { bold: true }
      exportData.forEach(row => ws.addRow(row))
      
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      
      return true
    } catch (err) {
      console.error('Export error:', err)
    }
  }
  
  if (typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Efficiency Data')
    XLSX.writeFile(wb, filename)
    return true
  }
  
  return false
}

// ============ UI COMPONENTS ============

function openEfficiencyModal(machineId) {
  const modal = document.getElementById('efficiency-modal')
  if (!modal) return
  
  modal.dataset.machineId = machineId
  
  const today = new Date().toISOString().split('T')[0]
  const eff = getTodayEfficiency(machineId) || { shiftA: 0, shiftB: 0, shiftC: 0, global: 0 }
  
  document.getElementById('eff-machine-id').textContent = machineId
  document.getElementById('eff-date').value = today
  document.getElementById('eff-shift-a').value = eff.shiftA || ''
  document.getElementById('eff-shift-b').value = eff.shiftB || ''
  document.getElementById('eff-shift-c').value = eff.shiftC || ''
  document.getElementById('eff-global').textContent = eff.global + '%'
  
  modal.classList.remove('hidden')
  
  const inputs = [
    document.getElementById('eff-shift-a'),
    document.getElementById('eff-shift-b'),
    document.getElementById('eff-shift-c')
  ]
  
  const updateGlobal = () => {
    const a = parseFloat(inputs[0].value) || 0
    const b = parseFloat(inputs[1].value) || 0
    const c = parseFloat(inputs[2].value) || 0
    const shifts = [a, b, c].filter(s => s > 0)
    const global = shifts.length > 0 
      ? shifts.reduce((sum, val) => sum + val, 0) / shifts.length 
      : 0
    document.getElementById('eff-global').textContent = Math.round(global * 100) / 100 + '%'
  }
  
  inputs.forEach(input => {
    input.removeEventListener('input', updateGlobal)
    input.addEventListener('input', updateGlobal)
  })
}

function closeEfficiencyModal() {
  const modal = document.getElementById('efficiency-modal')
  if (modal) modal.classList.add('hidden')
}

async function saveEfficiencyFromModal() {
  const modal = document.getElementById('efficiency-modal')
  const machineId = parseInt(modal.dataset.machineId)
  const date = document.getElementById('eff-date').value
  const shiftA = parseFloat(document.getElementById('eff-shift-a').value) || 0
  const shiftB = parseFloat(document.getElementById('eff-shift-b').value) || 0
  const shiftC = parseFloat(document.getElementById('eff-shift-c').value) || 0
  
  if (!date) {
    if (typeof showToast !== 'undefined') {
      showToast('Pilih tanggal', 'warn')
    }
    return
  }
  
  setMachineEfficiency(machineId, date, shiftA, shiftB, shiftC)
  await saveEfficiencyData()
  
  if (typeof renderGrid === 'function') renderGrid()
  if (typeof renderEfficiencyGrid === 'function') renderEfficiencyGrid()
  if (typeof updateBlockSummary === 'function') updateBlockSummary()
  if (typeof updateTrendChart === 'function') updateTrendChart()
  if (typeof updateBlockChart === 'function') updateBlockChart()
  
  closeEfficiencyModal()
  
  if (typeof showToast !== 'undefined') {
    showToast(`Efisiensi mesin ${machineId} disimpan ✅`, 'success')
  }
}

function addEfficiencyIndicator(machineBox, machineId) {
  const eff = getTodayEfficiency(machineId)
  
  if (eff && eff.global > 0) {
    const oldIndicator = machineBox.querySelector('.efficiency-indicator')
    if (oldIndicator) oldIndicator.remove()
    
    const indicator = document.createElement('div')
    indicator.className = 'efficiency-indicator'
    indicator.style.cssText = `
      position: absolute;
      top: 2px;
      right: 2px;
      background: rgba(0, 0, 0, 0.7);
      color: ${eff.global >= 80 ? '#34d399' : eff.global >= 60 ? '#ffd166' : '#f97316'};
      font-size: 8px;
      padding: 2px 4px;
      border-radius: 3px;
      font-weight: 700;
      z-index: 10;
    `
    indicator.textContent = eff.global + '%'
    machineBox.appendChild(indicator)
  }
}

function setupEfficiencyModalListeners() {
  const saveBtn = document.getElementById('save-efficiency')
  const closeBtn = document.getElementById('close-efficiency-modal')
  
  if (saveBtn) {
    const newSaveBtn = saveBtn.cloneNode(true)
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn)
    newSaveBtn.addEventListener('click', saveEfficiencyFromModal)
  }
  
  if (closeBtn) {
    const newCloseBtn = closeBtn.cloneNode(true)
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn)
    newCloseBtn.addEventListener('click', closeEfficiencyModal)
  }
  
  const modal = document.getElementById('efficiency-modal')
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeEfficiencyModal()
      }
    })
  }
}

function getCurrentUserId() {
  return localStorage.getItem('currentUserId') || 'unknown'
}

function getDeviceId() {
  let deviceId = localStorage.getItem('device_id')
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem('device_id', deviceId)
  }
  return deviceId
}

// ============ INITIALIZE ============
loadEfficiencyData()

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
  efficiencyData,
  isMachineOperational,
  MACHINE_CONFIG
}

console.log('✅ Efficiency system loaded')
