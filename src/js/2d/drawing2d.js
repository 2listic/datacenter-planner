import {
  paper,
  LINE_STROKE_WIDTH,
  MIN_DRAG_DISTANCE,
  GRID_SPACING,
} from './core2d.js'

let vertices = []

/**
 * Snap a point to the nearest grid intersection
 * Ensures consistent alignment for drawing precision
 */
export function snapToGrid(point) {
  return new paper.Point(
    Math.round(point.x / GRID_SPACING) * GRID_SPACING,
    Math.round(point.y / GRID_SPACING) * GRID_SPACING
  )
}

/**
 * Create a visible vertex (red circle) at the given point
 * Each vertex tracks its connected paths for later updates
 */
export function createVertex(point) {
  const vertex = new paper.Path.Circle({
    center: point,
    radius: 6,
    fillColor: 'red',
    strokeColor: 'darkred',
    strokeWidth: 1,
  })
  vertex.data = { connectedPaths: [] } // store connections for interactive updates
  vertices.push(vertex)
  vertex.bringToFront()
  return vertex
}

/**
 * Accessor for all created vertices
 */
export function getVertices() {
  return vertices
}

/**
 * Remove all vertex objects from the canvas
 * Used when resetting or clearing the drawing state
 */
export function clearVertices() {
  vertices.forEach((vertex) => vertex.remove())
  vertices = []
}

/**
 * Find and delete a line near the given paper.Point within tolerance (pixels).
 * Also cleans up connected vertices if they become orphaned.
 * Returns true if a line was deleted, false otherwise.
 */
export function deleteLineNear(paperPoint, tolerance = 12) {
  if (!paperPoint) return false

  // Use Paper.js hit testing to get candidates near the point (optimized)
  const hits = paper.project.hitTestAll(paperPoint, {
    stroke: true,
    tolerance,
    fill: false,
    segments: true,
  })

  if (!hits || hits.length === 0) return false

  // Map to unique path items and filter to simple two-segment lines
  const candidateItems = hits
    .map((h) => h.item)
    .filter((item) => item && item.segments && item.segments.length === 2)

  if (candidateItems.length === 0) return false

  // Pick the geometrically nearest candidate
  let nearest = null
  let nearestDist = Infinity
  candidateItems.forEach((p) => {
    try {
      const nearestPt = p.getNearestPoint(paperPoint)
      const d = nearestPt.getDistance(paperPoint)
      if (d < nearestDist) {
        nearestDist = d
        nearest = p
      }
    } catch (err) {
      // ignore malformed items
    }
  })

  if (!nearest || nearestDist > tolerance) return false

  // Remove associated length text if present
  if (nearest.data?.lengthText) {
    try {
      nearest.data.lengthText.remove()
    } catch (e) {
      // ignore
    }
  }

  // For each endpoint, find matching vertex and remove the connection entry
  const startPt = nearest.firstSegment.point
  const endPt = nearest.lastSegment.point

  const affectedVertices = vertices.filter(
    (v) => v.position.equals(startPt) || v.position.equals(endPt)
  )

  affectedVertices.forEach((vertex) => {
    vertex.data.connectedPaths = vertex.data.connectedPaths.filter(
      (entry) => entry.path !== nearest
    )
  })

  // Remove the path
  nearest.remove()

  // Remove orphaned vertices from canvas and vertices array
  const remaining = []
  vertices.forEach((v) => {
    if (
      !v.data ||
      !v.data.connectedPaths ||
      v.data.connectedPaths.length === 0
    ) {
      v.remove()
    } else {
      remaining.push(v)
    }
  })
  vertices = remaining

  return true
}

// Listen for context menu deletion events (client coordinates) and convert
// to paper coordinates here to avoid introducing a dependency in the context menu.
window.addEventListener('datacenter:deleteLineAt', (e) => {
  const detail = e?.detail || {}
  const clientX = detail.clientX
  const clientY = detail.clientY
  if (typeof clientX !== 'number' || typeof clientY !== 'number') return
  // convert client to view/paper coordinates
  const rect = document.getElementById('canvas2D')?.getBoundingClientRect()
  if (!rect) return
  const canvasPoint = new paper.Point(clientX - rect.left, clientY - rect.top)
  deleteLineNear(canvasPoint)
})

/**
 * Remove all user-drawn items from the canvas (except grid)
 */
export function clearCanvas() {
  // Remove all items except the grid group (if present)
  const all = paper.project.activeLayer.children.slice() // snapshot
  all.forEach((item) => {
    try {
      if (item && item.name === 'grid') return // keep grid
      // If the gridGroup is a group named 'grid', preserve it
      if (item.parent && item.parent.name === 'grid') return
      // Remove other items
      item.remove()
    } catch (e) {
      // ignore
    }
  })

  // Clear vertices array and any leftover visuals
  clearVertices()
}

// Listen for clear canvas events from the context menu
window.addEventListener('datacenter:clearCanvas', () => {
  clearCanvas()
})

// Interaction state flags
let isPanning = false
let startPoint = null
let tempLine = null
let tempText = null
let snapIndicator = null
let isDragging = false
let selectedVertex = null
let isDraggingVertex = false

/**
 * Update the position and value of a line's length text
 * Converts length from pixels to meters based on canvas scale
 */
function updateLengthText(path, textItem) {
  if (!textItem) return

  const lengthInPixels = path.length
  const metersPerPixel = 10 / paper.view.bounds.width // dynamic scaling factor
  const lengthInMeters = (lengthInPixels * metersPerPixel).toFixed(2)

  // Position the text slightly offset from the midpoint
  const direction = path.firstSegment.point.subtract(path.lastSegment.point)
  if (direction.length === 0) return
  const offset = direction.normalize().rotate(90).multiply(20)

  textItem.content = `${lengthInMeters} m`
  textItem.point = path.getPointAt(path.length / 2).add(offset)
}

/**
 * Remove any temporary elements (preview line, text, snap indicator)
 * Prevents clutter and overlapping visuals while dragging
 */
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

/**
 * Initialize interactive mouse event handling for drawing and editing
 * - Left click: draw new lines or select vertices
 * - Alt + drag: move vertices or pan view
 */
export function setupMouseHandlers(canvas2D) {
  paper.view.onMouseDown = (event) => {
    isDragging = false
    isDraggingVertex = false

    const isAltPressed = event.event.altKey

    // Detect if user clicked on an existing vertex
    const hitResult = paper.project.hitTest(event.point, {
      fill: true,
      stroke: true,
      segments: true,
      tolerance: 12,
      match: (hit) => hit.item && getVertices().includes(hit.item),
    })

    if (hitResult?.item && getVertices().includes(hitResult.item)) {
      // Clicking directly on a vertex
      if (isAltPressed) {
        // Alt + click: prepare for vertex drag
        selectedVertex = hitResult.item
        startPoint = null
      } else {
        // Regular click: prepare to start drawing from this vertex
        startPoint = hitResult.item.position.clone()
        selectedVertex = null
      }
    } else {
      // Clicking empty space
      if (isAltPressed) {
        // Alt + click empty: start panning
        isPanning = true
        canvas2D.style.cursor = 'grab'
      } else {
        // Regular click: start drawing a new line
        selectedVertex = null
        startPoint = event.point.clone()
      }
    }
  }

  paper.view.onMouseDrag = (event) => {
    const isAltPressed = event.event.altKey

    // Handle view panning
    if (isPanning) {
      canvas2D.style.cursor = 'grabbing'
      paper.view.translate(event.delta.divide(2)) // divide to reduce pan speed
    }

    // Compute drag distance for action threshold
    const dragDistance = selectedVertex
      ? selectedVertex.position.subtract(event.point).length
      : startPoint
        ? startPoint.subtract(event.point).length
        : 0

    if (dragDistance < MIN_DRAG_DISTANCE) return // ignore micro movements

    // Vertex movement mode (Alt + drag vertex)
    if (isAltPressed && selectedVertex) {
      isDraggingVertex = true
      cleanupPreview()

      const snappedPos = snapToGrid(event.point)
      selectedVertex.position = snappedPos

      // Update all lines connected to this vertex dynamically
      selectedVertex.data.connectedPaths.forEach(({ path, index }) => {
        path.segments[index].point = snappedPos
        if (path.data?.lengthText) {
          updateLengthText(path, path.data.lengthText)
        }
      })
    }
    // Line drawing mode
    else if (startPoint) {
      isDragging = true
      cleanupPreview()

      const snappedStart = snapToGrid(startPoint)
      const snappedEnd = snapToGrid(event.point)

      // Show snap target indicator
      snapIndicator = new paper.Path.Circle({
        center: snappedEnd,
        radius: 4,
        fillColor: 'red',
        strokeColor: 'darkred',
        strokeWidth: 0.5,
        opacity: 0.8,
      })

      // Draw preview dashed line
      tempLine = new paper.Path.Line({
        from: snappedStart,
        to: snappedEnd,
        strokeColor: 'black',
        strokeWidth: LINE_STROKE_WIDTH,
        dashArray: [6, 4],
        opacity: 0.6,
      })

      // Show temporary measurement label
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
    const isAltPressed = event.event.altKey
    cleanupPreview()

    // End panning
    if (isPanning) {
      isPanning = false
      canvas2D.style.cursor = 'default'
    }

    // Finalize vertex drag
    if (isDraggingVertex && isAltPressed && selectedVertex) {
      const snappedPos = snapToGrid(selectedVertex.position)
      selectedVertex.position = snappedPos

      selectedVertex.data.connectedPaths.forEach(({ path, index }) => {
        path.segments[index].point = snappedPos
        if (path.data?.lengthText) {
          updateLengthText(path, path.data.lengthText)
        }
      })
    }
    // Finalize line creation
    else if (isDragging && startPoint) {
      const snappedStart = snapToGrid(startPoint)
      const snappedEnd = snapToGrid(event.point)

      if (!snappedStart.equals(snappedEnd)) {
        // Reuse existing vertices if they already exist on those points
        let startVertex = getVertices().find((v) =>
          v.position.equals(snappedStart)
        )
        let endVertex = getVertices().find((v) => v.position.equals(snappedEnd))

        if (!startVertex) startVertex = createVertex(snappedStart)
        if (!endVertex) endVertex = createVertex(snappedEnd)

        // Create final line between vertices
        const finalLine = new paper.Path.Line({
          from: snappedStart,
          to: snappedEnd,
          strokeColor: 'black',
          strokeWidth: LINE_STROKE_WIDTH,
        })

        // Attach a permanent length label
        const finalText = new paper.PointText({
          point: snappedStart,
          content: '',
          fillColor: 'black',
          fontSize: 14,
          fontFamily: 'Arial',
        })
        updateLengthText(finalLine, finalText)
        finalLine.data = { lengthText: finalText }

        // Register mutual connections for dynamic updates
        startVertex.data.connectedPaths.push({ path: finalLine, index: 0 })
        endVertex.data.connectedPaths.push({ path: finalLine, index: 1 })
      }
    }

    // Reset interaction state
    startPoint = null
    selectedVertex = null
    isDragging = false
    isDraggingVertex = false
  }
}
