import * as THREE from 'three'
import type { CharacterAppearance } from '../../../domain/characters/types'
import type { CharacterRegionId } from '../../../application/ports/CharacterSelection'
import type { CharacterRig } from '../scene/CharacterRig'

export type StageMaterial = THREE.MeshPhysicalMaterial
export type StageMesh = THREE.Mesh<THREE.BufferGeometry, StageMaterial>

export interface CharacterModelMetrics {
  width: number
  height: number
  depth: number
  centerY: number
}

export interface BuiltCharacterModel {
  root: THREE.Group
  clickable: StageMesh[]
  byCategory: Map<CharacterRegionId, StageMesh[]>
  materials: THREE.Material[]
  metrics: CharacterModelMetrics
  rig: CharacterRig
  /** Releases geometry and every owned material exactly once. */
  dispose(): void
}

export type BoxAdder = (
  size: [number, number, number],
  position: [number, number, number],
  material: StageMaterial,
  category?: CharacterRegionId,
  click?: boolean,
  parent?: THREE.Group
) => StageMesh

export interface BuildContext {
  root: THREE.Group
  add: BoxAdder
  addGeometry: (geometry: THREE.BufferGeometry, position: [number, number, number], material: StageMaterial, category?: CharacterRegionId, click?: boolean, parent?: THREE.Group) => StageMesh
  addHingedBox: (size:[number,number,number], anchor:[number,number,number], local:[number,number,number], rotation:[number,number,number], material:StageMaterial, category:CharacterRegionId, rigPart?:string, click?:boolean) => StageMesh
  primary: StageMaterial
  secondary: StageMaterial
  accent: StageMaterial
  skin: StageMaterial
  dark: StageMaterial
  light: StageMaterial
  mouth: StageMaterial
  blush: StageMaterial
  eyes: (x: number, y: number, z: number, spacing?: number, size?: number) => StageMesh[]
  badge: (x: number, y: number, z: number) => void
}


export interface ModelBuilder { build(appearance: CharacterAppearance, context: BuildContext): void }
