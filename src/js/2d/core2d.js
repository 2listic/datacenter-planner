import paper from 'paper'

import { setupMouseHandlers } from './drawing2d.js'
import { initContextMenu } from './contextMenu2d.js'

// ----------------------------------------------------
// 1. Canvas and Paper.js Setup
// ----------------------------------------------------
const canvas2D = document.getElementById('canvas2D')
paper.setup(canvas2D)

// ----------------------------------------------------
// 2. Constants
// ----------------------------------------------------
export const GRID_SPACING = 30
export const LINE_STROKE_WIDTH = 3
export const MIN_DRAG_DISTANCE = 5

// ----------------------------------------------------
// 3. Grid Management
// ----------------------------------------------------
let gridGroup = null
let currentGridSpacing = GRID_SPACING
let currentGridColor = '#d0d0d0'

/**
 * Create the 2D grid based on view bounds
 */
export function createGrid(spacing = GRID_SPACING, color = '#d0d0d0') {
  currentGridSpacing = spacing
  currentGridColor = color

  if (!gridGroup) {
    gridGroup = new paper.Group()
    gridGroup.name = 'grid'
  } else {
    gridGroup.removeChildren()
  }

  const viewBounds = paper.view.bounds
  const left = Math.floor(viewBounds.left / spacing) * spacing
  const right = Math.ceil(viewBounds.right / spacing) * spacing
  const top = Math.floor(viewBounds.top / spacing) * spacing
  const bottom = Math.ceil(viewBounds.bottom / spacing) * spacing

  // Vertical lines
  for (let x = left; x <= right; x += spacing) {
    const line = new paper.Path.Line(
      new paper.Point(x, top),
      new paper.Point(x, bottom)
    )
    line.strokeColor = color
    line.strokeWidth = 1
    line.opacity = 0.7
    gridGroup.addChild(line)
  }

  // Horizontal lines
  for (let y = top; y <= bottom; y += spacing) {
    const line = new paper.Path.Line(
      new paper.Point(left, y),
      new paper.Point(right, y)
    )
    line.strokeColor = color
    line.strokeWidth = 1
    line.opacity = 0.7
    gridGroup.addChild(line)
  }

  gridGroup.sendToBack()
  return gridGroup
}

/**
 * Ensure grid is visible and created
 */
export function ensureGridVisible() {
  if (!gridGroup) {
    createGrid()
  } else {
    gridGroup.visible = true
  }
  return gridGroup
}

// Auto-refresh grid when view changes
paper.view.onFrame = function () {
  if (gridGroup) {
    createGrid(currentGridSpacing, currentGridColor)
  }
}

// ----------------------------------------------------
// 4. Initialization (replaces floor2d.js)
// ----------------------------------------------------
export function setup2D() {
  // Setup drawing handlers
  setupMouseHandlers(canvas2D)

  // Initialize context menu
  initContextMenu(canvas2D)

  // Create grid initially
  createGrid()

  console.log('2D environment initialized')
}

// ----------------------------------------------------
// 5. Exports
// ----------------------------------------------------
export { paper, canvas2D }
