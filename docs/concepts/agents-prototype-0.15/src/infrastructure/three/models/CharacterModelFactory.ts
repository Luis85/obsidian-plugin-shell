import * as THREE from 'three'
import type { CharacterAppearance, CharacterSilhouette } from '../../../domain/characters/types'
import { characterModel } from '../../../domain/characters/rules'
import { assembleCharacterRig } from '../scene/CharacterRig'
import { disposeThreeScene } from '../scene/disposeThreeScene'
import { AccessoryAssembler } from '../accessories/AccessoryAssembler'
import { PatternAssembler } from '../patterns/PatternAssembler'
import { HumanModelBuilder } from './HumanModelBuilder'
import { QuadrupedModelBuilder } from './QuadrupedModelBuilder'
import { BirdModelBuilder } from './BirdModelBuilder'
import { HeadModelBuilder } from './HeadModelBuilder'
import { ObjectModelBuilder } from './ObjectModelBuilder'
import { createModelBuildContext } from './createModelBuildContext'
import type { BuiltCharacterModel, ModelBuilder } from './ModelBuildContext'
export type { BuiltCharacterModel, CharacterModelMetrics } from './ModelBuildContext'

/** +Y up, +Z forward, structural footprint at the origin, ground at Y=0. */
export class CharacterModelFactory {
  private readonly builders: Record<CharacterSilhouette, ModelBuilder> = {
    human: new HumanModelBuilder(), quadruped: new QuadrupedModelBuilder(),
    bird: new BirdModelBuilder(), head: new HeadModelBuilder(), object: new ObjectModelBuilder()
  }
  private readonly accessories = new AccessoryAssembler()
  private readonly patterns = new PatternAssembler()

  build(appearance: CharacterAppearance): BuiltCharacterModel {
    const definition = characterModel(appearance.modelId)
    const { context, clickable, byCategory, materials } = createModelBuildContext(appearance)
    const content = context.root
    const root = new THREE.Group()
    root.add(content)
    try {
      this.builders[definition.silhouette].build(appearance, context)
      content.updateWorldMatrix(true, true)
      const structuralBounds = new THREE.Box3()
      for (const category of ['mind', 'character'] as const) {
        for (const mesh of byCategory.get(category) ?? []) structuralBounds.expandByObject(mesh, true)
      }
      if (structuralBounds.isEmpty()) structuralBounds.setFromObject(content, true)
      const center = structuralBounds.getCenter(new THREE.Vector3())
      this.patterns.assemble(appearance, context, byCategory)
      this.accessories.assemble(appearance, context, byCategory)
      const rig = assembleCharacterRig(content, byCategory, definition.silhouette)
      content.position.set(-center.x, -structuralBounds.min.y, -center.z)
      root.scale.setScalar(appearance.scale)
      root.updateWorldMatrix(true, true)
      const bounds = new THREE.Box3().setFromObject(root, true)
      const size = bounds.getSize(new THREE.Vector3())
      root.userData.silhouette = definition.silhouette
      root.userData.floorY = 0
      root.userData.modelHeight = size.y
      let disposed = false
      return {
        root, clickable, byCategory, materials, rig,
        metrics: { width: size.x, height: size.y, depth: size.z, centerY: bounds.getCenter(new THREE.Vector3()).y },
        dispose() {
          if (disposed) return
          disposed = true
          root.removeFromParent()
          disposeThreeScene(root, materials)
          clickable.length = 0
          byCategory.clear()
        }
      }
    } catch (error) {
      disposeThreeScene(root, materials)
      throw error
    }
  }
}
