import * as THREE from 'three'
import { particleSystems as rackParticleSystems } from './rackParticles.js'
import { particleSystems as coolerParticleSystems } from './coolerParticles.js'

const GRID_SIZE = 1.0 // Cell size for spatial partitioning
const COLLISION_DISTANCE = 0.1

// Spatial hash for particles
function getGridKey(x, y, z) {
  const ix = Math.floor(x / GRID_SIZE)
  const iy = Math.floor(y / GRID_SIZE)
  const iz = Math.floor(z / GRID_SIZE)
  return `${ix},${iy},${iz}`
}

function buildSpatialHash(particleSystems) {
  const hash = new Map()
  particleSystems.forEach((systemData) => {
    const worldPositions = systemData.geometry.attributes.worldPosition.array
    for (let i = 0; i < worldPositions.length; i += 3) {
      const x = worldPositions[i]
      const y = worldPositions[i + 1]
      const z = worldPositions[i + 2]
      const key = getGridKey(x, y, z)
      if (!hash.has(key)) hash.set(key, [])
      hash.get(key).push({ systemData, index: i })
    }
  })
  return hash
}

function getNearbyCells(key) {
  const [ix, iy, iz] = key.split(',').map(Number)
  const cells = []
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        cells.push(`${ix + dx},${iy + dy},${iz + dz}`)
      }
    }
  }
  return cells
}

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
  // Build spatial hashes for efficient collision detection
  const rackHash = buildSpatialHash(rackParticleSystems)
  const coolerHash = buildSpatialHash(coolerParticleSystems)

  // Check collisions using spatial partitioning
  const checkedPairs = new Set() // To avoid duplicate checks

  rackHash.forEach((rackParticles, key) => {
    const nearbyCells = getNearbyCells(key)
    nearbyCells.forEach((cellKey) => {
      if (coolerHash.has(cellKey)) {
        const coolerParticles = coolerHash.get(cellKey)
        rackParticles.forEach((rackParticle) => {
          coolerParticles.forEach((coolerParticle) => {
            const pairKey = `${rackParticle.systemData.system.id}-${rackParticle.index}-${coolerParticle.systemData.system.id}-${coolerParticle.index}`
            if (!checkedPairs.has(pairKey)) {
              checkedPairs.add(pairKey)
              checkCollisionBetweenParticles(rackParticle, coolerParticle)
            }
          })
        })
      }
    })
  })
}

function checkCollisionBetweenParticles(rackParticle, coolerParticle) {
  const rackWorldPositions =
    rackParticle.systemData.geometry.attributes.worldPosition.array
  const coolerWorldPositions =
    coolerParticle.systemData.geometry.attributes.worldPosition.array

  const rackPos = new THREE.Vector3(
    rackWorldPositions[rackParticle.index],
    rackWorldPositions[rackParticle.index + 1],
    rackWorldPositions[rackParticle.index + 2]
  )

  const coolerPos = new THREE.Vector3(
    coolerWorldPositions[coolerParticle.index],
    coolerWorldPositions[coolerParticle.index + 1],
    coolerWorldPositions[coolerParticle.index + 2]
  )

  const distance = rackPos.distanceTo(coolerPos)

  if (distance < COLLISION_DISTANCE) {
    // Collision detected!
    handleCollision(
      rackParticle.systemData,
      rackParticle.index,
      coolerParticle.systemData,
      coolerParticle.index
    )
  }
}

function handleCollision(
  rackData,
  rackArrayIndex,
  coolerData,
  coolerArrayIndex
) {
  // Make both particles disappear immediately by setting their lifetime to max
  const rackGeometry = rackData.geometry
  const coolerGeometry = coolerData.geometry

  const rackMaxLifetimes = rackGeometry.attributes.maxLifetime.array
  const rackColors = rackGeometry.attributes.color.array
  const coolerMaxLifetimes = coolerGeometry.attributes.maxLifetime.array
  const coolerColors = coolerGeometry.attributes.color.array

  // Colors are at arrayIndex
  rackColors[rackArrayIndex] = 1.0 // Red
  rackColors[rackArrayIndex + 1] = 0.5 // Yellow
  rackColors[rackArrayIndex + 2] = 0.0 // Blue

  coolerColors[coolerArrayIndex] = 1.0 // Red
  coolerColors[coolerArrayIndex + 1] = 0.5 // Yellow
  coolerColors[coolerArrayIndex + 2] = 0.0 // Blue

  // Reduce maxLifetimes to avoid accumulation
  const rackParticleIndex = rackArrayIndex / 3
  const coolerParticleIndex = coolerArrayIndex / 3
  rackMaxLifetimes[rackParticleIndex] *= 0.9
  coolerMaxLifetimes[coolerParticleIndex] *= 0.9

  rackGeometry.attributes.maxLifetime.needsUpdate = true
  coolerGeometry.attributes.maxLifetime.needsUpdate = true
  rackGeometry.attributes.color.needsUpdate = true
  coolerGeometry.attributes.color.needsUpdate = true
}
