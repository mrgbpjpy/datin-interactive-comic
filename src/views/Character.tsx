/**
 * R3F view adapter joining DATIN's model configuration to rendering controllers.
 * In this MVC-inspired design, React owns lifecycle while AnimationController
 * owns time. useGLTF loads cached scenes/clips; SkeletonUtils.clone gives each
 * panel its own bones. Noir, environment and camera helpers prepare those clones.
 * Concepts: scene-graph ownership, nullable readiness, effects and cleanup,
 * name-based animation binding, and shared seconds across separate mixer roots.
 * https://drei.docs.pmnd.rs/loaders/gltf-use-gltf
 * https://threejs.org/docs/pages/GLTFLoader.html
 * https://threejs.org/docs/pages/module-SkeletonUtils.html
 * https://r3f.docs.pmnd.rs/api/objects
 * https://react.dev/reference/react/useEffect
 * https://www.typescriptlang.org/docs/handbook/2/generics.html
 */
import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';

import {
  MODEL_URL,
  DATIN_CHARACTER_MODEL,
  PAGE_01_MODEL,
  PAGE_02_MODEL,
  type PanelAnimation,
  type PanelCameraSettings,
} from '../models/Comic.model';
import { AnimationController } from '../controllers/Animation.controller';
import { makeNoirMaterials } from '../controllers/Noir.controller';
import { measureCharacter, type CharacterFraming } from '../controllers/Camera.controller';
import { prepareEnvironment } from '../controllers/Environment.controller';

/* ============================================================
   DATIN — CHARACTER, CAMERA, AND SHOT PROPS

   Datin.web.glb: visible, independently skinned Datin.
   Shot GLB: camera, environment, props (including Microphone),
             and animation clips.
   One authoritative AnimationController is exposed to GSAP.
   ============================================================ */

export interface CharacterScene {
  // A ready scene always has a clock; framing and camera are nullable because
  // automatic framing and exported-camera rendering use different data paths.
  controller: AnimationController;
  framing: CharacterFraming | null;
  camera: THREE.PerspectiveCamera | null;
}

interface Props {
  noir: boolean;
  modelUrl?: string;
  animation: PanelAnimation;
  cameraSettings: PanelCameraSettings;
  onReady: (scene: CharacterScene | null) => void;
}

/** Clone materials per panel, while sharing GLB-owned textures. */
function isolateMaterials(root: THREE.Object3D): () => void {
  // Map keys are source-material identities. A shared source gets one owned
  // copy within this panel, preserving sharing without mutating another panel.
  const copies = new Map<THREE.Material, THREE.Material>();
  const originals: Array<{
    mesh: THREE.Mesh;
    material: THREE.Material | THREE.Material[];
  }> = [];

  const duplicate = (material: THREE.Material): THREE.Material => {
    let copy = copies.get(material);
    if (!copy) {
      copy = material.clone();
      copies.set(material, copy);
    }
    return copy;
  };

  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material;
    if (!material) return;
    originals.push({ mesh: object, material });
    object.material = Array.isArray(material)
      ? material.map(duplicate)
      : duplicate(material);
  });

  return () => {
    originals.forEach(({ mesh, material }) => {
      mesh.material = material;
    });
    copies.forEach(copy => copy.dispose());
  };
}

function reportAnimationTargets(root: THREE.Object3D, clip: THREE.AnimationClip): void {
  // Track paths identify a node and one of its properties. This diagnostic
  // checks node lookup on the actual binding root, not just the source GLB.
  const missing: string[] = [];
  for (const track of clip.tracks) {
    try {
      const target = THREE.PropertyBinding.parseTrackName(track.name).nodeName;
      if (target && !root.getObjectByName(target)) missing.push(track.name);
    } catch {
      missing.push(track.name);
    }
  }
  if (missing.length) {
    console.warn(`[DATIN] Unmatched targets for "${clip.name}":`, missing);
  }
}

/**
 * The character is supplied separately by Datin.web.glb.
 * Hide only the shot's skinned meshes; keep regular meshes such
 * as the microphone, furniture, piano, and other studio props.
 */
function hideDuplicateSkinnedMeshes(root: THREE.Object3D): void {
  // Invisible meshes remain in the graph: bones are still available for binding
  // and for parented props. Removing a rig branch would remove its props too.
  // Preserve the microphone and all of its descendants, even if the
  // microphone assembly contains skinned geometry.
  const microphone = root.getObjectByName('Microphone');
  const protectedNodes = new Set<THREE.Object3D>();
  if (microphone) {
    microphone.traverse(object => protectedNodes.add(object));
    let parent: THREE.Object3D | null = microphone.parent;
    while (parent) {
      protectedNodes.add(parent);
      parent = parent.parent;
    }
  }

  root.traverse(object => {
    if (object instanceof THREE.SkinnedMesh && !protectedNodes.has(object)) {
      object.visible = false;
    }
  });
}

function findShotCamera(
  root: THREE.Object3D,
  requestedName: string,
  modelUrl: string,
): THREE.PerspectiveCamera {
  const cameras: THREE.PerspectiveCamera[] = [];
  root.traverse(object => {
    if (object instanceof THREE.PerspectiveCamera) cameras.push(object);
  });

  const exact = cameras.find(camera => camera.name === requestedName);
  if (exact) return exact;

  // Do not silently substitute a different camera if several exist.
  if (cameras.length === 1) {
    console.warn(
      `[DATIN] Camera "${requestedName}" not found in ${modelUrl}; ` +
      `using the only exported perspective camera "${cameras[0].name}".`,
    );
    return cameras[0];
  }

  throw new Error(
    `[DATIN] Perspective camera "${requestedName}" not found in ${modelUrl}. ` +
    `Exported perspective cameras: ${cameras.map(camera => camera.name).join(', ') || '(none)'}.`,
  );
}

export function Character({
  noir,
  modelUrl = MODEL_URL,
  animation,
  cameraSettings,
  onReady,
}: Props) {
  const characterGLTF = useGLTF(DATIN_CHARACTER_MODEL);
  const shotGLTF = useGLTF(modelUrl);

  const scene = useMemo(() => clone(characterGLTF.scene), [characterGLTF.scene]);
  // Both primitives below are rendered: the separate character plus the shot's
  // camera/environment/props. Skeleton-aware cloning preserves bone references.
  const shotScene = useMemo(() => {
    const result = clone(shotGLTF.scene);
    hideDuplicateSkinnedMeshes(result);
    result.updateMatrixWorld(true);
    return result;
  }, [shotGLTF.scene]);

  // Isolate materials during effect setup, not on every render; cleanup restores
  // originals so repeated setup (including StrictMode checks) can start cleanly.
  useEffect(() => {
    const restoreCharacter = isolateMaterials(scene);
    const restoreShot = isolateMaterials(shotScene);
    return () => {
      restoreShot();
      restoreCharacter();
    };
  }, [scene, shotScene]);

  useEffect(() => {
    const blender = cameraSettings.mode === 'blender';
    const camera = blender
      ? findShotCamera(shotScene, cameraSettings.cameraName, modelUrl)
      : null;

    const clips = shotGLTF.animations;
    const bodyController = new AnimationController(scene, clips);
    const shotControllers: AnimationController[] = [];
    const durations: number[] = [];
    const selectedNames = new Set<string>();
    const selectedTracks = new Set<string>();

    const registerShotClip = (name: string, required: boolean): void => {
      if (selectedNames.has(name)) return;
      const clip = THREE.AnimationClip.findByName(clips, name);
      if (!clip) {
        const message = `[DATIN] ${required ? 'Required' : 'Optional'} shot animation "${name}" missing from ${modelUrl}. Available: ${clips.map(item => item.name).join(', ')}`;
        if (required) throw new Error(message);
        console.warn(message);
        return;
      }

      // Several controllers may target this same shot root, but their property
      // tracks must be disjoint. selectedNames also prevents duplicate actions.
      const conflicts = clip.tracks.filter(track => selectedTracks.has(track.name));
      if (conflicts.length) {
        const message = `[DATIN] Animation "${name}" overlaps other shot tracks: ${conflicts.map(track => track.name).join(', ')}`;
        if (required) throw new Error(message);
        console.warn(message);
        return;
      }

      reportAnimationTargets(shotScene, clip);
      const controller = new AnimationController(shotScene, clips);
      if (!controller.selectByName(name, { loop: false, speed: 1 })) {
        controller.dispose();
        if (required) throw new Error(`[DATIN] Could not select shot animation "${name}".`);
        console.warn(`[DATIN] Could not select optional animation "${name}".`);
        return;
      }

      selectedNames.add(name);
      clip.tracks.forEach(track => selectedTracks.add(track.name));
      shotControllers.push(controller);
      durations.push(clip.duration);
    };

    try {
      if (animation.playback === 'static') {
        scene.traverse(object => {
          if (object instanceof THREE.SkinnedMesh) object.skeleton.pose();
        });
      } else {
        const bodyClip = THREE.AnimationClip.findByName(clips, animation.body);
        if (!bodyClip) {
          throw new Error(
            `[DATIN] Body animation "${animation.body}" missing from ${modelUrl}. ` +
            `Available: ${clips.map(clip => clip.name).join(', ')}`,
          );
        }
        reportAnimationTargets(scene, bodyClip);
        if (!bodyController.selectByName(animation.body, {
          loop: animation.loop,
          speed: animation.speed,
        })) {
          throw new Error(`[DATIN] Cannot select body animation "${animation.body}".`);
        }
        durations.push(bodyClip.duration);

        if (blender && cameraSettings.animationName) {
          registerShotClip(cameraSettings.animationName, true);
        }
        // Here effects means additional shot-root clips, not just visual FX.
        // P04 requests the body clip on this rig as well as Microphone_Action;
        // its hand-parented prop must move with the hidden shot rig's bones.
        for (const effect of animation.effects ?? []) {
          registerShotClip(effect, false);
        }
        // The longest selected clip defines the master duration. Shorter clips
        // hold their final pose rather than cutting off a longer prop animation.
        bodyController.setDuration(Math.max(0, ...durations));
      }
    } catch (error) {
      shotControllers.forEach(controller => controller.dispose());
      bodyController.dispose();
      throw error;
    }

    // GSAP, autoplay and playback controls all use this same master clock.
    const originalSetTime = bodyController.setTime.bind(bodyController);
    // Decorate the existing setter rather than creating another animation clock.
    // Both scroll setProgress and autoplay advance eventually call this method.
    bodyController.setTime = (time: number): void => {
      originalSetTime(time);
      const sampledTime = bodyController.getSnapshot().time;
      shotControllers.forEach(controller => controller.setTime(sampledTime));
      scene.updateMatrixWorld(true);
      shotScene.updateMatrixWorld(true);
    };

    const restoreEnvironment = prepareEnvironment(scene);
    const culling: Array<[THREE.SkinnedMesh, boolean]> = [];
    if (blender) {
      scene.traverse(object => {
        if (object instanceof THREE.SkinnedMesh) {
          culling.push([object, object.frustumCulled]);
          object.frustumCulled = false;
        }
      });
    }

    const framing = blender ? null : measureCharacter(scene);
    bodyController.setTime(0);
    if (animation.playback === 'autoplay') bodyController.play();
    else bodyController.pause();

    onReady({ controller: bodyController, framing, camera });
    return () => {
      onReady(null);
      bodyController.dispose();
      shotControllers.forEach(controller => controller.dispose());
      culling.forEach(([object, value]) => { object.frustumCulled = value; });
      restoreEnvironment();
    };
  }, [scene, shotScene, shotGLTF.animations, animation, cameraSettings, modelUrl, onReady]);

  useEffect(() => {
    if (!noir) return;
    const restoreCharacter = makeNoirMaterials(scene);
    const restoreShot = makeNoirMaterials(shotScene);
    return () => {
      restoreShot();
      restoreCharacter();
    };
  }, [scene, shotScene, noir]);

  // primitive mounts existing Three.js objects. dispose={null} expresses that
  // cached GLB resources are shared; the effects release their own material copies.
  return (
    <>
      <primitive object={scene} dispose={null} />
      <primitive object={shotScene} dispose={null} />
    </>
  );
}

useGLTF.preload(DATIN_CHARACTER_MODEL);
useGLTF.preload(PAGE_01_MODEL);
useGLTF.preload(PAGE_02_MODEL);
