import * as THREE from 'three'
import type { CharacterIdleStyle, CharacterMotionState, CharacterPoseId } from '../../../domain/characters/types'
import type { CharacterRig, CharacterRigPart } from './CharacterRig'

type RotationTarget = Partial<Record<CharacterRigPart, [number, number, number]>>

const POSES: Record<CharacterPoseId, RotationTarget> = {
  neutral: {},
  ready: { head:[-.035,0,.02], leftArm:[-.06,0,-.12], rightArm:[-.06,0,.12], leftLeg:[0,0,-.025], rightLeg:[0,0,.025] },
  wave: { head:[-.03,-.08,-.04], rightArm:[0,0,2.28], leftArm:[-.04,0,-.08] },
  thinking: { head:[-.12,.12,.08], rightArm:[-.62,.12,-1.78], leftArm:[-.08,0,-.08] },
  working: { head:[.04,0,0], leftArm:[-.62,0,-.12], rightArm:[-.62,0,.12], leftLeg:[.04,0,0], rightLeg:[-.04,0,0] },
  celebrate: { head:[-.08,0,0], leftArm:[0,0,-2.28], rightArm:[0,0,2.28], leftLeg:[.06,0,-.05], rightLeg:[-.06,0,.05] }
}

const damp = (current:number,target:number,lambda:number,delta:number) => THREE.MathUtils.damp(current,target,lambda,delta)

export class CharacterAnimationController {
  private pose:CharacterPoseId='neutral'
  private motion:CharacterMotionState='idle'
  private readonly baseScale=new Map<THREE.Object3D,THREE.Vector3>()
  constructor(private readonly rig:CharacterRig){for(const eye of rig.eyes)this.baseScale.set(eye,eye.scale.clone())}
  setPose(value:CharacterPoseId){this.pose=value}
  setMotion(value:CharacterMotionState){this.motion=value}
  update(time:number,delta:number,idle:CharacterIdleStyle,reducedMotion:boolean){
    const target=POSES[this.pose]
    for(const [part,node] of Object.entries(this.rig.nodes) as [CharacterRigPart,THREE.Group][]) {
      if(!node)continue
      const base=target[part]??[0,0,0]
      let [x,y,z]=base
      if(!reducedMotion){
        if(part==='head'){
          const amp=idle==='playful' ? .055 : idle==='focused' ? .018 : .03
          y+=Math.sin(time*(idle==='playful'?1.8:.72))*amp
          if(this.motion==='listen')z+=Math.sin(time*1.1)*.09
          if(this.motion==='think'){x+=Math.sin(time*.9)*.055;z+=.06}
        }
        if(part==='rightArm'&&this.pose==='wave')x+=Math.sin(time*5.2)*.22
        if((part==='leftArm'||part==='rightArm')&&this.motion==='work')x+=Math.sin(time*3.4+(part==='rightArm'?Math.PI:0))*.24
        if((part==='leftArm'||part==='rightArm')&&this.motion==='celebrate')z+=(part==='leftArm'?-1:1)*(.12+Math.sin(time*5)*.08)
        if((part==='leftLeg'||part==='rightLeg')&&this.motion==='work')x+=Math.sin(time*3+(part==='rightLeg'?Math.PI:0))*.08
        if(part==='tail')y+=Math.sin(time*(idle==='playful'?5.4:2.1))*(idle==='playful' ? .28 : .12)
      }
      node.rotation.x=damp(node.rotation.x,x,11,delta);node.rotation.y=damp(node.rotation.y,y,11,delta);node.rotation.z=damp(node.rotation.z,z,11,delta)
    }
    const blink=reducedMotion?1:this.blinkScale(time)
    for(const eye of this.rig.eyes){const base=this.baseScale.get(eye);if(base){eye.scale.x=base.x;eye.scale.y=base.y*blink;eye.scale.z=base.z}}
  }
  private blinkScale(time:number){
    // deterministic calm blink: two quick frames roughly every 4.7 seconds, no random state.
    const phase=time%4.7
    if(phase<.07)return THREE.MathUtils.lerp(1,.08,phase/.07)
    if(phase<.14)return THREE.MathUtils.lerp(.08,1,(phase-.07)/.07)
    if(phase>3.92&&phase<4.02)return .12
    return 1
  }
}
