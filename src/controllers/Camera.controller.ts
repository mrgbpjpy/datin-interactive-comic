/**
 * MVC-inspired controller for measured, automatic character framing.
 * Three.js provides world-space bounds, vectors and perspective projection;
 * the type-only PanelCamera import describes settings from Comic.model.
 * Character measures bounds for auto mode; ComicScene's CameraRig calls update.
 * Blender-camera panels take a separate path and use their exported cameras.
 * Concepts: type predicates, scene traversal, coordinate transforms, and FOV math.
 * https://threejs.org/docs/pages/Box3.html
 * https://threejs.org/docs/pages/PerspectiveCamera.html
 * https://www.typescriptlang.org/docs/handbook/2/narrowing.html
 */
import * as THREE from 'three';
import type { PanelCamera } from '../models/Comic.model';

export interface CharacterFraming { bounds: THREE.Box3; dome: THREE.Sphere; }

// GLTFLoader sanitizes dots and splits multi-material meshes into children.
export function isCharacterMesh(object: THREE.Object3D): object is THREE.Mesh {
  // The return type is a type predicate: a true result narrows callers' object
  // to Mesh. Parent-name checks include children of multi-material assemblies.
  if (!(object as THREE.Mesh).isMesh) return false;
  let character = false;
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (node.name.includes('_proxy-D-AD')) return false;
    if (node.name === 'Cap' || node.name.startsWith('HG_')) character = true;
  }
  return character;
}

export function measureCharacter(root: THREE.Object3D): CharacterFraming {
  // Local bounds must be transformed by matrixWorld before boxes from different
  // mesh parents can be unioned into one shared coordinate system.
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  const dome = new THREE.Sphere();
  root.traverse(object => {
    if (object.name === 'Sphere' && (object as THREE.Mesh).isMesh) {
      const mesh = object as THREE.Mesh;
      mesh.geometry.computeBoundingSphere();
      dome.copy(mesh.geometry.boundingSphere!).applyMatrix4(mesh.matrixWorld);
    }
    if (!isCharacterMesh(object)) return;
    const skinned = object as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh) {
      skinned.skeleton.update();
      skinned.computeBoundingBox();
      bounds.union(skinned.boundingBox!.clone().applyMatrix4(skinned.matrixWorld));
    } else {
      object.geometry.computeBoundingBox();
      bounds.union(object.geometry.boundingBox!.clone().applyMatrix4(object.matrixWorld));
    }
  });
  if (bounds.isEmpty() || dome.radius <= 0) throw new Error('Datin character or dome bounds are missing');
  return { bounds, dome };
}

/** Uses Y-up and a +Z orbit origin; samples directly without temporal smoothing. */
export class CameraController {
  private target = new THREE.Vector3();
  private size = new THREE.Vector3();
  update(camera: THREE.PerspectiveCamera, framing: CharacterFraming, progress: number, aspect: number, settings: PanelCamera) {
    framing.bounds.getSize(this.size);
    framing.bounds.getCenter(this.target);
    const targetHeight = THREE.MathUtils.clamp(settings.targetHeight, 0, 1);
    this.target.y = framing.bounds.min.y + this.size.y * targetHeight;
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    const angle = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(settings.startAngle, settings.endAngle, p));
    // tan(half vertical FOV) is visible half-height per unit camera distance.
    // Multiplication by aspect gives the corresponding horizontal allowance.
    const vertical = Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV() / 2));
    const horizontal = vertical * Math.max(aspect, 0.01);
    const sin = Math.abs(Math.sin(angle));
    const cos = Math.abs(Math.cos(angle));
    const halfWidth = (this.size.x * cos + this.size.z * sin) / 2;
    const depth = (this.size.z * cos + this.size.x * sin) / 2;
    const verticalExtent = this.size.y * Math.max(targetHeight, 1 - targetHeight);
    // Fit both width and height, then add margin and depth. The dome constraint
    // limits this distance so the view stays within the surrounding environment.
    const fit = Math.max(verticalExtent / vertical, halfWidth / horizontal) * 1.12 + depth;
    const interior = framing.dome.radius * 0.94 - this.target.distanceTo(framing.dome.center);
    const distance = Math.max(0.01, Math.min(interior, fit * Math.max(0.1, settings.distanceScale)));
    camera.position.set(this.target.x + Math.sin(angle) * distance, this.target.y, this.target.z + Math.cos(angle) * distance);
    camera.up.set(0, 1, 0);
    camera.lookAt(this.target);
    camera.aspect = aspect;
    camera.near = Math.max(0.005, this.size.y / 200);
    camera.far = framing.dome.radius * 2.1;
    // Changing aspect or clipping planes requires rebuilding the projection.
    camera.updateProjectionMatrix();
  }
}
