import * as THREE from 'three'
import { raycasterCollision, models, floor } from './scene3d.js'
import { walls } from './pathsTo3d.js'

export let particleSystems = []

// reduces velocity by 50% at every update on the main direction due to friction with other particles
// increases by 50% towards the floor due to gravity and lower temperature
// along z on the plane parrallel to the floor is constant
const accelerations = [0.5, 1.5, 1]
 
export function createCoolerParticles(coolerObject) {
  const particleCount = 500
  const particlesGeometry = new THREE.BufferGeometry()
  const positions = new Float32Array(particleCount * 3)
  const velocities = new Float32Array(particleCount * 3)
  const lifetimes = new Float32Array(particleCount)
  const maxLifetime = new Float32Array(particleCount)
  const colors = new Float32Array(particleCount * 3) // Add color attribute

  for (let i = 0; i < particleCount; i++) {
    initCoolerParticleProps(
      i,
      positions,
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

  // Group particles to cooler object
  coolerObject.add(particleSystem)

  // Store reference for updating
  particleSystems.push({
    system: particleSystem,
    geometry: particlesGeometry,
    cooler: coolerObject,
  })
}

export function updateCoolerParticles() {
  particleSystems.forEach((particleData) => {
    const geometry = particleData.geometry
    const positions = geometry.attributes.position.array
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
        initCoolerParticleProps(
          particleIndex,
          positions,
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

      // Add some turbulence
      velocities[i] += (Math.random() - 0.5) * 0.001
      velocities[i + 1] += (Math.random() - 0.5) * 0.01
      velocities[i + 2] += (Math.random() - 0.5) * 0.02 // it expands along z-axis orthogonal to main direction x

      // Check for collisions
      const particlePosition = new THREE.Vector3(
        positions[i],
        positions[i + 1],
        positions[i + 2]
      )

      // Convert particle position from local cooler space to world space
      const worldPosition = particlePosition.clone()
      particleData.cooler.localToWorld(worldPosition)

      // Set up raycaster from particle position
      const rayDirection = new THREE.Vector3(
        velocities[i],
        velocities[i + 1],
        velocities[i + 2]
      ).normalize()

      raycasterCollision.set(worldPosition, rayDirection)

      // Get all objects except the cooler itself and particles
      const filteredObjects = models.filter(
        (obj) => obj !== particleData.cooler
      )
      const objectsToTest = [...filteredObjects, floor, ...walls]

      const intersects = raycasterCollision.intersectObjects(
        objectsToTest,
        false  // do not check descendants
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
       }
     }

      // TODO: Inter-particle collision with rack particles (removed due to circular dependency)
      // This functionality can be re-implemented with a different architecture

     geometry.attributes.color.needsUpdate = true
     geometry.attributes.position.needsUpdate = true
     geometry.attributes.lifetime.needsUpdate = true
   })
 }

export function initCoolerParticleProps(
  index,
  positions,
  velocities,
  lifetimes,
  maxLifetime,
  colors
) {
  // Initialize position
  positions[index * 3] = 0 // x no offset
  positions[index * 3 + 1] = ((Math.random() - 0.5) * 0.2) + 20 // y offset
  positions[index * 3 + 2] = (Math.random() - 0.5) * 40 // z offset

  // Initial velocities
  velocities[index * 3] = Math.random() * 2 // main flow direction (along X-axis)
  velocities[index * 3 + 1] = -(Math.random() * 0.1 + 0.1) // slight downward flow
  velocities[index * 3 + 2] = (Math.random() - 0.5) * 0.02 // slight z variation

  // Initialize color
  colors[index * 3] = 0.1 // Red
  colors[index * 3 + 1] = 0.5 // Green
  colors[index * 3 + 2] = 1.0 // Blue

  // Initialize lifetime
  lifetimes[index] = Math.random() * 1000
  maxLifetime[index] = 1000 + Math.random() * 500
}
