import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { updateCoolerParticles } from './coolerParticles.js'
import { updateRackParticles } from './rackParticles.js'
import { addObjectToScene, deleteObject } from './3dObjects.js'
import { checkInterParticleCollisions } from './particleCollisions.js'
import { attractCoolerParticles } from './attractors.js'

const canvas3D = document.getElementById('canvas3D')

let scene, camera, renderer, controls, transformControls
let raycasterMouse
let raycasterCollision
let draggableObject = null
let floor
let models = []
let MODELS_NAME = ['cooler', 'chair', 'table', 'wall', 'rack']

export {
  scene,
  camera,
  canvas3D,
  renderer,
  raycasterMouse,
  raycasterCollision,
  transformControls,
  models,
  floor,
}

/**
 * init3D initializes the 3D scene, camera, renderer, controls, lights, and floor.
 *
 * This should be called once on page load to set up the environment.
 *
 * @returns {void}
 */
export function init3D() {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )

  renderer = new THREE.WebGLRenderer({ canvas: canvas3D })
  renderer.setSize(window.innerWidth, window.innerHeight)

  // Orbit controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.zoomToCursor = true
  camera.position.set(5, 20, 20)
  controls.update()
  controls.addEventListener('change', render)

  // Transform controls
  transformControls = new TransformControls(camera, renderer.domElement)
  transformControls.addEventListener('change', render)
  transformControls.addEventListener('dragging-changed', function (event) {
    controls.enabled = !event.value
  })
  transformControls.showX = true
  transformControls.showY = false
  transformControls.showZ = true
  const gizmo = transformControls.getHelper()
  scene.add(gizmo)

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 1)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 2)
  directionalLight.position.set(5, 10, 7.5)
  scene.add(directionalLight)

  // Add a floor
  const floorGeometry = new THREE.PlaneGeometry(20, 20)
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    side: THREE.DoubleSide,
  })
  floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0
  floor.name = 'floor'
  scene.add(floor)

  // Raycaster and mouse initialization
  raycasterMouse = new THREE.Raycaster()
  raycasterCollision = new THREE.Raycaster()

  animate()

  // Event listeners for drag functionality
  window.addEventListener('click', onMouseClick)
}

function animate() {
  requestAnimationFrame(animate)
  updateCoolerParticles()
  updateRackParticles()
  checkInterParticleCollisions()
  attractCoolerParticles()
  render()
}

function render() {
  renderer.render(scene, camera)
}

function onMouseClick(event) {
  //  event.preventDefault();
  const rect = renderer.domElement.getBoundingClientRect()
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  )

  // Update the raycaster with camera and mouse
  raycasterMouse.setFromCamera(mouse, camera)

  // Check for intersection with objects in the scene
  const intersects = raycasterMouse.intersectObjects(models, true)

  const selectedModelElem = document.getElementById('selectedModel')
  if (intersects.length > 0) {
    selectedModelElem.innerText = `Selected: ${intersects[0].object.name}`
    if (draggableObject) {
      transformControls.detach()
    }
    // Find the root parent object (the one in models array)
    let rootObject = intersects[0].object
    while (rootObject.parent && !models.includes(rootObject)) {
      rootObject = rootObject.parent
    }
    // Attach transform controls to the root object to move everything together
    draggableObject = rootObject
    transformControls.attach(draggableObject)
  } else {
    selectedModelElem.innerText = 'No selected model'
    if (draggableObject) {
      transformControls.detach()
      draggableObject = null
    }
  }
}

function exportSceneToJson() {
  let localPosition = new THREE.Vector3(0, 0, 0)
  let box = new THREE.Box3()
  let size = new THREE.Vector3(0, 0, 0)
  const sceneData = {}

  scene.traverse((object) => {
    // Ensure object has a position property
    if (object.position && object.isMesh) {
      // Use object name as key, or generate a unique identifier if name is empty
      if (MODELS_NAME.includes(object.name)) {
        const objectKey = `${object.name}_${object.id}`
        if (object.name.startsWith('wall')) {
          sceneData[objectKey] = {
            dimensions: null,
            coords: object.localToWorld(localPosition.clone()),
          }
        } else {
          sceneData[objectKey] = {
            dimensions: box.setFromObject(object).getSize(size),
            coords: object.localToWorld(localPosition.clone()),
          }
        }
      }
    }
  })

  console.log(JSON.stringify(sceneData, null, 2)) // Pretty print JSON with 2-space indent
}

// Add event listener for keypress
window.addEventListener('keydown', (event) => {
  switch (event.key) {
    case 't': // If "t" is pressed, switch to translation mode
      setTransformMode('translate', true, false, true)
      break
    case 'r': // If "r" is pressed, switch to rotation mode
      setTransformMode('rotate', false, true, false)
      break
    case 'y': // If "y" is pressed, switch to translation mode along Y-axis
      setTransformMode('translate', false, true, false)
      break
    default:
      console.log(`Unhandled key: ${event.key}`)
      break
  }
})

function setTransformMode(mode, x, y, z) {
  transformControls.setMode(mode)
  transformControls.showX = x
  transformControls.showY = y
  transformControls.showZ = z
}

window.selectImage = (imageName) => {
  const element = document.getElementById('dropdownMenuButton')
  element.innerText = `${imageName} `
  element.setAttribute('data-alt', `${imageName}`)
}

let add_model = document.getElementById('add_model')
add_model.addEventListener(
  'click',
  () => {
    let model = document
      .getElementById('dropdownMenuButton')
      .getAttribute('data-alt')
    addObjectToScene(model)
  },
  false
)

let remove_model = document.getElementById('delete_model')
remove_model.addEventListener('click', deleteObject, false)

let export_scene = document.getElementById('export_scene')
export_scene.addEventListener('click', exportSceneToJson, false)
