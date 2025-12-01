// ============ EFFICIENCY EXCEL TEMPLATE GENERATOR ============
// Generate template Excel for importing efficiency data

async function generateEfficiencyTemplate() {
  if (!window.ExcelJS && typeof XLSX === 'undefined') {
    showToast('Excel library not available', 'warn')
    return
  }
  
  const filename = 'efficiency_import_template.xlsx'
  
  if (window.ExcelJS) {
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
        fgColor: { argb: 'FFD166' }
      }
      ws1.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
      
      // Add sample data
      const today = new Date().toISOString().split('T')[0]
      ws1.addRow({ machine: 1, date: today, shiftA: 75.5, shiftB: 80.2, shiftC: 78.0 })
      ws1.addRow({ machine: 2, date: today, shiftA: 82.0, shiftB: 85.5, shiftC: 83.3 })
      ws1.addRow({ machine: 3, date: today, shiftA: 70.0, shiftB: 72.5, shiftC: 71.2 })
      
      // Add data validation for Machine ID (1-640)
      ws1.dataValidations.add('A2:A1000', {
        type: 'whole',
        operator: 'between',
        formulae: [1, 640],
        showErrorMessage: true,
        errorTitle: 'Invalid Machine ID',
        error: 'Machine ID must be between 1 and 640'
      })
      
      // Add data validation for percentages (0-100)
      ['C', 'D', 'E'].forEach(col => {
        ws1.dataValidations.add(`${col}2:${col}1000`, {
          type: 'decimal',
          operator: 'between',
          formulae: [0, 100],
          showErrorMessage: true,
          errorTitle: 'Invalid Percentage',
          error: 'Efficiency must be between 0 and 100'
        })
      })
      
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
        fgColor: { argb: 'FF6EC7' }
      }
      
      ws2.addRow({
        field: 'Machine ID',
        desc: 'Nomor mesin (1-640)',
        format: 'Integer'
      })
      
      ws2.addRow({
        field: 'Date',
        desc: 'Tanggal dalam format YYYY-MM-DD atau DD/MM/YYYY',
        format: 'Date'
      })
      
      ws2.addRow({
        field: 'Shift A',
        desc: 'Efisiensi shift A dalam persen (0-100)',
        format: 'Decimal'
      })
      
      ws2.addRow({
        field: 'Shift B',
        desc: 'Efisiensi shift B dalam persen (0-100)',
        format: 'Decimal'
      })
      
      ws2.addRow({
        field: 'Shift C',
        desc: 'Efisiensi shift C dalam persen (0-100)',
        format: 'Decimal'
      })
      
      ws2.addRow({})
      ws2.addRow({ field: 'NOTES:', desc: 'Efisiensi global akan dihitung otomatis sebagai rata-rata dari ketiga shift' })
      ws2.addRow({ field: '', desc: 'Kosongkan shift yang tidak ada data (akan diisi 0)' })
      ws2.addRow({ field: '', desc: 'Satu mesin bisa memiliki data untuk tanggal yang berbeda-beda' })
      
      // Sheet 3: Block Reference
      const ws3 = wb.addWorksheet('Block Reference')
      ws3.columns = [
        { header: 'Block', key: 'block', width: 10 },
        { header: 'Machine Range', key: 'range', width: 20 },
        { header: 'Total Machines', key: 'total', width: 15 }
      ]
      
      ws3.getRow(1).font = { bold: true, size: 12 }
      ws3.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '7C5CFF' }
      }
      
      ws3.addRow({ block: 'A', range: '1 - 160', total: 160 })
      ws3.addRow({ block: 'B', range: '201-220, 261-280, ...', total: 160 })
      ws3.addRow({ block: 'C', range: '181-200, 241-260, ...', total: 160 })
      ws3.addRow({ block: 'D', range: '161-180, 221-240, ...', total: 160 })
      
      // Export
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      
      showToast(`Template downloaded: ${filename}`, 'success')
      return true
    } catch (err) {
      console.error('Template generation failed:', err)
      showToast('Failed to generate template', 'warn')
      return false
    }
  }
  
  // Fallback to SheetJS
  if (typeof XLSX !== 'undefined') {
    const template = [
      ['Machine ID', 'Date', 'Shift A', 'Shift B', 'Shift C'],
      [1, new Date().toISOString().split('T')[0], 75.5, 80.2, 78.0],
      [2, new Date().toISOString().split('T')[0], 82.0, 85.5, 83.3],
      [3, new Date().toISOString().split('T')[0], 70.0, 72.5, 71.2]
    ]
    
    const ws = XLSX.utils.aoa_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, filename)
    
    showToast(`Template downloaded: ${filename}`, 'success')
    return true
  }
  
  return false
}

// Add button to generate template
function addTemplateButton() {
  // Add to efficiency page
  const filterBar = document.querySelector('.filter-bar')
  if (filterBar && !document.getElementById('download-template-btn')) {
    const btn = document.createElement('button')
    btn.id = 'download-template-btn'
    btn.className = 'chip'
    btn.innerHTML = '📋 Download Template'
    btn.style.cssText = 'background: rgba(124, 92, 255, 0.2);'
    btn.addEventListener('click', generateEfficiencyTemplate)
    filterBar.appendChild(btn)
  }
  
  // Add to main layout page
  const controls = document.querySelector('.controls .right')
  if (controls && !document.getElementById('efficiency-template-btn')) {
    const btn = document.createElement('button')
    btn.id = 'efficiency-template-btn'
    btn.className = 'chip'
    btn.title = 'Download template Excel untuk import efisiensi'
    btn.innerHTML = '📋 Template'
    btn.style.cssText = 'background: rgba(124, 92, 255, 0.2); padding: 6px 12px; font-size: 12px;'
    btn.addEventListener('click', generateEfficiencyTemplate)
    controls.appendChild(btn)
  }
}

// Auto-add button when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addTemplateButton)
} else {
  addTemplateButton()
}

// Expose globally
window.generateEfficiencyTemplate = generateEfficiencyTemplate

console.log('✅ Efficiency template generator loaded')
