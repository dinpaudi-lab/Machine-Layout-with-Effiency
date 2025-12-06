// ============ CONFLICT DETECTION SYSTEM ============
// Mencegah overwrite data antar device

const CONFLICT_CHECK_INTERVAL = 2000 // Check every 2 seconds
let lastKnownState = {}
let isEditing = false
let editingItemId = null

// Track when user is editing
function startEditing(itemType, itemId) {
  isEditing = true
  editingItemId = `${itemType}_${itemId}`
  console.log('🔒 User started editing:', editingItemId)
}

function stopEditing() {
  isEditing = false
  editingItemId = null
  console.log('🔓 User stopped editing')
}

// Detect conflicts
function detectConflict(currentState, incomingState, itemType, itemId) {
  const key = `${itemType}_${itemId}`
  
  // First time seeing this item - no conflict
  if (!lastKnownState[key]) {
    lastKnownState[key] = currentState
    return false
  }
  
  // Not editing - no conflict
  if (!isEditing || editingItemId !== key) {
    lastKnownState[key] = currentState
    return false
  }
  
  // Check if incoming state is different from what we expect
  // Only detect conflict if we're currently editing AND state changed externally
  const lastState = lastKnownState[key]
  const currentStateStr = JSON.stringify(currentState)
  const lastStateStr = JSON.stringify(lastState)
  
  if (lastStateStr !== currentStateStr) {
    console.log('🔍 Conflict detected:', {
      key,
      lastState,
      currentState,
      isEditing,
      editingItemId
    })
    return true // CONFLICT!
  }
  
  return false
}

// Show conflict warning
function showConflictWarning(itemType, itemId, deviceName) {
  const modal = document.createElement('div')
  modal.className = 'conflict-modal'
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    animation: fadeIn 0.2s ease;
  `
  
  modal.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 32px;
      border-radius: 16px;
      max-width: 480px;
      border: 2px solid #f97316;
      box-shadow: 0 20px 60px rgba(249, 115, 22, 0.4);
    ">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
        <h2 style="color: #f97316; margin: 0 0 8px 0;">Conflict Detected!</h2>
        <p style="color: #cbd5e1; margin: 0; font-size: 14px;">
          Device lain sedang mengedit item yang sama
        </p>
      </div>
      
      <div style="
        background: rgba(249, 115, 22, 0.1);
        border: 1px solid rgba(249, 115, 22, 0.3);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
      ">
        <div style="color: #fff; font-size: 13px; line-height: 1.6;">
          <strong>Item:</strong> ${itemType} #${itemId}<br>
          <strong>Device:</strong> ${deviceName || 'Unknown'}<br>
          <strong>Time:</strong> ${new Date().toLocaleTimeString()}
        </div>
      </div>
      
      <div style="color: #9aa6c0; font-size: 12px; margin-bottom: 20px; line-height: 1.6;">
        💡 <strong>Tip:</strong> Koordinasikan dengan user lain atau tunggu beberapa detik sebelum save.
      </div>
      
      <div style="display: flex; gap: 12px;">
        <button id="conflict-reload" style="
          flex: 1;
          padding: 12px;
          background: linear-gradient(90deg, #3b82f6, #2563eb);
          border: none;
          border-radius: 8px;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
        ">🔄 Reload Data</button>
        
        <button id="conflict-force" style="
          flex: 1;
          padding: 12px;
          background: linear-gradient(90deg, #f97316, #ea580c);
          border: none;
          border-radius: 8px;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
        ">💪 Force Save</button>
        
        <button id="conflict-close" style="
          padding: 12px 16px;
          background: rgba(255,255,255,0.1);
          border: none;
          border-radius: 8px;
          color: #fff;
          cursor: pointer;
          font-size: 14px;
        ">✕</button>
      </div>
    </div>
  `
  
  document.body.appendChild(modal)
  
  document.getElementById('conflict-reload').addEventListener('click', () => {
    location.reload()
  })
  
  document.getElementById('conflict-force').addEventListener('click', () => {
    modal.remove()
    // Allow save to proceed
  })
  
  document.getElementById('conflict-close').addEventListener('click', () => {
    modal.remove()
    stopEditing()
  })
}

// Monitor for real-time changes
function setupConflictDetection() {
  if (!window.isCloudAvailable) {
    console.log('⚠️ Cloud not available, conflict detection disabled')
    return
  }
  
  console.log('🛡️ Conflict detection active')
  
  // Monitor machines
  const originalSaveMachine = window.saveMachineToCloud
  if (originalSaveMachine) {
    window.saveMachineToCloud = async function(machineId, constructId, userId, oldConstructId) {
      console.log('🔒 Conflict check for machine', machineId)
      
      const currentState = { constructId, oldConstructId, timestamp: Date.now() }
      
      // Only check conflict if user is actively editing this machine
      if (isEditing && editingItemId === `machine_${machineId}`) {
        if (detectConflict(currentState, null, 'machine', machineId)) {
          console.log('⚠️ Conflict detected for machine', machineId)
          showConflictWarning('Machine', machineId, 'Another device')
          return false
        }
      }
      
      // Proceed with save
      console.log('✅ No conflict, proceeding with save')
      const result = await originalSaveMachine(machineId, constructId, userId, oldConstructId)
      
      if (result) {
        lastKnownState[`machine_${machineId}`] = currentState
        console.log('✅ State updated after successful save')
      }
      
      return result
    }
    console.log('✅ Machine conflict wrapper installed')
  }
  
  // Monitor constructions
  const originalSaveConstruction = window.saveConstructionToCloud
  if (originalSaveConstruction) {
    window.saveConstructionToCloud = async function(construction, userId, isNew) {
      console.log('🔒 Conflict check for construction', construction.id)
      
      const currentState = { ...construction, timestamp: Date.now() }
      
      // Only check conflict if user is actively editing this construction
      if (isEditing && editingItemId === `construction_${construction.id}`) {
        if (detectConflict(currentState, null, 'construction', construction.id)) {
          console.log('⚠️ Conflict detected for construction', construction.id)
          showConflictWarning('Construction', construction.id, 'Another device')
          return false
        }
      }
      
      // Proceed with save
      console.log('✅ No conflict, proceeding with save')
      const result = await originalSaveConstruction(construction, userId, isNew)
      
      if (result) {
        lastKnownState[`construction_${construction.id}`] = currentState
        console.log('✅ State updated after successful save')
      }
      
      return result
    }
    console.log('✅ Construction conflict wrapper installed')
  }
}

// Add activity indicator
function showActiveUsers() {
  const indicator = document.createElement('div')
  indicator.id = 'active-users-indicator'
  indicator.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px 16px;
    z-index: 9998;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    font-size: 13px;
    color: #fff;
  `
  
  indicator.innerHTML = `
    <div style="
      width: 8px;
      height: 8px;
      background: #34d399;
      border-radius: 50%;
      animation: pulse 2s ease-in-out infinite;
    "></div>
    <span id="active-count">1 device online</span>
  `
  
  const style = document.createElement('style')
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.2); }
    }
  `
  document.head.appendChild(style)
  
  document.body.appendChild(indicator)
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      setupConflictDetection()
      showActiveUsers()
    }, 2000)
  })
} else {
  setTimeout(() => {
    setupConflictDetection()
    showActiveUsers()
  }, 2000)
}

// Export functions
window.conflictHandler = {
  startEditing,
  stopEditing,
  detectConflict,
  showConflictWarning
}

console.log('🛡️ Conflict handler loaded')
