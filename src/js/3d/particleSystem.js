import * as THREE from 'three'
import { raycasterCollision, models, floor } from './scene3d.js'
import { walls } from './pathsTo3d.js'

/**
 * A particle system entry.
 *
 * @typedef {Object} ParticleSystemEntry
 * @property {THREE.BufferGeometry} geometry - Geometry containing particle attributes.
 * @property {THREE.Object3D} owner - The mesh or group that owns the particles.
 */

/**
 * Holds the particle systems that belong to *cooler* objects.
 *
 * @type {Array<ParticleSystemEntry>}
 */
export let coolerParticleSystems = []

/**
 * Holds the particle systems that belong to *rack* objects.
 *
 * @type {Array<ParticleSystemEntry>}
 */
export let rackParticleSystems = []

/**
 * Configuration object for particle systems.
 *
 * @typedef {Object} ParticleSystemConfig
 * @property {number} particleCount - Number of particles in the system.
 * @property {number} particleSize - Size of each particle.
 * @property {number[]} accelerations - Acceleration factors for each axis.
 * @property {number[]} turbulence - Turbulence factors for each axis.
 * @property {number[]} positionOffset - Initial position offset for each axis.
 * @property {number[]} positionRange - Range of initial positions for each axis.
 * @property {number[]} velocityOffset - Initial velocity offset for each axis.
 * @property {number[]} velocityRange - Range of initial velocities for each axis.
 * @property {number[]} color - Color of the particles.
 * @property {number} maxLifetime - Maximum lifetime of a particle.
 * @property {number} maxLifetimeRange - Range for the maximum lifetime of a particle.
 * @property {number[]} collisionColor - Color of the particles on collision.
 */

/**
 * Configuration object for cooler particle systems.
 *
 * @type {ParticleSystemConfig}
 */
const coolerConfig = {
  particleCount: 500,
  particleSize: 0.05,
  accelerations: [0.5, 1.5, 1],
  turbulence: [0.001, 0.01, 0.02],

  // x and y no offset, z offset
  positionOffset: [0, 20, 0],
  positionRange: [0, 0.2, 40],

  // main flow direction x, slight downward flow y, slight z variation
  velocityOffset: [1, -0.1, 0],
  velocityRange: [0.8, -0.1, 0.02],

  color: [0.1, 0.5, 1.0],
  maxLifetime: 1000,
  maxLifetimeRange: 500,
  collisionColor: [1.0, 0.5, 0.0],
}

/**
 * Configuration object for rack particle systems.
 *
 * @type {ParticleSystemConfig}
 */
const rackConfig = {
  particleCount: 250,
  particleSize: 0.05,
  accelerations: [1, 1.2, 0.3],
  turbulence: [0, 0, 0],

  // [x, y, z] initial position offset
  positionOffset: [0, 0, -1],
  positionRange: [0.5, 2.5, -1],

  // slightly random along x, slight upward flow y, mainly backwards flow due to fans on z
  velocityOffset: [0, 0.002, -0.01],
  velocityRange: [0.002, 0.002, -0.02],

  color: [1.0, 0.1, 0.1],
  maxLifetime: 1000,
  maxLifetimeRange: 500,
  collisionColor: [1.0, 0.5, 0.0],
}

export function createCoolerParticles(coolerObject) {
  createParticleSystem(coolerObject, coolerConfig, coolerParticleSystems)
}

export function updateCoolerParticles() {
  updateParticleSystems(coolerParticleSystems)
}

export function createRackParticles(rackObject) {
  createParticleSystem(rackObject, rackConfig, rackParticleSystems)
}

export function updateRackParticles() {
  updateParticleSystems(rackParticleSystems)
}

/**
 * createParticleSystem creates a particle system attached to a given object.
 *
 * @param {THREE.Object3D} object - The object to which the particle system will be attached.
 * @param {Object} config - Configuration object for the particle system.
 * @returns {void}
 */
export function createParticleSystem(object, config, particleSystems) {
  const particleCount = config.particleCount
  const particlesGeometry = new THREE.BufferGeometry()
  const positions = new Float32Array(particleCount * 3)
  const worldPositions = new Float32Array(particleCount * 3)
  const velocities = new Float32Array(particleCount * 3)
  const lifetimes = new Float32Array(particleCount)
  const maxLifetime = new Float32Array(particleCount)
  const colors = new Float32Array(particleCount * 3) // Add color attribute

  for (let i = 0; i < particleCount; i++) {
    initParticleProps(
      i,
      positions,
      worldPositions,
      velocities,
      lifetimes,
      maxLifetime,
      colors,
      config
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
    size: config.particleSize,
    vertexColors: true, // Enable vertex colors
  })

  const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial)

  // Group particles to object
  object.add(particleSystem)

  // Store reference for updating
  particleSystems.push({
    system: particleSystem,
    // geometry: particlesGeometry,
    object: object,
    config: config,
  })
}

/**
 * updateParticleSystems updates all particle systems each frame.
 *
 * @returns {void}
 */
export function updateParticleSystems(particleSystems) {
  particleSystems.forEach((particleData) => {
    const geometry = particleData.system.geometry
    const positions = geometry.attributes.position.array
    const worldPositions = geometry.attributes.worldPosition.array
    const velocities = geometry.attributes.velocity.array
    const lifetimes = geometry.attributes.lifetime.array
    const maxLifetime = geometry.attributes.maxLifetime.array
    const colors = geometry.attributes.color.array
    const config = particleData.config

    for (let i = 0; i < positions.length; i += 3) {
      const particleIndex = i / 3

      // Update particle lifetime
      lifetimes[particleIndex]++
      if (lifetimes[particleIndex] >= maxLifetime[particleIndex]) {
        // Reset particle
        initParticleProps(
          particleIndex,
          positions,
          worldPositions,
          velocities,
          lifetimes,
          maxLifetime,
          colors,
          config
        )
      }

      // Update position
      positions[i] += velocities[i] * config.accelerations[0]
      positions[i + 1] += velocities[i + 1] * config.accelerations[1]
      positions[i + 2] += velocities[i + 2] * config.accelerations[2]

      // Add some turbulence
      velocities[i] += (Math.random() - 0.5) * config.turbulence[0]
      velocities[i + 1] += (Math.random() - 0.5) * config.turbulence[1]
      velocities[i + 2] += (Math.random() - 0.5) * config.turbulence[2]

      // Check for collisions
      const particlePosition = new THREE.Vector3(
        positions[i],
        positions[i + 1],
        positions[i + 2]
      )

      // Convert particle position from local object space to world space
      const worldPosition = particlePosition.clone()
      particleData.object.localToWorld(worldPosition)

      // Store current world positions for other uses
      worldPositions[i] = worldPosition['x']
      worldPositions[i + 1] = worldPosition['y']
      worldPositions[i + 2] = worldPosition['z']

      // Set up raycaster from particle position
      const rayDirection = new THREE.Vector3(
        velocities[i],
        velocities[i + 1],
        velocities[i + 2]
      ).normalize()

      raycasterCollision.set(worldPosition, rayDirection)

      // Get all objects except the object itself
      const filteredObjects = models.filter(
        (obj) => obj !== particleData.object
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
        colors[i] = config.collisionColor[0]
        colors[i + 1] = config.collisionColor[1]
        colors[i + 2] = config.collisionColor[2]

        // Stop the particle completely on wall collision
        velocities[i] = 0
        velocities[i + 1] = 0
        velocities[i + 2] = 0

        maxLifetime[particleIndex] *= 0.9 // Reduce maxLifetime to avoid accumulation
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
 * initParticleProps initializes (or resets) the properties of a single particle.
 *
 * Used internally by `createParticleSystem` and `updateParticleSystems`.
 *
 * @param {number} index - Index of the particle to initialize.
 * @param {Float32Array} positions - Buffer attribute for local positions.
 * @param {Float32Array} worldPositions - Buffer attribute for world positions.
 * @param {Float32Array} velocities - Buffer attribute for particle velocities.
 * @param {Float32Array} lifetimes - Buffer attribute for particle lifetimes.
 * @param {Float32Array} maxLifetime - Buffer attribute for max lifetimes.
 * @param {Float32Array} colors - Buffer attribute for particle colors (r,g,b).
 * @param {Object} config - Configuration object for the particle system.
 * @returns {void}
 */
export function initParticleProps(
  index,
  positions,
  worldPositions,
  velocities,
  lifetimes,
  maxLifetime,
  colors,
  config
) {
  // Initialize position
  positions[index * 3] =
    config.positionOffset[0] + (Math.random() - 0.5) * config.positionRange[0]
  positions[index * 3 + 1] =
    config.positionOffset[1] + (Math.random() - 0.5) * config.positionRange[1]
  positions[index * 3 + 2] =
    config.positionOffset[2] + (Math.random() - 0.5) * config.positionRange[2]

  worldPositions[index * 3] = 0
  worldPositions[index * 3 + 1] = 0
  worldPositions[index * 3 + 2] = 0 // initially set world position to 0

  // Initial velocities
  velocities[index * 3] =
    config.velocityOffset[0] + (Math.random() - 0.5) * config.velocityRange[0]
  velocities[index * 3 + 1] =
    config.velocityOffset[1] + (Math.random() - 0.5) * config.velocityRange[1]
  velocities[index * 3 + 2] =
    config.velocityOffset[2] + (Math.random() - 0.5) * config.velocityRange[2]

  // Initialize color
  colors[index * 3] = config.color[0]
  colors[index * 3 + 1] = config.color[1]
  colors[index * 3 + 2] = config.color[2]

  // Initialize lifetime
  lifetimes[index] = Math.random() * config.maxLifetime
  maxLifetime[index] =
    config.maxLifetime + Math.random() * config.maxLifetimeRange
}
