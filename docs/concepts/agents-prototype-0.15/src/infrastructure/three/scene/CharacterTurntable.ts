import * as THREE from 'three'

const Y_AXIS=new THREE.Vector3(0,1,0)
export const normalizeTurntableDegrees=(degrees:number)=>((degrees%360)+360)%360

/**
 * Owns character yaw only. Camera transforms deliberately do not belong here.
 */
export class CharacterTurntable {
  private degrees=0
  constructor(private readonly root:THREE.Object3D){}
  getRotation(){return this.degrees}
  setRotation(degrees:number){
    this.degrees=normalizeTurntableDegrees(degrees)
    this.root.quaternion.setFromAxisAngle(Y_AXIS,THREE.MathUtils.degToRad(this.degrees))
    this.root.updateMatrixWorld(true)
    return this.degrees
  }
  rotate(deltaDegrees:number){return this.setRotation(this.degrees+deltaDegrees)}
}
