import * as THREE from 'three'
import type { CharacterAppearance } from '../../../domain/characters/types'
import type { BuildContext } from './ModelBuildContext'

/** Authored quadruped silhouette; geometry is local to the shared model coordinate frame. */
export class QuadrupedModelBuilder {
  build(appearance: CharacterAppearance, x: BuildContext) {
    const { add, addHingedBox, primary, secondary, accent, dark, light, blush, eyes, badge } = x
    const head = appearance.parts.head ?? 'head-dog'
    const body = appearance.parts.body ?? 'body-long'
    const ears = appearance.parts.ears ?? 'ears-pointed'
    const tail = appearance.parts.tail ?? 'tail-short'
    const shell = body === 'body-shell'
    const compact = body === 'body-compact'

    const bodyWidth = shell ? 1.58 : compact ? 1.22 : 1.4
    const bodyLength = shell ? 2.18 : compact ? 1.76 : 2.22
    const bodyHeight = shell ? .76 : compact ? .82 : .9
    const legHeight = shell ? .5 : compact ? .68 : .76
    const footHeight = .2
    const bodyBottom = footHeight + legHeight - .045
    const bodyY = bodyBottom + bodyHeight / 2
    const bodyFront = bodyLength / 2
    add([bodyWidth, bodyHeight, bodyLength], [0, bodyY, 0], primary, 'mind')

    if (shell) {
      add([bodyWidth * .96, .58, bodyLength * .82], [0, bodyY + .37, -.04], secondary, 'appearance')
      // Calm turtle-shell tiles make the shell intentional instead of a second displaced box.
      for (const sx of [-.38, 0, .38]) for (const sz of [-.42, .08, .58]) {
        add([.28, .055, .38], [sx, bodyY + .67, sz - .1], accent, 'appearance', false)
      }
    }

    const legX = bodyWidth * .31, foreZ = bodyLength * .3, hindZ = -bodyLength * .3
    const legAssembly = (lx:number,lz:number,category:'skills'|'tools'|'character',part:'leftArm'|'rightArm'|'leftLeg'|'rightLeg') => {
      const joint = new THREE.Group(); joint.name=`joint:${part}`; joint.userData.authoredJoint=true; joint.userData.rigPart=part; joint.position.set(lx,bodyBottom,lz); x.root.add(joint)
      const leg = add([.34,legHeight,.38],[0,-legHeight/2+.01,0],primary,category,true,joint); leg.userData.rigPart=part
      const paw = add([.46,footHeight,.58],[0,-legHeight+footHeight/2,.08],secondary,'character',false,joint); paw.userData.rigPart=part
      add([.3,.06,.12],[0,-legHeight+.08,.39],accent,'appearance',false,joint).userData.rigPart=part
    }
    legAssembly(-legX,foreZ,'skills','leftArm'); legAssembly(legX,foreZ,'tools','rightArm'); legAssembly(-legX,hindZ,'character','leftLeg'); legAssembly(legX,hindZ,'character','rightLeg')

    const headWidth = head === 'head-fox' ? .92 : head === 'head-rabbit' ? .86 : head === 'head-turtle' ? .8 : head === 'head-cat' ? .94 : 1.02
    const headHeight = head === 'head-turtle' ? .66 : head === 'head-rabbit' ? .84 : .9
    const headDepth = head === 'head-fox' ? .9 : head === 'head-turtle' ? .72 : .86
    const neckY = bodyY + bodyHeight * .18
    const headY = bodyY + (shell ? .03 : .2)
    const headZ = bodyFront + headDepth * .44
    if (!shell) add([headWidth*.42,.48,.46],[0,neckY,bodyFront-.02],secondary,'appearance',false)
    add([headWidth, headHeight, headDepth], [0, headY, headZ], primary, 'identity')
    const faceZ = headZ + headDepth / 2 + .035
    eyes(0, headY + .08, faceZ, head === 'head-rabbit' ? .17 : head === 'head-turtle' ? .16 : .2, .112)

    if (head === 'head-dog' || head === 'head-fox') {
      const muzzleWidth = head === 'head-fox' ? .44 : .54
      const muzzleDepth = head === 'head-fox' ? .38 : .32
      add([muzzleWidth, .27, muzzleDepth], [0, headY - .13, faceZ + muzzleDepth * .36], secondary, 'identity', false)
      add([.14, .11, .09], [0, headY - .045, faceZ + muzzleDepth * .92], dark, 'identity', false)
      add([.12,.045,.055],[-.13,headY-.25,faceZ+.12],blush,'identity',false)
      add([.12,.045,.055],[.13,headY-.25,faceZ+.12],blush,'identity',false)
    } else if (head === 'head-cat') {
      add([.12,.085,.07],[0,headY-.08,faceZ+.015],accent,'identity',false).rotation.z=Math.PI/4
      for(const side of[-1,1] as const){for(const dy of[-.08,.03]){const whisker=add([.38,.025,.035],[side*.31,headY-.13+dy,faceZ+.018],light,'identity',false);whisker.rotation.z=side*(dy<0?.12:-.08)}}
    } else if (head === 'head-rabbit') {
      add([.11,.08,.07],[0,headY-.1,faceZ+.018],accent,'identity',false)
      add([.25,.17,.055],[-.16,headY-.2,faceZ+.012],secondary,'identity',false)
      add([.25,.17,.055],[.16,headY-.2,faceZ+.012],secondary,'identity',false)
    } else if (head === 'head-turtle') {
      add([.12,.06,.065],[0,headY-.14,faceZ+.012],dark,'identity',false)
    }

    const earBaseY=headY+headHeight/2-.055,earZ=headZ-.02
    const hingedEar=(side:-1|1,size:[number,number,number],localY:number,rotationZ:number,xFactor:number)=>addHingedBox(size,[side*headWidth*xFactor,earBaseY,earZ],[0,localY,0],[0,0,rotationZ],secondary,'appearance','head')
    if(ears==='ears-floppy'){hingedEar(-1,[.24,.66,.3],-.27,.3,.36);hingedEar(1,[.24,.66,.3],-.27,-.3,.36)}
    else if(ears==='ears-pointed'){hingedEar(-1,[.27,.56,.29],.27,-.16,.31);hingedEar(1,[.27,.56,.29],.27,.16,.31)}
    else if(ears==='ears-tall'){hingedEar(-1,[.23,.94,.27],.47,-.04,.25);hingedEar(1,[.23,.94,.27],.47,.04,.25)}
    else if(ears==='ears-round'){hingedEar(-1,[.35,.35,.25],.11,-.05,.37);hingedEar(1,[.35,.35,.25],.11,.05,.37)}

    if(tail!=='tail-none'){
      const tailBaseZ=-bodyFront-.035,tailBaseY=bodyY+.13
      if(tail==='tail-puff'){
        const tailJoint=new THREE.Group();tailJoint.name='joint:tail';tailJoint.userData.authoredJoint=true;tailJoint.userData.rigPart='tail';tailJoint.position.set(0,tailBaseY,tailBaseZ);x.root.add(tailJoint)
        const puff=add([.5,.5,.5],[0,0,-.24],secondary,'appearance',true,tailJoint);puff.userData.rigPart='tail'
      } else {
        const length=tail==='tail-fox'?1.24:tail==='tail-curled'?.86:.62,thickness=tail==='tail-fox'?.33:.23
        const tailMesh=addHingedBox([thickness,thickness,length],[0,tailBaseY,tailBaseZ],[0,0,-length/2],[tail==='tail-curled'?.74:.37,0,0],secondary,'appearance','tail')
        if(tail==='tail-fox')add([thickness*.78,thickness*.78,length*.28],[0,0,-length*.38],light,'appearance',false,tailMesh.parent as THREE.Group).userData.rigPart='tail'
      }
    }

    if (!shell) {
      add([Math.min(bodyWidth * .72, .92), .13, .08], [0, headY - headHeight * .43, faceZ - .04], accent, 'appearance', false)
      add([Math.min(bodyWidth * .46, .58), Math.min(bodyHeight * .6, .55), .065], [0, bodyY + .015, bodyFront + .038], secondary, 'appearance', false)
    }

    add([.72, .27, .62], [0, bodyY + bodyHeight / 2 + .16, -.28], accent, 'memory')
    add([.48,.09,.43],[0,bodyY+bodyHeight/2+.31,-.28],secondary,'memory',false)
    badge(headWidth * .3, headY - .18, faceZ + .015)
  }
}
