import { paper, LINE_STROKE_WIDTH, MIN_DRAG_DISTANCE, GRID_SPACING } from './core2d.js'

let vertices = []

/**
 * Snap a point to the grid
 */
export function snapToGrid(point) {
  return new paper.Point(
    Math.round(point.x / GRID_SPACING) * GRID_SPACING,
    Math.round(point.y / GRID_SPACING) * GRID_SPACING
  )
}

/**
 * Create a red vertex circle at given point
 */
export function createVertex(point) {
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

export function getVertices() {
  return vertices
}

export function clearVertices() {
  vertices.forEach((vertex) => vertex.remove())
  vertices = []
}


let isPanning = false
let startPoint = null
let tempLine = null
let tempText = null
let snapIndicator = null
let isDragging = false
let selectedVertex = null
let isDraggingVertex = false

/**
 * Update length text
 */
function updateLengthText(path, textItem) {
  if (!textItem) return

  const lengthInPixels = path.length
  const metersPerPixel = 10 / paper.view.bounds.width
  const lengthInMeters = (lengthInPixels * metersPerPixel).toFixed(2)

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

// Mouse event handlers
export function setupMouseHandlers(canvas2D) {
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
      match: (hit) => hit.item && getVertices().includes(hit.item),
    })

    if (hitResult?.item && getVertices().includes(hitResult.item)) {
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
      } else {
        // Start drawing
        selectedVertex = null
        startPoint = event.point.clone()
      }
    }
  }

  paper.view.onMouseDrag = (event) => {
    const isAltPressed = event.event.altKey

    if (isPanning) {
      canvas2D.style.cursor = 'grabbing'
      paper.view.translate(event.delta.divide(2)) // the divition for stability
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
        let startVertex = getVertices().find((v) => v.position.equals(snappedStart))
        let endVertex = getVertices().find((v) => v.position.equals(snappedEnd))

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
}