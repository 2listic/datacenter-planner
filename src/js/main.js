import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import paper from 'paper'
import { createGrid, setup2D } from './2d/core2d.js'
import { setupDxfUpload } from './2d/dxfLoader.js'
import { init3D, camera, renderer } from './3d/scene3d.js'
import { convertPathsTo3D } from './3d/pathsTo3d.js'

// ----------------------------------------------------
// 1. Initialize 2D + 3D environments
// ----------------------------------------------------
setup2D()        // Sets up Paper.js, grid, and context menu
setupDxfUpload() // Enables DXF import
init3D()         // Sets up 3D scene

// ----------------------------------------------------
// 2. Switch between 2D and 3D modes
// ----------------------------------------------------
const container2D = document.getElementById('container2D')
const container3D = document.getElementById('container3D')
const switchButton = document.getElementById('switchMode')

switchButton.addEventListener('click', () => {
  if (container3D.style.display === 'none') {
    // Switch to 3D
    container2D.style.display = 'none'
    container3D.style.display = 'block'
    convertPathsTo3D()
    switchButton.textContent = 'Switch to 2D'
  } else {
    // Switch to 2D
    container2D.style.display = 'block'
    container3D.style.display = 'none'
    switchButton.textContent = 'Switch to 3D'

    // Fix canvas stretch issue after resizing
    paper.view.viewSize = new paper.Size(window.innerWidth, window.innerHeight)
    createGrid() // Recreate grid to fit new view bounds
  }
})

// ----------------------------------------------------
// 3. Keyboard Shortcuts Toggle Panels
// ----------------------------------------------------
function setupShortcutsToggle(headerId, contentId) {
  const shortcutsHeader = document.getElementById(headerId)
  const shortcutsContent = document.getElementById(contentId)
  const shortcutsArrow = document.getElementsByClassName('shortcutsArrow')

  let shortcutsExpanded = false // Start collapsed

  shortcutsHeader.addEventListener('click', () => {
    shortcutsExpanded = !shortcutsExpanded

    if (shortcutsExpanded) {
      shortcutsContent.classList.remove('collapsed')
      shortcutsArrow.textContent = '▼'
    } else {
      shortcutsContent.classList.add('collapsed')
      shortcutsArrow.textContent = '▶'
    }
  })
}

setupShortcutsToggle('shortcutsHeader2D', 'shortcutsContent2D')
setupShortcutsToggle('shortcutsHeader3D', 'shortcutsContent3D')

// ----------------------------------------------------
// 4. Handle window resizing (3D responsiveness)
// ----------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
