import * as THREE from 'three'
import type { CharacterAppearance } from '../../../domain/characters/types'
import type { BuildContext, StageMesh } from './ModelBuildContext'

export function createFaceAssembler(appearance: CharacterAppearance, add: BuildContext['add'], palette: Pick<BuildContext, 'accent' | 'dark' | 'light'>) {
  const { accent, dark, light } = palette
  const eyes = (x: number, y: number, z: number, spacing = .27, size = .14): StageMesh[] => {
    const animated:StageMesh[]=[]
    if (appearance.eyeStyle === 'visor') {
      const visor = add([spacing * 2.65, size * .78, .065], [x, y, z], accent, 'identity', false)
      visor.material.emissive.set(appearance.accentColor)
      visor.material.emissiveIntensity = .58
      visor.userData.faceRole='eye';animated.push(visor)
      return animated
    }
    const eyeSize = appearance.eyeStyle === 'round' ? size * 1.25 : appearance.eyeStyle === 'focused' ? size * .78 : size
    const leftEye=add([eyeSize, eyeSize, .065], [x - spacing, y, z], dark, 'identity', false)
    const rightEye=add([eyeSize, eyeSize, .065], [x + spacing, y, z], dark, 'identity', false)
    leftEye.userData.faceRole='eye';rightEye.userData.faceRole='eye';animated.push(leftEye,rightEye)
    // tiny catchlights make the block face read as vivid without losing the retro calm style
    if (appearance.eyeStyle !== 'focused') {
      add([eyeSize * .28, eyeSize * .28, .069], [x - spacing - eyeSize * .18, y + eyeSize * .18, z + .004], light, 'identity', false)
      add([eyeSize * .28, eyeSize * .28, .069], [x + spacing - eyeSize * .18, y + eyeSize * .18, z + .004], light, 'identity', false)
    }
    if (appearance.eyeStyle === 'focused') {
      const left = add([eyeSize * 1.32, .035, .071], [x - spacing, y + eyeSize * .63, z + .004], accent, 'identity', false)
      const right = add([eyeSize * 1.32, .035, .071], [x + spacing, y + eyeSize * .63, z + .004], accent, 'identity', false)
      left.rotation.z = .08
      right.rotation.z = -.08
    }
    return animated
  }
  
  const badge = (x: number, y: number, z: number) => {
    const value = add([.24, .24, .065], [x, y, z], accent, 'appearance', true)
    value.rotation.z = Math.PI / 4
  }
  return { eyes, badge }
}

export function buildScreenFace(screen: string, appearance: CharacterAppearance, x: BuildContext, cx: number, cy: number, z: number) {
    const { add, accent, dark, eyes } = x
    if (screen === 'screen-terminal') {
      const bar = add([.88, .105, .064], [cx, cy, z], accent, 'identity', false)
      bar.material.emissive.set(appearance.accentColor); bar.material.emissiveIntensity = .72
      add([.17, .105, .067], [cx + .5, cy, z], accent, 'identity', false)
    } else if (screen === 'screen-dotmatrix') {
      for (const dx of [-.23, .23]) for (const dy of [-.09, .09]) {
        const dot = add([.09, .09, .068], [cx + dx, cy + dy, z], accent, 'identity', false)
        dot.material.emissive.set(appearance.accentColor); dot.material.emissiveIntensity = .65
      }
    } else if (screen === 'screen-none') {
      eyes(cx, cy, z, .29, .115)
    } else {
      const panel = add([.84, .48, .06], [cx, cy, z], dark, 'identity', false)
      panel.material.emissive.set('#061416'); panel.material.emissiveIntensity = .38
      eyes(cx, cy, z + .038, .29, .115)
    }
  }
