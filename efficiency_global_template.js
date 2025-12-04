// ============ GLOBAL EFFICIENCY EXCEL TEMPLATE GENERATOR ============

async function generateGlobalEfficiencyTemplate() {
  try {
    console.log('📋 Generating global efficiency template...')
    
    if (!window.ExcelJS && typeof XLSX === 'undefined') {
      const msg = '❌ Excel library not loaded'
      console.error(msg)
      if (typeof showToast !== 'undefined') {
        showToast(msg, 'warn')
      }
      return false
    }
    
    const filename = 'efficiency_global_template.xlsx'
    
    // Try ExcelJS first
    if (window.ExcelJS) {
      console.log('Using ExcelJS for global template')
      return await generateGlobalWithExcelJS(filename)
    }
    
    // Fallback to SheetJS
    if (typeof XLSX !== 'undefined') {
      console.log('Using SheetJS for global template')
      return generateGlobalWithSheetJS(filename)
    }
    
    return false
  } catch (error) {
    console.error('❌ Global template generation error:', error)
    if (typeof showToast !== 'undefined') {
      showToast('Template generation failed: ' + error.message, 'warn')
    }
    return false
  }
}

// Generate using ExcelJS
async function generateGlobalWithExcelJS(filename) {
  try {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Layout Mesin Rapier'
    wb.created = new Date()
    
    // Sheet 1: Template dengan contoh data hari ini
    const ws1 = wb.addWorksheet('Data Produksi Global')
    
    ws1.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Counter A', key: 'counterA', width: 14 },
      { header: 'Pick A', key: 'pickA', width: 10 },
      { header: 'Counter B', key: 'counterB', width: 14 },
      { header: 'Pick B', key: 'pickB', width: 10 },
      { header: 'Counter C', key: 'counterC', width: 14 },
      { header: 'Pick C', key: 'pickC', width: 10 },
      { header: 'Mesin Run', key: 'machinesRun', width: 12 }
    ]
    
    // Style header
    ws1.getRow(1).font = { bold: true, size: 11 }
    ws1.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00FFE1' }
    }
    ws1.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    
    // Add sample data - multiple days in one sheet
    const today = new Date()
    for (let i = 2; i >= 0; i--) {
      const date = new Date(today.getTime() - (i * 86400000))
      const dateStr = date.toISOString().split('T')[0]
      
      ws1.addRow({ 
        date: dateStr,
        counterA: 14560 + (i * 200),
        pickA: 28.5 + (i * 0.3),
        counterB: 15200 + (i * 150),
        pickB: 29.0 + (i * 0.2),
        counterC: 14800 + (i * 180),
        pickC: 28.8 + (i * 0.25),
        machinesRun: 600 - (i * 2)
      })
    }
    
    // Sheet 2: Contoh format dengan nama sheet = tanggal
    const yesterday = new Date(today.getTime() - 86400000)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    
    const ws3 = wb.addWorksheet(yesterdayStr)
    ws3.columns = [
      { header: 'Counter A', key: 'counterA', width: 14 },
      { header: 'Pick A', key: 'pickA', width: 10 },
      { header: 'Counter B', key: 'counterB', width: 14 },
      { header: 'Pick B', key: 'pickB', width: 10 },
      { header: 'Counter C', key: 'counterC', width: 14 },
      { header: 'Pick C', key: 'pickC', width: 10 },
      { header: 'Mesin Run', key: 'machinesRun', width: 12 }
    ]
    
    ws3.getRow(1).font = { bold: true, size: 11 }
    ws3.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7C5CFF' }
    }
    ws3.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
    
    ws3.addRow({ 
      counterA: 14760,
      pickA: 28.8,
      counterB: 15350,
      pickB: 29.2,
      counterC: 14980,
      pickC: 29.05,
      machinesRun: 598
    })
    
    // Sheet 3: Instructions
    const ws2 = wb.addWorksheet('Instruksi')
    ws2.columns = [
      { header: 'Field', key: 'field', width: 20 },
      { header: 'Deskripsi', key: 'desc', width: 70 },
      { header: 'Contoh', key: 'example', width: 15 }
    ]
    
    ws2.getRow(1).font = { bold: true, size: 12 }
    ws2.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF6EC7' }
    }
    
    ws2.addRow({
      field: 'Date',
      desc: 'Tanggal produksi (YYYY-MM-DD atau DD-MM-YYYY)',
      example: today
    })
    
    ws2.addRow({
      field: 'Counter A/B/C',
      desc: 'Total counter dari SEMUA mesin untuk shift tersebut (angka total produksi)',
      example: '14560'
    })
    
    ws2.addRow({
      field: 'Pick A/B/C',
      desc: 'Rata-rata pick untuk shift tersebut (dari semua mesin yang jalan)',
      example: '28.5'
    })
    
    ws2.addRow({
      field: 'Mesin Run',
      desc: 'Jumlah mesin yang operasional di hari tersebut (dari total 640 mesin)',
      example: '600'
    })
    
    ws2.addRow({})
    
    ws2.addRow({ 
      field: '📊 RUMUS PERHITUNGAN',
      desc: '',
      example: ''
    })
    
    ws2.addRow({ 
      field: 'Efisiensi Shift',
      desc: '= (Counter × 39.37 × Pick) / (Mesin Run × 155 × 8 × 60)',
      example: ''
    })
    
    ws2.addRow({ 
      field: 'Efisiensi Global',
      desc: '= (Shift A + Shift B + Shift C) / 3',
      example: ''
    })
    
    ws2.addRow({})
    
    ws2.addRow({ 
      field: '⚙️ KONSTANTA TETAP',
      desc: '',
      example: ''
    })
    
    ws2.addRow({ 
      field: 'RPM',
      desc: '155 (kecepatan mesin)',
      example: '155'
    })
    
    ws2.addRow({ 
      field: 'Jam per Shift',
      desc: '8 jam',
      example: '8'
    })
    
    ws2.addRow({ 
      field: 'Faktor Konversi',
      desc: '39.37',
      example: '39.37'
    })
    
    ws2.addRow({})
    
    ws2.addRow({ 
      field: '💡 CATATAN PENTING',
      desc: '',
      example: ''
    })
    
    ws2.addRow({ 
      field: '',
      desc: '• Counter adalah TOTAL dari semua mesin (bukan per mesin)',
      example: ''
    })
    
    ws2.addRow({ 
      field: '',
      desc: '• Pick adalah RATA-RATA dari semua mesin yang jalan',
      example: ''
    })
    
    ws2.addRow({ 
      field: '',
      desc: '• Mesin Run bisa berbeda setiap hari (maintenance, breakdown, dll)',
      example: ''
    })
    
    ws2.addRow({ 
      field: '',
      desc: '• Ini adalah efisiensi GLOBAL pabrik, berbeda dengan efisiensi per mesin',
      example: ''
    })
    
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
    
    console.log('✅ Global template generated:', filename)
    if (typeof showToast !== 'undefined') {
      showToast(`✅ Template Global downloaded: ${filename}`, 'success')
    }
    return true
  } catch (err) {
    console.error('ExcelJS generation failed:', err)
    throw err
  }
}

// Generate using SheetJS
function generateGlobalWithSheetJS(filename) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    
    const template = [
      ['Date', 'Counter A', 'Pick A', 'Counter B', 'Pick B', 'Counter C', 'Pick C', 'Mesin Run'],
      [yesterday, 14560, 28.5, 15200, 29.0, 14800, 28.8, 600],
      [today, 15100, 29.2, 15600, 29.5, 15300, 29.3, 598]
    ]
    
    const ws = XLSX.utils.aoa_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data Produksi Global')
    XLSX.writeFile(wb, filename)
    
    console.log('✅ Global template generated:', filename)
    if (typeof showToast !== 'undefined') {
      showToast(`✅ Template Global downloaded: ${filename}`, 'success')
    }
    return true
  } catch (err) {
    console.error('SheetJS generation failed:', err)
    throw err
  }
}

// Add template button for global efficiency
function addGlobalTemplateButton() {
  console.log('🔧 Adding global template button...')
  
  const filterBar = document.querySelector('.filter-bar')
  if (!filterBar) {
    console.log('⚠️ Filter bar not found')
    return
  }
  
  // Check if button already exists
  if (document.getElementById('download-global-template-btn')) {
    console.log('ℹ️ Global template button already exists')
    return
  }
  
  const btn = document.createElement('button')
  btn.id = 'download-global-template-btn'
  btn.className = 'chip'
  btn.innerHTML = '📋 Download Template Global'
  btn.style.cssText = 'background: rgba(0, 255, 225, 0.2);'
  btn.addEventListener('click', generateGlobalEfficiencyTemplate)
  
  filterBar.appendChild(btn)
  console.log('✅ Global template button added')
}

// Auto-add button when page loads
function initGlobalTemplateButton() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(addGlobalTemplateButton, 500)
    })
  } else {
    setTimeout(addGlobalTemplateButton, 500)
  }
}

initGlobalTemplateButton()

// Expose globally
window.generateGlobalEfficiencyTemplate = generateGlobalEfficiencyTemplate

console.log('✅ Global efficiency template generator loaded')
