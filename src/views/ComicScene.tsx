/**

 * Scene composition inside each comic View (MVC-inspired view layer).

 * Character supplies a loaded controller/camera; CameraController handles auto

 * framing. R3F useThree accesses the current portal store and useFrame schedules

 * timed animation/camera work. Drei camera/text helpers and Three.js math build

 * the lit scene and its camera-relative WebGL speech bubble.

 * Concepts: effect cleanup, frame priorities, coordinate transforms, Suspense,

 * error boundaries, nullable readiness, and autoplay versus scroll ownership.

 * https\://r3f.docs.pmnd.rs/api/hooks

 * https\://threejs.org/docs/pages/PerspectiveCamera.html

 * https\://threejs.org/docs/pages/Object3D.html

 * https\://react.dev/reference/react/Suspense

 * https\://react.dev/reference/react/Component

 * https\://www.typescriptlang.org/docs/handbook/2/narrowing.html

 */

import {

  Component,

  Suspense,

  useCallback,

  useLayoutEffect,

  useMemo,

  useRef,

  useState,

  type RefObject,

  type ReactNode,

} from 'react';

import { useFrame, useThree } from '@react-three/fiber';

import { PerspectiveCamera, Text } from '@react-three/drei';

import * as THREE from 'three';

import { Character, type CharacterScene } from './Character';

import type { PanelAnimation, PanelCamera, PanelCameraSettings } from '../models/Comic.model';

import type { SceneProgress } from '../controllers/Scroll.controller';

import type { AnimationController } from '../controllers/Animation.controller';

import {

  CameraController,

  type CharacterFraming,

} from '../controllers/Camera.controller';

// Bubble layout settings: fractions of the visible panel dimensions.

const BUBBLE_LAYOUT = {

  width: 0.42,

  maxWidthByHeight: 0.55,

  rightMargin: 0.035,

  topMargin: 0.035,

  fontSize: 0.052,

};

interface CameraRigProps {

  cameraSettings: PanelCamera;

  progress: SceneProgress;

  framing: CharacterFraming | null;

  viewport: RefObject<HTMLDivElement | null>;

  active: boolean;

}

function CameraRig({

  cameraSettings,

  progress,

  framing,

  viewport,

  active,

}: CameraRigProps) {

  const camera = useThree((state) => state.camera);

  const controller = useMemo(() => new CameraController(), []);

  const update = useCallback(() => {

    const element = viewport.current;

    if (

      !framing ||

      !element ||

      element.clientWidth <= 0 ||

      element.clientHeight <= 0 ||

      !(camera instanceof THREE.PerspectiveCamera)

    ) {

      return;

    }

    controller.update(

      camera,

      framing,

      progress.value,

      element.clientWidth / element.clientHeight,

      cameraSettings,

    );

    camera.updateMatrixWorld();

  }, [camera, controller, framing, progress, viewport, cameraSettings]);

  useLayoutEffect(update, [update]);

  // Update the camera before positioning the bubble.

  useFrame(() => { if (active) update(); }, -0.5);

  return null;

}

interface CanvasSpeechBubbleProps {
  text: string;
  musical?: boolean;
  active?: boolean;
}

const MUSIC_TOKENS = ['BOOM', 'BAP', 'BARS', '♩', '♪', '♫', '♬'];
const MUSIC_PARTICLE_COUNT = 11;

type MusicParticleState = {
  label: string;
  x: number;
  y: number;
  speed: number;
  size: number;
  opacity: number;
};

function resetMusicParticle(p: MusicParticleState, scatter = false) {
  p.label = MUSIC_TOKENS[Math.floor(Math.random() * MUSIC_TOKENS.length)];
  p.x = scatter ? -0.38 + Math.random() * 0.63 : -0.38 - Math.random() * 0.12;
  p.y = -0.075 + Math.random() * 0.15;
  p.speed = 0.10 + Math.random() * 0.12;
  p.size = p.label.length > 2 ? 0.048 : 0.068;
  p.opacity = 0;
}

function MusicParticle({ active }: { active: boolean }) {
  const object = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const particle = useMemo<MusicParticleState>(() => {
    const state = { label: '', x: 0, y: 0, speed: 0, size: 0, opacity: 0 };
    resetMusicParticle(state, true);
    return state;
  }, []);
  const [label, setLabel] = useState(particle.label);

  useFrame((_, delta) => {
    if (!active || !object.current || !material.current) return;
    const p = particle;
    p.x += p.speed * Math.min(delta, 0.05);
    // Reserve space for text width: fade and reset BEFORE the bubble edge.
    const fadeIn = THREE.MathUtils.smoothstep(p.x, -0.38, -0.26);
    const fadeOut = 1 - THREE.MathUtils.smoothstep(p.x, 0.18, 0.31);
    p.opacity = fadeIn * fadeOut;
    object.current.position.set(p.x, p.y, 0.006);
    material.current.opacity = p.opacity;
    if (p.x > 0.31) {
      resetMusicParticle(p);
      setLabel(p.label);
      object.current.position.set(p.x, p.y, 0.006);
      material.current.opacity = 0;
    }
  });

  return (
    <Text
      ref={object}
      position={[particle.x, particle.y, 0.006]}
      fontSize={particle.size}
      anchorX="center"
      anchorY="middle"
      renderOrder={1003}
      frustumCulled={false}
    >
      {label}
      <meshBasicMaterial
        ref={material}
        color="#111111"
        transparent
        opacity={0}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </Text>
  );
}

function CanvasSpeechBubble({ text, musical = false, active = true }: CanvasSpeechBubbleProps) {

  const group = useRef<THREE.Group>(null);

  // Bubble geometry with its tail toward the lower-left.

  const shape = useMemo(() => {

    const bubble = new THREE.Shape();

    bubble.moveTo(-0.5, 0.14);

    bubble.lineTo(0.5, 0.14);

    bubble.lineTo(0.5, -0.14);

    bubble.lineTo(-0.18, -0.14);

    bubble.lineTo(-0.29, -0.23);

    bubble.lineTo(-0.32, -0.14);

    bubble.lineTo(-0.5, -0.14);

    bubble.closePath();

    return bubble;

  }, []);

  const localPosition = useMemo(() => new THREE.Vector3(), []);

  const cameraPosition = useMemo(() => new THREE.Vector3(), []);

  const cameraRotation = useMemo(() => new THREE.Quaternion(), []);

  useFrame(({ camera }) => {

    const bubble = group.current;

    if (

      !bubble ||

      !(camera instanceof THREE.PerspectiveCamera)

    ) {

      return;

    }

    const distance = Math.max(1, camera.near * 4);

    // Perspective projects a slice at distance d to height 2*d*tan(FOV/2).

    // This keeps bubble size relative to the camera view rather than the model.

    const visibleHeight =

      2 *

      Math.tan(

        THREE.MathUtils.degToRad(camera.getEffectiveFOV() / 2),

      ) *

      distance;

    const visibleWidth = visibleHeight * camera.aspect;

    // Scale the entire bubble and its text together.

    const bubbleWidth = Math.min(

      visibleWidth * BUBBLE_LAYOUT.width,

      visibleHeight * BUBBLE_LAYOUT.maxWidthByHeight,

    );

    const rightMargin =

      visibleWidth * BUBBLE_LAYOUT.rightMargin;

    const topMargin =

      visibleHeight * BUBBLE_LAYOUT.topMargin;

    // Upper-right placement, allowing room for the outline and shadow.

    const bubbleX =

      visibleWidth / 2 -

      rightMargin -

      bubbleWidth * 0.54;

    const bubbleY =

      visibleHeight / 2 -

      topMargin -

      bubbleWidth * 0.15;

    camera.getWorldPosition(cameraPosition);

    camera.getWorldQuaternion(cameraRotation);

    // The camera looks along local -Z. Rotate the camera-local offset into world

    // space, then translate it by the camera's world position before placing text.

    localPosition

      .set(bubbleX, bubbleY, -distance)

      .applyQuaternion(cameraRotation)

      .add(cameraPosition);

    bubble.position.copy(localPosition);

    bubble.quaternion.copy(cameraRotation);

    bubble.scale.setScalar(bubbleWidth);

    bubble.visible = true;

  });

  return (

    <group ref={group} visible={false}>

      {/* Offset black shadow. */}

      <mesh

        position={[0.014, -0.014, 0]}

        scale={[1.045, 1.08, 1]}

        renderOrder={1000}

        frustumCulled={false}

      >

        <shapeGeometry args={[shape]} />

        <meshBasicMaterial

          color="#111111"

          depthTest={false}

          depthWrite={false}

          toneMapped={false}

        />

      </mesh>

      {/* Black outline. */}

      <mesh

        scale={[1.025, 1.055, 1]}

        renderOrder={1001}

        frustumCulled={false}

      >

        <shapeGeometry args={[shape]} />

        <meshBasicMaterial

          color="#111111"

          depthTest={false}

          depthWrite={false}

          toneMapped={false}

        />

      </mesh>

      {/* White bubble face. */}

      <mesh

        renderOrder={1002}

        frustumCulled={false}

      >

        <shapeGeometry args={[shape]} />

        <meshBasicMaterial

          color="#f8f7f1"

          depthTest={false}

          depthWrite={false}

          toneMapped={false}

        />

      </mesh>

              {/* Musical text is rendered in WebGL and loops independently of GSAP. */}
        {musical ? (
          Array.from({ length: MUSIC_PARTICLE_COUNT }, (_, index) => (
            <MusicParticle key={index} active={active} />
          ))
        ) : (
          <Text
            position={[0, 0, 0.002]}
            fontSize={BUBBLE_LAYOUT.fontSize}
            maxWidth={0.86}
            lineHeight={1.15}
            textAlign="center"
            anchorX="center"
            anchorY="middle"
            overflowWrap="break-word"
            renderOrder={1003}
            frustumCulled={false}
          >
            {text}
            <meshBasicMaterial
              color="#111111"
              depthTest={false}
              depthWrite={false}
              toneMapped={false}
            />
          </Text>
        )}
</group>

  );

}

// Called inside a Drei View, so set/get refer to that View's portal store.

// The camera remains attached to the cloned GLTF hierarchy for animation binding.

function BlenderCamera({ camera }: { camera: THREE.PerspectiveCamera }) {

  // Replacing this portal's camera leaves other panels' cameras independent.

  // Keeping it under the shot hierarchy preserves parent transforms and binding.

  const set = useThree(state => state.set);

  const get = useThree(state => state.get);

  useLayoutEffect(() => {

    const previous = get().camera;

    set({ camera });

    return () => { set({ camera: previous }); };

  }, [camera, get, set]);

  return null;

}

function ShotPlayback({ controller, active }: { controller: AnimationController; active: boolean }) {

  // Only autoplay/interaction modes mount this component. Scroll panels receive

  // absolute time from GSAP, so they must not also advance by frame delta.

  const firstFrame = useRef(true);

  useLayoutEffect(() => { firstFrame.current = true; }, [active, controller]);

  useFrame((_, delta) => {

    if (!active || document.hidden) {

      firstFrame.current = true;

      return;

    }

    // The first delta after resuming can include time spent in a hidden tab.

    if (firstFrame.current) {

      firstFrame.current = false;

      return;

    }

    controller.advance(delta);

  }, -0.75);

  return null;

}

// The class generic types props and fallback state. Resetting its key on modelUrl

// change permits a new asset to load after a previous scene raised an error.

class SceneErrorBoundary extends Component<{

  children: ReactNode;

  onError: (message: string) => void;

}, { failed: boolean }> {

  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error) { this.props.onError(error.message); }

  render() { return this.state.failed ? null : this.props.children; }

}

interface ComicSceneProps {

  modelUrl?: string;

  animation: PanelAnimation;

  cameraSettings: PanelCameraSettings;

  noir: boolean;

  progress: SceneProgress;

  onAnimation: (animation: AnimationController | null) => void;

  viewport: RefObject<HTMLDivElement | null>;

  dialogue: string;

  /** Set true for Page 2 / P04 in ComicPanel.tsx. */
  musicBubble?: boolean;

  visible: boolean;

  active: boolean;

  onError: (message: string) => void;

}

function SceneContents({

  modelUrl,

  animation,

  cameraSettings,

  noir,

  progress,

  onAnimation,

  viewport,

  dialogue,

  musicBubble = false,

  visible,

  active,

}: ComicSceneProps) {

  const [loaded, setLoaded] = useState<CharacterScene | null>(null);

  // Bridge Character's imperative resources to React state and the parent panel.

  // Suspense below renders nothing for the model while useGLTF is still loading.

  const ready = useCallback(

    (scene: CharacterScene | null) => {

      setLoaded(scene);

      onAnimation(scene?.controller ?? null);

    },

    [onAnimation],

  );

  return (

    <>

      {cameraSettings.mode === 'auto' && <PerspectiveCamera

        makeDefault

        fov={42}

        position={[0, 1, 3]}

        near={0.01}

        far={100}

      />}

      {loaded?.camera && <BlenderCamera camera={loaded.camera} />}

      {loaded && (animation.playback === 'autoplay' || animation.playback === 'interaction') && (

        <ShotPlayback controller={loaded.controller} active={active} />

      )}

      <color

        attach="background"

        args={[noir ? '#e9e5d9' : '#202837']}

      />

      <ambientLight intensity={noir ? 0.8 : 1.1} />

      <directionalLight

        position={[-3, 5, 4]}

        intensity={noir ? 2.5 : 2.2}

        castShadow

        shadow-mapSize={[1024, 1024]}

        shadow-bias={-0.0002}

      />

      <directionalLight

        position={[3, 2, 2]}

        intensity={noir ? 0.6 : 1.1}

      />

      <Suspense fallback={null}>

        <Character noir={noir} modelUrl={modelUrl} animation={animation} cameraSettings={cameraSettings} onReady={ready} />

      </Suspense>

      {cameraSettings.mode === 'auto' && <CameraRig

        cameraSettings={cameraSettings}

        progress={progress}

        framing={loaded?.framing ?? null}

        viewport={viewport}

        active={active}

      />}

      {loaded && visible && (musicBubble || dialogue.trim().length > 0) && (

        <Suspense fallback={null}>

          <CanvasSpeechBubble text={dialogue} musical={musicBubble} active={active} />

        </Suspense>

      )}

    </>

  );

}

export function ComicScene(props: ComicSceneProps) {

  return (

    <SceneErrorBoundary key={props.modelUrl} onError={props.onError}>

      <SceneContents {...props} />

    </SceneErrorBoundary>

  );

}
