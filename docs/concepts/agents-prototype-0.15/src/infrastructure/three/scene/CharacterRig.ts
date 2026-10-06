import * as THREE from 'three'
import type { CharacterRegionId as CharacterEditorCategoryId } from '../../../application/ports/CharacterSelection'
import type { CharacterSilhouette } from '../../../domain/characters/types'
export type CharacterRigPart = 'head' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | 'tail'

export interface CharacterRig {
  nodes: Partial<Record<CharacterRigPart, THREE.Group>>
  eyes: THREE.Object3D[]
}

type RigMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>

const boundsOf = (objects: THREE.Object3D[]) => {
  const bounds = new THREE.Box3()
  for (const object of objects) bounds.expandByObject(object, true)
  return bounds
}
const meshCenter = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object, true).getCenter(new THREE.Vector3())
const unique = <T>(values: T[]) => [...new Set(values)]

/**
 * Returns the authored top-level assembly for a mesh. A rotated ear/tail/wing can live
 * inside a hinge Group. Re-parenting the mesh alone would throw away that authored pivot,
 * so semantic rigging always moves the highest child directly below `content`.
 */
const assemblyRoot = (object: THREE.Object3D, content: THREE.Group): THREE.Object3D => {
  let current = object
  while (current.parent && current.parent !== content) current = current.parent
  return current
}

/**
 * Creates a semantic animation rig without dismantling model-factory joints.
 * Authored hinge groups remain intact; the semantic node wraps whole assemblies.
 */
export function assembleCharacterRig(
  content: THREE.Group,
  byCategory: Map<CharacterEditorCategoryId, RigMesh[]>,
  silhouette: CharacterSilhouette
): CharacterRig {
  content.updateWorldMatrix(true, true)
  const nodes: CharacterRig['nodes'] = {}
  const used = new Set<THREE.Object3D>()
  const all: RigMesh[] = []
  content.traverse(object => { if ((object as THREE.Mesh).isMesh) all.push(object as RigMesh) })
  const identity = byCategory.get('identity') ?? []
  const appearance = byCategory.get('appearance') ?? []
  const character = byCategory.get('character') ?? []
  const skills = byCategory.get('skills') ?? []
  const tools = byCategory.get('tools') ?? []
  const rootOf = (object: THREE.Object3D) => assemblyRoot(object, content)
  const isUsed = (object: THREE.Object3D) => used.has(rootOf(object))
  const explicit = (part:CharacterRigPart) => all.filter(mesh=>mesh.userData.rigPart===part)
  const identityBounds = identity.length ? boundsOf(identity) : boundsOf(all)
  const identitySize = identityBounds.getSize(new THREE.Vector3())

  const createNode = (part: CharacterRigPart, objects: THREE.Object3D[], pivot: THREE.Vector3, parent: THREE.Object3D = content) => {
    const members = unique(objects.map(rootOf)).filter(object => !used.has(object))
    if (!members.length) return
    const group = new THREE.Group()
    group.name = `rig:${part}`
    group.position.copy(pivot)
    group.userData.rigPart = part
    parent.add(group)
    // Object3D.attach preserves each authored assembly's world transform. We only attach
    // top-level assemblies, never an individual voxel from inside a hinge.
    for (const object of members) { group.attach(object); used.add(object) }
    nodes[part] = group
    return group
  }

  const headAppearance = appearance.filter(mesh => {
    const center = meshCenter(mesh)
    const box = new THREE.Box3().setFromObject(mesh, true)
    const topBias = center.y >= identityBounds.min.y - Math.max(.12, identitySize.y * .12)
    const nearFace = box.max.z >= identityBounds.min.z - .45 && box.min.z <= identityBounds.max.z + .55
    const nearCenter = Math.abs(center.x - identityBounds.getCenter(new THREE.Vector3()).x) <= Math.max(identitySize.x * .9, 1.05)
    return topBias && nearFace && nearCenter
  })
  const headMembers = unique([...identity, ...headAppearance, ...explicit('head')])
  if (headMembers.length) {
    const b = boundsOf(headMembers), c = b.getCenter(new THREE.Vector3())
    createNode('head', headMembers, new THREE.Vector3(c.x, b.min.y + Math.min(.16, (b.max.y - b.min.y) * .12), c.z))
  }

  const addForeFoot = (members: RigMesh[], side: -1 | 1) => {
    if (silhouette !== 'quadruped') return members
    const feet = character.filter(mesh => { const c = meshCenter(mesh); return Math.sign(c.x || side) === side && c.z > 0 })
    return unique([...members, ...feet])
  }
  const armNode = (part: 'leftArm' | 'rightArm', source: RigMesh[], side: -1 | 1) => {
    const tagged=explicit(part).filter(mesh=>!isUsed(mesh))
    const members = tagged.length ? tagged : addForeFoot(source.filter(mesh => !isUsed(mesh)), side)
    if (!members.length) return
    const b = boundsOf(members), c = b.getCenter(new THREE.Vector3())
    const innerX = side < 0 ? b.max.x : b.min.x
    createNode(part, members, new THREE.Vector3(innerX, b.max.y - Math.min(.08, (b.max.y-b.min.y)*.08), c.z))
  }
  armNode('leftArm', skills, -1)
  armNode('rightArm', tools, 1)

  const legCandidates = character.filter(mesh => !isUsed(mesh))
  const legFor = (part:'leftLeg'|'rightLeg',side: -1 | 1) => {
    const tagged=explicit(part).filter(mesh=>!isUsed(mesh))
    if(tagged.length)return tagged
    return legCandidates.filter(mesh => {
      const c = meshCenter(mesh)
      if (Math.sign(c.x || side) !== side) return false
      if (silhouette === 'quadruped') return c.z <= 0
      if (silhouette === 'human' || silhouette === 'bird') return true
      return false
    })
  }
  for (const [part, side] of [['leftLeg', -1], ['rightLeg', 1]] as const) {
    const members = legFor(part,side)
    if (!members.length) continue
    const b = boundsOf(members), c = b.getCenter(new THREE.Vector3())
    createNode(part, members, new THREE.Vector3(c.x, b.max.y - Math.min(.05, (b.max.y-b.min.y)*.05), c.z))
  }

  if (silhouette === 'quadruped') {
    const allBounds = boundsOf(all), depth = allBounds.max.z - allBounds.min.z
    const taggedTail=explicit('tail').filter(mesh=>!isUsed(mesh))
    const tailCandidates = taggedTail.length ? taggedTail : appearance.filter(mesh => !isUsed(mesh) && meshCenter(mesh).z < allBounds.min.z + depth * .2)
    if (tailCandidates.length) {
      const b = boundsOf(tailCandidates), c = b.getCenter(new THREE.Vector3())
      createNode('tail', tailCandidates, new THREE.Vector3(c.x, c.y, b.max.z))
    }
  }

  const eyes = all.filter(mesh => mesh.userData.faceRole === 'eye')
  return { nodes, eyes }
}
