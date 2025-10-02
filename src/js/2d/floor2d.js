import paper from 'paper'

const canvas2D = document.getElementById('canvas2D')
export { canvas2D }

paper.setup(canvas2D)

// #################### Grid logic ####################

const GRID_SPACING = 30
const GRID_RANGE = 5000 // ±10,000 units (covers huge floor plans)

/**
 * createGrid creates an INFINITE grid background on the Paper.js canvas.
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

  const gridGroup = new paper.Group()
  gridGroup.name = 'grid'

  // Vertical lines (x = ..., -2*spacing, -spacing, 0, spacing, 2*spacing, ...)
  const startX = -GRID_RANGE
  const endX = GRID_RANGE
  for (
    let x = Math.floor(startX / spacing) * spacing;
    x <= endX;
    x += spacing
  ) {
    const line = new paper.Path.Line(
      new paper.Point(x, -GRID_RANGE),
      new paper.Point(x, GRID_RANGE)
    )
    line.strokeColor = color
    line.strokeWidth = 1
    line.opacity = 0.7
    gridGroup.addChild(line)
  }

  // Horizontal lines (y = ..., -2*spacing, -spacing, 0, spacing, 2*spacing, ...)
  const startY = -GRID_RANGE
  const endY = GRID_RANGE
  for (
    let y = Math.floor(startY / spacing) * spacing;
    y <= endY;
    y += spacing
  ) {
    const line = new paper.Path.Line(
      new paper.Point(-GRID_RANGE, y),
      new paper.Point(GRID_RANGE, y)
    )
    line.strokeColor = color
    line.strokeWidth = 1
    line.opacity = 0.7
    gridGroup.addChild(line)
  }

  gridGroup.sendToBack()
  gridGroup.visible = true
  gridGroup.opacity = 1
  // console.log('Infinite grid created with', gridGroup.children.length, 'lines')
  return gridGroup
}

/**
 * ensureGridVisible ensures that a grid is visible on the canvas.
 * @returns {paper.Group}
 */
export function ensureGridVisible() {
  let grid = paper.project.getItem({ name: 'grid' })
  if (!grid) {
    console.log('No grid found, creating new infinite grid')
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

// #################### Draw logic ####################
let isPanning = false
let lastPanPoint = null
let startPoint = null
let tempLine = null
let tempText = null
let snapIndicator = null
let isDragging = false
let selectedVertex = null
let isDraggingVertex = false
let vertices = []
const LINE_STROKE_WIDTH = 3
const MIN_DRAG_DISTANCE = 5

/**
 * Snap a point to the grid
 */
function snapToGrid(point) {
  return new paper.Point(
    Math.round(point.x / GRID_SPACING) * GRID_SPACING,
    Math.round(point.y / GRID_SPACING) * GRID_SPACING
  )
}

/**
 * Create a red vertex circle at given point
 */
function createVertex(point) {
  const vertex = new paper.Path.Circle({
    center: point,
    radius: 6,
    fillColor: 'red',
    strokeColor: 'darkred',
    strokeWidth: 1,
  })
  vertex.data = { connectedPaths: [] }
  vertices.push(vertex)
  vertex.bringToFront()
  return vertex
}

/**
 * Update length text
 */
function updateLengthText(path, textItem) {
  if (!textItem) return

  const lengthInPixels = path.length
  const lengthInMeters = (lengthInPixels / 100).toFixed(2)

  const direction = path.firstSegment.point.subtract(path.lastSegment.point)
  if (direction.length === 0) return
  const offset = direction.normalize().rotate(90).multiply(20)

  textItem.content = `${lengthInMeters} m`
  textItem.point = path.getPointAt(path.length / 2).add(offset)
}

function cleanupPreview() {
  if (tempLine) {
    tempLine.remove()
    tempLine = null
  }
  if (tempText) {
    tempText.remove()
    tempText = null
  }
  if (snapIndicator) {
    snapIndicator.remove()
    snapIndicator = null
  }
}

paper.view.onMouseDown = (event) => {
  isDragging = false
  isDraggingVertex = false

  // ✅ Read Alt state from mouse event
  const isAltPressed = event.event.altKey

  const hitResult = paper.project.hitTest(event.point, {
    fill: true,
    stroke: true,
    segments: true,
    tolerance: 12,
    match: (hit) => hit.item && vertices.includes(hit.item),
  })

  if (hitResult?.item && vertices.includes(hitResult.item)) {
    if (isAltPressed) {
      selectedVertex = hitResult.item
      startPoint = null
    } else {
      startPoint = hitResult.item.position.clone()
      selectedVertex = null
    }
  } else {
    // Not clicking on a vertex
    if (isAltPressed) {
      // Start panning
      isPanning = true
      canvas2D.style.cursor = 'grab'
      lastPanPoint = event.point.clone()
    } else {
      // Start drawing
      selectedVertex = null
      startPoint = event.point.clone()
    }
  }
}

paper.view.onMouseDrag = (event) => {
  const isAltPressed = event.event.altKey

  if (isPanning && lastPanPoint) {
    canvas2D.style.cursor = 'grabbing'
    paper.view.translate(event.point.subtract(lastPanPoint))
    lastPanPoint = event.point.clone()
  
  }

  const dragDistance = selectedVertex
    ? selectedVertex.position.subtract(event.point).length
    : startPoint
      ? startPoint.subtract(event.point).length
      : 0

  if (dragDistance < MIN_DRAG_DISTANCE) return

  if (isAltPressed && selectedVertex) {
    isDraggingVertex = true
    cleanupPreview()

    const snappedPos = snapToGrid(event.point)
    selectedVertex.position = snappedPos

    selectedVertex.data.connectedPaths.forEach(({ path, index }) => {
      path.segments[index].point = snappedPos
      if (path.data?.lengthText) {
        updateLengthText(path, path.data.lengthText)
      }
    })
  } else if (startPoint) {
    isDragging = true
    cleanupPreview()

    const snappedStart = snapToGrid(startPoint)
    const snappedEnd = snapToGrid(event.point)

    snapIndicator = new paper.Path.Circle({
      center: snappedEnd,
      radius: 4,
      fillColor: 'red',
      strokeColor: 'darkred',
      strokeWidth: 0.5,
      opacity: 0.8,
    })

    tempLine = new paper.Path.Line({
      from: snappedStart,
      to: snappedEnd,
      strokeColor: 'black',
      strokeWidth: LINE_STROKE_WIDTH,
      dashArray: [6, 4],
      opacity: 0.6,
    })

    tempText = new paper.PointText({
      point: snappedStart,
      content: '',
      fillColor: 'black',
      fontSize: 14,
      fontFamily: 'Arial',
    })
    updateLengthText(tempLine, tempText)
  }
}

paper.view.onMouseUp = (event) => {
  const isAltPressed = event.event.altKey // ✅ From mouse event
  cleanupPreview()
  if (isPanning) {
    isPanning = false
    lastPanPoint = null
    canvas2D.style.cursor = 'default'
  }

  if (isDraggingVertex && isAltPressed && selectedVertex) {
    const snappedPos = snapToGrid(selectedVertex.position)
    selectedVertex.position = snappedPos
    selectedVertex.data.connectedPaths.forEach(({ path, index }) => {
      path.segments[index].point = snappedPos
      if (path.data?.lengthText) {
        updateLengthText(path, path.data.lengthText)
      }
    })
  } else if (isDragging && startPoint) {
    const snappedStart = snapToGrid(startPoint)
    const snappedEnd = snapToGrid(event.point)

    if (!snappedStart.equals(snappedEnd)) {
      let startVertex = vertices.find((v) => v.position.equals(snappedStart))
      let endVertex = vertices.find((v) => v.position.equals(snappedEnd))

      if (!startVertex) startVertex = createVertex(snappedStart)
      if (!endVertex) endVertex = createVertex(snappedEnd)

      const finalLine = new paper.Path.Line({
        from: snappedStart,
        to: snappedEnd,
        strokeColor: 'black',
        strokeWidth: LINE_STROKE_WIDTH,
      })

      const finalText = new paper.PointText({
        point: snappedStart,
        content: '',
        fillColor: 'black',
        fontSize: 14,
        fontFamily: 'Arial',
      })
      updateLengthText(finalLine, finalText)
      finalLine.data = { lengthText: finalText }

      startVertex.data.connectedPaths.push({ path: finalLine, index: 0 })
      endVertex.data.connectedPaths.push({ path: finalLine, index: 1 })
    }
  }

  startPoint = null
  selectedVertex = null
  isDragging = false
  isDraggingVertex = false
}
