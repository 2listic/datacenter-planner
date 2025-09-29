import paper from 'paper'

const canvas2D = document.getElementById('canvas2D')
export { canvas2D }

const GRID_SPACING = 30
paper.setup(canvas2D)

let actionHistory = [];
let MAX_HISTORY_LENGTH = 50;

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
  console.log('Grid created with', gridGroup.children.length, 'lines')
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

// Store the drawn paths (lines)
let currentPath
let currentText
let vertices = [] // Array to store all vertices
let contextMenu
let selectedVertex = null // Track the selected vertex for dragging
let selectedLine = null // Track the selected line for length adjustment
let isDraggingVertex = false // Flag for vertex dragging

function snapToGrid(point) {
  const snappedX = Math.round(point.x / GRID_SPACING) * GRID_SPACING
  const snappedY = Math.round(point.y / GRID_SPACING) * GRID_SPACING
  return new paper.Point(snappedX, snappedY)
}

function updateLengthText(path) {
  const lengthInPixels = path.length
  const metersPerPixel = 10 / paper.view.bounds.width
  const lengthInMeters = (lengthInPixels * metersPerPixel).toFixed(2)

  // Calculate offset perpendicular to the line to avoid overlap
  const direction = path.firstSegment.point.subtract(path.lastSegment.point)
  const offset = direction.normalize().rotate(90).multiply(30) // 30 pixel of offset

  currentText.content = lengthInMeters + ' m'
  currentText.point = path.getPointAt(path.length / 2).add(offset) // Offset text position
}

function updateConnectedLines(vertex) {
  vertex.data.connectedPaths.forEach((pathInfo) => {
    const path = pathInfo.path
    const index = pathInfo.index

    // Update the position of the path segments
    path.segments[index].point = vertex.position

    // Update length text
    updateLengthText(path)
  })
}

function createVertex(point) {
  const vertex = new paper.Path.Circle({
    center: point,
    radius: 5,
    fillColor: 'red',
  })

  vertex.data = { connectedPaths: [] } // Initialize connected paths
  vertices.push(vertex)
  return vertex
}

// Function to create the context menu
function createContextMenu(position) {
  // Remove any existing context menu
  if (contextMenu) {
    contextMenu.remove()
  }
  // Create a new context menu
  contextMenu = document.createElement('div')
  contextMenu.style.position = 'absolute'
  contextMenu.style.top = `${position.y}px`
  contextMenu.style.left = `${position.x}px`
  contextMenu.style.background = '#fff'
  contextMenu.style.border = '1px solid #ccc'
  contextMenu.style.padding = '5px'
  contextMenu.style.boxShadow = '0px 2px 10px rgba(0, 0, 0, 0.2)'
  contextMenu.style.zIndex = 1000

  // Add the delete option
  const deleteOption = document.createElement('div')
  deleteOption.textContent = 'Delete Line'
  deleteOption.style.cursor = 'pointer'
  deleteOption.onclick = () => {
    if (selectedLine) {
      deleteLine(selectedLine) // Call delete function when option is clicked
      selectedLine = null
      contextMenu.remove()
    }
  }
  // Append the option to the menu
  contextMenu.appendChild(deleteOption)
  document.body.appendChild(contextMenu)
}

// Function to delete the line and its vertices
function deleteLine(line) {
  const deletionData = {
    lineData: {
      strokeColor: line.strokeColor,
      strokeWidth: line.strokeWidth,
    },
    startPoint: line.firstSegment.point.clone(),
    endPoint: line.lastSegment.point.clone(),
    lengthText: {
      point: line.data.lengthText.point.clone(),
      content: line.data.lengthText.content,
      fillColor: line.data.lengthText.fillColor,
      fontSize: line.data.lengthText.fontSize,
    },
  };

  addActionToHistory({
    type: "LINE_DELETED",
    data: deletionData,
  });

  // Remove connected vertices and lines from the vertex data
  vertices.forEach((vertex) => {
    vertex.data.connectedPaths = vertex.data.connectedPaths.filter(
      (pathInfo) => pathInfo.path !== line
    );
    // If the vertex has no more connected paths, remove it
    if (vertex.data.connectedPaths.length === 0) {
      vertex.remove();
      vertices.splice(vertices.indexOf(vertex), 1); // Remove vertex from the vertices array
    }
  });

  // Remove the line and its length text from the canvas
  if (line.data.lengthText) {
    line.data.lengthText.remove();
  }
  line.remove();
}


// 1. Centralize the configuration for easier future changes.
const drawingConfig = {
    line: {
        strokeColor: 'black',
        strokeWidth: 5,
    },
    text: {
        fillColor: 'black',
        fontSize: 16,
    },
    hitTest: {
        segments: true,
        stroke: true,
        fill: true,
        tolerance: 5,
    },
};

/**
 * 2. Extract the repeated logic for creating a new line and its text.
 * @param {paper.Point} startPoint - The starting point for the new line.
 */
function startNewLine(startPoint) {
    // Create the Path
    currentPath = new paper.Path({
        ...drawingConfig.line, // Use the centralized configuration
        segments: [startPoint],
    });

    // Create the length text
    currentText = new paper.PointText({
        ...drawingConfig.text, // Use the centralized configuration
        point: startPoint,
        content: '',
    });
}

/**
 * 3. Separate the right-click logic into its own function.
 * @param {paper.ToolEvent} event - The mouse event.
 * @returns {boolean} - Returns true if the event was handled, otherwise false.
 */
function handleRightClick(event) {
    const hitResult = paper.project.hitTest(event.point, drawingConfig.hitTest);

    if (hitResult?.item.className === 'Path') {
        selectedLine = hitResult.item;
        createContextMenu(event.event);
        return true; // The right-click found a target and was handled
    }
    return false; // Nothing was done
}

/**
 * 4. The main function is now cleaner and acts as an "orchestrator".
 */
paper.view.onMouseDown = function (event) {
    // Handle right-clicks (Guard Clause)
    if (event.event.button === 2) {
        if (handleRightClick(event)) {
            return; // If the right-click did something, stop execution here.
        }
    }

    // If we get here, it's a left-click or a right-click that did nothing.
    // First, clean up any previous state (the context menu)
    if (contextMenu) {
        contextMenu.remove();
        contextMenu = null;
    }
    
    // If a line is selected, deselect it to start drawing.
    // (You can add other logic here if needed)
    if (selectedLine) {
        selectedLine = null;
    }

    // Determine the starting point for the new line
    let startPoint;
    if (selectedVertex) {
        startPoint = snapToGrid(selectedVertex.position);
        selectedVertex = null; // Clear the vertex selection
    } else {
        startPoint = snapToGrid(event.point);
    }

    // Finally, call the function to create the new line
    startNewLine(startPoint);
};

paper.view.onMouseDrag = function (event) {
  if (currentPath) {
    // Ensure the line remains straight
    if (currentPath.segments.length > 1) {
      currentPath.removeSegment(1)
    }
    currentPath.add(snapToGrid(event.point)) // Snap endpoint to the nearest grid intersection

    // Update length text during drag
    updateLengthText(currentPath)
  } else if (isDraggingVertex && selectedVertex) {
    selectedVertex.position = snapToGrid(event.point) // Snap dragging vertex to grid
    updateConnectedLines(selectedVertex) // Update connected lines
  } else if (selectedLine) {
    // Adjust the length of the selected line (not the focus here)
  }
}

paper.view.onMouseUp = function () {
  if (currentPath) {
    const startVertex = snapToGrid(currentPath.firstSegment.point)
    const endVertex = snapToGrid(currentPath.lastSegment.point)

    currentPath.firstSegment.point = startVertex
    currentPath.lastSegment.point = endVertex

    // Connect path to vertices and add vertices to the list if new
    let start = vertices.find((v) => v.position.equals(startVertex))
    let end = vertices.find((v) => v.position.equals(endVertex))

    const wasStartVertexNew = !start
    const wasEndVertexNew = !end

    if (!start) start = createVertex(startVertex)
    if (!end) end = createVertex(endVertex)

    start.data.connectedPaths.push({ path: currentPath, index: 0 })
    end.data.connectedPaths.push({ path: currentPath, index: 1 })

    // Store the length text in the path's data for easy access
    currentPath.data.lengthText = currentText

    addActionToHistory({
      type: "LINE_DRAWN",
      data: {
        line: currentPath,
        startVertex: start,
        endVertex: end,
        lengthText: currentText,
        wasStartVertexNew,
        wasEndVertexNew,
      },
    });

    // Reset the current path and text variables
    currentPath = null
    currentText = null
  }
}

/**
 * addActionToHistory adds the action to undo history
 * 
 * @param {Object} action 
 */
function addActionToHistory(action) {
  actionHistory.push(action);

  if(actionHistory.length > MAX_HISTORY_LENGTH) {
    actionHistory.shift()
  }
}

/**
 * undoLineDraw undo a line drawing action
 * @param {Object} data - Contains the line and vertices information
 */
function undoLineDraw(data) {
  const { line, startVertex, endVertex, lengthText, wasStartVertexNew, wasEndVertexNew } = data
  
  if (lengthText) {
    lengthText.remove()
  }
  line.remove()
  
  if (wasStartVertexNew && startVertex) {
    const index = vertices.indexOf(startVertex)
    if (index > -1) {
      vertices.splice(index, 1)
      startVertex.remove()
    }
  } else if (startVertex) {
    startVertex.data.connectedPaths = startVertex.data.connectedPaths.filter(
      pathInfo => pathInfo.path !== line
    )
  }
  
  if (wasEndVertexNew && endVertex) {
    const index = vertices.indexOf(endVertex)
    if (index > -1) {
      vertices.splice(index, 1)
      endVertex.remove()
    }
  } else if (endVertex) {
    endVertex.data.connectedPaths = endVertex.data.connectedPaths.filter(
      pathInfo => pathInfo.path !== line
    )
  }
  
  console.log('Line drawing undone')
}

/**
 * redrawDeletedLine redo a deleted line (when undoing a delete action)
 * @param {Object} data - Contains the original line data
 */
function redrawDeletedLine(data) {
  const { lineData, startPoint, endPoint, lengthText } = data
  
  // Recreate the line
  const newLine = new paper.Path()
  newLine.strokeColor = lineData.strokeColor
  newLine.strokeWidth = lineData.strokeWidth
  newLine.add(startPoint)
  newLine.add(endPoint)
  
  const newLengthText = new paper.PointText({
    point: lengthText.point,
    content: lengthText.content,
    fillColor: lengthText.fillColor,
    fontSize: lengthText.fontSize,
  })
  
  let startVertex = vertices.find((v) => v.position.equals(startPoint))
  let endVertex = vertices.find((v) => v.position.equals(endPoint))
  
  if (!startVertex) startVertex = createVertex(startPoint)
  if (!endVertex) endVertex = createVertex(endPoint)
  
  startVertex.data.connectedPaths.push({ path: newLine, index: 0 })
  endVertex.data.connectedPaths.push({ path: newLine, index: 1 })
  
  newLine.data.lengthText = newLengthText
  
  console.log('Deleted line restored')
}

function undo() {
  if(actionHistory.length === 0) {
    console.log('There is nothing to undo');
    return;
  }

  const lastAction = actionHistory.pop();

  switch(lastAction.type) {
    case 'LINE_DRAWN':
      undoLineDraw(lastAction.data);
      break;
    case 'LINE_DELETED':
      redrawDeletedLine(lastAction.data);
      break;
  }
}

document.addEventListener("keydown", function (event) {
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key === "z" &&
    !event.shiftKey
  ) {
    event.preventDefault();
    undo();
  }
});

canvas2D.addEventListener('contextmenu', (e) => {
  e.preventDefault()
})
