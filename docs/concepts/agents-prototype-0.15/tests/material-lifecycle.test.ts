import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { CharacterModelFactory } from '../src/infrastructure/three/models/CharacterModelFactory'
import { MaterialFactory } from '../src/infrastructure/three/materials/MaterialFactory'
import { modelAppearance } from '../src/domain/characters/appearance'
import { CHARACTER_MODELS } from '../src/presentation/character-catalog/catalog'

describe('character GPU resource ownership', () => {
  it('tracks both material templates and highlight clones', () => {
    const factory = new MaterialFactory('matte'), template = factory.create('#8b5cf6'), clone = factory.clone(template)
    expect(factory.materials).toEqual([template, clone])
    expect(clone).not.toBe(template)
    for (const material of factory.materials) material.dispose()
  })
  for (const definition of CHARACTER_MODELS) {
    it(`${definition.id} releases every scoped material exactly once and detaches its root`, () => {
      const model = new CharacterModelFactory().build(modelAppearance(definition.id))
      const materials = new Set(model.materials)
      const geometries = new Set<THREE.BufferGeometry>()
      model.root.traverse(object => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry)
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
        }
      })
      const spies = [...materials, ...geometries].map(resource => vi.spyOn(resource, 'dispose'))
      const parent = new THREE.Group()
      parent.add(model.root)
      model.dispose(); model.dispose()
      expect(model.root.parent).toBe(null)
      expect(model.clickable).toHaveLength(0)
      expect(model.byCategory.size).toBe(0)
      for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1)
    })
  }
})
