/**
 * Animated record-player view shown inside LoadingCanvas, not a comic panel.
 * In the MVC-inspired organization this view owns a local loading-scene mixer:
 * Drei useGLTF loads the asset, React memoizes scene/mixer objects, R3F useFrame
 * advances them, and Three.js clips/actions define the requested playback modes.
 * Concepts: asset caching, object cloning, refs, delta time, optional callbacks,
 * and one-shot event thresholds. This timeline is independent of comic GSAP.
 * https://drei.docs.pmnd.rs/loaders/gltf-use-gltf
 * https://threejs.org/docs/pages/AnimationMixer.html
 * https://threejs.org/docs/pages/AnimationAction.html
 * https://r3f.docs.pmnd.rs/api/hooks
 * https://react.dev/reference/react/useMemo
 * https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
 */
import {
  useEffect,
  useMemo,
  useRef,
} from 'react';

import {
  useFrame,
} from '@react-three/fiber';

import {
  useGLTF,
} from '@react-three/drei';

import * as THREE from 'three';


/* ============================================================
   MODEL
   ============================================================ */

const MODEL_URL =
  '/models/Record_Player.glb';


/* ============================================================
   BLENDER ACTIONS
   ============================================================ */

// These names are requested from gltf.animations; missing clips are logged and
// skipped below. A configuration string alone does not guarantee an exported clip.
const ACTION_NAMES = [
  'CoverAction',
  'NeedleAction',
  'RecordAction',
];


/* ============================================================
   NEEDLE CONTACT TIMING
   ============================================================ */

/*
 * Authored contact cue configured by this source (not collision detection):
 * 24 FPS, with the application treating frame 135 as elapsed frame time.
 * The callback threshold is:
 *
 * 5 seconds + 15 frames
 *
 * 15 / 24 = 0.625
 *
 * 5 + 0.625 = 5.625 seconds
 *
 * Equivalent Blender frame:
 *
 * 5 * 24 = 120
 * 120 + 15 = 135
 */

const FPS =
  24;

const NEEDLE_TOUCH_FRAME =
  135;

const NEEDLE_TOUCH_TIME =
  NEEDLE_TOUCH_FRAME /
  FPS;


/* ============================================================
   PROPS
   ============================================================ */

type RecordPlayerSceneProps = {

  /*
   * Fired once per animation setup when NeedleAction reaches the configured
   * 135 / 24 seconds threshold, if the requested action exists and reaches it.
   *
   * LoadingScreen / ComicReader will use
   * this to play:
   *
   * /music/Vinyl.mp3
   */
  onNeedleTouch?: () => void;

};


/* ============================================================
   RECORD PLAYER SCENE
   ============================================================ */

export function RecordPlayerScene({
  onNeedleTouch,
}: RecordPlayerSceneProps) {

  /* ==========================================================
     LOAD GLB
     ========================================================== */

  const gltf =
    useGLTF(
      MODEL_URL,
    );


  /* ==========================================================
     CLONE SCENE
     ========================================================== */

  // Object3D.clone(true) duplicates the hierarchy but shares geometry/materials.
  // Unlike Character's skeleton-aware clone, this is a regular scene clone.
  const scene =
    useMemo(
      () =>
        gltf.scene.clone(
          true,
        ),
      [
        gltf.scene,
      ],
    );


  /* ==========================================================
     ANIMATION MIXER
     ========================================================== */

  const mixer =
    useMemo(
      () =>
        new THREE.AnimationMixer(
          scene,
        ),
      [
        scene,
      ],
    );


  /* ==========================================================
     NEEDLE ACTION REFERENCE
     ========================================================== */

  /*
   * We need a direct reference to NeedleAction
   * so useFrame can read its actual playback time.
   */
  // A ref exposes the action to useFrame without a React render per animation
  // sample. null means no NeedleAction was found or the effect has cleaned up.
  const needleActionRef =
    useRef<THREE.AnimationAction | null>(
      null,
    );


  /*
   * Prevents the sound callback from firing
   * every frame after 5.625 seconds.
   */
  const needleTouchTriggered =
    useRef(
      false,
    );


  /* ==========================================================
     DEBUG
     ========================================================== */

  useEffect(
    () => {

      console.log(
        '[RECORD PLAYER] MODEL LOADED',
        gltf,
      );


      console.log(
        '[RECORD PLAYER] ANIMATIONS:',
        gltf.animations.map(
          clip =>
            clip.name,
        ),
      );


      console.log(
        '[RECORD PLAYER] NEEDLE CONTACT:',
        {
          fps:
            FPS,

          frame:
            NEEDLE_TOUCH_FRAME,

          time:
            NEEDLE_TOUCH_TIME,
        },
      );


      const box =
        new THREE.Box3()
          .setFromObject(
            scene,
          );


      const size =
        new THREE.Vector3();


      const center =
        new THREE.Vector3();


      box.getSize(
        size,
      );


      box.getCenter(
        center,
      );


      console.log(
        '[RECORD PLAYER] SIZE:',
        size,
      );


      console.log(
        '[RECORD PLAYER] CENTER:',
        center,
      );


      scene.traverse(
        object => {

          console.log(
            '[RECORD PLAYER OBJECT]',
            object.name,
            object.type,
          );

        },
      );

    },
    [
      gltf,
      scene,
    ],
  );


  /* ==========================================================
     START BLENDER ANIMATIONS
     ========================================================== */

  useEffect(
    () => {

      const actions:
        THREE.AnimationAction[] =
        [];


      /*
       * Reset our needle contact trigger
       * whenever this scene starts.
       */
      needleTouchTriggered.current =
        false;


      needleActionRef.current =
        null;


      /* ======================================================
         FIND EACH ACTION
         ====================================================== */

      for (
        const actionName
        of ACTION_NAMES
      ) {

        const clip =
          THREE.AnimationClip.findByName(
            gltf.animations,
            actionName,
          );


        /* ====================================================
           MISSING ACTION
           ==================================================== */

        if (
          !clip
        ) {

          console.warn(
            `[RECORD PLAYER] Missing action: ${actionName}`,
          );


          continue;

        }


        /* ====================================================
           CREATE ACTION
           ==================================================== */

        const action =
          mixer.clipAction(
            clip,
          );


        action.reset();


        /* ====================================================
           RECORD ACTION
           ==================================================== */

        /*
         * RecordAction continuously loops.
         *
         * The vinyl therefore keeps spinning
         * for the entire loading sequence.
         */
        if (
          actionName ===
          'RecordAction'
        ) {

          action.setLoop(
            THREE.LoopRepeat,
            Infinity,
          );


          action.clampWhenFinished =
            false;

        }


        /* ====================================================
           COVER + NEEDLE
           ==================================================== */

        /*
         * CoverAction and NeedleAction play once
         * and remain on their final frame.
         */
        else {

          action.setLoop(
            THREE.LoopOnce,
            1,
          );


          action.clampWhenFinished =
            true;

        }


        /* ====================================================
           SAVE NEEDLE ACTION
           ==================================================== */

        if (
          actionName ===
          'NeedleAction'
        ) {

          needleActionRef.current =
            action;


          console.log(
            '[RECORD PLAYER] NeedleAction ready.',
          );

        }


        /* ====================================================
           PLAY
           ==================================================== */

        action.play();


        actions.push(
          action,
        );


        console.log(
          `[RECORD PLAYER] Playing ${actionName}`,
        );

      }


      /* ======================================================
         CLEANUP
         ====================================================== */

      return () => {

        actions.forEach(
          action => {

            action.stop();

          },
        );


        mixer.stopAllAction();


        needleActionRef.current =
          null;


        needleTouchTriggered.current =
          false;

      };

    },
    [
      gltf.animations,
      mixer,
    ],
  );


  /* ==========================================================
     ANIMATION LOOP
     ========================================================== */

  useFrame(
    (
      _,
      delta,
    ) => {

      /*
       * Advance all three Blender actions.
       */
      // R3F delta is elapsed seconds: update advances all actions on this mixer,
      // unlike the comic controller's absolute setTime sampling for scroll seeks.
      mixer.update(
        delta,
      );


      const needleAction =
        needleActionRef.current;


      if (
        !needleAction
      ) {

        return;

      }


      /* ======================================================
         NEEDLE CONTACT
         ====================================================== */

      /*
       * Read the ACTUAL NeedleAction animation time.
       *
       * Once it crosses frame 135 / 5.625 seconds,
       * fire onNeedleTouch exactly once.
       */
      if (
        !needleTouchTriggered.current &&
        needleAction.time >=
          NEEDLE_TOUCH_TIME
      ) {

        needleTouchTriggered.current =
          true;


        console.log(
          '[RECORD PLAYER] NEEDLE TOUCHED VINYL',
          {
            frame:
              NEEDLE_TOUCH_FRAME,

            targetTime:
              NEEDLE_TOUCH_TIME,

            actualTime:
              needleAction.time,
          },
        );


        /*
         * LoadingCanvas and LoadingScreen forward this callback to
         * ComicReader's Vinyl.mp3 playback handler.
         */
        onNeedleTouch?.();

      }

    },
  );


  /* ==========================================================
     MODEL
     ========================================================== */

  // The JSX transform rotates the scene by pi/2 radians (90 degrees) about Y and
  // offsets it downward. The primitive reuses the already constructed scene;
  // dispose={null} retains shared loader resources when this view unmounts.
  return (

    <primitive

      object={
        scene
      }

      position={[
        0,
        -0.5,
        0,
      ]}

      rotation={[
        0,
        Math.PI / 2,
        0,
      ]}

      dispose={
        null
      }

    />

  );

}


/* ============================================================
   PRELOAD
   ============================================================ */

useGLTF.preload(
  MODEL_URL,
);
