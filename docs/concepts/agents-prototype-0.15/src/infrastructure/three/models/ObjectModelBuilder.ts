import * as THREE from 'three'
import type { CharacterAppearance } from '../../../domain/characters/types'
import type { BuildContext } from './ModelBuildContext'
import { buildScreenFace } from './FaceAssembler'

/** Authored object silhouette; geometry is local to the shared model coordinate frame. */
export class ObjectModelBuilder {
  build(appearance: CharacterAppearance, x: BuildContext) {
    const { add, addHingedBox, primary, secondary, accent, dark, light, badge } = x
    const body = appearance.parts.body ?? 'body-cube'
    const screen = appearance.parts.screen ?? 'screen-friendly'
    const arms = appearance.parts.arms ?? 'arms-none'
    const base = appearance.parts.base ?? 'base-hover'
    const baseY=.12

    if(base==='base-feet'){
      add([.5,.24,.68],[-.42,.12,.04],secondary,'character');add([.5,.24,.68],[.42,.12,.04],secondary,'character')
      add([.32,.07,.72],[-.42,.035,.08],accent,'appearance',false);add([.32,.07,.72],[.42,.035,.08],accent,'appearance',false)
    } else if(base==='base-pedestal'){
      add([1.12,.24,.84],[0,.12,0],secondary,'character');add([.82,.08,.7],[0,.28,0],accent,'appearance',false)
    } else {
      add([1.15,.12,.72],[0,.08,0],accent,'character',false);add([.68,.06,.44],[0,.22,0],secondary,'appearance',false)
    }

    const bodyY=baseY+1.22
    if(body==='body-terminal'){
      add([2.08,1.6,1.02],[0,bodyY,0],secondary,'mind')
      add([1.82,1.3,.09],[0,bodyY+.06,.56],primary,'appearance',false)
      const panel=add([1.54,.92,.065],[0,bodyY+.08,.614],dark,'identity');panel.material.emissive.set('#071316');panel.material.emissiveIntensity=.28
      buildScreenFace(screen,appearance,x,0,bodyY+.1,.657)
      add([1.0,.31,.8],[0,.38,0],primary,'character')
      for(const sx of[-.55,-.35,-.15,.15,.35,.55])add([.1,.05,.05],[sx,bodyY-.58,.535],sx<0?accent:light,'appearance',false)
    } else if(body==='body-toolbox'){
      add([2.16,1.14,1.04],[0,bodyY-.08,0],primary,'tools')
      add([1.18,.3,.44],[0,bodyY+.69,0],secondary,'appearance')
      add([.86,.16,.24],[0,bodyY+.82,0],dark,'appearance',false)
      add([1.46,.13,.065],[0,bodyY+.06,.553],accent,'identity')
      add([.18,.32,.075],[-.72,bodyY-.1,.558],secondary,'appearance',false);add([.18,.32,.075],[.72,bodyY-.1,.558],secondary,'appearance',false)
      buildScreenFace(screen,appearance,x,0,bodyY+.27,.578)
    } else if(body==='body-book'){
      add([1.62,2.16,.5],[0,bodyY+.4,0],primary,'mind')
      add([.17,2.04,.56],[-.7,bodyY+.4,0],secondary,'appearance')
      // page block sits slightly behind the cover so the silhouette reads from oblique views.
      add([1.33,1.9,.42],[.07,bodyY+.4,-.04],light,'appearance',false)
      buildScreenFace(screen,appearance,x,.08,bodyY+.68,.285)
      add([.92,.09,.55],[.08,bodyY+.02,.285],accent,'identity')
      for(const y of[-.26,.04,.34])add([.72,.035,.055],[.12,bodyY+.42+y,.292],secondary,'appearance',false)
    } else {
      add([1.68,1.68,1.68],[0,bodyY,0],primary,'mind')
      buildScreenFace(screen,appearance,x,0,bodyY+.2,.875)
      add([1.72,.18,1.72],[0,bodyY-.54,0],accent,'appearance')
      add([.4,.08,.07],[0,bodyY+.62,.878],light,'appearance',false)
    }

    if(arms==='arms-floating'){
      addHingedBox([.46,.46,.46],[-1.04,bodyY,0],[-.28,0,0],[0,0,0],accent,'skills','leftArm')
      addHingedBox([.46,.46,.46],[1.04,bodyY,0],[.28,0,0],[0,0,0],accent,'tools','rightArm')
    } else if(arms==='arms-clamps'){
      const left=addHingedBox([.4,.62,.46],[-1.0,bodyY-.15,.02],[-.2,0,0],[0,0,0],secondary,'skills','leftArm')
      const right=addHingedBox([.4,.62,.46],[1.0,bodyY-.15,.02],[.2,0,0],[0,0,0],secondary,'tools','rightArm')
      for(const mesh of[left,right]){const parent=mesh.parent as THREE.Group;add([.2,.22,.52],[0,-.4,0],accent,'appearance',false,parent).userData.rigPart=mesh.userData.rigPart}
    }
    badge(.6,bodyY-.3,.58)
  }
}
