// Context menu object
const ContextMenu = {
  element: null,
  options: [], // Store added options
  lastClickClient: null, // store last right-click client coords

  create(position) {
    // Remove any existing context menu
    this.remove()

    // Create a new context menu
    this.element = document.createElement('div')
    this.element.className = 'context-menu'
    this.element.style.top = `${position.y}px`
    this.element.style.left = `${position.x}px`
    // store last client coords for other modules to use
    this.lastClickClient = { x: position.x, y: position.y }

    // Add all stored options
    this.options.forEach((option) => {
      this.element.appendChild(option)
    })

    document.body.appendChild(this.element)
  },

  remove() {
    if (this.element) {
      this.element.remove()
      this.element = null
    }
  },

  addOption(text, callback) {
    const optionElement = document.createElement('div')
    optionElement.textContent = text
    optionElement.className = 'context-menu-option'
    optionElement.onclick = () => {
      callback()
      this.remove() // Close menu after clicking an option
    }
    this.options.push(optionElement)
  },

  clearOptions() {
    this.options = []
  },
}

// Default option
ContextMenu.addOption('Close Menu', () => ContextMenu.remove())

ContextMenu.addOption('Clear Canvas', () => {
  const evt = new CustomEvent('datacenter:clearCanvas')
  window.dispatchEvent(evt)
})

// Delete line option: will call into drawing logic using the last right-click position
// Note: drawing2d.deleteLineNear expects a Paper.js Point; the context that opens
// this menu (core2d) calls create with client coordinates. Consumers should convert
// client->paper coordinates before calling deleteLineNear. To keep this file decoupled
// we dispatch a custom event with the client coords and let drawing code listen for it.
ContextMenu.addOption('Delete Line', () => {
  const detail = {
    clientX: ContextMenu.lastClickClient?.x,
    clientY: ContextMenu.lastClickClient?.y,
  }
  // dispatch a custom event that drawing2d can listen to
  const evt = new CustomEvent('datacenter:deleteLineAt', { detail })
  window.dispatchEvent(evt)
})

// ==========================================
// Safe initialization function
// ==========================================
export function initContextMenu(canvas2D) {
  if (!canvas2D) {
    console.warn('initContextMenu: canvas2D not found')
    return
  }

  // Right-click opens custom menu
  canvas2D.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    ContextMenu.create({ x: e.clientX, y: e.clientY })
  })

  // Click anywhere else closes it
  document.addEventListener('mousedown', (e) => {
    if (ContextMenu.element && !ContextMenu.element.contains(e.target)) {
      ContextMenu.remove()
    }
  })

  console.log('Context menu initialized')
}

export { ContextMenu }
