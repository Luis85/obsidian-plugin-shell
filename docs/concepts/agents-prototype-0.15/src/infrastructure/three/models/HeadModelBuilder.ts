import * as THREE from 'three'
import type { CharacterAppearance } from '../../../domain/characters/types'
import type { BuildContext } from './ModelBuildContext'

/** Authored head silhouette; geometry is local to the shared model coordinate frame. */
export class HeadModelBuilder {
  build(appearance: CharacterAppearance, x: BuildContext) {
    const { add, addHingedBox, primary, secondary, accent, skin, dark, light, mouth, eyes, badge } = x
    // Talking-head form: clear hover base, neck signal and expressive cubic face.
    add([1.2,.14,.78],[0,.07,0],secondary,'character',false)
    add([1.72,.11,.58],[0,.41,0],accent,'appearance',false)
    add([.38,.44,.38],[0,.77,0],secondary,'mind',false)
    const headY=1.64,headW=2.0,headH=1.76,headD=.98
    add([headW,headH,headD],[0,headY,0],primary,'identity')
    const faceZ=headD/2+.035
    // A stepped crown gives the talking head a deliberate character silhouette.
    add([headW+.05,.23,headD+.05],[0,headY+headH/2-.1,-.01],secondary,'appearance',false)
    add([.36,.34,.13],[-.45,headY+.54,faceZ+.01],secondary,'appearance',false)
    add([.44,.28,.13],[.05,headY+.58,faceZ+.01],secondary,'appearance',false)
    eyes(0,headY+.12,faceZ,.4,.155)
    add([.07,.07,.055],[0,headY-.09,faceZ+.006],light,'identity',false)
    add([.42,.06,.06],[0,headY-.32,faceZ],mouth,'identity',false)
    add([2.02,.2,1],[0,.72,0],secondary,'mind')
    add([.72,.09,.065],[0,.72,.54],accent,'mind',false)

    if(appearance.parts.ears==='ears-pointed'){
      addHingedBox([.3,.66,.28],[-.72,2.46,0],[-.1,.33,0],[0,0,-.22],secondary,'appearance','head')
      addHingedBox([.3,.66,.28],[.72,2.46,0],[.1,.33,0],[0,0,.22],secondary,'appearance','head')
    } else if(appearance.parts.ears==='ears-round'){
      addHingedBox([.45,.45,.3],[-.79,2.3,0],[-.11,.08,0],[0,0,-.05],secondary,'appearance','head')
      addHingedBox([.45,.45,.3],[.79,2.3,0],[.11,.08,0],[0,0,.05],secondary,'appearance','head')
    }
    if(appearance.parts.arms==='arms-floating'){
      const left=addHingedBox([.44,.44,.44],[-1.05,1.38,.04],[-.34,0,0],[0,0,0],accent,'skills','leftArm')
      const right=addHingedBox([.44,.44,.44],[1.05,1.38,.04],[.34,0,0],[0,0,0],accent,'tools','rightArm')
      for(const mesh of[left,right])add([.2,.2,.48],[0,-.31,0],dark,'appearance',false,mesh.parent as THREE.Group).userData.rigPart=mesh.userData.rigPart
    }
    badge(.67,.92,.52)
  }
}
