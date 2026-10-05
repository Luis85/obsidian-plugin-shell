import * as THREE from 'three'
import type { CharacterAppearance } from '../../../domain/characters/types'
import type { CharacterRegionId } from '../../../application/ports/CharacterSelection'
import type { BuildContext, StageMesh } from '../models/ModelBuildContext'
import { semanticBounds } from '../models/semanticBounds'

interface AccessoryAnchors {
  centerX: number
  centerZ: number
  faceY: number
  faceZ: number
  headTopY: number
  width: number
  neckY: number
  neckZ: number
  chestY: number
  chestZ: number
}

/** Anchors come from assembled bounds, never from a different preset. */
export class AccessoryAssembler {
  private accessoryAnchors(byCategory: Map<CharacterRegionId, StageMesh[]>, content: THREE.Group): AccessoryAnchors {
    content.updateWorldMatrix(true,true)
    const head=semanticBounds(byCategory,'identity',content)
    const body=semanticBounds(byCategory,'mind',content)
    const headCenter=head.getCenter(new THREE.Vector3()),headSize=head.getSize(new THREE.Vector3())
    const bodyCenter=body.getCenter(new THREE.Vector3())
    return {
      centerX:headCenter.x,
      centerZ:headCenter.z,
      faceY:headCenter.y+headSize.y*.06,
      faceZ:head.max.z+.035,
      headTopY:head.max.y,
      width:Math.max(.5,headSize.x),
      neckY:head.min.y-.05,
      neckZ:Math.min(headCenter.z,body.max.z),
      chestY:bodyCenter.y,
      chestZ:body.max.z+.035
    }
  }

  assemble(appearance: CharacterAppearance, x: BuildContext, byCategory: Map<CharacterRegionId, StageMesh[]>) {
    const { add, addGeometry, accent, secondary, dark } = x
    const anchor = this.accessoryAnchors(byCategory,x.root)
    for (const id of appearance.accessoryIds) {
      if (id === 'glasses') add([anchor.width*.68,.09,.07],[anchor.centerX,anchor.faceY,anchor.faceZ+.035],dark,'appearance')
      if (id === 'headset') {
        add([anchor.width*1.04,.11,.18],[anchor.centerX,anchor.headTopY-.12,anchor.centerZ],secondary,'appearance')
        add([.13,.52,.18],[anchor.centerX+anchor.width*.51,anchor.faceY-.12,anchor.centerZ],accent,'appearance')
      }
      if (id === 'scarf') add([Math.min(1.42,anchor.width*1.04),.26,.78],[anchor.centerX,anchor.neckY,anchor.neckZ],accent,'appearance')
      if (id === 'cap') {
        add([Math.min(1.58,anchor.width*1.1),.21,.98],[anchor.centerX,anchor.headTopY+.08,anchor.centerZ],accent,'appearance')
        add([.52,.09,.36],[anchor.centerX,anchor.headTopY-.02,anchor.faceZ+.12],accent,'appearance',false)
      }
      if (id === 'bowtie') {
        add([.28,.24,.13],[anchor.centerX-.16,anchor.neckY,anchor.chestZ],accent,'appearance')
        add([.28,.24,.13],[anchor.centerX+.16,anchor.neckY,anchor.chestZ],accent,'appearance')
      }
      if (id === 'antenna') {
        add([.1,.66,.1],[anchor.centerX,anchor.headTopY+.34,anchor.centerZ],accent,'appearance')
        const tip=add([.26,.26,.26],[anchor.centerX,anchor.headTopY+.76,anchor.centerZ],accent,'appearance');tip.rotation.y=Math.PI/4
      }
      if (id === 'halo') {
        const ring=addGeometry(new THREE.TorusGeometry(Math.min(.76,anchor.width*.47),.055,8,36),[anchor.centerX,anchor.headTopY+.36,anchor.centerZ],accent,'appearance')
        ring.rotation.x=Math.PI/2
      }
    }
  }
}
