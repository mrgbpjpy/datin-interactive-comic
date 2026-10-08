/**
 * MVC-inspired bridge from document scrolling to AnimationController progress.
 * GSAP/ScrollTrigger measure DOM ranges; the controller import is type-only.
 * ComicPage supplies ready panel registrations, each with a mutable progress
 * object and its master animation clock. This module does not render React UI.
 * Concepts: nullable dependencies, closures, normalized progress, and cleanup.
 * https://gsap.com/docs/v3/Plugins/ScrollTrigger/
 * https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
 * https://threejs.org/docs/pages/AnimationMixer.html
 */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import type {
  AnimationController,
} from './Animation.controller';

gsap.registerPlugin(ScrollTrigger);

/* ============================================================
   DATIN — GSAP SCROLL CONTROLLER
   ============================================================ */

export interface SceneProgress {
  value: number;
}

export interface SequentialPanel {
  id: string;
  progress: SceneProgress;
  animation: AnimationController | null;
}

/* ============================================================
   CONFIGURATION
   ============================================================ */

/**
 * Each connected panel begins when its top reaches 65%
 * of the browser viewport.
 *
 * No pinning is performed.
 */
const PANEL_START = 'top 65%';

/**
 * The normal endpoint is the panel's bottom reaching 20% of the viewport.
 *
 * Clamp to the document's maximum scroll so the last row
 * can reach its final animation frame without extra layout space.
 */
const PANEL_END = 'clamp(bottom 20%)';

/**
 * Minimum usable scroll range.
 *
 * A short panel can otherwise have
 * very little distance between start/end.
 */
const MIN_SCROLL_RANGE = 100;

/* ============================================================
   HELPERS
   ============================================================ */

const clampProgress = (
  value: number,
): number =>
  gsap.utils.clamp(0, 1, value);

/* ============================================================
   APPLY ANIMATION PROGRESS
   ============================================================ */

function applyAnimationProgress(
  state: SceneProgress,
  animation: AnimationController | null,
  progress: number,
): void {

  const normalized =
    clampProgress(progress);

  state.value = normalized;

  if (!animation) {
    return;
  }

  /**
   * GSAP controls the animation clock.
   *
   * Scrolling down:
   * 0% -> 100%
   *
   * Scrolling up:
   * 100% -> 0%
   */
  animation.pause();

  animation.setProgress(normalized);
}

/* ============================================================
   SCROLL RANGE
   ============================================================ */

/**
 * ScrollTrigger normally uses the panel's
 * position within the document.
 *
 * Short elements use a relative 100-pixel range. Other elements use the
 * clamped viewport-relative endpoint; this function does not move the page.
 */
function getPanelEnd(
  element: HTMLElement,
): string {

  const height =
    element.getBoundingClientRect().height;

  if (height < MIN_SCROLL_RANGE) {
    return `+=${MIN_SCROLL_RANGE}`;
  }

  return PANEL_END;
}

/* ============================================================
   CREATE SCROLL TRIGGER
   ============================================================ */

/**
 * Create a non-pinning ScrollTrigger.
 *
 * Important:
 * - Does not modify the CSS Grid
 * - Does not insert a pin spacer
 * - Does not force scroll-position changes
 * - Supports forward and reverse scrubbing
 */
function createPanelTrigger(
  element: HTMLElement,
  state: SceneProgress,
  animation: AnimationController,
  id: string,
): ScrollTrigger {

  /**
   * Prevent duplicate triggers with the
   * same ID from controlling one panel.
   */
  const existing =
    ScrollTrigger.getById(id);

  if (existing) {
    existing.kill();
  }

  // This closure captures one panel's objects. onUpdate and onRefresh route
  // through the same setter, which pauses autoplay before sampling scroll time.
  const apply = (
    progress: number,
  ): void => {

    applyAnimationProgress(
      state,
      animation,
      progress,
    );
  };

  const trigger =
    ScrollTrigger.create({

      id,

      trigger: element,

      start: PANEL_START,

      end: () =>
        getPanelEnd(element),

      /**
       * Never pin a grid cell.
       *
       * Pinning changes document geometry
       * and can cause page jumping.
       */
      pin: false,

      /**
       * Use direct scroll progress.
       *
       * AnimationController.setProgress()
       * handles the actual Blender timeline.
       */
      scrub: true,

      /**
       * Recalculate only when GSAP performs
       * a normal refresh.
       */
      invalidateOnRefresh: true,

      /**
       * Update animation in both directions.
       */
      onUpdate: self => {

        apply(self.progress);

      },

      onRefresh: self => {

        apply(self.progress);

      },

    });

  /**
   * Synchronize the animation with the
   * current scroll position on creation.
   */
  apply(trigger.progress);

  return trigger;
}

/* ============================================================
   INDIVIDUAL PANEL SCROLL
   ============================================================ */

/**
 * Single-panel connector available for callers; current ComicPage wiring uses
 * connectSequentialPageScroll instead.
 *
 * This must only be used for panels whose
 * playback mode is 'scroll'.
 *
 * Do not call this for autoplay panels.
 */
export function connectPanelScroll(
  panel: HTMLElement,
  state: SceneProgress,
  animation: AnimationController | null,
): () => void {

  if (!animation) {
    return () => {};
  }

  const id =
    `datin-panel-${panel.dataset.panelId ?? 'panel'}`;

  const trigger =
    createPanelTrigger(
      panel,
      state,
      animation,
      id,
    );

  return () => {

    trigger.kill();

  };
}

/* ============================================================
   SEQUENTIAL PAGE SCROLL
   ============================================================ */

/**
 * P01 — Cover:
 *   Autoplay. GSAP excluded.
 *
 * P02 — Recording studio:
 *   GSAP scroll forward/reverse in the current model.
 *
 * P03 — V5:
 *   GSAP scroll forward/reverse.
 *
 * P04 — The call:
 *   GSAP scroll drives the synchronized body, camera and microphone shot.
 *
 * Each scroll-controlled panel receives
 * an independent, non-pinning trigger.
 * Despite the function name, it does not sequence panels in weighted subranges:
 * side-by-side panels can legitimately share the same document scroll range.
 *
 * No page-level pinning.
 * No forced ScrollTrigger.refresh().
 */
export function connectSequentialPageScroll(
  page: HTMLElement,
  panels: SequentialPanel[],
): () => void {

  if (panels.length === 0) {
    return () => {};
  }

  const triggers:
    ScrollTrigger[] = [];

  /* ==========================================================
     FIND PANEL ELEMENT
     ========================================================== */

  const findPanelElement = (
    panelId: string,
  ): HTMLElement | null => {

    // The generic supplies HTMLElement methods to TypeScript. The runtime
    // selector still chooses by data-panel-id, matching ComicPage's wrappers.
    const elements =
      page.querySelectorAll<HTMLElement>(
        '[data-panel-id]',
      );

    for (const element of elements) {

      if (
        element.dataset.panelId === panelId
      ) {
        return element;
      }

    }

    return null;
  };

  /* ==========================================================
     CREATE PANEL TRIGGERS
     ========================================================== */

  panels.forEach((
    panel,
    index,
  ) => {

    if (!panel.animation) {
      return;
    }

    const element =
      findPanelElement(panel.id);

    if (!element) {

      console.warn(
        '[DATIN GSAP] Missing panel element:',
        panel.id,
      );

      return;
    }

    const trigger =
      createPanelTrigger(
        element,
        panel.progress,
        panel.animation,
        `datin-sequential-${index}-${panel.id}`,
      );

    triggers.push(trigger);

  });

  /* ==========================================================
     CLEANUP
     ========================================================== */

  return () => {

    triggers.forEach(
      trigger => trigger.kill(),
    );

  };
}
