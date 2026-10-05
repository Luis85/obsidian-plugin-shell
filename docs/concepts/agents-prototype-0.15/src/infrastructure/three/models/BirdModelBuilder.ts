import * as THREE from 'three'
import type { CharacterAppearance } from '../../../domain/characters/types'
import type { BuildContext } from './ModelBuildContext'

/** Authored bird silhouette; geometry is local to the shared model coordinate frame. */
export class BirdModelBuilder {
  build(appearance: CharacterAppearance, x: BuildContext) {
    const { add, addHingedBox, primary, secondary, accent, dark, light, eyes, badge } = x
    const footHeight=.12, legHeight=.5, bodyBottom=footHeight+legHeight-.02
    const legAssembly=(side:-1|1,part:'leftLeg'|'rightLeg')=>{
      const joint=new THREE.Group();joint.name=`joint:${part}`;joint.userData.authoredJoint=true;joint.userData.rigPart=part;joint.position.set(side*.25,bodyBottom,.02);x.root.add(joint)
      const leg=add([.18,legHeight,.22],[0,-legHeight/2+.01,0],accent,'character',true,joint);leg.userData.rigPart=part
      const foot=add([.42,footHeight,.46],[0,-legHeight+footHeight/2,.12],secondary,'character',false,joint);foot.userData.rigPart=part
      for(const clawX of[-.12,.12])add([.08,.055,.22],[clawX,-legHeight+.055,.35],dark,'appearance',false,joint).userData.rigPart=part
    }
    legAssembly(-1,'leftLeg');legAssembly(1,'rightLeg')

    const bodyHeight=1.46,bodyY=bodyBottom+bodyHeight/2
    add([1.2,bodyHeight,.94],[0,bodyY,0],primary,'mind')
    // Belly/chest is inset into the body surface rather than floating in front of it.
    add([.7,.82,.065],[0,bodyY+.02,.505],secondary,'appearance',false)
    add([.38,.36,.072],[0,bodyY-.43,.51],light,'appearance',false)

    const headHeight=.92,headY=bodyY+bodyHeight/2+headHeight/2-.02
    add([1.08,headHeight,.94],[0,headY,.02],primary,'identity')
    const faceZ=.02+.94/2+.035
    add([.4,.4,.055],[-.27,headY+.09,faceZ-.012],secondary,'appearance',false)
    add([.4,.4,.055],[.27,headY+.09,faceZ-.012],secondary,'appearance',false)
    eyes(0,headY+.11,faceZ,.24,.13)
    add([.2,.15,.2],[0,headY-.13,faceZ+.08],accent,'identity',false)
    add([.34,.075,.07],[-.25,headY+.31,faceZ],dark,'appearance',false).rotation.z=-.12
    add([.34,.075,.07],[.25,headY+.31,faceZ],dark,'appearance',false).rotation.z=.12
    if(appearance.parts.ears==='ears-owl')for(const side of[-1,1] as const)addHingedBox([.21,.38,.23],[side*.35,headY+.43,.02],[0,.19,0],[0,0,side*.2],secondary,'appearance','head')

    const wing=(side:-1|1,category:'skills'|'tools',rigPart:'leftArm'|'rightArm')=>{
      const outer=addHingedBox([.44,1.1,.62],[side*.6,bodyY+.4,0],[side*.21,-.47,0],[0,0,side*.19],secondary,category,rigPart)
      const joint=outer.parent as THREE.Group
      add([.3,.62,.65],[side*.02,-.77,-.02],primary,'appearance',false,joint).userData.rigPart=rigPart
      return outer
    }
    wing(-1,'skills','leftArm');wing(1,'tools','rightArm')
    // Tail fan closes the silhouette from the side/back.
    for(const side of[-1,0,1] as const){const feather=add([.28,.62,.25],[side*.24,bodyY-.55,-.55],secondary,'appearance',false);feather.rotation.x=-.38;feather.rotation.z=side*.12}
    add([.7,.48,.28],[0,bodyY,-.59],accent,'memory')
    badge(.42,bodyY+.3,.5)
  }
}
