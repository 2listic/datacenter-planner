import paper from 'paper'

const canvas2D = document.getElementById('canvas2D')
export { canvas2D }

const GRID_SPACING = 30
paper.setup(canvas2D)

// #################### Grid logic ####################

/**
 * createGrid creates a grid background on the Paper.js canvas.
 * @param {number} spacing
 * @param {string | paper.Color} color
 * @returns {paper.Group}
 */
export function createGrid(spacing = GRID_SPACING, color = '#d0d0d0') {
  // Remove existing grid first
  const existingGrid = paper.project.getItem({ name: 'grid' })
  if (existingGrid) {
    existingGrid.remove()
  }

  const bounds = paper.view.bounds
  const gridGroup = new paper.Group()
  gridGroup.name = 'grid'

  for (let x = bounds.left; x <= bounds.right; x += spacing) {
    const start = new paper.Point(x, bounds.top)
    const end = new paper.Point(x, bounds.bottom)
    const line = new paper.Path.Line(start, end)
    line.strokeColor = color
    line.strokeWidth = 1
    line.opacity = 0.7 // More visible
    gridGroup.addChild(line)
  }

  for (let y = bounds.top; y <= bounds.bottom; y += spacing) {
    const start = new paper.Point(bounds.left, y)
    const end = new paper.Point(bounds.right, y)
    const line = new paper.Path.Line(start, end)
    line.strokeColor = color
    line.strokeWidth = 1
    line.opacity = 0.7 // More visible
    gridGroup.addChild(line)
  }

  gridGroup.sendToBack()
  gridGroup.visible = true
  gridGroup.opacity = 1
  // console.log('Grid created with', gridGroup.children.length, 'lines')
  return gridGroup
}

/**
 * ensureGridVisible ensures that a grid is visible on the canvas.
 * @returns {paper.Group}
 */
export function ensureGridVisible() {
  /**
   * @type {paper.Item | null}
   */
  let grid = paper.project.getItem({ name: 'grid' })
  if (!grid) {
    console.log('No grid found, creating new one')
    grid = createGrid()
  } else {
    grid.visible = true
    grid.opacity = 1
    grid.sendToBack()
    console.log('Grid made visible')
  }
  return grid
}

// #################### Context window ####################

// Context menu object
const ContextMenu = {
  element: null,
  options: [], // Store added options
  
  create(position) {
    // Remove any existing context menu
    if (this.element) {
      this.remove()
    }
    
    // Create a new context menu
    this.element = document.createElement('div')
    this.element.className = 'context-menu'
    this.element.style.top = `${position.y}px`
    this.element.style.left = `${position.x}px`

    // Add all stored options
    this.options.forEach(option => {
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
  }
}

// Add options from outside the object
// ContextMenu.addOption('Delete Line', () => {
//   if (selectedLine) {
//     deleteLine(selectedLine)
//     selectedLine = null
//   }
// })

// refresh the grid option
ContextMenu.addOption('Close Menu', ContextMenu.remove)


// Event listeners
canvas2D.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  ContextMenu.create({ x: e.clientX, y: e.clientY })
})

document.addEventListener('mousedown', (e) => {
  ContextMenu.remove()
})