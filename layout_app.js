// Stub functions untuk backward compatibility
function setMachineShiftEfficiency(machineId, shift, efficiency) {
  console.warn('⚠️ setMachineShiftEfficiency is deprecated, use efficiencySystem instead')
  if (!window.efficiencySystem) return
  
  const today = new Date().toISOString().split('T')[0]
  const eff = window.efficiencySystem.getMachineEfficiency(machineId, today) || {
    shiftA: 0, shiftB: 0, shiftC: 0
  }
  
  if (shift === 'A') eff.shiftA = efficiency
  if (shift === 'B') eff.shiftB = efficiency
  if (shift === 'C') eff.shiftC = efficiency
  
  window.efficiencySystem.setMachineEfficiency(
    machineId, today, eff.shiftA, eff.shiftB, eff.shiftC
  )
}

function setMachineAllShifts(machineId, a, b, c) {
  console.warn('⚠️ setMachineAllShifts is deprecated')
  if (!window.efficiencySystem) return
  const today = new Date().toISOString().split('T')[0]
  window.efficiencySystem.setMachineEfficiency(machineId, today, a, b, c)
}
function getGlobalEfficiency() {
  console.warn('⚠️ getGlobalEfficiency is deprecated')
  if (!window.efficiencySystem) {
    return { average: 0, byShift: { A: 0, B: 0, C: 0 }, machineCount: 0 }
  }
  
  const today = new Date().toISOString().split('T')[0]
  const machines = []
  
  // Get all machines with efficiency data today
  for (let i = 1; i <= 640; i++) {
    const eff = window.efficiencySystem.getMachineEfficiency(i, today)
    if (eff && eff.global > 0) {
      machines.push(eff)
    }
  }
  
  if (machines.length === 0) {
    return { average: 0, byShift: { A: 0, B: 0, C: 0 }, machineCount: 0 }
  }
  
  const avgA = machines.reduce((sum, m) => sum + m.shiftA, 0) / machines.length
  const avgB = machines.reduce((sum, m) => sum + m.shiftB, 0) / machines.length
  const avgC = machines.reduce((sum, m) => sum + m.shiftC, 0) / machines.length
  const avg = (avgA + avgB + avgC) / 3
  
  return {
    average: avg,
    byShift: { A: avgA, B: avgB, C: avgC },
    machineCount: machines.length,
    totalMachines: machines.length
  }
}

function getEfficiencyByBlock(blocks) {
  console.warn('⚠️ getEfficiencyByBlock is deprecated')
  if (!window.efficiencySystem) return {}
  
  const today = new Date().toISOString().split('T')[0]
  const byBlock = {}
  
  if (Array.isArray(blocks)) {
    blocks.forEach(block => {
      byBlock[block.name] = window.efficiencySystem.getBlockEfficiency(block.name, today)
    })
  }
  
  return byBlock
}

function getEfficiencyStat(min, max) {
  console.warn('⚠️ getEfficiencyStat is deprecated')
  if (!window.efficiencySystem) return 0
  
  const today = new Date().toISOString().split('T')[0]
  let count = 0
  
  for (let i = 1; i <= 640; i++) {
    const eff = window.efficiencySystem.getMachineEfficiency(i, today)
    if (eff && eff.global >= min && eff.global <= max) {
      count++
    }
  }
  
  return count
}
// Layout mesin app - Fixed Real-time Sync
const $ = id => document.getElementById(id)

const TOTAL_MACHINES = 640

// ============ STORAGE KEYS ============
const STORAGE_KEY = 'layout_machines_v1'
const HISTORY_KEY = 'layout_history_v1'
const CONSTS_KEY = 'layout_constructions_v1'
const SESSION_KEY = 'app_session_token'
const CURRENT_USER_KEY = 'current_user'

// Block definition
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

function getMachineBlock(machineNum){
  for(const [blockName, ranges] of Object.entries(BLOCKS)){
    for(const range of ranges){
      if(machineNum >= range.start && machineNum <= range.end){
        return blockName
      }
    }
  }
  return '?'
}

// Initial constructions
let constructions = [
  {id:'R84-56-125', name:'R84 56 125', color:'#ff6ec7'},
  {id:'R84-60-125', name:'R84 60 125', color:'#7c5cff'},
  {id:'R72-38-125', name:'R72 38 125', color:'#00ffe1'},
]

function loadConstructions(){
  try{
    const raw = localStorage.getItem(CONSTS_KEY)
    if(!raw) return constructions
    const parsed = JSON.parse(raw)
    if(Array.isArray(parsed) && parsed.length) return parsed
    return constructions
  }catch(e){ return constructions }
}

function saveConstructions(){ 
  localStorage.setItem(CONSTS_KEY, JSON.stringify(constructions))
  
  // Sync to cloud if available
  if(typeof saveConstructionToCloud !== 'undefined' && window.isCloudAvailable){
    constructions.forEach(c => {
      saveConstructionToCloud(c, getCurrentUserId()).catch(e => 
        console.warn('Cloud sync failed for construction:', e)
      )
    })
  }
}

constructions = loadConstructions()

function loadMachines(){
  const raw = localStorage.getItem(STORAGE_KEY)
  if(raw) {
    const loaded = JSON.parse(raw)
    // PENTING: Sort by ID untuk memastikan urutan benar
    loaded.sort((a, b) => a.id - b.id)
    return loaded
  }
  const arr = []
  for(let i=1;i<=TOTAL_MACHINES;i++){
    const c = constructions[(i-1) % constructions.length]
    arr.push({id:i, constructId:c.id})
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
  return arr
}
let machines = loadMachines()

function saveMachines(){ 
  localStorage.setItem(STORAGE_KEY, JSON.stringify(machines)) 
}
// ============ CLOUD HISTORY ============
let cloudHistory = []
let isCloudSyncEnabled = false

function getHistory() { 
  try {
    if (isCloudSyncEnabled && cloudHistory.length > 0) {
      return cloudHistory
    }
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch(e) { 
    return [] 
  } 
}

async function addHistory(entry) { 
  console.log('📝 Adding history entry:', entry)
  
  const h = getHistory()
  h.unshift(entry)
  if(h.length > 1000) h.length = 1000
  
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h))
  console.log('💾 History saved to localStorage, total entries:', h.length)
  
  if (isCloudSyncEnabled) {
    cloudHistory = h
  }
  
  // Save to cloud
  if (typeof saveHistoryToCloud !== 'undefined' && window.isCloudAvailable) {
    try {
      await saveHistoryToCloud({
        type: entry.type || 'general',
        action: entry.action || 'update',
        details: entry,
        device_id: getDeviceId(),
        device_name: getDeviceName()
      })
    } catch (e) {
      console.warn('Cloud history sync failed:', e)
    }
  }
  
  // ✅ FIX: Render LANGSUNG tanpa delay
  console.log('🔄 Rendering history immediately...')
  renderHistory()  // ← LANGSUNG, TANPA setTimeout!
}

function getCurrentUserId(){
  return localStorage.getItem('currentUserId') || 'unknown'
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

// ============ UI RENDER ============
function renderLegend(){ 
  const el = $('legend')
  if(!el) return
  el.innerHTML=''
  constructions.forEach(c=>{ 
    const item = document.createElement('div')
    item.className='legend-item'
    item.innerHTML = `<div class="legend-color" style="background:${c.color}"></div><div>${c.name}</div>`
    el.appendChild(item) 
  }) 
}

function renderConstructList(){
  const el = $('construct-list')
  if(!el) return
  el.innerHTML = ''
  constructions.forEach(c=>{
    const row = document.createElement('div')
    row.className = 'construct-row'
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px;'
    row.innerHTML = `<div style="width:14px;height:14px;border-radius:4px;background:${c.color}"></div><div style="flex:1">${c.name}</div><button class="edit-const" data-id="${c.id}" title="Edit warna">✏️</button><button class="delete-const" data-id="${c.id}">Hapus</button>`
    el.appendChild(row)
  })
  
  el.querySelectorAll('.edit-const').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-id')
      const c = constructions.find(x=> x.id === id)
      if(c) openConstModal(c)
    })
  })
  
  el.querySelectorAll('.delete-const').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.getAttribute('data-id')
      const constName = constructions.find(x=> x.id === id)?.name || id
      
      if(!confirm(`Hapus konstruksi "${constName}"?`)) return
      
      constructions = constructions.filter(x=> x.id !== id)
      machines.forEach(m=>{ if(m.constructId === id) m.constructId = null })
      
      saveConstructions()
      saveMachines()
      
      // Delete from cloud
      if(typeof deleteConstructionFromCloud !== 'undefined' && window.isCloudAvailable){
        try{
          await deleteConstructionFromCloud(id, getCurrentUserId())
        }catch(e){
          console.warn('Cloud delete failed:', e)
        }
      }
      
      renderLegend()
      renderConstructList()
      populateModalConstruct()
      renderGrid()
      updateChart()
      showToast(`Konstruksi "${constName}" dihapus`, 'warn')
    })
  })
}

function attachEventListeners(){
  const elLogout = $('logout-btn')
  if(elLogout){
    elLogout.addEventListener('click', ()=>{
      if(confirm('Anda yakin ingin logout?')){
        localStorage.removeItem(SESSION_KEY)
        localStorage.removeItem(CURRENT_USER_KEY)
        window.location.href = 'login.html'
      }
    })
  }
  
  const efficiencyBtn = $('efficiency-btn')
  if(efficiencyBtn){
    efficiencyBtn.addEventListener('click', ()=>{
      openEfficiencyPage()
    })
  }
  
  const elClose = $('close-modal')
  if(elClose) elClose.addEventListener('click', closeModal)
  
const elSave = $('save-edit')
if(elSave) {
  // Remove old listener by cloning
  const newSaveBtn = elSave.cloneNode(true)
  elSave.parentNode.replaceChild(newSaveBtn, elSave)
  
  newSaveBtn.addEventListener('click', async ()=>{
    // Disable button to prevent double-click
    newSaveBtn.disabled = true
    newSaveBtn.textContent = '💾 Menyimpan...'
    
    const modal = $('modal')
    const id = Number(modal.dataset.machineId)
    const newC = $('modal-construct').value
    const editor = $('modal-editor').value || 'Unknown'
    
    const machineIndex = machines.findIndex(m => m.id === id)
    const old = machineIndex !== -1 ? machines[machineIndex].constructId : null
    
    console.log('📝 Saving machine:', { id, old, new: newC, editor })
    
    // 1. Update local data FIRST
    if(machineIndex !== -1) {
      machines[machineIndex].constructId = newC
      saveMachines()
      console.log('✅ Local data updated')
    }
    
    // 2. Add to history IMMEDIATELY
    const historyEntry = {
      machine: id, 
      from: old, 
      to: newC, 
      editor: editor, 
      date: new Date().toISOString()
    }
    
    // ✅ SAVE TO LOCALSTORAGE DIRECTLY (bypass async)
    const h = getHistory()
    h.unshift(historyEntry)
    if(h.length > 1000) h.length = 1000
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h))
    console.log('✅ History saved to localStorage:', h.length, 'entries')
    
    // Save to cloud in background (non-blocking)
    if (typeof saveHistoryToCloud !== 'undefined' && window.isCloudAvailable) {
      saveHistoryToCloud({
        type: 'general',
        action: 'update',
        details: historyEntry,
        device_id: getDeviceId(),
        device_name: getDeviceName()
      }).catch(e => console.warn('Cloud history sync failed:', e))
    }
    
    // 3. Close modal
    closeModal()
    
    // 4. Update ALL UI (with forced delay for DOM)
    requestAnimationFrame(() => {
      renderGrid()
      renderLegend()
      updateChart()
      
      // ✅ FORCE RENDER HISTORY with double-check
      const historyEl = document.getElementById('history-list')
      if (historyEl) {
        renderHistory()
        console.log('✅ History rendered, children:', historyEl.children.length)
        
        // Double-check: if still empty, force again
        setTimeout(() => {
          if (historyEl.children.length === 0) {
            console.warn('⚠️ History empty, forcing render again')
            renderHistory()
          }
        }, 50)
      } else {
        console.error('❌ history-list element not found!')
      }
      
      showToast('✅ Perubahan disimpan', 'success')
    })
    
    // 5. Save to cloud in background (non-blocking)
    if (typeof saveMachineToCloud !== 'undefined' && window.isCloudAvailable) {
      saveMachineToCloud(id, newC, getCurrentUserId(), old)
        .then(() => {
          console.log('☁️ Synced to cloud')
          showToast('☁️ Tersinkron ke cloud', 'success')
        })
        .catch((e) => {
          console.error('❌ Cloud sync error:', e)
          showToast('⚠️ Cloud sync gagal (data tetap tersimpan lokal)', 'warn')
        })
    }
    
    // Re-enable button
    newSaveBtn.disabled = false
    newSaveBtn.textContent = 'Simpan'
  })
  
  console.log('✅ Save button listener attached')
}
  const elConstClose = $('close-const-modal')
  if(elConstClose) elConstClose.addEventListener('click', closeConstModal)
  
  const elConstSave = $('save-const')
  if(elConstSave) elConstSave.addEventListener('click', async ()=>{
    const modal = $('const-modal')
    const constructId = modal.dataset.constructId
    const c = constructions.find(x=> x.id === constructId)
    
    if(c){
      const newName = $('const-modal-name-input').value.trim() || c.name
      let newColor = $('const-modal-color').value
      
      if(!newColor.startsWith('#')) newColor = '#' + newColor
      newColor = newColor.toLowerCase()
      
      c.name = newName
      c.color = newColor
      saveConstructions()
      
      // Save to cloud
      if(typeof saveConstructionToCloud !== 'undefined' && window.isCloudAvailable){
        try{
          await saveConstructionToCloud(c, getCurrentUserId())
        }catch(e){
          console.warn('Cloud save failed:', e)
        }
      }
      
      renderLegend()
      renderConstructList()
      renderGrid()
      populateModalConstruct()
      updateChart()
      closeConstModal()
      showToast('Konstruksi diperbarui', 'success')
    }
  })
  
  const elAdd = $('add-const')
  if(elAdd) elAdd.addEventListener('click', async ()=>{
    const name = $('new-const-name').value.trim()
    if(!name){ alert('Isi nama konstruksi'); return }
    
    const id = name.replace(/\s+/g,'-') + '-' + Math.floor(Math.random()*9999)
    let color = $('new-const-color').value
    
    if(!color.startsWith('#')) color = '#' + color
    color = color.toLowerCase()
    
    const newConstruct = {id:id, name:name, color:color}
    constructions.push(newConstruct)
    
    const nameEl = $('new-const-name')
    if(nameEl) nameEl.value=''
    
    saveConstructions()
    
    // Save to cloud
    if(typeof saveConstructionToCloud !== 'undefined' && window.isCloudAvailable){
      try{
        await saveConstructionToCloud(newConstruct, getCurrentUserId(), true)
      }catch(e){
        console.warn('Cloud save failed:', e)
      }
    }
    
    renderLegend()
    renderConstructList()
    populateModalConstruct()
    updateChart()
    showToast('Konstruksi ditambahkan ☁️', 'success')
  })
  
  const searchEl = $('search')
  if(searchEl) searchEl.addEventListener('input', ()=> renderGrid())
  
  const clearBtn = $('clear-search')
  if(clearBtn){
    clearBtn.addEventListener('click', ()=>{
      const searchEl = $('search')
      if(searchEl) searchEl.value = ''
      renderGrid()
      showToast('Pencarian direset', 'success')
    })
  }
  
  const clearStorageBtn = $('clear-storage')
  if(clearStorageBtn){
    clearStorageBtn.addEventListener('click', ()=>{
      if(confirm('Yakin ingin menghapus semua data tersimpan?')){
        try{
          localStorage.removeItem(STORAGE_KEY)
          localStorage.removeItem(CONSTS_KEY)
          localStorage.removeItem(HISTORY_KEY)
          location.reload()
        }catch(e){
          showToast('Gagal hapus data', 'warn')
        }
      }
    })
  }
  
  const xlsBtn = $('export-excel')
  if(xlsBtn) xlsBtn.addEventListener('click', exportExcel)
}

function populateModalConstruct(){ 
  const sel = $('modal-construct')
  if(!sel) return
  sel.innerHTML=''
  constructions.forEach(c=>{ 
    const opt=document.createElement('option')
    opt.value=c.id
    opt.textContent=c.name
    sel.appendChild(opt) 
  }) 
}

function renderHistory(){ 
  console.log('🎨 renderHistory() called')
  
  const list = window.cloudHistory && window.cloudHistory.length > 0 
    ? window.cloudHistory 
    : getHistory()
  
  const el = document.getElementById('history-list')
  if(!el) {
    console.error('❌ history-list element not found in DOM')
    return
  }
  
  console.log('📋 Rendering history:', list.length, 'entries')
  
  el.innerHTML = ''
  
  if(list.length === 0){ 
    el.innerHTML = '<div style="padding:12px;color:#9aa6c0;text-align:center">Tidak ada riwayat.</div>'
    console.log('⚠️ No history to show')
    return 
  }
  
  // ✅ FIX: Render ALL items, tidak ada slice
  list.forEach((h, index) => { 
    const div = document.createElement('div')
    div.className = 'history-row'
    div.style.cssText = 'background:rgba(255,255,255,0.02);padding:8px;border-radius:8px;margin-bottom:8px'
    
    const machineId = h.machine || h.machine_id
    const timestamp = h.date || h.timestamp
    const dateStr = timestamp ? new Date(timestamp).toLocaleString('id-ID') : 'Unknown'
    
    const fromConstruct = getConstructById(h.from)
    const toConstruct = getConstructById(h.to)
    
    const fromName = fromConstruct ? fromConstruct.name : (h.from || 'Tidak ada')
    const toName = toConstruct ? toConstruct.name : (h.to || 'Tidak ada')
    
    // ✅ HIGHLIGHT untuk entry terbaru (first item)
    if (index === 0) {
      div.style.background = 'rgba(255,110,199,0.15)'
      div.style.border = '1px solid rgba(255,110,199,0.3)'
    }
    
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div>
          <strong style="color:#ff6ec7">Mesin ${machineId}</strong>
          <div style="font-size:12px;margin-top:4px">
            <span style="color:#f97316">${fromName}</span> 
            → 
            <span style="color:#34d399">${toName}</span>
          </div>
        </div>
        <div style="text-align:right;font-size:11px;color:#9aa6c0">
          <div>${h.editor}</div>
          <div>${dateStr}</div>
        </div>
      </div>
    `
    
    el.appendChild(div)
  })
  
  console.log('✅ History rendered:', list.length, 'items displayed')
  
  // ✅ FORCE browser repaint
  el.offsetHeight
}
function getConstructById(id){ 
  if(!id) return null
  return constructions.find(c=> c.id === id) || null 
}

function renderGrid(){ 
  console.log('🎨 Rendering grid...') // ← LOG AWAL
  
  const grid = $('machine-grid')
  if(!grid) {
    console.error('❌ machine-grid not found') // ← LOG ERROR
    return
  }
  
  const q = $('search')
  const filter = q ? q.value.trim() : ''
  const counter = $('search-counter')
  
  let matchCount = 0
  grid.innerHTML = ''
  
  function renderBlock(blockName, ranges) {
    const blockLabel = document.createElement('div')
    blockLabel.style.cssText = 'grid-column:1/-1;padding:12px 0 6px 0;font-weight:700;color:#ff6ec7;font-size:13px;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.1);margin-top:8px'
    blockLabel.textContent = `🏭 Blok ${blockName}`
    grid.appendChild(blockLabel)
    
    const allMachines = []
    for(const range of ranges){
      for(let i = range.start; i <= range.end; i++){
        allMachines.push(i)
      }
    }
    allMachines.sort((a,b) => a - b)
    
    for(let sectionIdx = 0; sectionIdx < allMachines.length; sectionIdx += 20) {
      const section = allMachines.slice(sectionIdx, sectionIdx + 20)
      if(section.length === 0) continue
      
      const sectionDiv = document.createElement('div')
      sectionDiv.style.cssText = 'display:grid;grid-template-columns:repeat(10,1fr);gap:4px;grid-column:1/-1;margin-bottom:8px'
      
      for(let i = 0; i < 10; i++) {
        const topMachine = section[i * 2]
        const bottomMachine = section[i * 2 + 1]
        
        const subCol = document.createElement('div')
        subCol.style.cssText = 'display:grid;grid-template-rows:1fr 1fr;gap:2px'
        
        if(topMachine) {
          const box = createMachineBox(topMachine, blockName, filter)
          if(box.matches) matchCount++
          subCol.appendChild(box.element)
        }
        
        if(bottomMachine) {
          const box = createMachineBox(bottomMachine, blockName, filter)
          if(box.matches) matchCount++
          subCol.appendChild(box.element)
        }
        
        sectionDiv.appendChild(subCol)
      }
      
      grid.appendChild(sectionDiv)
    }
  }
  
  function createMachineBox(machineNum, blockName, filter) {
    const m = machines.find(machine => machine.id === machineNum) || {id:machineNum, constructId:null}
    const box = document.createElement('div')
    box.className = 'machine-box'
    box.style.fontSize = '11px'
    box.style.padding = '4px'
    box.style.minHeight = '24px'
    box.style.display = 'flex'
    box.style.alignItems = 'center'
    box.style.justifyContent = 'center'
    box.style.flexDirection = 'column'
    box.title = `Mesin ${machineNum} - Blok ${blockName}`
    box.textContent = machineNum
    
    box.setAttribute('data-machine-id', machineNum)
    
    const c = constructions.find(x=> x.id === m.constructId)
    box.style.background = c ? c.color : '#262626'
    
    const isMachine = String(machineNum)
    const matches = !filter || isMachine === filter
    
    if(!matches){
      box.style.opacity = '0.15'
      box.style.pointerEvents = 'none'
    } else {
      box.style.opacity = '1'
      box.style.cursor = 'pointer'
      box.style.border = filter ? '2px solid #ffd166' : '1px solid rgba(255,255,255,0.04)'
      const constructName = c ? c.name : 'Belum ditugaskan'
      box.title = `Mesin ${machineNum} - Blok ${blockName}\nKonstruksi: ${constructName}`
      box.addEventListener('click', (e)=>{ 
        const machineId = parseInt(e.currentTarget.getAttribute('data-machine-id'))
        openModal(machineId) 
      })
    }
    
    return { element: box, matches: matches }
  }
  
  renderBlock('A', BLOCKS.A)
  renderBlock('B', BLOCKS.B)
  renderBlock('C', BLOCKS.C)
  renderBlock('D', BLOCKS.D)
  
  if(counter){
    if(filter){
      counter.textContent = `${matchCount} hasil`
      counter.style.color = matchCount > 0 ? '#34d399' : '#f97316'
    } else {
      counter.textContent = ''
    }
  }
  
  const searchResultDiv = $('search-result')
  const searchResultText = $('search-result-text')
  if(filter && matchCount > 0){
    const machineNum = parseInt(filter)
    const m = machines.find(machine => machine.id === machineNum)
    const c = constructions.find(x=> x.id === m?.constructId)
    const block = getMachineBlock(machineNum)
    const constructName = c ? c.name : 'Belum ditugaskan'
    
    searchResultText.innerHTML = `
      <div style="display:grid;gap:8px">
        <div>🔍 <strong>Mesin ${machineNum}</strong></div>
        <div>📍 Blok: <strong>${block}</strong></div>
        <div>🏗️ Konstruksi: <strong style="color:${c?.color || '#999'}">${constructName}</strong></div>
      </div>
    `
    searchResultDiv.style.display = 'block'
  } else {
    searchResultDiv.style.display = 'none'
  }
  
  console.log('✅ Grid rendered') // ← LOG AKHIR
}

function openModal(id){ 
  // ✅ TAMBAHAN: Notify conflict system
  if (window.conflictHandler) {
    window.conflictHandler.startEditing('machine', id)
  }
  
  const modal = $('modal')
  if(!modal) return
  
  const mid = $('modal-machine-id')
  if(mid){
    const block = getMachineBlock(id)
    mid.textContent = id
    mid.title = `Blok ${block}`
  }
  
  populateModalConstruct()

  modal.dataset.machineId = id
  
  const sel = $('modal-construct')
  const m = machines.find(machine => machine.id === id) || {constructId:''}
  if(sel) sel.value = m.constructId || ''
  
  const editor = $('modal-editor')
  if(editor) editor.value=''
  
  modal.classList.remove('hidden')
}

function closeModal(){ 
  // ✅ TAMBAHAN: Stop editing
  if (window.conflictHandler) {
    window.conflictHandler.stopEditing()
  }
  
  const modal = $('modal')
  if(modal) modal.classList.add('hidden') 
}
function openConstModal(construct){ 
  // ✅ TAMBAHAN: Notify conflict system
  if (window.conflictHandler) {
    window.conflictHandler.startEditing('construction', construct.id)
  }
  
  const modal = $('const-modal')
  if(!modal) return
  
  const nameSpan = $('const-modal-name')
  const nameInput = $('const-modal-name-input')
  const colorInput = $('const-modal-color')
  
  if(nameSpan) nameSpan.textContent = construct.name
  if(nameInput) nameInput.value = construct.name
  
  let displayColor = construct.color
  if(!displayColor.startsWith('#')) displayColor = '#' + displayColor
  displayColor = displayColor.toLowerCase()
  
  if(colorInput) colorInput.value = displayColor
  
  modal.dataset.constructId = construct.id
  modal.classList.remove('hidden')
}

function closeConstModal(){ 
  // ✅ TAMBAHAN: Stop editing
  if (window.conflictHandler) {
    window.conflictHandler.stopEditing()
  }
  
  const modal = $('const-modal')
  if(modal) modal.classList.add('hidden') 
}

// Chart
let barChart = null
function updateChart(){ 
  const canvasEl = $('barChart')
  if(!canvasEl) return
  
  const ctx = canvasEl.getContext('2d')
  
  const map = {}
  constructions.forEach(c=> map[c.id] = 0)
  machines.forEach(m=>{
    if(map[m.constructId] !== undefined){
      map[m.constructId]++
    }
  })
  
  const constructIds = Object.keys(map)
  const labels = constructIds.map(k=> {
    const c = getConstructById(k)
    return c ? c.name : k
  })
  const data = constructIds.map(k=> map[k])
  const colors = constructIds.map(k=> {
    const c = getConstructById(k)
    return c ? c.color : '#999999'
  })
  
  if(barChart){
    barChart.destroy()
    barChart = null
  }
  
  barChart = new Chart(ctx, {
    type:'bar',
    data:{
      labels: labels,
      datasets:[{
        label:'Jumlah Mesin',
        data: data,
        backgroundColor: colors
      }]
    },
    options:{
      plugins:{legend:{display:false}},
      scales:{
        x:{ticks:{color:'#cbd5e1'}},
        y:{beginAtZero:true, ticks:{color:'#cbd5e1'}}
      }
    }
  })
}

function updateGreeting(){ 
  const h = new Date().getHours()
  const g = $('greeting')
  if(!g) return
  if(h<12) g.textContent='Selamat Pagi'
  else if(h<17) g.textContent='Selamat Sore'
  else g.textContent='Selamat Malam' 
}

function updateClock(){
  const el = $('clock')
  const de = $('date')
  if(!el) return
  
  const now = new Date()
  const hh = String(now.getHours()).padStart(2,'0')
  const mm = String(now.getMinutes()).padStart(2,'0')
  const ss = String(now.getSeconds()).padStart(2,'0')
  el.textContent = `${hh}:${mm}:${ss}`
  
  if(de) {
    try{
      de.textContent = now.toLocaleDateString('id-ID', { 
        weekday:'long', day:'numeric', month:'long', year:'numeric' 
      })
    }catch(e){
      de.textContent = now.toLocaleDateString()
    }
  }
}

// ============ INITIALIZATION ============
async function initializeApp() {
  try {
    console.log('🚀 Initializing app...')
    
    // Wait for Supabase to be available
    if (typeof supabaseInit !== 'undefined') {
      console.log('📡 Initializing Supabase...')
      const cloudReady = await supabaseInit()
      window.isCloudAvailable = cloudReady
      
      if (cloudReady) {
        console.log('✅ Cloud connected')
        
        // Load from cloud
        if (typeof loadMachinesFromCloud !== 'undefined') {
          const cloudMachines = await loadMachinesFromCloud()
          if (cloudMachines && cloudMachines.length > 0) {
            machines = cloudMachines
            machines.sort((a, b) => a.id - b.id)
            saveMachines()
            console.log('✅ Loaded machines from cloud')
          }
        }
        
        if (typeof loadConstructionsFromCloud !== 'undefined') {
          const cloudConstructs = await loadConstructionsFromCloud()
          if (cloudConstructs && cloudConstructs.length > 0) {
            constructions = cloudConstructs
            saveConstructions()
            console.log('✅ Loaded constructions from cloud')
          }
        }
        
        if (typeof loadHistoryFromCloud !== 'undefined') {
          const cloudHist = await loadHistoryFromCloud(500)
          if (cloudHist && cloudHist.length > 0) {
            window.cloudHistory = cloudHist
            isCloudSyncEnabled = true
            console.log('✅ Loaded history from cloud')
          }
        }
        
        if (typeof loadEfficiencyFromCloud !== 'undefined') {
          const cloudEff = await loadEfficiencyFromCloud()
          if (cloudEff && Object.keys(cloudEff).length > 0) {
            efficiencyData = cloudEff
            saveEfficiencyData()
            console.log('✅ Loaded efficiency from cloud')
          }
        }
        
        // Setup real-time listeners
        if (typeof setupRealtimeListeners !== 'undefined') {
          setupRealtimeListeners(
            (newMachines) => {
              console.log('🔄 Real-time: machines updated')
              machines = newMachines
              machines.sort((a, b) => a.id - b.id)
              saveMachines()
              renderGrid()
              updateChart()
              showToast('Mesin disinkronkan dari cloud', 'success')
            },
            (newConstructs) => {
              console.log('🔄 Real-time: constructions updated')
              constructions = newConstructs
              saveConstructions()
              renderLegend()
              renderConstructList()
              populateModalConstruct()
              renderGrid()
              updateChart()
              showToast('Konstruksi disinkronkan dari cloud', 'success')
            },
            (newHistory) => {
              console.log('🔄 Real-time: history updated')
              window.cloudHistory = newHistory
              renderHistory()
              showToast('History disinkronkan dari cloud', 'success')
            }
          )
          console.log('✅ Real-time listeners active')
        }
        
        showToast('✅ Connected to Cloud - Real-time Sync Active!', 'success')
      } else {
        console.log('⚠️ Cloud unavailable, using local storage')
        showToast('Mode Offline - Data tersimpan lokal', 'warn')
      }
    } else {
      console.log('⚠️ Supabase not loaded')
      window.isCloudAvailable = false
    }
  } catch (e) {
    console.error('❌ Init error:', e)
    window.isCloudAvailable = false
    showToast('Mode Offline', 'warn')
  }
  
// Render UI
  renderLegend()
  renderGrid()
  renderConstructList()
  populateModalConstruct()
  renderHistory()
  updateChart()
  updateGreeting()
  updateClock()
  attachEventListeners()
  
  // Setup efficiency modal listeners
  if (window.efficiencySystem && window.efficiencySystem.setupEfficiencyModalListeners) {
    window.efficiencySystem.setupEfficiencyModalListeners()
    console.log('✅ Efficiency modal listeners initialized')
  }
  
  console.log('✅ App initialized')
}

// Start app
if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp)
} else {
  initializeApp()
}

setInterval(updateClock, 1000)

// ============ EXCEL EXPORT ============
async function exportExcel(){
  const pad = n=> String(n).padStart(2,'0')
  const now = new Date()
  const fname = `layout_export_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.xlsx`

  if(window.ExcelJS){
    try{
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Didin'
      wb.created = now

      const ws1 = wb.addWorksheet('Machines')
      ws1.columns = [
        {header:'Machine', key:'machine', width:10},
        {header:'Construct ID', key:'cid', width:22},
        {header:'Construct Name', key:'cname', width:40},
        {header:'Block', key:'block', width:10},
        {header:'Assigned', key:'assigned', width:12}
      ]
      ws1.getRow(1).font = {bold:true}
      
      machines.forEach(m=>{
        const c = getConstructById(m.constructId) || {name:'UNASSIGNED'}
        const block = getMachineBlock(m.id)
        ws1.addRow({
          machine:m.id, 
          cid: m.constructId||'', 
          cname: c.name, 
          block: block,
          assigned: m.constructId? 'Yes':'No'
        })
      })

      const ws2 = wb.addWorksheet('Constructions')
      ws2.columns = [
        {header:'Construct ID', key:'id', width:26}, 
        {header:'Name', key:'name', width:40}, 
        {header:'Color', key:'color', width:14}, 
        {header:'Machines Using', key:'count', width:16}
      ]
      ws2.getRow(1).font = {bold:true}
      
      const counts = {}
      machines.forEach(m=>{ counts[m.constructId] = (counts[m.constructId]||0)+1 })
      constructions.forEach(c=> ws2.addRow({
        id:c.id, 
        name:c.name, 
        color:c.color, 
        count: counts[c.id]||0
      }))

      const ws3 = wb.addWorksheet('History')
      ws3.columns = [
        {header:'Machine',key:'machine',width:10},
        {header:'From',key:'from',width:18},
        {header:'To',key:'to',width:18},
        {header:'Editor',key:'editor',width:24},
        {header:'Date',key:'date',width:22}
      ]
      ws3.getRow(1).font = {bold:true}
      
      getHistory().forEach(h=>{
        const d = h.date ? new Date(h.date) : null
        const row = ws3.addRow({ 
          machine:h.machine||'', 
          from:h.from||'', 
          to:h.to||'', 
          editor:h.editor||'', 
          date: d || '' 
        })
        if(d && !isNaN(d)) row.getCell('date').numFmt = 'dd/mm/yyyy hh:mm:ss'
      })

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fname
      a.click()
      URL.revokeObjectURL(url)
      showToast(`Excel exported: ${fname}`, 'success')
      return
    }catch(err){ 
      console.error('ExcelJS export failed', err)
      showToast('Export failed', 'warn') 
    }
  }

  if(typeof XLSX === 'undefined'){ 
    showToast('XLSX library not available', 'warn')
    return 
  }
  
  const wb = XLSX.utils.book_new()
  const machinesData = [['Machine','Construct ID','Construct Name','Block','Assigned']]
  machines.forEach(m=>{
    const c = getConstructById(m.constructId) || {name:'UNASSIGNED'}
    const block = getMachineBlock(m.id)
    machinesData.push([m.id, m.constructId || '', c.name, block, m.constructId? 'Yes' : 'No'])
  })
  
  const ws1 = XLSX.utils.aoa_to_sheet(machinesData)
  XLSX.utils.book_append_sheet(wb, ws1, 'Machines')

  try{
    XLSX.writeFile(wb, fname)
    showToast(`Excel exported: ${fname}`, 'success')
  }catch(e){ 
    console.error(e)
    showToast('Export failed', 'warn') 
  }
}

// ============ TOAST NOTIFICATIONS ============
function ensureToastRoot(){ 
  let r = document.querySelector('.toast-root')
  if(!r){ 
    r = document.createElement('div')
    r.className = 'toast-root'
    r.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:8px'
    document.body.appendChild(r) 
  } 
  return r 
}

function showToast(text, type=''){
  const root = ensureToastRoot()
  const t = document.createElement('div')
  t.className = 'toast' + (type? ' '+type : '')
  t.style.cssText = `
    padding:12px 20px;
    background:rgba(15,23,42,0.95);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:8px;
    color:#fff;
    font-size:13px;
    box-shadow:0 10px 30px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease-out;
  `
  
  if(type === 'success'){
    t.style.borderColor = 'rgba(34,197,94,0.3)'
    t.style.background = 'rgba(34,197,94,0.1)'
  } else if(type === 'warn'){
    t.style.borderColor = 'rgba(251,146,60,0.3)'
    t.style.background = 'rgba(251,146,60,0.1)'
  }
  
  t.textContent = text
  root.appendChild(t)
  
  setTimeout(()=>{ 
    t.style.transition='opacity .3s, transform .3s'
    t.style.opacity='0'
    t.style.transform='translateX(20px)'
    setTimeout(()=> t.remove(),350) 
  }, 3500)
  
  return t
}

// ============ EFFICIENCY DASHBOARD UI ============
let effEditingMachine = null
let efficiencyPageChart = null

function renderEfficiencyDashboard() {
  const global = getGlobalEfficiency()
  document.getElementById('eff-global-avg').textContent = Math.round(global.average)
  document.getElementById('eff-global-bar').style.width = global.average + '%'
  document.getElementById('eff-machine-count').textContent = global.totalMachines
  document.getElementById('eff-shift-a').textContent = Math.round(global.byShift.A) + '%'
  document.getElementById('eff-shift-b').textContent = Math.round(global.byShift.B) + '%'
  document.getElementById('eff-shift-c').textContent = Math.round(global.byShift.C) + '%'

  let above = getEfficiencyStat(80, 100)
  let middle = getEfficiencyStat(60, 79.99)
  let below = getEfficiencyStat(0, 59.99)
  
  document.getElementById('eff-stat-above').textContent = above
  document.getElementById('eff-stat-middle').textContent = middle
  document.getElementById('eff-stat-below').textContent = below

  renderEfficiencyMachineList()
  renderEfficiencyChart()
}

function renderEfficiencyMachineList() {
  const list = document.getElementById('eff-machine-list')
  if(!list) return
  
  list.innerHTML = ''
  Object.keys(efficiencyData)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach(machineId => {
      const m = efficiencyData[machineId]
      const block = getMachineBlock(machineId)
      const row = document.createElement('div')
      row.style.cssText = 'background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;display:grid;grid-template-columns:auto 1fr auto auto;gap:12px;align-items:center;border-left:3px solid #34d399'
      
      let statusColor = '#34d399'
      if (m.average < 60) statusColor = '#f97316'
      else if (m.average < 80) statusColor = '#fbbf24'
      
      row.style.borderLeftColor = statusColor
      
      row.innerHTML = `
        <div style="font-weight:700;color:#ff6ec7;min-width:60px">M${machineId}</div>
        <div>
          <div style="font-weight:600;font-size:13px">Blok ${block}</div>
          <div style="font-size:11px;opacity:0.6;margin-top:2px">A: ${m.shifts.A}% | B: ${m.shifts.B}% | C: ${m.shifts.C}%</div>
        </div>
        <div style="font-weight:700;color:${statusColor};min-width:50px;text-align:center;font-size:16px">${Math.round(m.average)}%</div>
        <button onclick="openEffModal(${machineId})" style="padding:6px 12px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);color:#60a5fa;border-radius:4px;cursor:pointer;font-size:12px;transition:all .2s ease" onmouseover="this.style.background='rgba(59,130,246,0.2)'" onmouseout="this.style.background='rgba(59,130,246,0.1)'">✏️ Edit</button>
      `
      list.appendChild(row)
    })
}

function renderEfficiencyChart() {
  const canvas = document.getElementById('eff-chart-canvas')
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  
  // Prepare data for all machines
  const labels = []
  const data = []
  const colors = []
  
  Object.keys(efficiencyData)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach(machineId => {
      const m = efficiencyData[machineId]
      labels.push(`M${machineId}`)
      data.push(Math.round(m.average))
      
      if (m.average >= 80) colors.push('#34d399')
      else if (m.average >= 60) colors.push('#fbbf24')
      else colors.push('#f97316')
    })
  
  if (efficiencyPageChart) {
    efficiencyPageChart.destroy()
    efficiencyPageChart = null
  }
  
  efficiencyPageChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Efisiensi (%)',
        data: data,
        backgroundColor: colors,
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'x',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 12,
          titleColor: '#fff',
          bodyColor: '#fff'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { color: '#cbd5e1' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        x: {
          ticks: { color: '#cbd5e1', font: { size: 10 } },
          grid: { display: false }
        }
      }
    }
  })
}

function openEfficiencyPage() {
  try {
    console.log('🔓 Opening efficiency page...')
    const page = document.getElementById('efficiency-page')
    console.log('Page element:', page)
    if (page) {
      page.style.display = 'block'
      console.log('✅ Page displayed')
      renderEfficiencyDashboard()
      console.log('✅ Dashboard rendered')
    } else {
      console.error('❌ efficiency-page element not found')
      showToast('Error: Dashboard element not found', 'warn')
    }
  } catch(e) {
    console.error('❌ Error opening efficiency page:', e)
    showToast('Error: ' + e.message, 'warn')
  }
}

function closeEfficiencyPage() {
  const page = document.getElementById('efficiency-page')
  if (page) page.style.display = 'none'
}

function openEffModal(machineId) {
  effEditingMachine = machineId
  const m = efficiencyData[machineId]
  document.getElementById('eff-modal-machine').textContent = machineId
  document.getElementById('eff-input-a').value = m.shifts.A || 0
  document.getElementById('eff-input-b').value = m.shifts.B || 0
  document.getElementById('eff-input-c').value = m.shifts.C || 0
  const modal = document.getElementById('eff-edit-modal')
  modal.style.display = 'flex'
  modal.style.visibility = 'visible'
}

function closeEffModal() {
  document.getElementById('eff-edit-modal').style.display = 'none'
  effEditingMachine = null
}

function saveEffModal() {
  if (!effEditingMachine) return
  const a = parseInt(document.getElementById('eff-input-a').value) || 0
  const b = parseInt(document.getElementById('eff-input-b').value) || 0
  const c = parseInt(document.getElementById('eff-input-c').value) || 0
  
  setMachineAllShifts(effEditingMachine, a, b, c)
  closeEffModal()
  renderEfficiencyDashboard()
  renderGrid()
  showToast('✅ Efisiensi mesin diperbarui', 'success')
}

function addSampleDataEff() {
  for (let i = 1; i <= 10; i++) {
    const a = Math.floor(Math.random() * 40) + 60
    const b = Math.floor(Math.random() * 40) + 60
    const c = Math.floor(Math.random() * 40) + 60
    setMachineAllShifts(i, a, b, c)
  }
  renderEfficiencyDashboard()
  showToast('✅ Data sample untuk 10 mesin sudah ditambahkan!', 'success')
}

window._layout = {
  machines, 
  constructions, 
  updateChart,
  isCloudAvailable: () => window.isCloudAvailable,
  efficiencyData,  // ← HAPUS
  setMachineShiftEfficiency,  // ← HAPUS
  setMachineAllShifts,  // ← HAPUS
  getGlobalEfficiency,  // ← HAPUS
  getEfficiencyByBlock  // ← HAPUS
}
// ============ EFFICIENCY SYSTEM CHECK ============
if (window.efficiencySystem) {
  console.log('✅ Efficiency system available in layout app')
} else {
  console.error('❌ Efficiency system NOT available')
}































