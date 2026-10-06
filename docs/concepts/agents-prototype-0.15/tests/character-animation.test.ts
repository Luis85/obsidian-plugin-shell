import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { CHARACTER_MODELS } from '../src/presentation/character-catalog/catalog'
import { modelAppearance } from '../src/domain/characters/appearance'
import { CharacterAnimationController } from '../src/infrastructure/three/scene/CharacterAnimationController'
import { CharacterModelFactory } from '../src/infrastructure/three/models/CharacterModelFactory'

describe('procedural character animation rig', () => {
  const factory = new CharacterModelFactory()

  it('exposes semantic rig nodes without changing the grounded footprint', () => {
    const built = factory.build(modelAppearance('voxel-human-v2'))
    const before = new THREE.Box3().setFromObject(built.root, true)
    expect(built.rig.nodes.head).toBeTruthy()
    expect(built.rig.nodes.leftArm).toBeTruthy()
    expect(built.rig.nodes.rightArm).toBeTruthy()
    expect(built.rig.nodes.leftLeg).toBeTruthy()
    expect(built.rig.nodes.rightLeg).toBeTruthy()
    expect(built.rig.eyes.length).toBeGreaterThan(0)
    const after = new THREE.Box3().setFromObject(built.root, true)
    expect(after.min.y).toBeCloseTo(before.min.y, 5)
    expect(after.min.y).toBeCloseTo(0, 5)
  })

  it('can apply a pose and motion without translating the model root', () => {
    const built = factory.build(modelAppearance('voxel-human-v2'))
    const controller = new CharacterAnimationController(built.rig)
    controller.setPose('wave')
    controller.setMotion('listen')
    controller.update(1.2, 1/60, 'calm', false)
    expect(built.root.position.x).toBeCloseTo(0, 5)
    expect(built.root.position.y).toBeCloseTo(0, 5)
    expect(built.root.position.z).toBeCloseTo(0, 5)
    expect(Math.abs(built.rig.nodes.rightArm?.rotation.z ?? 0)).toBeGreaterThan(.01)
  })

  for (const definition of CHARACTER_MODELS) {
    it(`${definition.name} rig update stays finite`, () => {
      const built = factory.build(modelAppearance(definition.id))
      const controller = new CharacterAnimationController(built.rig)
      controller.setPose('celebrate')
      controller.setMotion('celebrate')
      controller.update(2.4, 1/60, 'playful', false)
      built.root.updateWorldMatrix(true, true)
      const bounds = new THREE.Box3().setFromObject(built.root, true)
      const size = bounds.getSize(new THREE.Vector3())
      expect(Number.isFinite(size.x + size.y + size.z)).toBe(true)
      expect(size.y).toBeGreaterThan(.5)
    })
  }
})
