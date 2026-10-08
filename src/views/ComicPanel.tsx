/**
 * MVC-inspired panel view connecting DOM framing, a Drei View and ComicScene.
 * React stores readiness/visibility; model types describe content and playback;
 * controller types describe the clock registered upward with ComicPage.
 * PlaybackControls is shown for timed modes rather than scroll-owned panels.
 * Concepts: props, nullable refs, mutable progress, observer cleanup, and portals.
 * https://drei.docs.pmnd.rs/portals/view
 * https://r3f.docs.pmnd.rs/api/canvas
 * https://react.dev/reference/react/useRef
 * https://react.dev/reference/react/useEffect
 * https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import { View } from '@react-three/drei';

import { ComicScene } from './ComicScene';

import type {
  ComicPanel as Panel,
} from '../models/Comic.model';

import type {
  AnimationController,
  PlaybackSnapshot,
} from '../controllers/Animation.controller';

import type {
  SceneProgress,
} from '../controllers/Scroll.controller';

import { PlaybackControls } from './PlaybackControls';

/* ============================================================
   DATIN — COMIC PANEL
   ============================================================ */

/* ============================================================
   PANEL REGISTRATION
   ============================================================ */

export interface ComicPanelRegistration {
  id: string;
  progress: SceneProgress;
  animation: AnimationController | null;
}

/* ============================================================
   PANEL PROPS
   ============================================================ */

export interface ComicPanelProps {
  panel: Panel;
  index: number;
  viewIndex: number;
  noir: boolean;

  /**
   * True only when this panel is controlled
   * by the page-managed GSAP scroll connection.
   */
  sequential?: boolean;

  onRegister?: (
    registration: ComicPanelRegistration,
  ) => void;

  onUnregister?: (
    id: string,
  ) => void;
}

interface SavedPlayback {
  controller: AnimationController | null;
  saved: PlaybackSnapshot | null;
}

/* ============================================================
   COMPONENT
   ============================================================ */

export function ComicPanel({
  panel,
  index,
  viewIndex,
  noir,
  sequential = false,
  onRegister,
  onUnregister,
}: ComicPanelProps) {

  /* ==========================================================
     ELEMENT REFERENCES
     ========================================================== */

  const viewport =
    useRef<HTMLDivElement>(null);

  /* ==========================================================
     SCROLL PROGRESS
     ========================================================== */

  /**
   * Shared mutable progress object.
   *
   * The page-managed GSAP connection updates this
   * without causing React to render every frame.
   */
  const progress = useMemo<SceneProgress>(
    () => ({
      value: 0,
    }),
    [],
  );

  /* ==========================================================
     ANIMATION CONTROLLER
     ========================================================== */

  const [
    animation,
    setAnimation,
  ] = useState<AnimationController | null>(
    null,
  );

  const playback = useRef<SavedPlayback>({
    controller: null,
    saved: null,
  });

  /* ==========================================================
     PLAYBACK MODES
     ========================================================== */

  /**
   * GSAP only controls panels explicitly configured
   * with playback: 'scroll'.
   *
   * P01 Cover = autoplay
   * P02 Studio = scroll
   * P03 onward = scroll, when configured
   */
  const scrollDriven =
    sequential &&
    panel.animation.playback === 'scroll';

  const timed =
    !scrollDriven &&
    (
      panel.animation.playback === 'autoplay' ||
      panel.animation.playback === 'interaction'
    );

  const cinematic =
    panel.camera.mode === 'blender';

  /* ==========================================================
     VISIBILITY
     ========================================================== */

  const [
    visible,
    setVisible,
  ] = useState(false);

  const [
    documentVisible,
    setDocumentVisible,
  ] = useState(
    () => !document.hidden,
  );

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const active =
    visible && documentVisible;

  /* ==========================================================
     CONTROLLER READY
     ========================================================== */

  // Character reports a controller when ready and null during cleanup. Keeping
  // this callback stable avoids rebuilding the scene's effect just for UI updates.
  const onAnimation = useCallback(
    (
      controller: AnimationController | null,
    ) => {

      const state = playback.current;

      /*
       * Save playback position before the
       * existing controller is removed.
       */
      if (
        !controller &&
        state.controller
      ) {
        state.saved = {
          ...state.controller.getSnapshot(),
        };
      }

      if (controller) {

        if (scrollDriven) {

          /*
           * GSAP owns the animation clock.
           *
           * Do not autoplay scroll panels.
           */
          controller.pause();

          controller.setProgress(
            progress.value,
          );

        } else if (state.saved) {

          /*
           * Autoplay and interaction panels
           * restore their previous playback state
           * after a Drei View remount.
           */
          controller.setTime(
            state.saved.time,
          );

          if (state.saved.playing) {
            controller.play();
          } else {
            controller.pause();
          }

        }
      }

      // The ref preserves an imperative handle and saved time across renders;
      // state separately exposes readiness to rendering and registration effects.
      state.controller = controller;

      setAnimation(controller);

    },
    [
      scrollDriven,
      progress,
    ],
  );

  /* ==========================================================
     REGISTER WITH PAGE-LEVEL GSAP
     ========================================================== */

  useEffect(() => {

    /*
     * Autoplay and static panels must never
     * register with the GSAP timeline.
     */
    if (!scrollDriven) {
      return;
    }

    onRegister?.({
      id: panel.id,
      progress,
      animation,
    });

    return () => {
      onUnregister?.(panel.id);
    };

  }, [
    scrollDriven,
    panel.id,
    progress,
    animation,
    onRegister,
    onUnregister,
  ]);

  /* ==========================================================
     INTERSECTION OBSERVER
     ========================================================== */

  useEffect(() => {

    const element =
      viewport.current;

    if (!element) {
      return;
    }

    // DOM intersection controls rendering/active timed playback, not GSAP's time
    // source. visibilitychange below also suspends timed work in a hidden tab.
    const observer =
      new IntersectionObserver(
        ([entry]) => {
          setVisible(
            entry.isIntersecting,
          );
        },
        {
          threshold: 0,
        },
      );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };

  }, []);

  /* ==========================================================
     DOCUMENT VISIBILITY
     ========================================================== */

  useEffect(() => {

    const update = () => {
      setDocumentVisible(
        !document.hidden,
      );
    };

    document.addEventListener(
      'visibilitychange',
      update,
    );

    return () => {
      document.removeEventListener(
        'visibilitychange',
        update,
      );
    };

  }, []);

  /* ==========================================================
     THREE.JS VIEW
     ========================================================== */

  // View places its children in a panel-specific R3F portal but shares the comic
  // Canvas renderer. Its DOM rectangle supplies the scissored rendering bounds.
  const sceneView = useMemo(
    () => (

      <View
        ref={viewport}
        className="panel-view"
        index={viewIndex}
        visible={
          visible && !error
        }
      >

        <ComicScene
          noir={noir}
          progress={progress}
          onAnimation={onAnimation}
          viewport={viewport}
          dialogue={panel.dialogue}
          modelUrl={panel.modelUrl}
          animation={panel.animation}
          cameraSettings={panel.camera}
          visible={active}
          active={active}
          onError={setError}
          musicBubble={panel.id === 'p04'}
        />

      </View>

    ),
    [
      viewIndex,
      visible,
      error,
      noir,
      progress,
      onAnimation,
      panel,
      active,
    ],
  );

  /* ==========================================================
     PANEL STYLES
     ========================================================== */

  const shotAspect =
    panel.camera.mode === 'blender'
      ? panel.camera.aspectRatio
      : panel.aspectRatio;

  const style = {
    gridArea: panel.placement.area,

    '--panel-aspect':
      panel.aspectRatio,

    '--shot-aspect':
      shotAspect,
  } as CSSProperties;

  /* ==========================================================
     RENDER
     ========================================================== */

  return (

    <article
      className={
        `comic-panel panel-${index}` +
        (
          cinematic
            ? ' panel-cinematic'
            : ''
        )
      }
      style={style}
      aria-labelledby={
        `${panel.id}-title`
      }
      data-panel-id={panel.id}
      data-playback={
        panel.animation.playback
      }
      data-gsap={scrollDriven}
    >

      {/* ====================================================
          PANEL HEADING
          ==================================================== */}

      <header
        className="comic-panel-heading"
      >

        <span>
          {String(
            index + 1,
          ).padStart(2, '0')}
        </span>

        <h2
          id={`${panel.id}-title`}
        >
          {panel.title}
        </h2>

      </header>

      {/* ====================================================
          3D PANEL
          ==================================================== */}

      <div
        className="panel-art"
        role="img"
        aria-label={
          panel.animation.playback === 'static'
            ? `Panel ${index + 1}: static scene`
            : `Panel ${index + 1}: ${panel.title} animation`
        }
      >

        {sceneView}

      </div>

      {/* ====================================================
          PANEL CAPTION
          ==================================================== */}

      <div
        className="panel-caption"
      >

        <p>
          {panel.caption}
        </p>

        {/* Autoplay / interaction controls */}

        {timed &&
          animation &&
          !error && (

            <PlaybackControls
              controller={animation}
              active={active}
              label={panel.title}
            />

          )}

        {/* Error message */}

        {error && (

          <p
            className="panel-status panel-error"
            role="alert"
          >
            {error}
          </p>

        )}

        {/* Loading status */}

        {!animation &&
          !error &&
          panel.animation.playback !== 'static' && (

            <p
              className="panel-status"
              role="status"
            >
              Loading scene…
            </p>

          )}

      </div>

    </article>

  );
}
