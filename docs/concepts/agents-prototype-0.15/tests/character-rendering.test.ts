import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { CHARACTER_MODELS, CHARACTER_PARTS } from '../src/presentation/character-catalog/catalog'
import { modelAppearance } from '../src/domain/characters/appearance'
import { CharacterModelFactory } from '../src/infrastructure/three/models/CharacterModelFactory'

const factory = new CharacterModelFactory()
const worldBounds = (object:THREE.Object3D) => {
  object.updateWorldMatrix(true,true)
  return new THREE.Box3().setFromObject(object,true)
}
const distanceToBox = (point:THREE.Vector3,box:THREE.Box3) => {
  const nearest=box.clampPoint(point,new THREE.Vector3())
  return nearest.distanceTo(point)
}

describe('procedural character geometry contract', () => {
  for (const definition of CHARACTER_MODELS) {
    it(`${definition.name} is grounded and centered after assembly`, () => {
      const built = factory.build(modelAppearance(definition.id))
      const bounds = worldBounds(built.root)
      const size = bounds.getSize(new THREE.Vector3())

      // Visible bounds may be asymmetric because backpacks, badges and tails intentionally
      // protrude from the structural body. The model origin itself must stay on the floor.
      expect(bounds.min.y).toBeCloseTo(0, 5)
      expect(built.root.position.x).toBeCloseTo(0, 5)
      expect(built.root.position.z).toBeCloseTo(0, 5)
      expect(size.y).toBeGreaterThan(.5)
      expect(built.metrics.height).toBeCloseTo(size.y, 5)
      expect(built.metrics.width).toBeCloseTo(size.x, 5)
      expect(built.metrics.depth).toBeCloseTo(size.z, 5)
    })


    it(`${definition.name} preserves authored hinge assemblies`, () => {
      const built=factory.build(modelAppearance(definition.id))
      const joints:THREE.Object3D[]=[]
      built.root.traverse(object=>{if(object.userData.authoredJoint)joints.push(object)})
      for(const joint of joints){
        const meshes:THREE.Object3D[]=[]
        joint.traverse(object=>{if((object as THREE.Mesh).isMesh)meshes.push(object)})
        expect(meshes.length).toBeGreaterThan(0)
        const bounds=worldBounds(joint),size=bounds.getSize(new THREE.Vector3())
        expect(size.length()).toBeGreaterThan(.05)
      }
    })
    it(`${definition.name} uses attached semantic rig pivots`, () => {
      const built=factory.build(modelAppearance(definition.id))
      for(const node of Object.values(built.rig.nodes)){
        if(!node)continue
        const bounds=worldBounds(node)
        const pivot=node.getWorldPosition(new THREE.Vector3())
        // A hinge may sit exactly on an attachment edge, but it must never be far away
        // from the voxels it controls. This catches the classic "shifted limb" bug.
        expect(distanceToBox(pivot,bounds)).toBeLessThan(.18)
      }
    })
  }

  for(const part of CHARACTER_PARTS){
    const model=CHARACTER_MODELS.find(candidate=>candidate.silhouette===part.silhouettes[0]&&part.categories.includes(candidate.category))
    if(!model)continue
    it(`part ${part.id} stays grounded when composed`,()=>{
      const appearance=modelAppearance(model.id)
      appearance.parts={...appearance.parts,[part.slot]:part.id}
      const built=factory.build(appearance)
      const bounds=worldBounds(built.root)
      const size=bounds.getSize(new THREE.Vector3())
      expect(bounds.min.y).toBeCloseTo(0,5)
      expect(size.x).toBeGreaterThan(.25)
      expect(size.y).toBeGreaterThan(.25)
      expect(size.z).toBeGreaterThan(.2)
      // Guard against a single badly pivoted part exploding the scene bounds.
      expect(size.x).toBeLessThan(8)
      expect(size.y).toBeLessThan(9)
      expect(size.z).toBeLessThan(8)
    })
  }

  it('authored human limb assemblies keep clothing and extremities together',()=>{
    const built=factory.build(modelAppearance('voxel-human-v2'))
    for(const part of ['leftArm','rightArm','leftLeg','rightLeg'] as const){
      const node=built.rig.nodes[part]
      expect(node).toBeTruthy()
      let meshCount=0
      node?.traverse(object=>{if((object as THREE.Mesh).isMesh)meshCount++})
      expect(meshCount).toBeGreaterThanOrEqual(3)
      const box=worldBounds(node!)
      expect(distanceToBox(node!.getWorldPosition(new THREE.Vector3()),box)).toBeLessThan(.18)
    }
  })

  it('default human safety affordance stays a compact torso emblem',()=>{
    const built=factory.build(modelAppearance('voxel-human-v2'))
    const safety=built.byCategory.get('safety') ?? []
    expect(safety.length).toBeGreaterThan(0)
    const bounds=new THREE.Box3()
    for(const object of safety)bounds.expandByObject(object,true)
    const size=bounds.getSize(new THREE.Vector3())
    const center=bounds.getCenter(new THREE.Vector3())
    expect(size.x).toBeLessThan(.5)
    expect(size.y).toBeLessThan(.5)
    expect(size.z).toBeLessThan(.3)
    expect(Math.abs(center.x)).toBeLessThan(.9)
  })

  it('quadruped leg assemblies keep paws attached to their semantic limbs',()=>{
    const built=factory.build(modelAppearance('voxel-dog-v1'))
    for(const part of ['leftArm','rightArm','leftLeg','rightLeg'] as const){
      const node=built.rig.nodes[part]
      expect(node).toBeTruthy()
      let meshCount=0
      node?.traverse(object=>{if((object as THREE.Mesh).isMesh)meshCount++})
      expect(meshCount).toBeGreaterThanOrEqual(2)
    }
  })

})
