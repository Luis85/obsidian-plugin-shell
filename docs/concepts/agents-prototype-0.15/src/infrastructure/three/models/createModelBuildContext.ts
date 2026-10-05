import * as THREE from 'three'
import type { CharacterAppearance } from '../../../domain/characters/types'
import type { CharacterRegionId } from '../../../application/ports/CharacterSelection'
import type { BoxAdder, BuildContext, StageMaterial, StageMesh } from './ModelBuildContext'
import { MaterialFactory } from '../materials/MaterialFactory'
import { createFaceAssembler } from './FaceAssembler'

export function createModelBuildContext(appearance: CharacterAppearance) {
  const content = new THREE.Group()
  const clickable: StageMesh[] = []
  const byCategory = new Map<CharacterRegionId, StageMesh[]>()
  const materialFactory = new MaterialFactory(appearance.finish)
  const register = (mesh: StageMesh, category?: CharacterRegionId, click = true) => {
    mesh.castShadow = true
    mesh.receiveShadow = true
    if (category) {
      mesh.userData.category = category
      mesh.userData.base = mesh.material.emissive.clone()
      mesh.userData.intensity = mesh.material.emissiveIntensity
      if (click) clickable.push(mesh)
      const list = byCategory.get(category) ?? []
      list.push(mesh)
      byCategory.set(category, list)
    }
    return mesh
  }

  const add: BoxAdder = (size, position, source, category, click = true, parent = content) => {
    const cloned = materialFactory.clone(source)
    const mesh = register(new THREE.Mesh(new THREE.BoxGeometry(...size), cloned), category, click)
    mesh.position.set(...position)
    parent.add(mesh)
    return mesh
  }

  const addGeometry = (geometry: THREE.BufferGeometry, position: [number, number, number], source: StageMaterial, category?: CharacterRegionId, click = true, parent = content) => {
    const cloned = materialFactory.clone(source)
    const mesh = register(new THREE.Mesh(geometry, cloned), category, click)
    mesh.position.set(...position)
    parent.add(mesh)
    return mesh
  }
  const addHingedBox:BuildContext['addHingedBox']=(size,anchor,local,rotation,source,category,rigPart,click=true)=>{
    const joint=new THREE.Group();joint.position.set(...anchor);joint.name=`joint:${rigPart??category}`;joint.userData.authoredJoint=true;if(rigPart)joint.userData.rigPart=rigPart;content.add(joint)
    const mesh=add(size,local,source,category,click,joint);joint.rotation.set(...rotation)
    if(rigPart)mesh.userData.rigPart=rigPart
    return mesh
  }

  const primary = materialFactory.create(appearance.primaryColor, { emissive: new THREE.Color(appearance.primaryColor), emissiveIntensity: .018 })
  const secondary = materialFactory.create(appearance.secondaryColor)
  const accent = materialFactory.create(appearance.accentColor, { emissive: new THREE.Color(appearance.accentColor), emissiveIntensity: .12 })
  const skin = materialFactory.create('#d9b38f', { roughness: .82 })
  const dark = materialFactory.create('#151820', { roughness: .64 })
  const light = materialFactory.create('#edf0f7', { roughness: .62 })
  const mouth = materialFactory.create('#955a66', { roughness: .9 })
  const blush = materialFactory.create('#d88c91', { roughness: .92 })

  const face = createFaceAssembler(appearance, add, { accent, dark, light })
  const context: BuildContext = {
    root: content, add, addGeometry, addHingedBox,
    primary, secondary, accent, skin, dark, light, mouth, blush, ...face
  }
  return { context, clickable, byCategory, materials: materialFactory.materials }
}
