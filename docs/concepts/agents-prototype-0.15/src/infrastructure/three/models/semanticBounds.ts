import * as THREE from 'three'
import type { CharacterRegionId } from '../../../application/ports/CharacterSelection'
import type { StageMesh } from './ModelBuildContext'

export function semanticBounds(byCategory: Map<CharacterRegionId, StageMesh[]>, category: CharacterRegionId, fallback: THREE.Object3D) {
    const meshes=byCategory.get(category)??[]
    if(!meshes.length)return new THREE.Box3().setFromObject(fallback,true)
    const bounds=new THREE.Box3()
    for(const mesh of meshes)bounds.expandByObject(mesh,true)
    return bounds
  }

  /**
   * Derive attachment anchors from the geometry that was actually assembled. This makes
   * accessories resilient to composable head/body parts instead of inheriting coordinates
   * from a different preset's proportions.
   */
