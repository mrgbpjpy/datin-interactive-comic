/**
 * Shared WebGL surface for the comic stage in the MVC-inspired view layer.
 * R3F Canvas supplies renderer/context, Drei View.Port renders the panel Views,
 * and Three.js provides the tone-mapping constant. ComicReader supplies a DOM ref
 * for events. LoadingCanvas is a different canvas used during the loading stage.
 * Concepts: typed refs, per-frame work, scissor regions and device pixel ratio.
 * https://r3f.docs.pmnd.rs/api/canvas
 * https://r3f.docs.pmnd.rs/api/hooks
 * https://drei.docs.pmnd.rs/portals/view
 * https://threejs.org/docs/pages/WebGLRenderer.html
 * https://www.typescriptlang.org/docs/handbook/2/generics.html
 */
import type { RefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { View } from '@react-three/drei';
import * as THREE from 'three';

function ClearCanvas() {
  // Negative priority runs before the panel Views render. Disable the previous
  // view's scissor rectangle before clearing the entire shared drawing surface.
  useFrame(({ gl }) => {
    gl.setScissorTest(false);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, true);
  }, -1);

  return null;
}

// eventSource connects pointer events to the DOM containing panels and Canvas;
// the DPR range caps drawing-buffer resolution without changing layout pixels.
export function ComicCanvas({ eventSource }: { eventSource: RefObject<HTMLElement> }) {
  return (
    <div className="scene" aria-hidden="true">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        eventSource={eventSource}
        eventPrefix="client"
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.NoToneMapping,
        }}
      >
        <ClearCanvas />
        <View.Port />
      </Canvas>
    </div>
  );
}
