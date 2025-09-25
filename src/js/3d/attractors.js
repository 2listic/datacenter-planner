import * as THREE from 'three'
import { scene, models } from './scene3d.js'
import { particleSystems as coolerParticleSystems } from './coolerParticles.js'

// Define the rectangle dimensions and position
export const rectangleWidth = 1
export const rectangleHeight = 3

export const localAttractingNormal = new THREE.Vector3(0, 0, 1) // Points in the positive z direction (Blue-axis)

// Create an array to store the attractors
export const attractors = []

export function addAttractor() {
  const planeGeometry = new THREE.PlaneGeometry(rectangleWidth, rectangleHeight)
  const planeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    side: THREE.DoubleSide,
  })
  const plane = new THREE.Mesh(planeGeometry, planeMaterial)
  plane.name = 'attractor'

  // Position the rectangle so its lower edge is at y=0
  plane.position.y = rectangleHeight / 2

  scene.add(plane)
  attractors.push({
    mesh: plane,
    parent: null,
  })

  // Create an arrow to represent the worldAttractingNormal vector for each rectangle
  const normalArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, 0),
    1,
    0x00ffff
  ) // Points in the positive z direction (Blue-axis)
  plane.add(normalArrow)
  models.push(plane)
}

export function addAttractorToRack(rackObj) {
  const planeGeometry = new THREE.PlaneGeometry(rectangleWidth, rectangleHeight)
  const planeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    side: THREE.DoubleSide,
  })
  const plane = new THREE.Mesh(planeGeometry, planeMaterial)

  attractors.push({
    mesh: plane,
    parent: rackObj,
  })

  // Create an arrow to represent the worldAttractingNormal vector for each rectangle
  const normalArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, 0),
    1,
    0x00ffff
  ) // Points in the positive z direction (Blue-axis)
  plane.add(normalArrow)

  rackObj.add(plane)
}

export function attractCoolerParticles() {
  // If no attractors in the scene return
  if (attractors.length === 0) {
    return
  }
  // Pre-allocate vectors to avoid creating new ones in the loop
  const particlePosition = new THREE.Vector3()
  const closestPoint = new THREE.Vector3()
  const direction = new THREE.Vector3()
  const totalForce = new THREE.Vector3()
  // Constant parameters
  const forceStrength = 0.001
  const minDistance = 0.5
  const maxForce = 0.01
  const falloffPower = 2

  // Calculate force from each attractor
  // attractors.forEach((attractor, index) => {
  coolerParticleSystems.forEach((coolerData) => {
    const coolerGeometry = coolerData.geometry
    const coolerParticlesWorldPositions =
      coolerGeometry.attributes.worldPosition.array
    const coolerParticlesVelocities = coolerGeometry.attributes.velocity.array

    for (
      let particleIndex = 0;
      particleIndex < coolerParticlesWorldPositions.length;
      particleIndex += 3
    ) {
      totalForce.set(0, 0, 0) // Reset total force for each particle

      for (let n = 0; n < attractors.length; n++) {
        particlePosition.set(
          coolerParticlesWorldPositions[particleIndex],
          coolerParticlesWorldPositions[particleIndex + 1],
          coolerParticlesWorldPositions[particleIndex + 2]
        )

        closestPointOnRectangle(particlePosition, attractors[n].mesh, closestPoint)

        // Calculate direction vector
        direction.subVectors(closestPoint, particlePosition)
        const distance = direction.length()

        // Skip if too far away (optimization)
        if (distance > 10) continue

        // Normalize direction
        if (distance > 0.001) {
          direction.divideScalar(distance)
        } else {
          direction.set(0, 1, 0) // Default direction if too close
        }

        // Calculate force magnitude with inverse square falloff
        const safeDistance = Math.max(distance, minDistance)
        const forceMagnitude = Math.min(
          forceStrength / Math.pow(safeDistance, falloffPower),
          maxForce
        )

        // Determine attraction/repulsion based on normal
        const worldAttractingNormal = localAttractingNormal.clone()
        worldAttractingNormal.applyQuaternion(attractors[n].mesh.quaternion)
        const dotProduct = direction.dot(worldAttractingNormal)

        // Apply force based on which side of the attractor
        const finalForce = dotProduct < 0 ? forceMagnitude : -forceMagnitude

        // Accumulate force
        totalForce.addScaledVector(direction, finalForce)
      }

      // Add the accumulated force to the velocity
      coolerParticlesVelocities[particleIndex] += totalForce.x
      coolerParticlesVelocities[particleIndex + 1] += totalForce.y
      coolerParticlesVelocities[particleIndex + 2] += totalForce.z
    }

    coolerGeometry.attributes.velocity.needsUpdate = true
  })
}

// Function to calculate the closest point on the rectangle to a given point
function closestPointOnRectangle(point, rectangle, result) {
  // Transform point to rectangle's local space
  const localPoint = point.clone()
  rectangle.worldToLocal(localPoint)

  // Now calculate closest point in local space
  const halfWidth = rectangleWidth / 2
  const halfHeight = rectangleHeight / 2

  // Clamp to rectangle boundaries
  result.x = Math.max(-halfWidth, Math.min(localPoint.x, halfWidth))
  result.y = Math.max(-halfHeight, Math.min(localPoint.y, halfHeight))
  result.z = 0 // Rectangle is on the XY plane in local space

  // Transform back to world space
  rectangle.localToWorld(result)
}
