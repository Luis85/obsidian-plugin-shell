import * as THREE from 'three'
import type { CharacterAppearance } from '../../../domain/characters/types'
import type { CharacterRegionId } from '../../../application/ports/CharacterSelection'
import type { BuildContext, StageMesh } from '../models/ModelBuildContext'
import { semanticBounds } from '../models/semanticBounds'

export class PatternAssembler {
  assemble(appearance: CharacterAppearance, x: BuildContext, byCategory: Map<CharacterRegionId, StageMesh[]>) {
    if (appearance.pattern === 'none') return
    const { add, accent } = x
    x.root.updateWorldMatrix(true,true)
    const body=semanticBounds(byCategory,'mind',x.root)
    const center=body.getCenter(new THREE.Vector3()),size=body.getSize(new THREE.Vector3())
    const front=body.max.z+.038
    const addPattern=(patternSize:[number,number,number],position:[number,number,number])=>{
      const value=add(patternSize,position,accent,'appearance',false)
      value.material.transparent=true
      value.material.opacity=appearance.pattern==='gradient'?.62:.82
    }
    if(appearance.pattern==='stripe')addPattern([Math.max(.42,size.x*.66),Math.max(.08,size.y*.065),.07],[center.x,center.y,front])
    else if(appearance.pattern==='patch')addPattern([Math.max(.28,size.x*.24),Math.max(.24,size.y*.22),.07],[center.x-size.x*.22,center.y+size.y*.13,front])
    else addPattern([Math.max(.4,size.x*.58),Math.max(.1,size.y*.09),.07],[center.x,center.y+size.y*.24,front])
  }
}
