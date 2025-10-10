import * as THREE from 'three'
import { particleSystems as coolerParticleSystems } from './coolerParticles.js'

/**
 * Array storing all attractors in the scene.
 *
 * Each attractor is represented as an object with the following properties:
 * - mesh: The THREE.Mesh representing the attractor plane.
 * - parent: The THREE.Object3D that the attractor is attached to.
 *
 * @type {Array<{mesh: THREE.Mesh, parent: THREE.Object3D}>}
 */
export const attractors = []

// Define the rectangle dimensions and position
export const rectangleWidth = 1
export const rectangleHeight = 3

export const localAttractingNormal = new THREE.Vector3(0, 0, 1) // Points in the positive z direction (Blue-axis)

/**
 * Adds an attractor plane to a rack object in the 3D scene.
 *
 * An attractor is represented as a yellow plane with a blue normal arrow.
 * The attractor is added to the global attractors array and attached to the rack object.
 *
 * @param {THREE.Object3D} rackObj - The rack object to which the attractor will be added.
 * @returns {void}
 */
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

/**
 * Attracts cooler particles toward attractors in the scene.
 *
 * This function calculates the forces exerted by attractors on cooler particles
 * and updates the particles' velocities accordingly.
 *
 * @returns {void}
 */
export function attractCoolerParticles() {
  // If no attractors in the scene return
  if (attractors.length === 0) {
    return
  }
  // Pre-allocate vectors to avoid creating new ones in the loop
  const particlePosition = new THREE.Vector3()
  const closestPoint = new THREE.Vector3()
  const distanceVector = new THREE.Vector3()
  const totalForce = new THREE.Vector3()
  const localForce = new THREE.Vector3()
  // Constant parameters
  const forceStrength = 0.001
  const minDistance = 0.5
  const maxForce = 0.01
  const falloffPower = 2

  // Calculate force from each attractor
  // attractors.forEach((attractor, index) => {
  coolerParticleSystems.forEach((coolerData) => {
    const coolerGeometry = coolerData.geometry
    const coolerObject = coolerData.cooler
    const coolerParticlesWorldPositions =
      coolerGeometry.attributes.worldPosition.array
    const coolerParticlesVelocities = coolerGeometry.attributes.velocity.array

    // Rotation from world to local cooler space
    const inverseCoolerQuaternion = coolerObject.quaternion.clone().invert()

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

        closestPointOnRectangle(
          particlePosition,
          attractors[n].mesh,
          closestPoint
        )

        // Calculate distance vector
        distanceVector.subVectors(closestPoint, particlePosition)
        const distance = distanceVector.length()

        // Skip if too far away (optimization)
        if (distance > 10) continue

        // Normalize distanceVector
        if (distance > 0.01) {
          distanceVector.divideScalar(distance)
        } else {
          continue // If too close continue (optimization)
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
        const dotProduct = distanceVector.dot(worldAttractingNormal)

        // Apply force based on which side of the attractor
        const finalForce = dotProduct < 0 ? forceMagnitude : -forceMagnitude

        // Accumulate force
        totalForce.addScaledVector(distanceVector, finalForce)
      }

      localForce.copy(totalForce)
      // Rotate force to the cooler local space
      localForce.applyQuaternion(inverseCoolerQuaternion)

      // Add the accumulated force to the velocity
      coolerParticlesVelocities[particleIndex] += localForce.x
      coolerParticlesVelocities[particleIndex + 1] += localForce.y
      coolerParticlesVelocities[particleIndex + 2] += localForce.z
    }

    coolerGeometry.attributes.velocity.needsUpdate = true
  })
}

/**
 * Calculates the closest point on a rectangle to a given point.
 *
 * @param {THREE.Vector3} point - The point to find the closest point for.
 * @param {THREE.Mesh} rectangle - The rectangle mesh.
 * @param {THREE.Vector3} result - The vector to store the result in.
 * @returns {void}
 */
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
