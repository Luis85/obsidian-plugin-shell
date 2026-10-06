import * as THREE from 'three'

/** Dispose each resource once, including scoped material templates not attached to a mesh. */
export function disposeThreeScene(root: THREE.Object3D, extraMaterials: Iterable<THREE.Material> = []): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>(extraMaterials)
  const textures = new Set<THREE.Texture>()
  root.traverse(object => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry) geometries.add(mesh.geometry)
    const attached = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
    for (const material of attached) materials.add(material)
  })
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value)
  }
  for (const texture of textures) texture.dispose()
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
}
