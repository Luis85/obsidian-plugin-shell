import { describe,expect,it } from 'vitest'
import * as THREE from 'three'
import { CharacterTurntable,normalizeTurntableDegrees } from '../src/infrastructure/three/scene/CharacterTurntable'

describe('character turntable',()=>{
  it('normalizes continuous rotation without touching an unrelated camera',()=>{
    const root=new THREE.Group(),camera=new THREE.PerspectiveCamera()
    camera.position.set(2,3,9);const before=camera.position.clone()
    const turntable=new CharacterTurntable(root)
    turntable.setRotation(450)
    expect(turntable.getRotation()).toBe(90)
    expect(camera.position.equals(before)).toBe(true)
    const forward=new THREE.Vector3(0,0,1).applyQuaternion(root.quaternion)
    expect(forward.x).toBeCloseTo(1,5)
    expect(forward.z).toBeCloseTo(0,5)
  })
  it('wraps negative and >360 degree inputs',()=>{
    expect(normalizeTurntableDegrees(-90)).toBe(270)
    expect(normalizeTurntableDegrees(720+15)).toBe(15)
  })
})
