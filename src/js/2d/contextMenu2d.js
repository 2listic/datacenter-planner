// Context menu object
const ContextMenu = {
  element: null,
  options: [], // Store added options

  create(position) {
    // Remove any existing context menu
    this.remove()

    // Create a new context menu
    this.element = document.createElement('div')
    this.element.className = 'context-menu'
    this.element.style.top = `${position.y}px`
    this.element.style.left = `${position.x}px`

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
