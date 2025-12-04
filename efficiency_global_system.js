// ============ EFFICIENCY GLOBAL SYSTEM ============
// Mengelola efisiensi global pabrik berdasarkan Counter & Pick

const GLOBAL_EFFICIENCY_KEY = 'global_efficiency_v1'

// ============ CONSTANTS ============
const GLOBAL_CONSTANTS = {
  RPM: 155,
  HOURS: 8,
  CONVERSION: 39.37,
  DEFAULT_MACHINES_RUNNING: 600
}

// Data structure: { date: { counterA, pickA, counterB, pickB, counterC, pickC, machinesRun, shiftA, shiftB, shiftC, global } }
let globalEfficiencyData = {}

// ============ LOAD & SAVE ============
function loadGlobalEfficiency() {
  try {
    const raw = localStorage.getItem(GLOBAL_EFFICIENCY_KEY)
    if (raw) {
      globalEfficiencyData = JSON.parse(raw)
      console.log('✅ Loaded global efficiency data:', Object.keys(globalEfficiencyData).length, 'dates')
      return globalEfficiencyData
    }
  } catch (e) {
    console.error('❌ Error loading global efficiency:', e)
  }
  globalEfficiencyData = {}
  return globalEfficiencyData
}

function saveGlobalEfficiency() {
  try {
    localStorage.setItem(GLOBAL_EFFICIENCY_KEY, JSON.stringify(globalEfficiencyData))
    console.log('💾 Global efficiency data saved')
    
    // Sync to cloud if available
    if (typeof saveGlobalEfficiencyToCloud !== 'undefined' && window.isCloudAvailable) {
      saveGlobalEfficiencyToCloud(globalEfficiencyData).catch(e => 
        console.warn('Cloud global efficiency sync failed:', e)
      )
    }
  } catch (e) {
    console.error('❌ Error saving global efficiency:', e)
  }
}

// ============ CALCULATE GLOBAL EFFICIENCY ============
function calculateGlobalShiftEfficiency(counter, pick, machinesRun) {
  // Rumus: (Counter × 39.37 × Pick) / (Mesin Run × 155 × 8 × 60)
  const numerator = counter * GLOBAL_CONSTANTS.CONVERSION * pick
  const denominator = machinesRun * GLOBAL_CONSTANTS.RPM * GLOBAL_CONSTANTS.HOURS * 60
  
  if (denominator === 0) return 0
  
  const efficiency = (numerator / denominator) * 100
  return Math.round(efficiency * 10) / 10
}

// ============ SET GLOBAL EFFICIENCY ============
function setGlobalEfficiency(date, counterA, pickA, counterB, pickB, counterC, pickC, machinesRun, editor) {
  machinesRun = machinesRun || GLOBAL_CONSTANTS.DEFAULT_MACHINES_RUNNING
  
  const shiftA = calculateGlobalShiftEfficiency(counterA, pickA, machinesRun)
  const shiftB = calculateGlobalShiftEfficiency(counterB, pickB, machinesRun)
  const shiftC = calculateGlobalShiftEfficiency(counterC, pickC, machinesRun)
  
  const global = Math.round(((shiftA + shiftB + shiftC) / 3) * 10) / 10
  
  globalEfficiencyData[date] = {
    counterA: parseFloat(counterA) || 0,
    pickA: parseFloat(pickA) || 0,
    counterB: parseFloat(counterB) || 0,
    pickB: parseFloat(pickB) || 0,
    counterC: parseFloat(counterC) || 0,
    pickC: parseFloat(pickC) || 0,
    machinesRun: parseInt(machinesRun),
    shiftA: shiftA,
    shiftB: shiftB,
    shiftC: shiftC,
    global: global,
    timestamp: new Date().toISOString(),
    editor: editor || getCurrentUserId()
  }
  
  saveGlobalEfficiency()
  
  console.log(`✏️ Set global efficiency for ${date}:`, globalEfficiencyData[date])
  
  return globalEfficiencyData[date]
}

// ============ GET GLOBAL EFFICIENCY ============
function getGlobalEfficiency(date) {
  const targetDate = date || new Date().toISOString().split('T')[0]
  return globalEfficiencyData[targetDate] || null
}

function getAllGlobalEfficiency() {
  return globalEfficiencyData
}

// ============ IMPORT FROM EXCEL - MULTI SHEET SUPPORT ============
async function importGlobalEfficiencyFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        
        let imported = 0
        let errors = []
        let sheetsProcessed = 0
        
        console.log(`📊 Found ${workbook.SheetNames.length} sheets in global efficiency Excel`)
        
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
                // Date priority: 1. Column, 2. Sheet name, 3. Error
                let date = row['Date'] || row['Tanggal'] || row['date'] || sheetDate
                
                if (!date) {
                  errors.push(`Sheet "${sheetName}" Row ${rowIndex + 2}: Missing Date (not in column or sheet name)`)
                  return
                }
                
                // Convert date to ISO format
                if (date instanceof Date) {
                  date = date.toISOString().split('T')[0]
                } else if (typeof date === 'string') {
                  if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // Already YYYY-MM-DD
                  } else if (date.match(/^\d{2}[-/]\d{2}[-/]\d{4}$/)) {
                    const parts = date.split(/[-/]/)
                    date = `${parts[2]}-${parts[1]}-${parts[0]}`
                  } else {
                    date = new Date(date).toISOString().split('T')[0]
                  }
                } else if (typeof date === 'number') {
                  const excelDate = new Date((date - 25569) * 86400 * 1000)
                  date = excelDate.toISOString().split('T')[0]
                }
                
                const counterA = parseFloat(row['Counter A'] || row['counterA'] || row['Counter Shift A'] || 0)
                const pickA = parseFloat(row['Pick A'] || row['pickA'] || row['Pick Shift A'] || 0)
                const counterB = parseFloat(row['Counter B'] || row['counterB'] || row['Counter Shift B'] || 0)
                const pickB = parseFloat(row['Pick B'] || row['pickB'] || row['Pick Shift B'] || 0)
                const counterC = parseFloat(row['Counter C'] || row['counterC'] || row['Counter Shift C'] || 0)
                const pickC = parseFloat(row['Pick C'] || row['pickC'] || row['Pick Shift C'] || 0)
                const machinesRun = parseInt(row['Mesin Run'] || row['Mesin Jalan'] || row['Machines Running'] || row['machinesRun'] || GLOBAL_CONSTANTS.DEFAULT_MACHINES_RUNNING)
                
                setGlobalEfficiency(date, counterA, pickA, counterB, pickB, counterC, pickC, machinesRun, `Excel Import (${sheetName})`)
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
        
        console.log(`✅ Imported ${imported} global efficiency records from ${sheetsProcessed} sheets`)
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

// ============ EXPORT TO EXCEL ============
async function exportGlobalEfficiencyToExcel() {
  if (typeof XLSX === 'undefined') {
    console.error('XLSX library not available')
    return false
  }
  
  const pad = n => String(n).padStart(2, '0')
  const now = new Date()
  const filename = `global_efficiency_export_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.xlsx`
  
  const exportData = []
  
  Object.keys(globalEfficiencyData)
    .sort()
    .forEach(date => {
      const data = globalEfficiencyData[date]
      exportData.push({
        'Date': date,
        'Counter A': data.counterA,
        'Pick A': data.pickA,
        'Counter B': data.counterB,
        'Pick B': data.pickB,
        'Counter C': data.counterC,
        'Pick C': data.pickC,
        'Mesin Run': data.machinesRun,
        'Shift A (%)': data.shiftA,
        'Shift B (%)': data.shiftB,
        'Shift C (%)': data.shiftC,
        'Global (%)': data.global,
        'Editor': data.editor || 'Unknown',
        'Updated': data.timestamp || ''
      })
    })
  
  if (exportData.length === 0) {
    console.warn('No global efficiency data to export')
    return false
  }
  
  try {
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Global Efficiency')
    XLSX.writeFile(wb, filename)
    console.log(`✅ Excel exported: ${filename}`)
    return true
  } catch (e) {
    console.error('Export error:', e)
    return false
  }
}

// ============ GET HELPER ============
function getCurrentUserId() {
  return localStorage.getItem('currentUserId') || 
         localStorage.getItem('current_user') || 
         'unknown'
}

// ============ INITIALIZE ============
loadGlobalEfficiency()

// Expose functions globally
window.globalEfficiencySystem = {
  setGlobalEfficiency,
  getGlobalEfficiency,
  getAllGlobalEfficiency,
  importGlobalEfficiencyFromExcel,
  exportGlobalEfficiencyToExcel,
  loadGlobalEfficiency,
  saveGlobalEfficiency,
  globalEfficiencyData,
  GLOBAL_CONSTANTS
}

console.log('✅ Global efficiency system loaded')
