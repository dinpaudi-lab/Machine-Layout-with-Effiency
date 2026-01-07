// ============ SUPABASE SYNC COMPLETE ============
const SUPABASE_URL = 'https://omkovtlvabwblgijodxe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ta292dGx2YWJ3YmxnaWpvZHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3OTA2MzgsImV4cCI6MjA3OTM2NjYzOH0._9CRzqxKd450pX5ZgVAaocCUfWh5vV2GJXIFK3XAGKc';

let supabase = null;
let isCloudAvailable = false;
let currentUserId = null;
let realtimeChannels = [];

async function supabaseInit() {
  try {
    console.log('🔧 Supabase init...');
    if (supabase && isCloudAvailable) return true;

    if (!window.supabase) {
      await loadSupabaseSDK();
    }

    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    
    const test = await supabase.from('machines').select('id').limit(1);
    if (test.error) throw test.error;
    
    isCloudAvailable = true;
    window.isCloudAvailable = true;
    console.log('✅ Cloud ready');
    return true;
  } catch (e) {
    console.error('❌ Cloud error:', e.message);
    isCloudAvailable = false;
    window.isCloudAvailable = false;
    return false;
  }
}

function loadSupabaseSDK() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = () => setTimeout(() => resolve(), 100);
    script.onerror = () => reject(new Error('SDK load failed'));
    document.head.appendChild(script);
  });
}

async function supabaseSignIn(email, password) {
  const users = {
    'didin@company.com': '86532',
    'indra@company.com': '86086',
    'nur@company.com': '80229',
    'desi@company.com': '82847'
  };
  if (users[email] && users[email] === password) {
    currentUserId = email.replace(/[^a-z0-9]/g, '_');
    return { email, uid: currentUserId, name: email.split('@')[0] };
  }
  throw new Error('Login failed');
}

async function supabaseSignOut() {
  currentUserId = null;
  cleanupListeners();
  return true;
}

async function loadMachinesFromCloud() {
  if (!isCloudAvailable || !supabase) return null;
  try {
    const result = await supabase.from('machines').select('*').order('id');
    if (result.error) throw result.error;
    if (result.data && result.data.length > 0) {
      return result.data.map(m => ({ id: m.id, constructId: m.construct_id }));
    }
    return null;
  } catch (e) {
    console.error('Load machines error:', e.message);
    return null;
  }
}

async function saveMachineToCloud(machineId, constructId, userId, oldConstructId) {
  if (!isCloudAvailable || !supabase) return false;
  try {
    await supabase.from('machines').upsert({
      id: machineId,
      construct_id: constructId,
      last_edited_by: userId || getCurrentUserId(),
      last_edited_at: new Date().toISOString(),
      device_id: getDeviceId()
    }, { onConflict: 'id' });
    
    await supabase.from('history').insert({
      timestamp: Date.now(),
      machine_id: machineId,
      from: oldConstructId,
      to: constructId,
      editor: userId || getCurrentUserId(),
      device_id: getDeviceId()
    });
    return true;
  } catch (e) {
    console.error('Save machine error:', e.message);
    return false;
  }
}

async function loadConstructionsFromCloud() {
  if (!isCloudAvailable || !supabase) return null;
  try {
    const result = await supabase.from('constructions').select('*');
    if (result.error) throw result.error;
    if (result.data && result.data.length > 0) {
      return result.data.map(c => ({
        id: c.id,
        name: c.name,
        color: c.color
      }));
    }
    return null;
  } catch (e) {
    console.error('Load constructions error:', e.message);
    return null;
  }
}

async function saveConstructionToCloud(construction, userId) {
  if (!isCloudAvailable || !supabase) return false;
  try {
    await supabase.from('constructions').upsert({
      id: construction.id,
      name: construction.name,
      color: construction.color,
      created_by: userId || getCurrentUserId()
    }, { onConflict: 'id' });
    return true;
  } catch (e) {
    console.error('Save construction error:', e.message);
    return false;
  }
}

async function deleteConstructionFromCloud(constructionId) {
  if (!isCloudAvailable || !supabase) return false;
  try {
    await supabase.from('constructions').delete().eq('id', constructionId);
    return true;
  } catch (e) {
    console.error('Delete construction error:', e.message);
    return false;
  }
}

async function loadHistoryFromCloud(limit) {
  if (!isCloudAvailable || !supabase) return null;
  try {
    const result = await supabase.from('history').select('*').order('timestamp', { ascending: false }).limit(limit || 1000);
    if (result.error) throw result.error;
    if (result.data && result.data.length > 0) {
      return result.data.map(h => ({
        machine: h.machine_id,
        from: h.from,
        to: h.to,
        editor: h.editor,
        date: new Date(h.timestamp).toISOString()
      }));
    }
    return null;
  } catch (e) {
    console.error('Load history error:', e.message);
    return null;
  }
}

async function saveHistoryToCloud(entry) {
  if (!isCloudAvailable || !supabase) return false;
  try {
    await supabase.from('history').insert({
      timestamp: Date.now(),
      machine_id: entry.details?.machine,
      from: entry.details?.from,
      to: entry.details?.to,
      editor: entry.details?.editor || getCurrentUserId(),
      device_id: getDeviceId()
    });
    return true;
  } catch (e) {
    console.error('Save history error:', e.message);
    return false;
  }
}

async function saveEfficiencyToCloud(efficiencyData) {
  if (!isCloudAvailable || !supabase) return false;
  try {
    const entries = [];
    Object.keys(efficiencyData).forEach(machineId => {
      Object.keys(efficiencyData[machineId]).forEach(date => {
        const eff = efficiencyData[machineId][date];
        entries.push({
          machine_id: parseInt(machineId),
          date: date,
          shift_a: parseFloat(eff.shiftA) || 0,
          shift_b: parseFloat(eff.shiftB) || 0,
          shift_c: parseFloat(eff.shiftC) || 0,
          global_efficiency: parseFloat(eff.global) || 0,
          editor: eff.editor || getCurrentUserId(),
          timestamp: eff.timestamp || new Date().toISOString(),
          device_id: getDeviceId()
        });
      });
    });
    
    if (entries.length === 0) return true;
    
    console.log('💾 Saving', entries.length, 'efficiency records to cloud...');
    
    const BATCH = 500;
    let savedCount = 0;
    const totalBatches = Math.ceil(entries.length / BATCH);
    
    if (typeof showLoadingOverlay !== 'undefined') {
      showLoadingOverlay('☁️ Syncing to cloud...', true);
    }
    
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      const currentBatch = Math.floor(i / BATCH) + 1;
      
      console.log(`📦 Syncing batch ${currentBatch}/${totalBatches} (${batch.length} records)...`);
      
      if (typeof updateLoadingProgress !== 'undefined') {
        updateLoadingProgress(savedCount, entries.length);
      }
      
      if (typeof updateLoadingOverlay !== 'undefined') {
        updateLoadingOverlay(
          `☁️ Syncing to cloud...`,
          `Batch ${currentBatch}/${totalBatches} - ${savedCount}/${entries.length} records`
        );
      }
      
      const result = await supabase.from('efficiency').upsert(batch, { onConflict: 'machine_id,date' });
      
      if (result.error) {
        console.error('❌ Batch sync error:', result.error.message);
      } else {
        savedCount += batch.length;
        console.log(`✅ Batch synced (${savedCount}/${entries.length} total)`);
        
        if (typeof updateLoadingProgress !== 'undefined') {
          updateLoadingProgress(savedCount, entries.length);
        }
      }
      
      if (i + BATCH < entries.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`✅ Efficiency saved to cloud: ${savedCount}/${entries.length} records`);
    return savedCount === entries.length;
  } catch (e) {
    console.error('Save efficiency error:', e.message);
    return false;
  }
}

async function loadEfficiencyFromCloud() {
  if (!isCloudAvailable || !supabase) return null;
  try {
    const result = await supabase.from('efficiency').select('*');
    if (result.error) throw result.error;
    if (result.data && result.data.length > 0) {
      const data = {};
      result.data.forEach(eff => {
        if (!data[eff.machine_id]) data[eff.machine_id] = {};
        data[eff.machine_id][eff.date] = {
          shiftA: parseFloat(eff.shift_a),
          shiftB: parseFloat(eff.shift_b),
          shiftC: parseFloat(eff.shift_c),
          global: parseFloat(eff.global_efficiency),
          editor: eff.editor,
          timestamp: eff.timestamp
        };
      });
      return data;
    }
    return null;
  } catch (e) {
    console.error('Load efficiency error:', e.message);
    return null;
  }
}

async function saveGlobalEfficiencyToCloud(globalData) {
  if (!isCloudAvailable || !supabase) return false;
  try {
    const entries = [];
    Object.keys(globalData).forEach(date => {
      const d = globalData[date];
      entries.push({
        date: date,
        counter_a: parseFloat(d.counterA) || 0,
        pick_a: parseFloat(d.pickA) || 0,
        counter_b: parseFloat(d.counterB) || 0,
        pick_b: parseFloat(d.pickB) || 0,
        counter_c: parseFloat(d.counterC) || 0,
        pick_c: parseFloat(d.pickC) || 0,
        machines_run: parseInt(d.machinesRun) || 600,
        shift_a_eff: parseFloat(d.shiftA) || 0,
        shift_b_eff: parseFloat(d.shiftB) || 0,
        shift_c_eff: parseFloat(d.shiftC) || 0,
        global_eff: parseFloat(d.global) || 0,
        editor: d.editor || getCurrentUserId(),
        timestamp: d.timestamp || new Date().toISOString(),
        device_id: getDeviceId()
      });
    });
    
    if (entries.length === 0) return true;
    
    await supabase.from('global_efficiency').upsert(entries, { onConflict: 'date' });
    console.log('✅ Global efficiency saved');
    return true;
  } catch (e) {
    console.error('Save global efficiency error:', e.message);
    return false;
  }
}

async function loadGlobalEfficiencyFromCloud() {
  if (!isCloudAvailable || !supabase) return null;
  try {
    const result = await supabase.from('global_efficiency').select('*');
    if (result.error) throw result.error;
    if (result.data && result.data.length > 0) {
      const data = {};
      result.data.forEach(r => {
        data[r.date] = {
          counterA: parseFloat(r.counter_a),
          pickA: parseFloat(r.pick_a),
          counterB: parseFloat(r.counter_b),
          pickB: parseFloat(r.pick_b),
          counterC: parseFloat(r.counter_c),
          pickC: parseFloat(r.pick_c),
          machinesRun: parseInt(r.machines_run),
          shiftA: parseFloat(r.shift_a_eff),
          shiftB: parseFloat(r.shift_b_eff),
          shiftC: parseFloat(r.shift_c_eff),
          global: parseFloat(r.global_eff),
          editor: r.editor,
          timestamp: r.timestamp
        };
      });
      return data;
    }
    return null;
  } catch (e) {
    console.error('Load global efficiency error:', e.message);
    return null;
  }
}

let machineUpdateTimeout = null;
let constructUpdateTimeout = null;
let historyUpdateTimeout = null;

async function setupRealtimeListeners(onMachines, onConstructs, onHistory) {
  if (!isCloudAvailable || !supabase) return;
  cleanupListeners();
  
  const machinesChannel = supabase.channel('machines_' + Date.now())
  .on('postgres_changes', { event: '*', schema: 'public', table: 'machines' }, async (p) => {
    if (p.new?.device_id === getDeviceId()) {
      console.log('🚫 Skipping own change');
      return;
    }
    
    if (machineUpdateTimeout) clearTimeout(machineUpdateTimeout);
    machineUpdateTimeout = setTimeout(async () => {
      console.log('🔄 Real-time: machines updated');
      if (onMachines) {
        const m = await loadMachinesFromCloud();
        if (m) onMachines(m);
      }
    }, 2000);
  }).subscribe();
  
  const constructsChannel = supabase.channel('constructs_' + Date.now())
  .on('postgres_changes', { event: '*', schema: 'public', table: 'constructions' }, async (p) => {
    if (p.new?.device_id === getDeviceId()) {
      console.log('🚫 Skipping own change');
      return;
    }
    
    if (constructUpdateTimeout) clearTimeout(constructUpdateTimeout);
    constructUpdateTimeout = setTimeout(async () => {
      console.log('🔄 Real-time: constructions updated');
      if (onConstructs) {
        const c = await loadConstructionsFromCloud();
        if (c) onConstructs(c);
      }
    }, 2000);
  }).subscribe();
  
  const historyChannel = supabase.channel('history_' + Date.now())
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'history' }, async (p) => {
    if (p.new?.device_id === getDeviceId()) {
      console.log('🚫 Skipping own change');
      return;
    }
    
    if (historyUpdateTimeout) clearTimeout(historyUpdateTimeout);
    historyUpdateTimeout = setTimeout(async () => {
      console.log('🔄 Real-time: history updated');
      if (onHistory) {
        const h = await loadHistoryFromCloud();
        if (h) onHistory(h);
      }
    }, 2000);
  }).subscribe();
  
  realtimeChannels.push(machinesChannel, constructsChannel, historyChannel);
  console.log('✅ Real-time active');
}

let effUpdateTimeout = null
let globalUpdateTimeout = null

async function setupEfficiencyRealtimeListener(onEff, onGlobal) {
  if (!isCloudAvailable || !supabase) {
    console.warn('⚠️ Cloud not available')
    return
  }
  
  console.log('🔄 Setting up efficiency real-time listeners...')
  
  const effChannel = supabase.channel('efficiency_changes_' + Date.now())
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'efficiency' 
    }, async (payload) => {
      if (payload.new?.device_id === getDeviceId()) {
        return
      }
      
      console.log('🔔 Machine efficiency update from cloud')
      
      if (effUpdateTimeout) clearTimeout(effUpdateTimeout)
      
      effUpdateTimeout = setTimeout(async () => {
  try {
    console.log('🔄 Fetching fresh efficiency data from cloud...')
    const freshData = await loadEfficiencyFromCloud()
    
    if (freshData && Object.keys(freshData).length > 0) {
      console.log('✅ Loaded', Object.keys(freshData).length, 'machines from cloud')
      
      // ✅ CRITICAL: Update ALL references
      if (window.efficiencySystem) {
        window.efficiencySystem.efficiencyData = freshData
        efficiencyData = freshData // Update module-level variable
        localStorage.setItem('machine_efficiency_v2', JSON.stringify(freshData))
        
        console.log('💾 Updated local storage and memory')
      }
      
      // ✅ Trigger callback
      if (onEff) {
        console.log('📡 Calling callback to update UI...')
        onEff(freshData)
      }
      
      // ✅ Force UI update jika di halaman efficiency
      if (typeof renderEfficiencyGrid === 'function') {
        console.log('🎨 Forcing UI refresh...')
        renderEfficiencyGrid()
      }
      if (typeof updateBlockSummary === 'function') {
        updateBlockSummary()
      }
      if (typeof updateBlockChart === 'function') {
        updateBlockChart()
      }
    } else {
      console.log('⚠️ No data received from cloud')
    }
  } catch (e) {
    console.error('❌ Real-time update error:', e)
  }
}, 2000)
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Machine efficiency real-time subscribed')
      }
    })
  
  const globalChannel = supabase.channel('global_efficiency_changes_' + Date.now())
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'global_efficiency' 
    }, async (payload) => {
      if (payload.new?.device_id === getDeviceId()) {
        return
      }
      
      console.log('🔔 Global efficiency update from cloud')
      
      if (globalUpdateTimeout) clearTimeout(globalUpdateTimeout)
      
      globalUpdateTimeout = setTimeout(async () => {
        try {
          const freshData = await loadGlobalEfficiencyFromCloud()
          
          if (freshData && Object.keys(freshData).length > 0) {
            console.log('✅ Loaded', Object.keys(freshData).length, 'dates')
            
            if (window.globalEfficiencySystem) {
              window.globalEfficiencySystem.globalEfficiencyData = freshData
              localStorage.setItem('global_efficiency_v1', JSON.stringify(freshData))
            }
            
            if (onGlobal) {
              onGlobal(freshData)
            }
          }
        } catch (e) {
          console.error('Error:', e)
        }
      }, 2000)
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Global efficiency real-time subscribed')
      }
    })
  
  realtimeChannels.push(effChannel, globalChannel)
  console.log('✅ Efficiency real-time active')
}

function cleanupListeners() {
  realtimeChannels.forEach(ch => supabase?.removeChannel(ch));
  realtimeChannels = [];
}

function getCurrentUserId() {
  return currentUserId || localStorage.getItem('currentUserId') || 'unknown';
}

function getDeviceId() {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = 'device_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('device_id', id);
  }
  return id;
}

function getDeviceName() {
  let name = localStorage.getItem('device_name');
  if (!name) {
    const ua = navigator.userAgent;
    if (ua.includes('Windows')) name = 'Windows PC';
    else if (ua.includes('Mac')) name = 'Mac';
    else if (ua.includes('Android')) name = 'Android';
    else name = 'Device';
    localStorage.setItem('device_name', name);
  }
  return name;
}

// ============ AUTO-SYNC PENDING EFFICIENCY DATA ============

// Cek dan sync data efisiensi yang pending
async function syncPendingEfficiency() {
  try {
    const pending = localStorage.getItem('pending_efficiency_sync')
    if (!pending) return
    
    console.log('🔄 Found pending efficiency data, syncing...')
    const pendingData = JSON.parse(pending)
    
    if (typeof saveEfficiencyToCloud !== 'undefined' && window.isCloudAvailable) {
      await saveEfficiencyToCloud(pendingData.data)
      localStorage.removeItem('pending_efficiency_sync')
      console.log('✅ Pending efficiency data synced to cloud')
      
      // Update UI jika di halaman efisiensi
      if (typeof window.efficiencySystem !== 'undefined') {
        window.efficiencySystem.loadEfficiencyData()
      }
    }
  } catch (e) {
    console.warn('⚠️ Failed to sync pending efficiency:', e)
  }
}

// Auto-sync ketika app load
if (typeof supabaseInit !== 'undefined') {
  supabaseInit().then(ready => {
    if (ready) {
      window.isCloudAvailable = true
      // Cek pending data setelah cloud ready
      setTimeout(syncPendingEfficiency, 2000)
    }
  })
}

// Auto-sync ketika device online
window.addEventListener('online', () => {
  if (window.isCloudAvailable) {
    syncPendingEfficiency()
  }
})

// ============ PATCH: Ensure loadEfficiencyFromCloud exists ============
if (typeof loadEfficiencyFromCloud === 'undefined') {
  window.loadEfficiencyFromCloud = async function() {
    if (!isCloudAvailable || !supabase) return null
    try {
      const result = await supabase.from('efficiency').select('*')
      if (result.error) throw result.error
      if (result.data && result.data.length > 0) {
        const data = {}
        result.data.forEach(eff => {
          if (!data[eff.machine_id]) data[eff.machine_id] = {}
          data[eff.machine_id][eff.date] = {
            shiftA: parseFloat(eff.shift_a),
            shiftB: parseFloat(eff.shift_b),
            shiftC: parseFloat(eff.shift_c),
            global: parseFloat(eff.global_efficiency),
            editor: eff.editor,
            timestamp: eff.timestamp
          }
        })
        console.log('✅ loadEfficiencyFromCloud: Got', Object.keys(data).length, 'machines')
        return data
      }
      return null
    } catch (e) {
      console.error('loadEfficiencyFromCloud error:', e)
      return null
    }
  }
}
window.supabaseInit = supabaseInit;
window.supabaseSignIn = supabaseSignIn;
window.supabaseSignOut = supabaseSignOut;
window.loadMachinesFromCloud = loadMachinesFromCloud;
window.saveMachineToCloud = saveMachineToCloud;
window.loadConstructionsFromCloud = loadConstructionsFromCloud;
window.saveConstructionToCloud = saveConstructionToCloud;
window.deleteConstructionFromCloud = deleteConstructionFromCloud;
window.loadHistoryFromCloud = loadHistoryFromCloud;
window.saveHistoryToCloud = saveHistoryToCloud;
window.saveEfficiencyToCloud = saveEfficiencyToCloud;
window.loadEfficiencyFromCloud = loadEfficiencyFromCloud;
window.saveGlobalEfficiencyToCloud = saveGlobalEfficiencyToCloud;
window.loadGlobalEfficiencyFromCloud = loadGlobalEfficiencyFromCloud;
window.setupRealtimeListeners = setupRealtimeListeners;
window.setupEfficiencyRealtimeListener = setupEfficiencyRealtimeListener;

console.log('✅ Supabase complete loaded');
