import * as THREE from 'three'
import type { CharacterAppearance } from '../../../domain/characters/types'
import type { BuildContext } from './ModelBuildContext'

/** Authored human silhouette; geometry is local to the shared model coordinate frame. */
export class HumanModelBuilder {
  build(appearance: CharacterAppearance, x: BuildContext) {
    const { add, addHingedBox, primary, secondary, accent, skin, dark, light, mouth, blush, eyes, badge } = x
    const head = appearance.parts.head ?? 'head-classic'
    const body = appearance.parts.body ?? 'body-tailored'
    const arms = appearance.parts.arms ?? 'arms-standard'

    const headSize: [number, number, number] = head === 'head-wide' ? [1.72, 1.46, 1.22] : head === 'head-compact' ? [1.36, 1.36, 1.1] : [1.52, 1.44, 1.18]
    const torsoWidth = body === 'body-utility' ? 1.98 : body === 'body-scholar' ? 1.7 : 1.84
    const torsoHeight = body === 'body-utility' ? 1.9 : body === 'body-scholar' ? 1.84 : 1.88
    const legHeight = body === 'body-scholar' ? 1.43 : 1.48
    const shoeHeight = .32
    const torsoBottom = shoeHeight + legHeight - .02
    const torsoY = torsoBottom + torsoHeight / 2
    const torsoTop = torsoBottom + torsoHeight
    const headY = torsoTop + headSize[1] / 2 - .035
    const faceZ = headSize[2] / 2 + .038

    // Limbs are authored as complete assemblies. The semantic rig wraps the assembly later,
    // so trouser, shoe and sole can never drift away from the leg during animation.
    const legAssembly = (side: -1 | 1, part: 'leftLeg' | 'rightLeg') => {
      const hipX = side * .39
      const joint = new THREE.Group(); joint.name = `joint:${part}`; joint.userData.authoredJoint = true; joint.userData.rigPart = part; joint.position.set(hipX, torsoBottom, 0); x.root.add(joint)
      const trouser = add([.7, legHeight, .72], [0, -legHeight / 2 + .02, 0], dark, 'character', true, joint); trouser.userData.rigPart = part
      const shoeY = -legHeight + shoeHeight / 2
      const shoe = add([.88, shoeHeight, 1.03], [0, shoeY, .13], light, 'character', true, joint); shoe.userData.rigPart = part
      const sole = add([.88, .11, 1.05], [0, -legHeight + .055, .14], primary, 'appearance', false, joint); sole.userData.rigPart = part
      add([.52, .07, .08], [0, shoeY + .02, .665], secondary, 'appearance', false, joint).userData.rigPart = part
    }
    legAssembly(-1, 'leftLeg'); legAssembly(1, 'rightLeg')

    // Jacket body with a calmer stepped silhouette and readable shirt/lapel construction.
    add([torsoWidth, torsoHeight, .98], [0, torsoY, 0], primary, 'mind')
    add([.66, 1.28, .066], [0, torsoY + .01, .523], light, 'mind', false)
    add([.12, 1.36, .072], [0, torsoY - .05, .535], secondary, 'appearance', false)
    const lapelLeft = add([.26, .82, .075], [-.43, torsoY + .27, .53], secondary, 'appearance', false)
    const lapelRight = add([.26, .82, .075], [.43, torsoY + .27, .53], secondary, 'appearance', false)
    lapelLeft.rotation.z = -.14; lapelRight.rotation.z = .14
    add([torsoWidth * .88, .1, 1.02], [0, torsoBottom + .2, -.005], secondary, 'appearance', false)
    if (body === 'body-utility') {
      add([.42, .34, .11], [-.56, torsoY + .08, .56], accent, 'appearance')
      add([.42, .34, .11], [.56, torsoY + .08, .56], accent, 'appearance')
      add([.24, .18, .12], [0, torsoY - .55, .565], secondary, 'appearance', false)
    }
    if (body === 'body-scholar') {
      add([.14, 1.25, .07], [-.5, torsoY - .03, .545], accent, 'appearance', false)
      add([.14, 1.25, .07], [.5, torsoY - .03, .545], secondary, 'appearance', false)
    }

    const upperWidth = arms === 'arms-compact' ? .43 : .5
    const sleeveHeight = arms === 'arms-compact' ? 1.18 : 1.28
    const handHeight = .38
    const shoulderX = torsoWidth / 2 + upperWidth / 2 - .025
    const shoulderY = torsoTop - .06
    const armAssembly = (side: -1 | 1, category: 'skills' | 'tools', part: 'leftArm' | 'rightArm') => {
      const joint = new THREE.Group(); joint.name = `joint:${part}`; joint.userData.authoredJoint = true; joint.userData.rigPart = part; joint.position.set(side * shoulderX, shoulderY, 0); x.root.add(joint)
      const sleeve = add([upperWidth, sleeveHeight, .72], [0, -sleeveHeight / 2, 0], primary, category, true, joint); sleeve.userData.rigPart = part
      const cuff = add([upperWidth + .03, .18, .75], [0, -sleeveHeight + .09, 0], secondary, 'appearance', false, joint); cuff.userData.rigPart = part
      const hand = add([upperWidth * .92, handHeight, .67], [0, -sleeveHeight - handHeight / 2 + .02, .01], skin, category, true, joint); hand.userData.rigPart = part
      // A tiny palm pixel keeps the hand readable at oblique angles.
      add([upperWidth * .55, .1, .055], [0, -sleeveHeight - handHeight * .52, .36], blush, 'appearance', false, joint).userData.rigPart = part
    }
    armAssembly(-1, 'skills', 'leftArm'); armAssembly(1, 'tools', 'rightArm')

    // Head: one clean cube with stepped hair voxels rather than intersecting slabs.
    add(headSize, [0, headY, 0], skin, 'identity')
    const hairTop = headY + headSize[1] / 2 - .105
    add([headSize[0] + .08, .25, headSize[2] + .07], [0, hairTop, -.01], dark, 'appearance')
    add([.29, .54, headSize[2] + .075], [-headSize[0] / 2 + .105, headY + .33, -.01], dark, 'appearance')
    add([.31, .46, headSize[2] + .075], [headSize[0] / 2 - .11, headY + .37, -.01], dark, 'appearance')
    // Pixel fringe uses stepped blocks that overlap the scalp by a few millimetres so no seam appears.
    add([.38, .26, .14], [-.39, headY + .42, faceZ + .012], dark, 'appearance', false)
    add([.42, .31, .14], [.02, headY + .47, faceZ + .012], dark, 'appearance', false)
    add([.29, .21, .14], [.39, headY + .43, faceZ + .012], dark, 'appearance', false)
    eyes(0, headY + .055, faceZ, head === 'head-wide' ? .31 : .276, .13)

    const mouthY = appearance.expression === 'confident' ? headY - .24 : headY - .285
    // One-pixel nose/cheeks add life while staying square and calm.
    add([.07, .07, .055], [0, headY - .095, faceZ + .006], secondary, 'identity', false)
    add([.32, .055, .065], [0, mouthY, faceZ], mouth, 'identity', false)
    if (appearance.expression === 'friendly' || appearance.expression === 'curious') {
      add([.1, .045, .065], [-.115, mouthY + .034, faceZ + .003], mouth, 'identity', false).rotation.z = .2
      add([.1, .045, .065], [.115, mouthY + .034, faceZ + .003], mouth, 'identity', false).rotation.z = -.2
    }
    add([.11, .045, .06], [-.45, headY - .2, faceZ], blush, 'identity', false)
    add([.11, .045, .06], [.45, headY - .2, faceZ], blush, 'identity', false)

    if (appearance.parts.ears === 'ears-round') {
      const y = headY + headSize[1] * .17
      addHingedBox([.22,.38,.18],[-headSize[0]/2,y,0],[0,.02,0],[0,0,-.08],skin,'appearance','head')
      addHingedBox([.22,.38,.18],[headSize[0]/2,y,0],[0,.02,0],[0,0,.08],skin,'appearance','head')
    }
    if (appearance.parts.ears === 'ears-pointed') {
      addHingedBox([.23,.52,.2],[-headSize[0]/2,headY+headSize[1]/2-.08,0],[0,.26,0],[0,0,-.35],skin,'appearance','head')
      addHingedBox([.23,.52,.2],[headSize[0]/2,headY+headSize[1]/2-.08,0],[0,.26,0],[0,0,.35],skin,'appearance','head')
    }

    // Semantic equipment hugs the back/body rather than floating beside it.
    add([1.08, .96, .28], [0, torsoY + .02, -.64], secondary, 'memory')
    add([.8, .12, .32], [0, torsoY + .47, -.81], accent, 'memory', false)
    add([.13, .65, .065], [-.4, torsoY, -.84], accent, 'memory', false)
    add([.13, .65, .065], [.4, torsoY, -.84], accent, 'memory', false)
    // Safety is represented as a compact chest emblem. It remains selectable without
    // distorting the silhouette with a permanent side-mounted shield.
    const safetyMark = add([.22, .22, .07], [.55, torsoY + .3, .56], accent, 'safety')
    safetyMark.rotation.z = Math.PI / 4
    add([.09, .09, .075], [.55, torsoY + .3, .602], light, 'safety', false)
    badge(-.54, torsoY + .32, .555)
  }
}
