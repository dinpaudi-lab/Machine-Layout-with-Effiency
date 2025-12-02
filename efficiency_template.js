// ============ EFFICIENCY EXCEL TEMPLATE GENERATOR - FIXED ============
// Generate template Excel for importing efficiency data

async function generateEfficiencyTemplate() {
  try {
    console.log('📋 Generating efficiency template...')
    
    // Check if libraries are available
    if (!window.ExcelJS && typeof XLSX === 'undefined') {
      const msg = '❌ Excel library not loaded. Please refresh the page.'
      console.error(msg)
      if (typeof showToast !== 'undefined') {
        showToast(msg, 'warn')
      } else {
        alert(msg)
      }
      return false
    }
    
    const filename = 'efficiency_import_template.xlsx'
    
    // Try ExcelJS first (better formatting)
    if (window.ExcelJS) {
      console.log('Using ExcelJS for template generation')
      return await generateWithExcelJS(filename)
    }
    
    // Fallback to SheetJS
    if (typeof XLSX !== 'undefined') {
      console.log('Using SheetJS for template generation')
      return generateWithSheetJS(filename)
    }
    
    return false
  } catch (error) {
    console.error('❌ Template generation error:', error)
    if (typeof showToast !== 'undefined') {
      showToast('Template generation failed: ' + error.message, 'warn')
    } else {
      alert('Template generation failed: ' + error.message)
    }
    return false
  }
}

// Generate using ExcelJS (with formatting)
async function generateWithExcelJS(filename) {
  try {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Layout Mesin Rapier'
    wb.created = new Date()
    
    // Sheet 1: Template
    const ws1 = wb.addWorksheet('Template')
    
    // Header styling
    ws1.columns = [
      { header: 'Machine ID', key: 'machine', width: 12 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Shift A', key: 'shiftA', width: 10 },
      { header: 'Shift B', key: 'shiftB', width: 10 },
      { header: 'Shift C', key: 'shiftC', width: 10 }
    ]
    
    // Style header
    ws1.getRow(1).font = { bold: true, size: 12 }
    ws1.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFD166' }
    }
    ws1.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    
    // Add sample data
    const today = new Date().toISOString().split('T')[0]
    ws1.addRow({ machine: 1, date: today, shiftA: 75.5, shiftB: 80.2, shiftC: 78.0 })
    ws1.addRow({ machine: 2, date: today, shiftA: 82.0, shiftB: 85.5, shiftC: 83.3 })
    ws1.addRow({ machine: 3, date: today, shiftA: 70.0, shiftB: 72.5, shiftC: 71.2 })
    
    // Sheet 2: Instructions
    const ws2 = wb.addWorksheet('Instructions')
    ws2.columns = [
      { header: 'Field', key: 'field', width: 15 },
      { header: 'Description', key: 'desc', width: 50 },
      { header: 'Format', key: 'format', width: 20 }
    ]
    
    ws2.getRow(1).font = { bold: true, size: 12 }
    ws2.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF6EC7' }
    }
    
    ws2.addRow({
      field: 'Machine ID',
      desc: 'Nomor mesin (1-640)',
      format: 'Integer'
    })
    
    ws2.addRow({
      field: 'Date',
      desc: 'Tanggal dalam format YYYY-MM-DD',
      format: 'Date'
    })
    
    ws2.addRow({
      field: 'Shift A/B/C',
      desc: 'Efisiensi dalam persen (0-100)',
      format: 'Decimal'
    })
    
    ws2.addRow({})
    ws2.addRow({ field: 'NOTE:', desc: 'Efisiensi global akan dihitung otomatis' })
    
    // Export
    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    console.log('✅ Template generated:', filename)
    if (typeof showToast !== 'undefined') {
      showToast(`✅ Template downloaded: ${filename}`, 'success')
    }
    return true
  } catch (err) {
    console.error('ExcelJS generation failed:', err)
    throw err
  }
}

// Generate using SheetJS (simple)
function generateWithSheetJS(filename) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const template = [
      ['Machine ID', 'Date', 'Shift A', 'Shift B', 'Shift C'],
      [1, today, 75.5, 80.2, 78.0],
      [2, today, 82.0, 85.5, 83.3],
      [3, today, 70.0, 72.5, 71.2]
    ]
    
    const ws = XLSX.utils.aoa_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, filename)
    
    console.log('✅ Template generated:', filename)
    if (typeof showToast !== 'undefined') {
      showToast(`✅ Template downloaded: ${filename}`, 'success')
    }
    return true
  } catch (err) {
    console.error('SheetJS generation failed:', err)
    throw err
  }
}

// Add template button to efficiency page
function addTemplateButton() {
  console.log('🔧 Adding template button...')
  
  // Only add to efficiency page
  const filterBar = document.querySelector('.filter-bar')
  if (!filterBar) {
    console.log('⚠️ Filter bar not found, skipping template button')
    return
  }
  
  // Check if button already exists
  if (document.getElementById('download-template-btn')) {
    console.log('ℹ️ Template button already exists')
    return
  }
  
  const btn = document.createElement('button')
  btn.id = 'download-template-btn'
  btn.className = 'chip'
  btn.innerHTML = '📋 Download Template'
  btn.style.cssText = 'background: rgba(124, 92, 255, 0.2);'
  btn.addEventListener('click', generateEfficiencyTemplate)
  
  filterBar.appendChild(btn)
  console.log('✅ Template button added')
}

// Auto-add button when page loads
function initTemplateButton() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(addTemplateButton, 500)
    })
  } else {
    setTimeout(addTemplateButton, 500)
  }
}

initTemplateButton()

// Expose globally
window.generateEfficiencyTemplate = generateEfficiencyTemplate

console.log('✅ Efficiency template generator loaded')
