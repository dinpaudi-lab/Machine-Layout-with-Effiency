// ============ SUPABASE SYNC LAYER - FIXED VERSION ============
// Real-time sync dengan Supabase database

// ✅ CREDENTIALS YANG BENAR
const SUPABASE_URL = 'https://omkovtlvabwblgijodxe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ta292dGx2YWJ3YmxnaWpvZHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3OTA2MzgsImV4cCI6MjA3OTM2NjYzOH0._9CRzqxKd450pX5ZgVAaocCUfWh5vV2GJXIFK3XAGKc';

let supabase = null;
let isCloudAvailable = false;
let currentUserId = null;
let realtimeChannels = [];

// ============ INITIALIZATION ============

async function supabaseInit() {
  try {
    console.log('🔧 Starting Supabase initialization...');
    console.log('📍 Supabase URL:', SUPABASE_URL);
    
    // Check if already initialized
    if (supabase && isCloudAvailable) {
      console.log('✅ Supabase already initialized');
      return true;
    }

    // Test basic connectivity
    console.log('🌐 Testing basic connectivity...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      await fetch('https://www.google.com/favicon.ico', { 
        mode: 'no-cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      console.log('✅ Network is available');
    } catch (netErr) {
      clearTimeout(timeoutId);
      console.error('❌ Network issue:', netErr.message);
      throw new Error('No network connection');
    }

    // Test Supabase URL accessibility
    console.log('🔍 Testing Supabase URL accessibility...');
    const supabaseController = new AbortController();
    const supabaseTimeout = setTimeout(() => supabaseController.abort(), 8000);
    
    try {
      const urlTest = await fetch(SUPABASE_URL + '/rest/v1/', {
        method: 'HEAD',
        headers: {
          'apikey': SUPABASE_KEY,
          'Content-Type': 'application/json'
        },
        signal: supabaseController.signal
      });
      clearTimeout(supabaseTimeout);
      
      if (!urlTest.ok && urlTest.status !== 404) {
        throw new Error('HTTP ' + urlTest.status + ': ' + urlTest.statusText);
      }
      
      console.log('✅ Supabase URL is accessible:', urlTest.status);
    } catch (urlErr) {
      clearTimeout(supabaseTimeout);
      
      if (urlErr.name === 'AbortError') {
        throw new Error('Supabase connection timeout - server tidak merespons');
      }
      
      console.error('❌ Cannot reach Supabase URL:', urlErr.message);
      throw new Error('Supabase URL not accessible: ' + urlErr.message);
    }

    // Load Supabase SDK
    if (!window.supabase) {
      console.log('📦 Loading Supabase SDK...');
      await loadSupabaseSDK();
    }

    console.log('🔨 Creating Supabase client...');
    const createClientFunc = window.supabase.createClient;
    
    if (!createClientFunc) {
      throw new Error('Supabase createClient not found');
    }
    
    supabase = createClientFunc(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
    
    console.log('✅ Supabase client created');
    
    // Test database connection
    console.log('🧪 Testing database connection...');
    const testResult = await supabase
      .from('machines')
      .select('id')
      .limit(1);
    
    if (testResult.error) {
      console.error('❌ Database test failed:', testResult.error.message);
      
      // Check if tables exist
      if (testResult.error.message.includes('relation') && testResult.error.message.includes('does not exist')) {
        throw new Error('Tabel database belum dibuat. Jalankan setup database dulu.');
      }
      
      throw testResult.error;
    }
    
    isCloudAvailable = true;
    window.isCloudAvailable = true;
    
    console.log('✅ Supabase initialized successfully');
    console.log('📡 Real-time enabled');
    console.log('🎉 Cloud status: AVAILABLE');
    
    return true;
  } catch (e) {
    console.error('❌ Supabase init error:', e.message);
    console.error('Full error:', e);
    
    isCloudAvailable = false;
    window.isCloudAvailable = false;
    
    // User-friendly error messages
    if (e.message.includes('network') || e.message.includes('Network')) {
      console.warn('⚠️ Masalah jaringan - Mode Offline');
    } else if (e.message.includes('timeout')) {
      console.warn('⚠️ Koneksi timeout - Supabase tidak merespons');
    } else if (e.message.includes('not accessible')) {
      console.warn('⚠️ Supabase tidak dapat diakses - Cek firewall/proxy');
    } else if (e.message.includes('Tabel database')) {
      console.warn('⚠️ Database belum di-setup');
    } else {
      console.warn('⚠️ Mode Offline - Data tersimpan lokal');
    }
    
    return false;
  }
}

// Load Supabase SDK dynamically
function loadSupabaseSDK() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    
    script.onload = () => {
      console.log('✅ Supabase SDK loaded');
      
      // Wait for SDK to be fully available
      setTimeout(() => {
        if (window.supabase && window.supabase.createClient) {
          resolve();
        } else {
          reject(new Error('Supabase SDK loaded but createClient not found'));
        }
      }, 100);
    };
    
    script.onerror = (err) => {
      console.error('❌ Failed to load Supabase SDK:', err);
      reject(new Error('Failed to load Supabase SDK from CDN'));
    };
    
    document.head.appendChild(script);
  });
}

// ============ AUTHENTICATION ============

async function supabaseSignIn(email, password) {
  console.log('🔐 Attempting sign in:', email);
  
  const LOCAL_USERS = {
    'didin@company.com': '86532',
    'indra@company.com': '86086',
    'nur@company.com': '80229',
    'desi@company.com': '82847'
  };

  if (LOCAL_USERS[email] && LOCAL_USERS[email] === password) {
    currentUserId = email.replace(/[^a-z0-9]/g, '_');
    const user = {
      email: email,
      uid: currentUserId,
      name: email.split('@')[0]
    };
    console.log('✅ Login successful:', email);
    return user;
  }

  throw new Error('Email atau password salah');
}

async function supabaseSignOut() {
  currentUserId = null;
  cleanupListeners();
  console.log('✅ Signed out');
  return true;
}

function getCurrentUserId() {
  return currentUserId || localStorage.getItem('currentUserId') || 'unknown';
}

// ============ MACHINES - LOAD ============

async function loadMachinesFromCloud() {
  if (!isCloudAvailable || !supabase) {
    console.log('⚠️ Cloud not available, using local storage');
    return null;
  }

  try {
    console.log('📥 Loading machines from Supabase...');
    const result = await supabase
      .from('machines')
      .select('*')
      .order('id', { ascending: true });

    if (result.error) {
      console.error('❌ Database error:', result.error);
      throw result.error;
    }

    if (result.data && result.data.length > 0) {
      console.log('✅ Loaded ' + result.data.length + ' machines from Supabase');
      return result.data.map(m => ({
        id: m.id,
        constructId: m.construct_id
      }));
    }

    console.log('ℹ️ No machines found in database');
    return null;
  } catch (e) {
    console.error('❌ Load machines error:', e.message);
    return null;
  }
}

// ============ MACHINES - SAVE ============

async function saveMachineToCloud(machineId, constructId, userId, oldConstructId) {
  if (!isCloudAvailable || !supabase) {
    console.log('⚠️ Cloud not available for machine save');
    return false;
  }

  try {
    const timestamp = new Date().toISOString();
    const user = userId || getCurrentUserId();

    console.log('💾 Saving machine ' + machineId + ' to cloud...');

    const machineResult = await supabase
      .from('machines')
      .upsert({
        id: machineId,
        construct_id: constructId || null,
        last_edited_by: user,
        last_edited_at: timestamp
      }, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      });

    if (machineResult.error) {
      console.error('❌ Machine upsert error:', machineResult.error);
      throw machineResult.error;
    }

    const historyResult = await supabase
      .from('history')
      .insert({
        timestamp: Date.now(),
        machine_id: machineId,
        from: oldConstructId || null,
        to: constructId || null,
        editor: user,
        action: 'UPDATE_MACHINE',
        type: 'machine_update',
        device_id: getDeviceId(),
        device_name: getDeviceName()
      });

    if (historyResult.error) {
      console.warn('⚠️ History insert warning:', historyResult.error);
    }

    console.log('✅ Machine ' + machineId + ' saved to cloud');
    return true;
  } catch (e) {
    console.error('❌ Save machine error:', e.message);
    return false;
  }
}

// ============ CONSTRUCTIONS - LOAD ============

async function loadConstructionsFromCloud() {
  if (!isCloudAvailable || !supabase) {
    console.log('⚠️ Cloud not available for constructions');
    return null;
  }

  try {
    console.log('📥 Loading constructions from Supabase...');
    const result = await supabase
      .from('constructions')
      .select('*');

    if (result.error) throw result.error;

    if (result.data && result.data.length > 0) {
      console.log('✅ Loaded ' + result.data.length + ' constructions from Supabase');
      return result.data.map(c => ({
        id: c.id,
        name: c.name,
        color: c.color,
        createdBy: c.created_by,
        createdAt: c.created_at
      }));
    }

    console.log('ℹ️ No constructions found in database');
    return null;
  } catch (e) {
    console.error('❌ Load constructions error:', e.message);
    return null;
  }
}

// ============ CONSTRUCTIONS - SAVE ============

async function saveConstructionToCloud(construction, userId, isNew) {
  if (!isCloudAvailable || !supabase) {
    console.log('⚠️ Cloud not available for construction save');
    return false;
  }

  try {
    const user = userId || getCurrentUserId();
    console.log('💾 Saving construction ' + construction.id + ' to cloud...');

    const result = await supabase
      .from('constructions')
      .upsert({
        id: construction.id,
        name: construction.name,
        color: construction.color,
        created_by: construction.createdBy || user,
        created_at: construction.createdAt || new Date().toISOString()
      }, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      });

    if (result.error) throw result.error;

    console.log('✅ Construction ' + construction.id + ' saved to cloud');
    return true;
  } catch (e) {
    console.error('❌ Save construction error:', e.message);
    return false;
  }
}

// ============ CONSTRUCTIONS - DELETE ============

async function deleteConstructionFromCloud(constructionId, userId) {
  if (!isCloudAvailable || !supabase) return false;

  try {
    console.log('🗑️ Deleting construction ' + constructionId + ' from cloud...');
    
    const result = await supabase
      .from('constructions')
      .delete()
      .eq('id', constructionId);

    if (result.error) throw result.error;

    console.log('✅ Deleted construction ' + constructionId + ' from cloud');
    return true;
  } catch (e) {
    console.error('❌ Delete construction error:', e.message);
    return false;
  }
}

// ============ HISTORY - LOAD ============

async function loadHistoryFromCloud(limit) {
  if (!isCloudAvailable || !supabase) {
    console.log('⚠️ Cloud not available for history');
    return null;
  }

  try {
    const maxLimit = limit || 1000;
    console.log('📥 Loading history from Supabase...');
    
    const result = await supabase
      .from('history')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(maxLimit);

    if (result.error) throw result.error;

    if (result.data && result.data.length > 0) {
      console.log('✅ Loaded ' + result.data.length + ' history entries from Supabase');
      return result.data.map(h => ({
        machine: h.machine_id,
        from: h.from,
        to: h.to,
        editor: h.editor,
        date: new Date(h.timestamp).toISOString(),
        action: h.action,
        type: h.type
      }));
    }

    console.log('ℹ️ No history found in database');
    return null;
  } catch (e) {
    console.error('❌ Load history error:', e.message);
    return null;
  }
}

// ============ HISTORY - SAVE ============

async function saveHistoryToCloud(historyEntry) {
  if (!isCloudAvailable || !supabase) {
    console.log('⚠️ Cloud not available for history save');
    return false;
  }

  try {
    const result = await supabase
      .from('history')
      .insert({
        timestamp: Date.now(),
        type: historyEntry.type || 'general',
        machine_id: historyEntry.details ? historyEntry.details.machine : null,
        from: historyEntry.details ? historyEntry.details.from : null,
        to: historyEntry.details ? historyEntry.details.to : null,
        action: historyEntry.action || 'update',
        editor: historyEntry.details ? historyEntry.details.editor : getCurrentUserId(),
        device_id: historyEntry.device_id || getDeviceId(),
        device_name: historyEntry.device_name || getDeviceName()
      });

    if (result.error) throw result.error;

    console.log('✅ History saved to Supabase');
    return true;
  } catch (e) {
    console.error('❌ Save history error:', e.message);
    return false;
  }
}

// ============ REAL-TIME LISTENERS ============

async function setupRealtimeListeners(onMachinesChange, onConstructionsChange, onHistoryChange) {
  if (!isCloudAvailable || !supabase) {
    console.log('⚠️ Supabase not available, skipping real-time setup');
    return;
  }

  try {
    console.log('🔌 Setting up real-time listeners...');

    cleanupListeners();

    const machinesChannel = supabase
      .channel('public:machines:' + Date.now())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'machines' },
        async (payload) => {
          console.log('🔄 Machine update received:', payload.eventType, payload.new ? payload.new.id : '');
          if (onMachinesChange) {
            const machines = await loadMachinesFromCloud();
            if (machines) onMachinesChange(machines);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Machines channel:', status);
      });

    realtimeChannels.push(machinesChannel);

    const constructionsChannel = supabase
      .channel('public:constructions:' + Date.now())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'constructions' },
        async (payload) => {
          console.log('🔄 Construction update received:', payload.eventType);
          if (onConstructionsChange) {
            const constructions = await loadConstructionsFromCloud();
            if (constructions) onConstructionsChange(constructions);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Constructions channel:', status);
      });

    realtimeChannels.push(constructionsChannel);

    const historyChannel = supabase
      .channel('public:history:' + Date.now())
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'history' },
        async (payload) => {
          console.log('🔄 New history entry received');
          if (onHistoryChange) {
            const history = await loadHistoryFromCloud();
            if (history) onHistoryChange(history);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 History channel:', status);
      });

    realtimeChannels.push(historyChannel);

    console.log('✅ Real-time listeners activated');
    console.log('📊 Active channels: ' + realtimeChannels.length);
  } catch (e) {
    console.error('❌ Setup listeners error:', e);
  }
}

function cleanupListeners() {
  if (realtimeChannels.length > 0) {
    console.log('🧹 Cleaning up ' + realtimeChannels.length + ' channels...');
    realtimeChannels.forEach(channel => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    });
    realtimeChannels = [];
    console.log('✅ Channels cleaned up');
  }
}

// ============ UTILITY FUNCTIONS ============

function getDeviceId() {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

function getDeviceName() {
  let deviceName = localStorage.getItem('device_name');
  if (!deviceName) {
    const ua = navigator.userAgent;
    if (ua.includes('Windows')) deviceName = 'Windows PC';
    else if (ua.includes('Mac')) deviceName = 'Mac';
    else if (ua.includes('iPhone')) deviceName = 'iPhone';
    else if (ua.includes('iPad')) deviceName = 'iPad';
    else if (ua.includes('Android')) deviceName = 'Android';
    else deviceName = 'Unknown Device';
    
    deviceName += ' (' + new Date().toLocaleDateString() + ')';
    localStorage.setItem('device_name', deviceName);
  }
  return deviceName;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  cleanupListeners();
});

// ============ EFFICIENCY - LOAD ============

async function loadEfficiencyFromCloud() {
  if (!isCloudAvailable || !supabase) {
    console.log('⚠️ Cloud not available for efficiency')
    return null
  }

  try {
    console.log('📥 Loading efficiency from Supabase...')
    const result = await supabase
      .from('efficiency')
      .select('*')
      .order('machine_id', { ascending: true })

    if (result.error) throw result.error

    if (result.data && result.data.length > 0) {
      console.log('✅ Loaded ' + result.data.length + ' efficiency records')
      
      // Convert to app format
      const efficiencyData = {}
      result.data.forEach(record => {
        efficiencyData[record.machine_id] = {
          shifts: {
            'A': record.shift_a || 0,
            'B': record.shift_b || 0,
            'C': record.shift_c || 0
          },
          average: record.average || 0,
          lastUpdated: record.last_updated
        }
      })
      
      return efficiencyData
    }

    console.log('ℹ️ No efficiency data found in database')
    return null
  } catch (e) {
    console.error('❌ Load efficiency error:', e.message)
    return null
  }
}

// ============ EFFICIENCY - SAVE ============

async function saveEfficiencyToCloud(allEfficiencyData, userId) {
  if (!isCloudAvailable || !supabase) {
    console.log('⚠️ Cloud not available for efficiency save')
    return false
  }

  try {
    const timestamp = new Date().toISOString()
    const records = []

    // Convert app format to database format
    Object.keys(allEfficiencyData).forEach(machineId => {
      const data = allEfficiencyData[machineId]
      records.push({
        machine_id: parseInt(machineId),
        shift_a: data.shifts.A || 0,
        shift_b: data.shifts.B || 0,
        shift_c: data.shifts.C || 0,
        average: data.average || 0,
        last_updated: timestamp,
        last_edited_by: userId || 'unknown'
      })
    })

    if (records.length === 0) {
      console.log('ℹ️ No efficiency data to save')
      return true
    }

    console.log('💾 Saving ' + records.length + ' efficiency records to cloud...')

    const result = await supabase
      .from('efficiency')
      .upsert(records, {
        onConflict: 'machine_id',
        ignoreDuplicates: false
      })

    if (result.error) throw result.error

    console.log('✅ All efficiency data saved to cloud')
    return true
  } catch (e) {
    console.error('❌ Save efficiency error:', e.message)
    return false
  }
}

async function saveSingleEfficiencyToCloud(machineId, data) {
  if (!isCloudAvailable || !supabase) {
    console.log('⚠️ Cloud not available for efficiency save')
    return false
  }

  try {
    const timestamp = new Date().toISOString()

    console.log('💾 Saving efficiency for machine ' + machineId + ' to cloud...')

    const result = await supabase
      .from('efficiency')
      .upsert({
        machine_id: parseInt(machineId),
        shift_a: data.shifts.A,
        shift_b: data.shifts.B,
        shift_c: data.shifts.C,
        average: data.average,
        last_updated: timestamp,
        last_edited_by: getCurrentUserId()
      }, {
        onConflict: 'machine_id',
        ignoreDuplicates: false
      })

    if (result.error) throw result.error

    console.log('✅ Efficiency for machine ' + machineId + ' saved to cloud')
    return true
  } catch (e) {
    console.error('❌ Save efficiency error:', e.message)
    return false
  }
}

console.log('📦 Supabase sync module loaded');
