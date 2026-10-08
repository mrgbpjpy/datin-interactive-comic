/**
 * DATIN's declarative story and playback configuration (the MVC-inspired model).
 * This dependency-free module supplies typed page/panel data to ComicReader,
 * ComicPage and Character; it does not load assets or drive animation itself.
 * Concepts: interfaces, discriminated unions, optional properties, normalized
 * progress, and pure helpers. Clip names are lookup keys validated at load time.
 * https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
 * https://www.typescriptlang.org/docs/handbook/2/narrowing.html
 * https://threejs.org/docs/pages/AnimationClip.html
 */
/* ============================================================
   DATIN — COMIC MODEL
   ============================================================ */

export interface PanelCamera {
  startAngle: number;
  endAngle: number;
  distanceScale: number;
  targetHeight: number;
}

// The mode discriminator makes cameraName available only in the blender branch;
// the auto branch instead combines PanelCamera with a literal mode via &.
export type PanelCameraSettings =
  | (PanelCamera & { mode: 'auto' })
  | {
      mode: 'blender';
      cameraName: string;
      animationName?: string;
      aspectRatio: number;
    };

// Checking playback === 'static' narrows this union before accessing pose/body.
// A ? marks an optional field; callers supply defaults when it is undefined.
export type PanelAnimation =
  | { playback: 'static'; pose: 'bind' }
  | {
      body: string;
      effects?: string[];
      playback: 'scroll' | 'autoplay' | 'interaction';
      loop?: boolean;
      speed?: number;
    };

export interface PanelScrollSettings {
  scrollWeight?: number;
}

export interface PageScrollSettings {
  scrollDistance: number;
  pin: boolean;
}

export interface ComicPanel {
  id: string;
  title: string;
  caption: string;
  dialogue: string;
  placement: { area: string };
  aspectRatio: number;
  modelUrl?: string;
  animation: PanelAnimation;
  camera: PanelCameraSettings;
  scroll?: PanelScrollSettings;
}

interface GridLayout {
  columns: string;
  areas: string[];
}

export interface ComicPageDefinition {
  id: string;
  title: string;
  caption: string;
  layout: GridLayout & {
    gap: number;
    mobile?: GridLayout;
  };
  scroll?: PageScrollSettings;
  panels: ComicPanel[];
}

/* ============================================================
   GLB MODEL PATHS
   ============================================================ */

export const DATIN_CHARACTER_MODEL = '/models/Datin.web.glb';
export const PAGE_01_MODEL = '/models/Datin_ComicV3.glb';
export const PAGE_02_MODEL = '/models/Datin_ComicV4.glb';
export const PAGE_02_PANEL_02_MODEL = '/models/Datin_ComicV5.glb';
export const PAGE_02_PANEL_03_MODEL = '/models/Datin_ComicV6.glb';

/* ============================================================
   PAGE DEFINITIONS
   ============================================================ */

// Views consume this data rather than embedding story text or playback decisions
// in the renderer. The current cover autoplays; all three Page 2 panels scroll.
export const pages: ComicPageDefinition[] = [
  {
    id: 'page-01-cover',
    title: 'DATIN',
    caption: '',
    layout: {
      columns: 'minmax(0, 1fr)',
      areas: ['cover'],
      gap: 0,
      mobile: {
        columns: 'minmax(0, 1fr)',
        areas: ['cover'],
      },
    },
    panels: [
      {
        id: 'p01-hero-reach',
        title: 'HERO REACH',
        caption: '',
        dialogue: '',
        placement: { area: 'cover' },
        aspectRatio: 16 / 9,
        modelUrl: PAGE_01_MODEL,
        animation: {
          body: 'Body_P01_HeroReach',
          effects: ['FX_P01_BOOM', 'FX_P01_BAP', 'FX_P01_BARS'],
          playback: 'autoplay',
          loop: false,
          speed: 1,
        },
        camera: {
          mode: 'blender',
          cameraName: 'Camera',
          animationName: 'Cam_P01_HeroReach',
          aspectRatio: 16 / 9,
        },
      },
    ],
  },
  {
    id: 'page-02',
    title: 'THE STUDIO',
    caption: 'The story begins.',
    scroll: {
      scrollDistance: 3200,
      pin: false,
    },
    layout: {
      columns: 'repeat(2, minmax(0, 1fr))',
      areas: ['top top', 'left right'],
      gap: 18,
      mobile: {
        columns: 'minmax(0, 1fr)',
        areas: ['top', 'left', 'right'],
      },
    },
    panels: [
      {
        // P02 — recording studio: scroll-driven V4 shot.
        id: 'p02',
        title: 'THE STUDIO',
        caption: 'Late night. One more session.',
        dialogue: '',
        placement: { area: 'top' },
        aspectRatio: 16 / 9,
        modelUrl: PAGE_02_MODEL,
        scroll: { scrollWeight: 3 },
        animation: {
          body: 'Body_P01_HeroReach',
          effects: [],
          playback: 'scroll',
          loop: false,
          speed: 1,
        },
        camera: {
          mode: 'blender',
          cameraName: 'Camera',
          // Retained from your existing V4 setup; verify this clip
          // actually contains camera tracks in the exported GLB.
          animationName: 'FX_P01_BARS',
          aspectRatio: 16 / 9,
        },
      },
      {
        // P03 — listening to the track: scroll-driven V5 shot.
        id: 'p03',
        title: "SOMETHING'S MISSING",
        caption: 'Datin listens closely to his latest track.',
        dialogue: '',
        placement: { area: 'left' },
        aspectRatio: 1,
        modelUrl: PAGE_02_PANEL_02_MODEL,
        scroll: { scrollWeight: 1 },
        animation: {
          body: 'Body_P01_HeroReach',
          effects: [],
          playback: 'scroll',
          loop: false,
          speed: 1,
        },
        camera: {
          mode: 'blender',
          cameraName: 'Camera_Page2_Panel2',
          animationName: 'Camera_Page2_Panel2Action',
          aspectRatio: 1,
        },
      },
      {
        // P04 — the call: scroll drives Datin, camera and microphone.
        id: 'p04',
        title: 'The Session',
        caption: 'Laying down vocals in the studio.',
        dialogue: '',
        placement: { area: 'right' },
        aspectRatio: 1,
        modelUrl: PAGE_02_PANEL_03_MODEL,
        scroll: { scrollWeight: 1 },
        animation: {
          body: 'Body_P01_HeroReach',
          // The microphone is parented to the shot rig's hand: animate that
          // rig too, while Character keeps its duplicate skinned meshes hidden.
          effects: ['Body_P01_HeroReach', 'Microphone_Action'],
          playback: 'scroll',
          loop: false,
          speed: 1,
        },
        camera: {
          mode: 'blender',
          cameraName: 'Camera',
          animationName: 'CameraAction',
          aspectRatio: 1,
        },
      },
    ],
  },
];

/* ============================================================
   SCROLL TIMELINE HELPERS
   ============================================================ */

export interface PanelScrollRange {
  panelId: string;
  start: number;
  end: number;
  weight: number;
}

/**
 * Build weighted, adjacent subranges in a hypothetical page-wide [0, 1] timeline.
 * These exported helpers are not called by the current view/scroll wiring:
 * Scroll.controller currently installs independent element-based triggers.
 */
export function getPanelScrollRanges(
  page: ComicPageDefinition,
): PanelScrollRange[] {
  const scrollPanels = page.panels.filter(
    panel => panel.animation.playback === 'scroll',
  );

  if (scrollPanels.length === 0) return [];

  const weights = scrollPanels.map(panel => {
    const weight = panel.scroll?.scrollWeight ?? 1;
    return Number.isFinite(weight) && weight > 0 ? weight : 1;
  });

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) return [];

  let cursor = 0;
  return scrollPanels.map((panel, index) => {
    const start = cursor / totalWeight;
    cursor += weights[index];
    return {
      panelId: panel.id,
      start,
      end: cursor / totalWeight,
      weight: weights[index],
    };
  });
}

/** Map a page fraction into a panel's subrange, clamping outside it to 0 or 1. */
export function getPanelLocalProgress(
  pageProgress: number,
  range: PanelScrollRange,
): number {
  const length = range.end - range.start;
  if (length <= 0) return 0;
  const progress = Number.isFinite(pageProgress) ? pageProgress : 0;
  return Math.max(0, Math.min(1, (progress - range.start) / length));
}

export const MODEL_URL = '/models/Datin_ComicV2.glb';
