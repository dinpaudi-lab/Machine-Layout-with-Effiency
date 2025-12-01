// ============ EFFICIENCY MANAGEMENT SYSTEM ============
// Mengelola efisiensi mesin per shift (A, B, C)

const EFFICIENCY_KEY = 'machine_efficiency_v1'

// Data structure: { machineId: { date: { shiftA: 60, shiftB: 65, shiftC: 70, global: 65 } } }
let efficiencyData = {}

// ============ LOAD & SAVE ============
function loadEfficiencyData() {
  try {
    const raw = localStorage.getItem(EFFICIENCY_KEY)
    if (raw) {
      efficiencyData = JSON.parse(raw)
      console.log('✅ Loaded efficiency data')
    }
  } catch (e) {
    console.error('❌ Error loading efficiency:', e)
    efficiencyData = {}
  }
}

function saveEfficiencyData() {
  try {
    localStorage.setItem(EFFICIENCY_KEY, JSON.stringify(efficiencyData))
    
    // Sync to cloud if available
    if (typeof saveEfficiencyToCloud !== 'undefined' && window.isCloudAvailable) {
      saveEfficiencyToCloud(efficiencyData).catch(e => 
        console.warn('Cloud efficiency sync failed:', e)
      )
    }
  } catch (e) {
    console.error('❌ Error saving efficiency:', e)
  }
}

// ============ EFFICIENCY OPERATIONS ============

// Set efisiensi untuk mesin tertentu
function setMachineEfficiency(machineId, date, shiftA, shiftB, shiftC) {
  if (!efficiencyData[machineId]) {
    efficiencyData[machineId] = {}
  }
  
  // Calculate global efficiency (average of all shifts)
  const shifts = [shiftA, shiftB, shiftC].filter(s => s !== null && s !== undefined && !isNaN(s))
  const global = shifts.length > 0 
    ? shifts.reduce((sum, val) => sum + val, 0) / shifts.length 
    : 0
  
  efficiencyData[machineId][date] = {
    shiftA: shiftA || 0,
    shiftB: shiftB || 0,
    shiftC: shiftC || 0,
    global: Math.round(global * 10) / 10,
    timestamp: new Date().toISOString(),
    editor: getCurrentUserId()
  }
  
  saveEfficiencyData()
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

// Get efisiensi global untuk blok
function getBlockEfficiency(blockName, date) {
  const today = date || new Date().toISOString().split('T')[0]
  const blockMachines = getMachinesInBlock(blockName)
  
  let totalGlobal = 0
  let count = 0
  
  blockMachines.forEach(machineId => {
    const eff = getMachineEfficiency(machineId, today)
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

// ============ BATCH IMPORT FROM EXCEL ============
async function importEfficiencyFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        
        // Expected format: Machine ID | Date | Shift A | Shift B | Shift C
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet)
        
        let imported = 0
        let errors = []
        
        rows.forEach((row, index) => {
          try {
            const machineId = parseInt(row['Machine ID'] || row['Mesin'] || row['ID'])
            const date = row['Date'] || row['Tanggal']
            const shiftA = parseFloat(row['Shift A'] || row['A'] || 0)
            const shiftB = parseFloat(row['Shift B'] || row['B'] || 0)
            const shiftC = parseFloat(row['Shift C'] || row['C'] || 0)
            
            if (!machineId || !date) {
              errors.push(`Row ${index + 2}: Missing Machine ID or Date`)
              return
            }
            
            // Convert date to ISO format
            let dateStr = date
            if (date instanceof Date) {
              dateStr = date.toISOString().split('T')[0]
            } else if (typeof date === 'string') {
              dateStr = new Date(date).toISOString().split('T')[0]
            }
            
            setMachineEfficiency(machineId, dateStr, shiftA, shiftB, shiftC)
            imported++
          } catch (err) {
            errors.push(`Row ${index + 2}: ${err.message}`)
          }
        })
        
        console.log(`✅ Imported ${imported} efficiency records`)
        if (errors.length > 0) {
          console.warn('⚠️ Import errors:', errors)
        }
        
        resolve({ imported, errors })
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
    showToast('Excel library not available', 'warn')
    return
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
    return a['Machine ID'] - b['Machine ID']
  })
  
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
        fgColor: { argb: 'FFD166' }
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
      
      showToast(`Excel exported: ${filename}`, 'success')
      return
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
    showToast(`Excel exported: ${filename}`, 'success')
  }
}

// ============ UI COMPONENTS ============

// Open efficiency modal for a machine
function openEfficiencyModal(machineId) {
  const modal = document.getElementById('efficiency-modal')
  if (!modal) {
    createEfficiencyModal()
    return openEfficiencyModal(machineId)
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
  
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      const a = parseFloat(inputs[0].value) || 0
      const b = parseFloat(inputs[1].value) || 0
      const c = parseFloat(inputs[2].value) || 0
      const shifts = [a, b, c].filter(s => s > 0)
      const global = shifts.length > 0 
        ? shifts.reduce((sum, val) => sum + val, 0) / shifts.length 
        : 0
      document.getElementById('eff-global').textContent = Math.round(global * 10) / 10 + '%'
    })
  })
}

function closeEfficiencyModal() {
  const modal = document.getElementById('efficiency-modal')
  if (modal) modal.classList.add('hidden')
}

function createEfficiencyModal() {
  const modal = document.createElement('div')
  modal.id = 'efficiency-modal'
  modal.className = 'modal hidden'
  modal.innerHTML = `
    <div class="modal-card" style="max-width: 480px;">
      <h3>⚡ Efisiensi Mesin <span id="eff-machine-id"></span></h3>
      
      <label>Tanggal:
        <input type="date" id="eff-date" style="width: 100%;" />
      </label>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 16px 0;">
        <label style="margin: 0;">
          <div style="font-size: 11px; color: #9aa6c0; margin-bottom: 4px;">SHIFT A (%)</div>
          <input type="number" id="eff-shift-a" min="0" max="100" step="0.1" placeholder="0" style="width: 100%;" />
        </label>
        
        <label style="margin: 0;">
          <div style="font-size: 11px; color: #9aa6c0; margin-bottom: 4px;">SHIFT B (%)</div>
          <input type="number" id="eff-shift-b" min="0" max="100" step="0.1" placeholder="0" style="width: 100%;" />
        </label>
        
        <label style="margin: 0;">
          <div style="font-size: 11px; color: #9aa6c0; margin-bottom: 4px;">SHIFT C (%)</div>
          <input type="number" id="eff-shift-c" min="0" max="100" step="0.1" placeholder="0" style="width: 100%;" />
        </label>
      </div>
      
      <div style="padding: 16px; background: rgba(255, 209, 102, 0.1); border: 1px solid rgba(255, 209, 102, 0.3); border-radius: 8px; text-align: center; margin-bottom: 16px;">
        <div style="font-size: 11px; color: #9aa6c0; margin-bottom: 4px;">EFISIENSI GLOBAL</div>
        <div style="font-size: 32px; font-weight: 700; color: #ffd166;" id="eff-global">0%</div>
      </div>
      
      <div class="actions">
        <button id="save-efficiency" class="btn primary">💾 Simpan</button>
        <button id="close-efficiency-modal" class="btn">Batal</button>
      </div>
    </div>
  `
  
  document.body.appendChild(modal)
  
  // Event listeners
  document.getElementById('save-efficiency').addEventListener('click', saveEfficiency)
  document.getElementById('close-efficiency-modal').addEventListener('click', closeEfficiencyModal)
}

async function saveEfficiency() {
  const modal = document.getElementById('efficiency-modal')
  const machineId = parseInt(modal.dataset.machineId)
  const date = document.getElementById('eff-date').value
  const shiftA = parseFloat(document.getElementById('eff-shift-a').value) || 0
  const shiftB = parseFloat(document.getElementById('eff-shift-b').value) || 0
  const shiftC = parseFloat(document.getElementById('eff-shift-c').value) || 0
  
  if (!date) {
    showToast('Pilih tanggal terlebih dahulu', 'warn')
    return
  }
  
  const result = setMachineEfficiency(machineId, date, shiftA, shiftB, shiftC)
  
  console.log('✅ Efficiency saved:', machineId, date, result)
  
  // Update UI
  if (window.renderGrid) window.renderGrid()
  if (window.updateEfficiencyChart) window.updateEfficiencyChart()
  
  closeEfficiencyModal()
  showToast(`Efisiensi mesin ${machineId} disimpan ✅`, 'success')
}

// Add efficiency indicator to machine box
function addEfficiencyIndicator(machineBox, machineId) {
  const eff = getTodayEfficiency(machineId)
  
  if (eff && eff.global > 0) {
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
    `
    indicator.textContent = eff.global + '%'
    machineBox.appendChild(indicator)
  }
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
  importEfficiencyFromExcel,
  exportEfficiencyToExcel,
  openEfficiencyModal,
  addEfficiencyIndicator,
  loadEfficiencyData,
  saveEfficiencyData
}

console.log('✅ Efficiency system loaded')
