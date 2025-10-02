import paper from 'paper'
import { ensureGridVisible } from './core2d.js'

/**
 * loadDxfFile loads and parses a DXF file, scales its entities to fit the canvas,
 * and draws them. Ensures the grid is visible after loading.
 * @param {File} file - The DXF file selected by the user.
 * @returns {Promise<{entities: Array<Object>}>} A promise that resolves with the parsed entities.
 */
export function loadDxfFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const dxfContent = event.target.result
        console.log('DXF Content:', dxfContent.substring(0, 200) + '...')

        // Parse DXF manually for basic entities
        const entities = parseDxfManually(dxfContent)
        console.log('Parsed entities:', entities)

        // Calculate bounds and scale entities to fit canvas
        const bounds = calculateEntitiesBounds(entities)
        const scale = calculateScaleToFit(bounds)
        const offset = calculateOffsetToCenter(bounds, scale)

        console.log('DXF bounds:', bounds)
        console.log('Scale factor:', scale)
        console.log('Offset:', offset)

        // Clear existing content
        paper.project.clear()
        dxfCircles.length = 0 // Clear previous circles

        // Process entities with scaling and positioning
        entities.forEach((entity, index) => {
          console.log(`Processing entity ${index}:`, entity)
          processDxfEntity(entity, scale, offset)
        })

        // Ensure grid is visible after loading DXF
        ensureGridVisible()
        console.log('DXF upload: Grid ensured visible after processing')

        resolve({ entities })
      } catch (error) {
        console.error('DXF parsing error:', error)
        reject(error)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

function parseDxfManually(content) {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const entities = []
  let i = 0

  while (i < lines.length) {
    if (lines[i] === '0' && lines[i + 1] === 'LINE') {
      const entity = parseLineEntity(lines, i)
      if (entity) {
        entities.push(entity)
        i = entity.endIndex
      } else {
        i++
      }
    } else if (lines[i] === '0' && lines[i + 1] === 'CIRCLE') {
      const entity = parseCircleEntity(lines, i)
      if (entity) {
        entities.push(entity)
        i = entity.endIndex
      } else {
        i++
      }
    } else {
      i++
    }
  }

  return entities
}

function parseLineEntity(lines, startIndex) {
  let i = startIndex
  const entity = { type: 'LINE' }

  try {
    while (i < lines.length && !(lines[i] === '0' && i > startIndex)) {
      const code = parseInt(lines[i])
      const value = lines[i + 1]

      switch (code) {
        case 10:
          entity.startX = parseFloat(value)
          break
        case 20:
          entity.startY = parseFloat(value)
          break
        case 11:
          entity.endX = parseFloat(value)
          break
        case 21:
          entity.endY = parseFloat(value)
          break
      }

      i += 2
    }

    if (
      entity.startX !== undefined &&
      entity.startY !== undefined &&
      entity.endX !== undefined &&
      entity.endY !== undefined
    ) {
      entity.start = { x: entity.startX, y: entity.startY }
      entity.end = { x: entity.endX, y: entity.endY }
      entity.endIndex = i
      return entity
    }
  } catch (error) {
    console.error('Error parsing LINE entity:', error)
  }

  return null
}

function parseCircleEntity(lines, startIndex) {
  let i = startIndex
  const entity = { type: 'CIRCLE' }

  try {
    while (i < lines.length && !(lines[i] === '0' && i > startIndex)) {
      const code = parseInt(lines[i])
      const value = lines[i + 1]

      switch (code) {
        case 10:
          entity.centerX = parseFloat(value)
          break
        case 20:
          entity.centerY = parseFloat(value)
          break
        case 40:
          entity.radius = parseFloat(value)
          break
      }

      i += 2
    }

    if (
      entity.centerX !== undefined &&
      entity.centerY !== undefined &&
      entity.radius !== undefined
    ) {
      entity.center = { x: entity.centerX, y: entity.centerY }
      entity.endIndex = i
      return entity
    }
  } catch (error) {
    console.error('Error parsing CIRCLE entity:', error)
  }

  return null
}

function processDxfEntity(entity, scale = 1, offset = { x: 0, y: 0 }) {
  console.log('Processing entity:', entity)
  switch (entity.type) {
    case 'LINE':
      createLineFromDxf(entity, scale, offset)
      break
    case 'CIRCLE':
      createCircleFromDxf(entity, scale, offset)
      break
    default:
      console.log('Unsupported entity type:', entity.type)
  }
}

function calculateEntitiesBounds(entities) {
  if (entities.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity

  entities.forEach((entity) => {
    if (entity.type === 'LINE') {
      minX = Math.min(minX, entity.start.x, entity.end.x)
      minY = Math.min(minY, entity.start.y, entity.end.y)
      maxX = Math.max(maxX, entity.start.x, entity.end.x)
      maxY = Math.max(maxY, entity.start.y, entity.end.y)
    } else if (entity.type === 'CIRCLE') {
      const left = entity.center.x - entity.radius
      const right = entity.center.x + entity.radius
      const top = entity.center.y - entity.radius
      const bottom = entity.center.y + entity.radius

      minX = Math.min(minX, left)
      minY = Math.min(minY, top)
      maxX = Math.max(maxX, right)
      maxY = Math.max(maxY, bottom)
    }
  })

  return { minX, minY, maxX, maxY }
}

function calculateScaleToFit(bounds) {
  const canvasWidth = paper.view.size.width
  const canvasHeight = paper.view.size.height
  const padding = 50 // pixels of padding around the content

  const contentWidth = bounds.maxX - bounds.minX
  const contentHeight = bounds.maxY - bounds.minY

  if (contentWidth === 0 || contentHeight === 0) return 1

  const scaleX = (canvasWidth - padding * 2) / contentWidth
  const scaleY = (canvasHeight - padding * 2) / contentHeight

  return Math.min(scaleX, scaleY)
}

function calculateOffsetToCenter(bounds, scale) {
  const canvasWidth = paper.view.size.width
  const canvasHeight = paper.view.size.height

  const scaledWidth = (bounds.maxX - bounds.minX) * scale
  const scaledHeight = (bounds.maxY - bounds.minY) * scale

  const offsetX = (canvasWidth - scaledWidth) / 2 - bounds.minX * scale
  const offsetY = (canvasHeight - scaledHeight) / 2 - bounds.minY * scale

  return { x: offsetX, y: offsetY }
}

function createLineFromDxf(entity, scale, offset) {
  console.log('Creating line from:', entity)

  if (entity.start && entity.end) {
    const start = new paper.Point(
      entity.start.x * scale + offset.x,
      entity.start.y * scale + offset.y
    )
    const end = new paper.Point(
      entity.end.x * scale + offset.x,
      entity.end.y * scale + offset.y
    )

    const path = new paper.Path.Line(start, end)
    path.strokeColor = 'black'
    path.strokeWidth = 2
  } else {
    console.log('Invalid line data:', entity)
  }
}

// Global array to store circle data for 3D conversion
export const dxfCircles = []

function createCircleFromDxf(entity, scale, offset) {
  console.log('Creating circle for 3D column:', entity)

  if (entity.center && entity.radius) {
    const centerX = entity.center.x * scale + offset.x
    const centerY = entity.center.y * scale + offset.y
    const scaledRadius = entity.radius * scale

    // Store circle data for 3D conversion
    dxfCircles.push({
      center: new paper.Point(centerX, centerY),
      radius: scaledRadius,
      originalCenter: entity.center,
      originalRadius: entity.radius,
    })

    // Display as circle in 2D view
    const circle = new paper.Path.Circle(
      new paper.Point(centerX, centerY),
      scaledRadius
    )
    circle.strokeColor = 'red' // Different color to indicate it's a 3D column
    circle.strokeWidth = 2
    circle.fillColor = null

    console.log(
      `Created circle for 3D column at (${centerX}, ${centerY}) with radius ${scaledRadius}`
    )
  } else {
    console.log('Invalid circle data:', entity)
  }
}

export function setupDxfUpload() {
  const fileInput = document.getElementById('dxfFileInput')
  const uploadBtn = document.getElementById('uploadDxfBtn')

  uploadBtn.addEventListener('click', () => {
    fileInput.click()
  })

  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0]
    if (file && file.name.toLowerCase().endsWith('.dxf')) {
      try {
        await loadDxfFile(file)
        console.log('DXF file loaded successfully')
      } catch (error) {
        console.error('Error loading DXF file:', error)
        alert('Error loading DXF file: ' + error.message)
      }
    }
  })
}
