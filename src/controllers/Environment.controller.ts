/**
 * Reversible scene preparation in DATIN's MVC-inspired controller layer.
 * Character calls this on its character clone. Three.js handles traversal and
 * material cloning; Camera.controller's isCharacterMesh classifies shadow casters.
 * Concepts: nullable scene hierarchies, arrays of cleanup closures, saved state,
 * material ownership, and rendering the inside of an enclosing sphere.
 * https://threejs.org/docs/pages/Object3D.html
 * https://threejs.org/docs/pages/Material.html
 * https://www.typescriptlang.org/docs/handbook/2/functions.html
 */
import * as THREE from 'three';
import { isCharacterMesh } from './Camera.controller';

/** Apply local render settings and return a function that restores prior state. */
export function prepareEnvironment(root: THREE.Object3D): () => void {
  const cleanups: Array<() => void> = [];
  root.traverse(object => {
    // Inspected: these are low-poly duplicates, with displaced jeans/flannel.
    // Hide their branch without removing bones or changing skin references.
    if (object.name.includes('_proxy-D-AD')) {
      const visible = object.visible;
      object.visible = false;
      cleanups.push(() => { object.visible = visible; });
    }
    if (!(object as THREE.Mesh).isMesh) return;
    const mesh = object as THREE.Mesh;
    const cast = mesh.castShadow, receive = mesh.receiveShadow;
    mesh.castShadow = isCharacterMesh(mesh);
    mesh.receiveShadow = mesh.name === 'Plane';
    cleanups.push(() => { mesh.castShadow = cast; mesh.receiveShadow = receive; });
    if (mesh.name !== 'Sphere') return;
    const original = mesh.material;
    // Normalize one material or an array into an array for processing. Cloning
    // avoids changing the cached GLB material used by another panel.
    const owned = (Array.isArray(original) ? original : [original]).map(source => {
      const material = source.clone();
      // Back faces make the enclosing sphere visible from a camera inside it.
      material.side = THREE.BackSide;
      return material;
    });
    mesh.material = Array.isArray(original) ? owned : owned[0];
    cleanups.push(() => { mesh.material = original; owned.forEach(m => m.dispose()); });
  });
  // Unwind changes in reverse order; dispose only materials created above.
  return () => cleanups.reverse().forEach(cleanup => cleanup());
}
