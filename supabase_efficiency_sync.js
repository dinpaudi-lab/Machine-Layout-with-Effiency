// ============ SUPABASE EFFICIENCY SYNC EXTENSION ============
// Add this to supabase_sync_fixed.js or load separately

// ============ EFFICIENCY - SAVE ============

async function saveEfficiencyToCloud(efficiencyData) {
  if (!isCloudAvailable || !supabase) {
    console.log('⚠️ Cloud not available for efficiency save')
    return false
  }

  try {
    const entries = []
    
    Object.keys(efficiencyData).forEach(machineId => {
      const machineData = efficiencyData[machineId]
      
      Object.keys(machineData).forEach(date => {
        const eff = machineData[date]
        
        entries.push({
          machine_id: parseInt(machineId),
          date: date,
          shift_a: eff.shiftA || 0,
          shift_b: eff.shiftB || 0,
          shift_c: eff.shiftC || 0,
          global_efficiency: eff.global || 0,
          editor: eff.editor || getCurrentUserId(),
          timestamp: eff.timestamp || new Date().toISOString(),
          device_id: getDeviceId(),
          device_name: getDeviceName()
        })
      })
    })
    
    if (entries.length === 0) {
      console.log('ℹ️ No efficiency data to sync')
      return true
    }
    
    console.log(`💾 Saving ${entries.length} efficiency records to cloud...`)
    
    const result = await supabase
      .from('efficiency')
      .upsert(entries, { 
        onConflict: 'machine_id,date',
        ignoreDuplicates: false 
      })

    if (result.error) throw result.error

    console.log('✅ Efficiency data saved to cloud')
    return true
  } catch (e) {
    console.error('❌ Save efficiency error:', e.message)
    return false
  }
}

// ============ EFFICIENCY - LOAD ============

async function loadEfficiencyFromCloud(machineId, dateFrom, dateTo) {
  if (!isCloudAvailable || !supabase) {
    console.log('⚠️ Cloud not available for efficiency load')
    return null
  }

  try {
    console.log('📥 Loading efficiency from cloud...')
    
    let query = supabase
      .from('efficiency')
      .select('*')
      .order('date', { ascending: false })
    
    if (machineId) {
      query = query.eq('machine_id', machineId)
    }
    
    if (dateFrom) {
      query = query.gte('date', dateFrom)
    }
    
    if (dateTo) {
      query = query.lte('date', dateTo)
    }
    
    const result = await query

    if (result.error) throw result.error

    if (result.data && result.data.length > 0) {
      console.log(`✅ Loaded ${result.data.length} efficiency records from cloud`)
      
      // Convert to local format
      const efficiencyData = {}
      
      result.data.forEach(eff => {
        if (!efficiencyData[eff.machine_id]) {
          efficiencyData[eff.machine_id] = {}
        }
        
        efficiencyData[eff.machine_id][eff.date] = {
          shiftA: eff.shift_a,
          shiftB: eff.shift_b,
          shiftC: eff.shift_c,
          global: eff.global_efficiency,
          editor: eff.editor,
          timestamp: eff.timestamp
        }
      })
      
      return efficiencyData
    }

    console.log('ℹ️ No efficiency data found in cloud')
    return null
  } catch (e) {
    console.error('❌ Load efficiency error:', e.message)
    return null
  }
}

// ============ EFFICIENCY - REAL-TIME LISTENER ============

async function setupEfficiencyRealtimeListener(onEfficiencyChange) {
  if (!isCloudAvailable || !supabase) {
    console.log('⚠️ Cloud not available for efficiency real-time')
    return
  }

  try {
    console.log('🔌 Setting up efficiency real-time listener...')
    
    const efficiencyChannel = supabase
      .channel('public:efficiency:' + Date.now())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'efficiency' },
        async (payload) => {
          console.log('🔄 Efficiency update received:', payload.eventType)
          
          if (onEfficiencyChange) {
            const efficiency = await loadEfficiencyFromCloud()
            if (efficiency) onEfficiencyChange(efficiency)
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Efficiency channel:', status)
      })
    
    realtimeChannels.push(efficiencyChannel)
    console.log('✅ Efficiency real-time listener active')
  } catch (e) {
    console.error('❌ Setup efficiency listener error:', e)
  }
}

// Expose functions globally
if (typeof window !== 'undefined') {
  window.saveEfficiencyToCloud = saveEfficiencyToCloud
  window.loadEfficiencyFromCloud = loadEfficiencyFromCloud
  window.setupEfficiencyRealtimeListener = setupEfficiencyRealtimeListener
}

console.log('📦 Supabase efficiency sync extension loaded')


// ============ DATABASE SETUP SCRIPT ============
// Run this once to create the efficiency table

/*
SQL SCRIPT TO CREATE EFFICIENCY TABLE IN SUPABASE:

CREATE TABLE IF NOT EXISTS public.efficiency (
  id BIGSERIAL PRIMARY KEY,
  machine_id INTEGER NOT NULL,
  date DATE NOT NULL,
  shift_a DECIMAL(5,2) DEFAULT 0,
  shift_b DECIMAL(5,2) DEFAULT 0,
  shift_c DECIMAL(5,2) DEFAULT 0,
  global_efficiency DECIMAL(5,2) DEFAULT 0,
  editor TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT,
  device_name TEXT,
  UNIQUE(machine_id, date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_efficiency_machine_id ON public.efficiency(machine_id);
CREATE INDEX IF NOT EXISTS idx_efficiency_date ON public.efficiency(date);
CREATE INDEX IF NOT EXISTS idx_efficiency_machine_date ON public.efficiency(machine_id, date);

-- Enable Row Level Security
ALTER TABLE public.efficiency ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your auth needs)
CREATE POLICY "Enable all operations for authenticated users" ON public.efficiency
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.efficiency TO anon;
GRANT ALL ON public.efficiency TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.efficiency_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.efficiency_id_seq TO authenticated;

*/

// Function to setup efficiency table (call this once)
async function setupEfficiencyTable() {
  if (!isCloudAvailable || !supabase) {
    console.error('❌ Supabase not available')
    return false
  }
  
  console.log('🔧 Setting up efficiency table...')
  console.log('⚠️ Please run the SQL script in Supabase SQL Editor')
  console.log('SQL script is in the comments of supabase_efficiency_sync.js')
  
  // Test if table exists
  try {
    const test = await supabase
      .from('efficiency')
      .select('id')
      .limit(1)
    
    if (test.error) {
      console.error('❌ Efficiency table not found. Run the SQL script first.')
      return false
    }
    
    console.log('✅ Efficiency table is ready')
    return true
  } catch (e) {
    console.error('❌ Error checking efficiency table:', e)
    return false
  }
}

if (typeof window !== 'undefined') {
  window.setupEfficiencyTable = setupEfficiencyTable
}
