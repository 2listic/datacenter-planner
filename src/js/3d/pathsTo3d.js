import * as THREE from 'three'
import paper from 'paper'
import { scene } from './scene3d.js'
import { dxfCircles } from '../2d/dxfLoader.js'

let walls = []
let columns = []

/**
 * convertPathsTo3D converts 2D paths drawn with Paper.js into 3D wall meshes in Three.js.
 *
 * @returns {void}
 *
 */
function convertPathsTo3D() {
  // Clear existing walls
  if (walls.length > 0) {
    walls.forEach((wall) => scene.remove(wall))
    walls = []
  }

  // Clear existing columns
  if (columns.length > 0) {
    columns.forEach((column) => scene.remove(column))
    columns = []
  }

  // Convert 2D paths to 3D walls
  paper.project.activeLayer.children.forEach((item) => {
     if (item.data && item.data.isObjectRectangle) {
       return // Skip this item - it's an object, not a wall
     }

    if (
      item instanceof paper.Path &&
      item.segments.length >= 2 &&
      item.segments[0].handleIn.isZero() &&
      item.segments[0].handleOut.isZero() &&
      item.segments[1].handleIn.isZero() &&
      item.segments[1].handleOut.isZero()
    ) {
      // Ensure item is a Path with at least 2 segments
      // Check if it's a straight line (no handles, meaning no curve, so no verteces)
      const startX =
        (item.segments[0].point.x / paper.view.bounds.width) * 10 - 5
      const startZ =
        -(item.segments[0].point.y / paper.view.bounds.height) * 10 + 5
      const endX = (item.segments[1].point.x / paper.view.bounds.width) * 10 - 5
      const endZ =
        -(item.segments[1].point.y / paper.view.bounds.height) * 10 + 5

      const wallLength = Math.sqrt(
        Math.pow(endX - startX, 2) + Math.pow(endZ - startZ, 2)
      )
      const wallHeight = 2.5 // Height of the walls
      const wallThickness = 0.1 // Thickness of the walls

      const wallGeometry = new THREE.BoxGeometry(
        wallLength,
        wallHeight,
        wallThickness
      )
      wallGeometry.translate(0, wallHeight / 2, 0)
      const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        opacity: 0.5,
        transparent: true,
      })
      const wall = new THREE.Mesh(wallGeometry, wallMaterial)

      wall.position.x = startX + endX
      wall.position.y = 0
      // Paper.js: Y increases downward (typical web/screen coordinates) Three.js: Z increases upward (typical 3D coordinates)
      wall.position.z = -(startZ + endZ)

      const angle = Math.atan2(endZ - startZ, endX - startX)
      wall.rotation.y = angle
      wall.scale.set(2, 2, 2)
      wall.name = 'wall'
      scene.add(wall)
      walls.push(wall)
    }
  })

  // Convert DXF circles to 3D columns
  dxfCircles.forEach((circleData) => {
    const columnX = (circleData.center.x / paper.view.bounds.width) * 10 - 5
    const columnZ = -(circleData.center.y / paper.view.bounds.height) * 10 + 5
    const columnRadius = (circleData.radius / paper.view.bounds.width) * 10
    const columnHeight = 3.0 // Height of the columns

    // Create cylindrical column geometry
    const columnGeometry = new THREE.CylinderGeometry(
      columnRadius,
      columnRadius,
      columnHeight,
      16
    )
    const columnMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666, // Dark gray for columns
      opacity: 0.8,
      transparent: true,
    })
    const column = new THREE.Mesh(columnGeometry, columnMaterial)

    column.position.x = columnX
    column.position.y = columnHeight / 2 // Position at ground level
    column.position.z = -columnZ

    column.name = 'column'
    scene.add(column)
    columns.push(column)

    console.log(
      `Created 3D column at (${columnX}, ${columnZ}) with radius ${columnRadius}`
    )
  })
}

export { walls, columns, convertPathsTo3D }
