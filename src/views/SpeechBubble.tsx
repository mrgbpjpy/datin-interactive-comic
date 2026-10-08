/**
 * Reusable DOM speech-bubble view positioned from Three.js character bounds.
 * Drei Html projects a 3D anchor into a DOM overlay; Box3/Vector3 provide its
 * position. In the MVC-inspired organization this is a presentation helper.
 * It is not called by the current ComicScene, which uses CanvasSpeechBubble
 * and WebGL text instead. Concepts: typed props, bounds-relative placement,
 * the DOM/WebGL distinction, and non-interactive overlays.
 * https://drei.docs.pmnd.rs/misc/html
 * https://threejs.org/docs/pages/Box3.html
 * https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
 */
import { Html } from '@react-three/drei';
import * as THREE from 'three';

export function SpeechBubble({
  text,
  bounds,
}: {
  text: string;
  bounds: THREE.Box3;
}) {
  // Offsets are fractions of the supplied box dimensions in that box's coordinate
  // space, not screen pixels. Html handles projecting the resulting anchor.
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());

  return (
    <Html
      position={[
        center.x - size.x * 1.25,
        center.y + size.y * 0.52,
        center.z + size.z * 0.15,
      ]}
      center
      distanceFactor={8}
      zIndexRange={[20, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div className="scene-bubble" role="note" aria-label="Character dialogue">
        {text}
      </div>
    </Html>
  );
}
