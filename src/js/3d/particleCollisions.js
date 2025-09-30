import * as THREE from 'three'
import { rackParticleSystems, coolerParticleSystems } from './particleSystem.js'

/**
 * checkInterParticleCollisions checks for collisions between particles emitted from racks (red)
 * and particles emitted from coolers (blue).
 *
 * This should be called on each animation frame to keep particle
 * interactions up to date.
 *
 * @returns {void}
 */
export function checkInterParticleCollisions() {
  rackParticleSystems.forEach((rackData) => {
    coolerParticleSystems.forEach((coolerData) => {
      checkCollisionsBetweenSystems(rackData, coolerData)
    })
  })
}

function checkCollisionsBetweenSystems(rackData, coolerData) {
  const rackGeometry = rackData.system.geometry
  const coolerGeometry = coolerData.system.geometry

  const rackWorldPositions = rackGeometry.attributes.worldPosition.array
  const coolerWorldPositions = coolerGeometry.attributes.worldPosition.array

  // Check for collisions between each rack particle and cooler particle
  const collisionDistance = 0.1 // Same as used in individual particle collision detection

  // Track which rack particles have already collided this frame
  const collidedRackParticles = new Set()

  for (
    let rackIndex = 0;
    rackIndex < rackWorldPositions.length;
    rackIndex += 3
  ) {
    // Skip if this rack particle already collided
    if (collidedRackParticles.has(rackIndex)) {
      continue
    }

    const rackPos = new THREE.Vector3(
      rackWorldPositions[rackIndex],
      rackWorldPositions[rackIndex + 1],
      rackWorldPositions[rackIndex + 2]
    )

    for (
      let coolerIndex = 0;
      coolerIndex < coolerWorldPositions.length;
      coolerIndex += 3
    ) {
      const coolerPos = new THREE.Vector3(
        coolerWorldPositions[coolerIndex],
        coolerWorldPositions[coolerIndex + 1],
        coolerWorldPositions[coolerIndex + 2]
      )
      const distance = rackPos.distanceTo(coolerPos)

      if (distance < collisionDistance) {
        // Collision detected!
        handleCollision(rackData, rackIndex, coolerData, coolerIndex)
        // Mark this rack particle as collided so it won't hit other particles
        collidedRackParticles.add(rackIndex)
        break // Stop checking this rack particle against other cooler particles
      }
    }
  }
}

function handleCollision(
  rackData,
  rackParticleIndex,
  coolerData,
  coolerParticleIndex
) {
  // Make both particles disappear immediately by setting their lifetime to max
  const rackGeometry = rackData.system.geometry
  const coolerGeometry = coolerData.system.geometry

  const rackMaxLifetimes = rackGeometry.attributes.maxLifetime.array
  const rackColors = rackGeometry.attributes.color.array
  const coolerMaxLifetimes = coolerGeometry.attributes.maxLifetime.array
  const coolerColors = coolerGeometry.attributes.color.array

  // Rember to multiply indexes by 3 as colors are defined 3 dimensional vectors
  rackColors[rackParticleIndex] = 1.0 // Red
  rackColors[rackParticleIndex + 1] = 0.5 // Yellow
  rackColors[rackParticleIndex + 2] = 0.0 // Blue

  coolerColors[coolerParticleIndex] = 1.0 // Red
  coolerColors[coolerParticleIndex + 1] = 0.5 // Yellow
  coolerColors[coolerParticleIndex + 2] = 0.0 // Blue

  // Reduce maxLifetimes to avoid accumulation
  rackMaxLifetimes[rackParticleIndex / 3] *= 0.9
  coolerMaxLifetimes[coolerParticleIndex / 3] *= 0.9

  rackGeometry.attributes.maxLifetime.needsUpdate = true
  coolerGeometry.attributes.maxLifetime.needsUpdate = true
  rackGeometry.attributes.color.needsUpdate = true
  coolerGeometry.attributes.color.needsUpdate = true
}
