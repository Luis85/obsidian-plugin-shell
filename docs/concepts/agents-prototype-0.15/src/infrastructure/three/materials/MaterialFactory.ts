import * as THREE from 'three'
import type { CharacterAppearance } from '../../../domain/characters/types'
import type { StageMaterial } from '../models/ModelBuildContext'

const finishProps = (finish: CharacterAppearance['finish']) => {
  // The character library deliberately avoids toy-like plastic by default. Every finish
  // keeps the broad, flat voxel faces readable; only explicitly metallic/glossy styles
  // receive stronger specular response.
  switch (finish) {
    case 'metallic': return { roughness: .42, metalness: .38, clearcoat: .04, flatShading: true, dithering: true }
    case 'glossy': return { roughness: .34, metalness: .06, clearcoat: .24, flatShading: true, dithering: true }
    case 'matte': return { roughness: .9, metalness: 0, clearcoat: 0, flatShading: true, dithering: true }
    default: return { roughness: .78, metalness: .01, clearcoat: .01, flatShading: true, dithering: true }
  }
}

/** Per-model material scope. Templates and highlight clones share one disposal owner. */
export class MaterialFactory {
  readonly materials: THREE.Material[] = []

  constructor(private readonly finish: CharacterAppearance['finish']) {}

  create(color: THREE.ColorRepresentation, options: Partial<THREE.MeshPhysicalMaterialParameters> = {}): StageMaterial {
    const material = new THREE.MeshPhysicalMaterial({ color, ...finishProps(this.finish), ...options })
    this.materials.push(material)
    return material
  }

  clone(source: StageMaterial): StageMaterial {
    const material = source.clone()
    this.materials.push(material)
    return material
  }
}
