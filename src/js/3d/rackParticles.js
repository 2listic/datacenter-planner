import * as THREE from 'three'
import { raycasterCollision, models, floor } from './scene3d.js'
import { walls } from './pathsTo3d.js'

export let particleSystems = []

// constant low velocity along x due to small initial velocity
// velocity increased by 50% at every update along y (hot particles going up)
// velocity reduced at every update along z (backwards on the main direction, due to friction)
const accelerations = [1, 1.2, 0.3]

let frameCount = 0

/**
 * createRackParticles creates a particle system attached to a given rack object.
 *
 * @param {THREE.Object3D} rackObject - The rack object to which the particle system will be attached.
 * @returns {void}
 */
export function createRackParticles(rackObject) {
  const particleCount = 100
  const particlesGeometry = new THREE.BufferGeometry()
  const positions = new Float32Array(particleCount * 3)
  const worldPositions = new Float32Array(particleCount * 3)
  const velocities = new Float32Array(particleCount * 3)
  const lifetimes = new Float32Array(particleCount)
  const maxLifetime = new Float32Array(particleCount)
  const colors = new Float32Array(particleCount * 3) // Add color attribute

  for (let i = 0; i < particleCount; i++) {
    initRackParticleProps(
      i,
      positions,
      worldPositions,
      velocities,
      lifetimes,
      maxLifetime,
      colors
    )
  }

  particlesGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3)
  )
  particlesGeometry.setAttribute(
    'worldPosition',
    new THREE.BufferAttribute(worldPositions, 3)
  )
  particlesGeometry.setAttribute(
    'velocity',
    new THREE.BufferAttribute(velocities, 3)
  )
  particlesGeometry.setAttribute(
    'lifetime',
    new THREE.BufferAttribute(lifetimes, 1)
  )
  particlesGeometry.setAttribute(
    'maxLifetime',
    new THREE.BufferAttribute(maxLifetime, 1)
  )
  particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const particlesMaterial = new THREE.PointsMaterial({
    size: 0.05,
    vertexColors: true, // Enable vertex colors
  })

  const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial)
  console.log(particleSystem)

  // Group particles to rack object
  rackObject.add(particleSystem)

  // Store reference for updating
  particleSystems.push({
    system: particleSystem,
    geometry: particlesGeometry,
    rack: rackObject,
  })
}

/**
 * updateRackParticles updates all existing rack particle systems on each animation frame.
 *
 * @returns {void}
 */
export function updateRackParticles() {
  frameCount++
  const doRaycast = frameCount % 5 === 0 // Raycast every 5 frames

  particleSystems.forEach((particleData) => {
    const geometry = particleData.geometry
    const positions = geometry.attributes.position.array
    const worldPositions = geometry.attributes.worldPosition.array
    const velocities = geometry.attributes.velocity.array
    const lifetimes = geometry.attributes.lifetime.array
    const maxLifetime = geometry.attributes.maxLifetime.array
    const colors = geometry.attributes.color.array

    for (let i = 0; i < positions.length; i += 3) {
      const particleIndex = i / 3

      // Update particle lifetime
      lifetimes[particleIndex]++
      if (lifetimes[particleIndex] >= maxLifetime[particleIndex]) {
        // Reset particle
        initRackParticleProps(
          particleIndex,
          positions,
          worldPositions,
          velocities,
          lifetimes,
          maxLifetime,
          colors
        )
      }

      // Update position
      positions[i] += velocities[i] * accelerations[0]
      positions[i + 1] += velocities[i + 1] * accelerations[1]
      positions[i + 2] += velocities[i + 2] * accelerations[2]

      // Add some turbulence (reduced frequency)
      if (doRaycast) {
        velocities[i] += (Math.random() - 0.5) * 0.0001
        velocities[i + 1] += (Math.random() - 0.5) * 0.0001
        velocities[i + 2] += (Math.random() - 0.5) * 0.0001
      }

      // Check for collisions
      const particlePosition = new THREE.Vector3(
        positions[i],
        positions[i + 1],
        positions[i + 2]
      )

      // Convert particle position from local rack space to world space
      const worldPosition = particlePosition.clone()
      particleData.rack.localToWorld(worldPosition)

      // Store current world positions for other uses
      worldPositions[i] = worldPosition['x']
      worldPositions[i + 1] = worldPosition['y']
      worldPositions[i + 2] = worldPosition['z']

      if (doRaycast) {
        // Set up raycaster from particle position
        const rayDirection = new THREE.Vector3(
          velocities[i],
          velocities[i + 1],
          velocities[i + 2]
        ).normalize()

        raycasterCollision.set(worldPosition, rayDirection)

        // Get all objects except the rack itself
        const filteredObjects = models.filter(
          (obj) => obj !== particleData.rack
        )
        // Take only the object itself without its particles if present
        const filteredObjectsMeshes = filteredObjects.map((obj) =>
          obj.getObjectByProperty('type', 'Mesh')
        )
        const objectsToTest = [...filteredObjectsMeshes, floor, ...walls]

        const intersects = raycasterCollision.intersectObjects(
          objectsToTest,
          false // do not check descendants
        )

        // Check if collision is close enough (within particle size)
        if (intersects.length > 0 && intersects[0].distance < 0.1) {
          // Change particle color on collision
          colors[i] = 1.0 // Red
          colors[i + 1] = 0.5 // Orange-ish
          colors[i + 2] = 0.0 // Blue = 0

          // Stop the particle completely on wall collision
          velocities[i] = 0
          velocities[i + 1] = 0
          velocities[i + 2] = 0

          maxLifetime[particleIndex] *= 0.9 // Reduce maxLifetime to avoid accumulation
        }
      }
    }

    geometry.attributes.color.needsUpdate = true
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.worldPosition.needsUpdate = true
    geometry.attributes.lifetime.needsUpdate = true
    geometry.attributes.maxLifetime.needsUpdate = true
  })
}

/**
 * initRackParticleProps initializes or resets a single particle’s properties at a given index.
 *
 * This function is called by `createRackParticles` to set up particles initially,
 * and by `updateRackParticles` to reset expired particles.
 *
 * @param {number} index - The index of the particle in the arrays.
 * @param {Float32Array} positions - Local positions array (x, y, z per particle).
 * @param {Float32Array} worldPositions - World positions array (x, y, z per particle).
 * @param {Float32Array} velocities - Particle velocities array (x, y, z per particle).
 * @param {Float32Array} lifetimes - Current lifetime for each particle.
 * @param {Float32Array} maxLifetime - Maximum lifetime for each particle.
 * @param {Float32Array} colors - RGB color array (r, g, b per particle).
 * @returns {void} This function does not return a value.
 */
export function initRackParticleProps(
  index,
  positions,
  worldPositions,
  velocities,
  lifetimes,
  maxLifetime,
  colors
) {
  // Initial positions
  positions[index * 3] = (Math.random() - 0.5) * 0.5 // x initial offset
  positions[index * 3 + 1] = (Math.random() - 0.5) * 2.5 // y offset
  positions[index * 3 + 2] = -(Math.random() - 0.5 + 0.8) // z offset

  worldPositions[index * 3] = 0
  worldPositions[index * 3 + 1] = 0
  worldPositions[index * 3 + 2] = 0 // initialy set world position to 0

  // Initial velocities
  velocities[index * 3] = (Math.random() - 0.5) * 0.002 // slightly random along x
  velocities[index * 3 + 1] = (Math.random() - 0.5) * 0.002 + 0.002 // slight upward flow
  velocities[index * 3 + 2] = -(Math.random() * 0.02 + 0.001) // mainly backwards flow due to fans

  // Initialize color
  colors[index * 3] = 1.0 // Red
  colors[index * 3 + 1] = 0.1 // Green
  colors[index * 3 + 2] = 0.1 // Blue

  // Initialize lifetime
  lifetimes[index] = Math.random() * 1000
  maxLifetime[index] = 1000 + Math.random() * 500
}
