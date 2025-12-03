// ============ EFFICIENCY MANAGEMENT SYSTEM - FIXED ============
// Mengelola efisiensi mesin per shift (A, B, C)

const EFFICIENCY_KEY = 'machine_efficiency_v2'

// Data structure: { machineId: { date: { shiftA, shiftB, shiftC, global, editor, timestamp } } }
let efficiencyData = {}

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

function saveEfficiencyData() {
  try {
    localStorage.setItem(EFFICIENCY_KEY, JSON.stringify(efficiencyData))
    console.log('💾 Efficiency data saved')
    
    // Sync to cloud if available
    if (typeof saveEfficiencyToCloudV2 !== 'undefined' && window.isCloudAvailable) {
      saveEfficiencyToCloudV2(efficiencyData).catch(e => 
        console.warn('Cloud efficiency sync failed:', e)
      )
    }
  } catch (e) {
    console.error('❌ Error saving efficiency:', e)
  }
}

// ============ EFFICIENCY OPERATIONS ============

// Set efisiensi untuk mesin tertentu pada tanggal tertentu
function setMachineEfficiency(machineId, date, shiftA, shiftB, shiftC, editor) {
  if (!efficiencyData[machineId]) {
    efficiencyData[machineId] = {}
  }
  
  // Calculate global efficiency (average of all shifts)
  const shifts = [shiftA, shiftB, shiftC].filter(s => s !== null && s !== undefined && !isNaN(s) && s > 0)
  const global = shifts.length > 0 
    ? shifts.reduce((sum, val) => sum + val, 0) / shifts.length 
    : 0
  
  efficiencyData[machineId][date] = {
    shiftA: parseFloat(shiftA) || 0,
    shiftB: parseFloat(shiftB) || 0,
    shiftC: parseFloat(shiftC) || 0,
    global: Math.round(global * 10) / 10,
    timestamp: new Date().toISOString(),
    editor: editor || getCurrentUserId()
  }
  
  saveEfficiencyData()
  
  console.log(`✏️ Set efficiency for machine ${machineId} on ${date}:`, efficiencyData[machineId][date])
  
  return efficiencyData[machineId][date]
}

// Get efisiensi mesin untuk tanggal tertentu
function getMachineEfficiency(machineId, date) {
  if (!efficiencyData[machineId]) return null
  return efficiencyData[machineId][date] || null
}

// Get efisiensi mesin untuk hari ini
function getTodayEfficiency(machineId) {
  const today = new Date().toISOString().split('T')[0]
  return getMachineEfficiency(machineId, today)
}

// Get all efficiency data untuk mesin
function getAllMachineEfficiency(machineId) {
  return efficiencyData[machineId] || {}
}

// Get efisiensi global untuk blok pada tanggal tertentu
function getBlockEfficiency(blockName, date) {
  const targetDate = date || new Date().toISOString().split('T')[0]
  const blockMachines = getMachinesInBlock(blockName)
  
  let totalGlobal = 0
  let count = 0
  
  blockMachines.forEach(machineId => {
    const eff = getMachineEfficiency(machineId, targetDate)
    if (eff && eff.global > 0) {
      totalGlobal += eff.global
      count++
    }
  })
  
  return count > 0 ? Math.round((totalGlobal / count) * 10) / 10 : 0
}

// Get mesin dalam blok tertentu
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

// Get all machines that have efficiency data for a specific date
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

// ============ BATCH IMPORT FROM EXCEL - MULTI SHEET SUPPORT ============
async function importEfficiencyFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        
        let imported = 0
        let errors = []
        let sheetsProcessed = 0
        
        console.log(`📊 Found ${workbook.SheetNames.length} sheets in Excel file`)
        
        // Loop through ALL sheets
        workbook.SheetNames.forEach((sheetName, sheetIndex) => {
          try {
            console.log(`📄 Processing sheet: ${sheetName}`)
            
            const sheet = workbook.Sheets[sheetName]
            const rows = XLSX.utils.sheet_to_json(sheet)
            
            if (rows.length === 0) {
              console.warn(`⚠️ Sheet "${sheetName}" is empty, skipping`)
              return
            }
            
            // Try to extract date from sheet name (e.g., "2024-12-03" or "03-12-2024")
            let sheetDate = null
            const dateMatch = sheetName.match(/(\d{4}-\d{2}-\d{2})|(\d{2}-\d{2}-\d{4})/)
            if (dateMatch) {
              sheetDate = dateMatch[0]
              // Normalize to YYYY-MM-DD format
              if (sheetDate.match(/^\d{2}-\d{2}-\d{4}$/)) {
                const parts = sheetDate.split('-')
                sheetDate = `${parts[2]}-${parts[1]}-${parts[0]}`
              }
              console.log(`📅 Sheet date detected: ${sheetDate}`)
            }
            
            rows.forEach((row, rowIndex) => {
              try {
                const machineId = parseInt(row['Machine ID'] || row['Mesin'] || row['ID'] || row['Machine'] || row['No Mesin'])
                
                // Date priority: 1. Column, 2. Sheet name, 3. Error
                let date = row['Date'] || row['Tanggal'] || sheetDate
                
                let shiftA = parseFloat(row['Shift A'] || row['A'] || row['shift_a'] || 0)
                let shiftB = parseFloat(row['Shift B'] || row['B'] || row['shift_b'] || 0)
                let shiftC = parseFloat(row['Shift C'] || row['C'] || row['shift_c'] || 0)
                
                if (!machineId) {
                  errors.push(`Sheet "${sheetName}" Row ${rowIndex + 2}: Missing Machine ID`)
                  return
                }
                
                if (!date) {
                  errors.push(`Sheet "${sheetName}" Row ${rowIndex + 2}: Missing Date (not in column or sheet name)`)
                  return
                }
                
                // PENTING: Auto-convert dari format persen Excel (0.84 → 84)
                // Ini otomatis detect apakah nilai sudah persen (>1) atau decimal (<1)
                if (shiftA > 0 && shiftA <= 1) shiftA = shiftA * 100
                if (shiftB > 0 && shiftB <= 1) shiftB = shiftB * 100
                if (shiftC > 0 && shiftC <= 1) shiftC = shiftC * 100
                
                // Round to 1 decimal
                shiftA = Math.round(shiftA * 10) / 10
                shiftB = Math.round(shiftB * 10) / 10
                shiftC = Math.round(shiftC * 10) / 10
                
                // Convert date to ISO format
                if (date instanceof Date) {
                  date = date.toISOString().split('T')[0]
                } else if (typeof date === 'string') {
                  // Handle various date formats
                  if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // Already in YYYY-MM-DD format
                  } else if (date.match(/^\d{2}[-/]\d{2}[-/]\d{4}$/)) {
                    // DD-MM-YYYY or DD/MM/YYYY
                    const parts = date.split(/[-/]/)
                    date = `${parts[2]}-${parts[1]}-${parts[0]}`
                  } else {
                    date = new Date(date).toISOString().split('T')[0]
                  }
                } else if (typeof date === 'number') {
                  // Excel date serial number
                  const excelDate = new Date((date - 25569) * 86400 * 1000)
                  date = excelDate.toISOString().split('T')[0]
                }
                
                setMachineEfficiency(machineId, date, shiftA, shiftB, shiftC, `Excel Import (${sheetName})`)
                imported++
              } catch (err) {
                errors.push(`Sheet "${sheetName}" Row ${rowIndex + 2}: ${err.message}`)
              }
            })
            
            sheetsProcessed++
          } catch (sheetErr) {
            errors.push(`Sheet "${sheetName}": ${sheetErr.message}`)
          }
        })
        
        console.log(`✅ Imported ${imported} efficiency records from ${sheetsProcessed} sheets`)
        if (errors.length > 0) {
          console.warn('⚠️ Import errors:', errors)
        }
        
        resolve({ imported, errors, sheetsProcessed })
      } catch (error) {
        console.error('❌ Excel import error:', error)
        reject(error)
      }
    }
    
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

// ============ EXPORT EFFICIENCY TO EXCEL ============
async function exportEfficiencyToExcel(dateFrom, dateTo) {
  if (!window.ExcelJS && typeof XLSX === 'undefined') {
    console.error('Excel library not available')
    return false
  }
  
  const pad = n => String(n).padStart(2, '0')
  const now = new Date()
  const filename = `efficiency_export_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.xlsx`
  
  // Prepare data
  const exportData = []
  
  Object.keys(efficiencyData).forEach(machineId => {
    const machineEfficiency = efficiencyData[machineId]
    
    Object.keys(machineEfficiency).forEach(date => {
      const eff = machineEfficiency[date]
      
      // Filter by date range if provided
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
  
  // Sort by date and machine ID
  exportData.sort((a, b) => {
    if (a.Date !== b.Date) return a.Date.localeCompare(b.Date)
    return parseInt(a['Machine ID']) - parseInt(b['Machine ID'])
  })
  
  if (exportData.length === 0) {
    console.warn('No data to export')
    return false
  }
  
  // Use ExcelJS if available
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
      ws.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFD166' }
      }
      
      exportData.forEach(row => ws.addRow(row))
      
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      
      console.log(`✅ Excel exported: ${filename}`)
      return true
    } catch (err) {
      console.error('ExcelJS export failed:', err)
    }
  }
  
  // Fallback to SheetJS
  if (typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Efficiency Data')
    XLSX.writeFile(wb, filename)
    console.log(`✅ Excel exported: ${filename}`)
    return true
  }
  
  return false
}

// ============ UI COMPONENTS ============

// Open efficiency modal for a machine
function openEfficiencyModal(machineId) {
  const modal = document.getElementById('efficiency-modal')
  if (!modal) {
    console.warn('Efficiency modal not found in DOM')
    return
  }
  
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
  
  // Auto-calculate global on input
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
    document.getElementById('eff-global').textContent = Math.round(global * 10) / 10 + '%'
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
      showToast('Pilih tanggal terlebih dahulu', 'warn')
    }
    return
  }
  
  const result = setMachineEfficiency(machineId, date, shiftA, shiftB, shiftC)
  
  console.log('✅ Efficiency saved:', machineId, date, result)
  
  // Update UI
  if (typeof renderGrid === 'function') renderGrid()
  if (typeof updateChart === 'function') updateChart()
  if (typeof renderEfficiencyGrid === 'function') renderEfficiencyGrid()
  if (typeof updateBlockSummary === 'function') updateBlockSummary()
  if (typeof updateTrendChart === 'function') updateTrendChart()
  if (typeof updateBlockChart === 'function') updateBlockChart()
  
  closeEfficiencyModal()
  
  if (typeof showToast !== 'undefined') {
    showToast(`Efisiensi mesin ${machineId} disimpan ✅`, 'success')
  }
}

// Add efficiency indicator to machine box
function addEfficiencyIndicator(machineBox, machineId) {
  const eff = getTodayEfficiency(machineId)
  
  if (eff && eff.global > 0) {
    // Remove old indicator if exists
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

// Setup efficiency modal event listeners (call once on page load)
function setupEfficiencyModalListeners() {
  console.log('🔧 Setting up efficiency modal listeners...')
  
  const saveBtn = document.getElementById('save-efficiency')
  const closeBtn = document.getElementById('close-efficiency-modal')
  
  // Only proceed if buttons exist (they exist in layout.html, not efficiency.html)
  if (!saveBtn && !closeBtn) {
    console.log('ℹ️ Efficiency modal buttons not found (probably on efficiency.html page)')
    return
  }
  
  if (saveBtn) {
    // Remove any existing listeners by cloning
    const newSaveBtn = saveBtn.cloneNode(true)
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn)
    
    newSaveBtn.addEventListener('click', saveEfficiencyFromModal)
    console.log('✅ Save button listener attached')
  }
  
  if (closeBtn) {
    // Remove any existing listeners by cloning
    const newCloseBtn = closeBtn.cloneNode(true)
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn)
    
    newCloseBtn.addEventListener('click', closeEfficiencyModal)
    console.log('✅ Close button listener attached')
  }
  
  // Also setup modal backdrop click to close
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
  efficiencyData // Expose data for debugging
}

console.log('✅ Efficiency system loaded - Fixed version')
