// Check if renderGrid exists before using
let originalRenderGrid = null

if (typeof renderGrid === 'function') {
  originalRenderGrid = renderGrid
} else {
  console.warn('⚠️ renderGrid not found, creating stub')
  // Create a stub function
  window.renderGrid = function() {
    console.log('renderGrid stub called')
  }
  originalRenderGrid = window.renderGrid
}
// Add this to the existing layout_app.js

// ============ EFFICIENCY INTEGRATION ============

// Update renderGrid function to include efficiency indicators

renderGrid = function() {
  originalRenderGrid.call(this)
  
  // Add efficiency indicators to all machine boxes
  if (window.efficiencySystem) {
    const machineBoxes = document.querySelectorAll('.machine-box')
    machineBoxes.forEach(box => {
      const machineId = parseInt(box.getAttribute('data-machine-id'))
      if (machineId) {
        window.efficiencySystem.addEfficiencyIndicator(box, machineId)
      }
    })
  }
}

// Add right-click menu for efficiency input
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('machine-grid')
  if (grid) {
    grid.addEventListener('contextmenu', (e) => {
      const box = e.target.closest('.machine-box')
      if (box) {
        e.preventDefault()
        const machineId = parseInt(box.getAttribute('data-machine-id'))
        
        // Show context menu
        showEfficiencyContextMenu(e.clientX, e.clientY, machineId)
      }
    })
  }
})

function showEfficiencyContextMenu(x, y, machineId) {
  // Remove existing menu
  const existingMenu = document.querySelector('.context-menu')
  if (existingMenu) existingMenu.remove()
  
  const menu = document.createElement('div')
  menu.className = 'context-menu'
  menu.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 8px;
    z-index: 10000;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    min-width: 180px;
  `
  
  menu.innerHTML = `
    <div class="context-menu-item" data-action="edit">
      <span>✏️</span> Edit Konstruksi
    </div>
    <div class="context-menu-item" data-action="efficiency">
      <span>⚡</span> Input Efisiensi
    </div>
    <div class="context-menu-item" data-action="view-efficiency">
      <span>📊</span> Lihat History Efisiensi
    </div>
  `
  
  document.body.appendChild(menu)
  
  // Add styles for menu items
  const style = document.createElement('style')
  style.textContent = `
    .context-menu-item {
      padding: 8px 12px;
      cursor: pointer;
      color: #fff;
      font-size: 13px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s ease;
    }
    .context-menu-item:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .context-menu-item span {
      font-size: 16px;
    }
  `
  document.head.appendChild(style)
  
  // Handle clicks
  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.getAttribute('data-action')
      
      if (action === 'edit') {
        openModal(machineId)
      } else if (action === 'efficiency') {
        if (window.efficiencySystem) {
          window.efficiencySystem.openEfficiencyModal(machineId)
        }
      } else if (action === 'view-efficiency') {
        window.location.href = `efficiency.html?machine=${machineId}`
      }
      
      menu.remove()
    })
  })
  
  // Close menu when clicking outside
  setTimeout(() => {
    document.addEventListener('click', () => {
      menu.remove()
    }, { once: true })
  }, 100)
}

// Setup efficiency button click handler (button already exists in HTML)
const efficiencyBtn = document.getElementById('efficiency-page-btn')
if (efficiencyBtn) {
  efficiencyBtn.addEventListener('click', () => {
    window.location.href = 'efficiency.html'
  })
}
// Update history to include efficiency changes
const originalAddHistory = addHistory

addHistory = async function(entry) {
  await originalAddHistory.call(this, entry)
  
  // If this is an efficiency update, also save to efficiency system
  if (entry.type === 'efficiency' && window.efficiencySystem) {
    window.efficiencySystem.saveEfficiencyData()
  }
}

// Load efficiency system on init
if (window.efficiencySystem) {
  window.efficiencySystem.loadEfficiencyData()
  console.log('✅ Efficiency system integrated')
}

// Add global reference
window.updateEfficiencyChart = function() {
  if (window.efficiencySystem) {
    renderGrid() // This will also update efficiency indicators
  }
}

console.log('✅ Efficiency integration loaded')
