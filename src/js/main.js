import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import paper from 'paper'
import { createGrid } from './2d/floor2d.js'
import { setupDxfUpload } from './2d/dxfLoader.js'
import { init3D, camera, renderer, loadUserOBJ } from './3d/scene3d.js'
import { convertPathsTo3D } from './3d/pathsTo3d.js'
// import parseDXF from 'dxf-parser'

createGrid()
setupDxfUpload()
init3D()

// Switch between 2D and 3D modes
const container2D = document.getElementById('container2D')
const container3D = document.getElementById('container3D')
const switchButton = document.getElementById('switchMode')
switchButton.addEventListener('click', () => {
  if (container3D.style.display === 'none') {
    container2D.style.display = 'none'
    container3D.style.display = 'block'
    convertPathsTo3D()
    switchButton.textContent = 'Switch to 2D'
  } else {
    container2D.style.display = 'block'
    container2D.style.display = 'block'
    container3D.style.display = 'none'
    switchButton.textContent = 'Switch to 3D'
  }
})

// Handle file upload
const fileInput = document.getElementById('fileInput')
fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target.result
      const fileName = file.name.toLowerCase()

      if (fileName.endsWith('.dxf')) {
        parseAndLoadDXF(content)
      } else if (fileName.endsWith('.obj')) {
        if (container3D.style.display === 'none') {
            switchButton.click()
        }
        loadUserOBJ(content)
      } else if (fileName.endsWith('.dwg')) {
        alert('DWG files are not supported. Please upload a DXF or OBJ file.')
      } else {
        alert('Please select a DXF or OBJ file.')
      }
    }
    reader.readAsText(file)
  }
})

// Function to parse DXF and load into Paper.js
function parseAndLoadDXF(content) {
  try {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line !== '')
    const entities = []
    let i = 0

    // Skip to ENTITIES section
    while (i < lines.length && !(lines[i] === '0' && lines[i + 1] === 'SECTION' && lines[i + 3] === 'ENTITIES')) {
      i++
    }
    i += 4 // Skip past SECTION, 2, ENTITIES

    // Parse entities
    while (i < lines.length && !(lines[i] === '0' && lines[i + 1] === 'ENDSEC')) {
      if (lines[i] === '0' && lines[i + 1] === 'LINE') {
        i += 2 // Skip 0 LINE
        const lineEntity = { type: 'LINE', layer: '', start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }

        while (i < lines.length && lines[i] !== '0') {
          const code = parseInt(lines[i])
          const value = lines[i + 1]

          switch (code) {
            case 8: // Layer
              lineEntity.layer = value
              break
            case 10: // Start X
              lineEntity.start.x = parseFloat(value)
              break
            case 20: // Start Y
              lineEntity.start.y = parseFloat(value)
              break
            case 11: // End X
              lineEntity.end.x = parseFloat(value)
              break
            case 21: // End Y
              lineEntity.end.y = parseFloat(value)
              break
          }
          i += 2
        }
        entities.push(lineEntity)
      } else {
        i++
      }
    }

    // Clear existing paths
    paper.project.clear()
    createGrid()

    // Draw entities
    entities.forEach(entity => {
      if (entity.type === 'LINE') {
        const path = new paper.Path()
        path.strokeColor = 'black'
        path.strokeWidth = 5
        path.add(new paper.Point(entity.start.x, entity.start.y))
        path.add(new paper.Point(entity.end.x, entity.end.y))
      }
    })

    paper.view.update()
    console.log(`Loaded ${entities.length} entities from DXF`)
  } catch (error) {
    console.error('Error parsing DXF:', error)
    alert('Error parsing DXF file. Please check the file format.')
  }
}

// Handle window resizing
window.addEventListener('resize', () => {
  console.log('resizing...')
  paper.view.viewSize = new paper.Size(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})