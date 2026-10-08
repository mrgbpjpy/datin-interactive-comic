/**
 * Full-screen R3F loading-stage view, mounted by LoadingScreen.
 * In the MVC-inspired view layer, Canvas creates a rendering context and
 * RecordPlayerScene supplies the model/animation. React Suspense covers async
 * model loading; useEffect here logs the component's mount/cleanup lifecycle.
 * Concepts: optional callback props, scene lighting, JSX Three.js properties,
 * and the distinction between the loading canvas and the later comic canvas.
 * https://r3f.docs.pmnd.rs/api/canvas
 * https://r3f.docs.pmnd.rs/api/objects
 * https://react.dev/reference/react/Suspense
 * https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
 */
import {
  Suspense,
  useEffect,
} from 'react';

import {
  Canvas,
} from '@react-three/fiber';

import {
  RecordPlayerScene,
} from './RecordPlayerScene';


/* ============================================================
   PROPS
   ============================================================ */

// The optional callback travels through the views; it does not make a DOM audio
// element part of the Three.js scene. ComicReader owns the media playback.
type LoadingCanvasProps = {

  /*
   * Fired by RecordPlayerScene when NeedleAction reaches the configured
   * action-time cue: 135 / 24 = 5.625 seconds. This is a timed callback,
   * not geometry-based contact detection.
   */
  onNeedleTouch?: () => void;

};


/* ============================================================
   LOADING CANVAS
   ============================================================ */

export function LoadingCanvas({
  onNeedleTouch,
}: LoadingCanvasProps) {

  /* ==========================================================
     DEBUG
     ========================================================== */

  useEffect(
    () => {

      console.log(
        '[DATIN LOADING] LoadingCanvas mounted',
      );


      return () => {

        console.log(
          '[DATIN LOADING] LoadingCanvas unmounted',
        );

      };

    },
    [],
  );


  /* ==========================================================
     RENDER
     ========================================================== */

  // Canvas's camera object configures its default perspective camera. Suspense's
  // null fallback keeps the lights/background while the record-player asset loads.
  return (

    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1,
      }}
    >

      <Canvas

        camera={{
          position: [
            0,
            2,
            8,
          ],

          fov: 45,
        }}

      >

        {/* ====================================================
            BACKGROUND
            ==================================================== */}

        <color
          attach="background"
          args={[
            '#444444',
          ]}
        />


        {/* ====================================================
            LIGHTING
            ==================================================== */}

        <ambientLight
          intensity={
            3
          }
        />


        <directionalLight
          position={[
            5,
            10,
            5,
          ]}
          intensity={
            5
          }
        />


        {/* ====================================================
            RECORD PLAYER
            ==================================================== */}

        <Suspense
          fallback={
            null
          }
        >

          <RecordPlayerScene

            /*
             * Pass the callback down to
             * RecordPlayerScene.
             *
             * At frame 135:
             *
             * RecordPlayerScene
             *      ↓
             * onNeedleTouch()
             *      ↓
             * LoadingCanvas
             *      ↓
             * LoadingScreen
             *      ↓
             * ComicReader
             *      ↓
             * Vinyl.mp3
             */
            onNeedleTouch={
              onNeedleTouch
            }

          />

        </Suspense>

      </Canvas>

    </div>

  );

}
