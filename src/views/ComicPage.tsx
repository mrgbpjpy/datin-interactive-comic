/**
 * MVC-inspired page view: turn Comic.model data into a CSS-grid of ComicPanels.
 * React refs keep controller registrations; state signals registry changes.
 * Scroll.controller receives the ready scroll panels and returns trigger cleanup.
 * Concepts: typed Maps, stable callbacks, effects, memoized style objects and
 * separating React lifecycle updates from continuously sampled animation time.
 * https://react.dev/reference/react/useRef
 * https://react.dev/reference/react/useMemo
 * https://react.dev/reference/react/useEffect
 * https://www.typescriptlang.org/docs/handbook/2/generics.html
 * https://gsap.com/docs/v3/Plugins/ScrollTrigger/
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import type {
  ComicPageDefinition,
} from '../models/Comic.model';

import {
  ComicPanel,
} from './ComicPanel';

import type {
  AnimationController,
} from '../controllers/Animation.controller';

import type {
  SceneProgress,
} from '../controllers/Scroll.controller';

import {
  connectSequentialPageScroll,
} from '../controllers/Scroll.controller';

/* ============================================================
   DATIN — COMIC PAGE
   ============================================================ */

interface ComicPageProps {
  page: ComicPageDefinition;
  index: number;
  viewOffset: number;
  noir: boolean;
}

/* ============================================================
   PANEL REGISTRATION
   ============================================================ */

export interface ComicPanelRegistration {
  id: string;
  progress: SceneProgress;
  animation: AnimationController | null;
}

/* ============================================================
   COMPONENT
   ============================================================ */

export function ComicPage({
  page,
  index,
  viewOffset,
  noir,
}: ComicPageProps) {

  const pageRef =
    useRef<HTMLElement>(null);

  const {
    layout,
  } = page;

  /* ==========================================================
     GSAP CONFIGURATION
     ============================================================ */

  /*
   * GSAP is enabled only when a page contains
   * panels explicitly configured for scrolling.
   *
   * Autoplay panels are NEVER registered with GSAP.
   */
  const scrollPanels = useMemo(
    () =>
      page.panels.filter(
        panel =>
          panel.animation.playback === 'scroll',
      ),
    [page.panels],
  );

  const gsapEnabled =
    scrollPanels.length > 0;

  /* ==========================================================
     PANEL REGISTRY
     ============================================================ */

  // Mutating a ref does not render React. registryVersion below is the explicit
  // notification that readiness changed and the connection effect should rerun.
  const registry = useRef(
    new Map<
      string,
      ComicPanelRegistration
    >(),
  );

  const [
    registryVersion,
    setRegistryVersion,
  ] = useState(0);

  /* ==========================================================
     REGISTER PANEL
     ============================================================ */

  const registerPanel = useCallback(
    (
      registration: ComicPanelRegistration,
    ) => {

      const previous =
        registry.current.get(
          registration.id,
        );

      // Identity checks avoid rebuilding registrations for the same controller
      // and progress object; changing a progress.value alone is not registration.
      if (
        previous?.animation ===
          registration.animation &&
        previous.progress ===
          registration.progress
      ) {
        return;
      }

      registry.current.set(
        registration.id,
        registration,
      );

      setRegistryVersion(
        version => version + 1,
      );
    },
    [],
  );

  /* ==========================================================
     UNREGISTER PANEL
     ============================================================ */

  const unregisterPanel = useCallback(
    (id: string) => {

      if (
        registry.current.delete(id)
      ) {
        setRegistryVersion(
          version => version + 1,
        );
      }

    },
    [],
  );

  /* ==========================================================
     GSAP — SEQUENTIAL PAGE TIMELINE
     ============================================================ */

  useEffect(() => {

    /*
     * No scroll-controlled panels:
     * no GSAP timeline.
     *
     * This excludes the cover and any page
     * containing only autoplay/static panels.
     */
    if (!gsapEnabled) {
      return;
    }

    const element =
      pageRef.current;

    if (!element) {
      return;
    }

    /*
     * Wait for every scroll-controlled panel
     * to register its animation controller.
     */
    // Wait for async GLB loading before connecting the page's scroll triggers.
    // This effect tracks registration changes, not per-frame progress changes.
    const allReady =
      scrollPanels.every(
        panel =>
          Boolean(
            registry.current.get(
              panel.id,
            )?.animation,
          ),
      );

    if (!allReady) {
      return;
    }

    /*
     * Preserve the panel order from Comic.model.ts.
     *
     * Autoplay panels are excluded.
     */
    // Order determines stable IDs here. The controller currently creates separate
    // element-based triggers rather than a single weighted, sequential timeline.
    const sequence =
      scrollPanels.map(
        panel => {

          const entry =
            registry.current.get(
              panel.id,
            )!;

          return {
            id: entry.id,
            progress: entry.progress,
            animation: entry.animation,
          };

        },
      );

    console.log(
      '[DATIN GSAP] PAGE:',
      page.id,
    );

    console.log(
      '[DATIN GSAP] SCROLL PANELS:',
      sequence.map(
        panel => panel.id,
      ),
    );

    const cleanup =
      connectSequentialPageScroll(
        element,
        sequence,
      );

    return () => {
      cleanup();
    };

  }, [
    gsapEnabled,
    scrollPanels,
    registryVersion,
    page.id,
  ]);

  /* ==========================================================
     GRID TEMPLATE
     ============================================================ */

  // CSS custom properties carry model layout data to the stylesheet. The final
  // CSSProperties assertion types this object; it does not validate CSS at runtime.
  const style = useMemo(() => {

    const areas = (
      rows: string[],
    ) =>
      rows
        .map(
          row => `"${row}"`,
        )
        .join(' ');

    return {

      '--page-columns':
        layout.columns,

      '--page-areas':
        areas(layout.areas),

      '--page-gap':
        `${layout.gap}px`,

      '--mobile-columns':
        layout.mobile?.columns ??
        layout.columns,

      '--mobile-areas':
        areas(
          layout.mobile?.areas ??
          layout.areas,
        ),

    } as CSSProperties;

  }, [
    layout,
  ]);

  /* ==========================================================
     RENDER
     ============================================================ */

  return (

    <section
      ref={pageRef}
      className="comic-page"
      id={page.id}
      data-page-index={index}
      data-gsap-enabled={
        gsapEnabled
      }
      data-animated-panels={
        scrollPanels.length
      }
      aria-labelledby={
        `${page.id}-title`
      }
    >

      <div
        className="page-frame"
      >

        {/* ====================================================
            PAGE HEADING
            ==================================================== */}

        <header
          className="page-heading"
        >

          <span>
            PAGE{' '}
            {String(
              index + 1,
            ).padStart(2, '0')}
            {' '} / DATIN
          </span>

          <h1
            id={`${page.id}-title`}
          >
            {page.title}
          </h1>

          <p>
            {page.caption}
          </p>

        </header>

        {/* ====================================================
            COMIC PANEL GRID
            ==================================================== */}

        <div
          className="comic-grid"
          style={style}
          data-page-id={page.id}
        >

          {page.panels.map(
            (
              panel,
              panelIndex,
            ) => {

              const sequenceIndex =
                viewOffset +
                panelIndex;

              /*
               * Only explicit scroll panels
               * receive GSAP control.
               */
              const panelUsesGSAP =
                panel.animation.playback ===
                'scroll';

              return (

                <div
                  key={
                    `${page.id}/${panel.id}`
                  }
                  className="comic-panel-slot"
                  data-sequence-index={
                    sequenceIndex
                  }
                  data-panel-id={
                    panel.id
                  }
                  data-playback={
                    panel.animation.playback
                  }
                  data-gsap={
                    panelUsesGSAP
                  }
                  style={{
                    gridArea:
                      panel.placement.area,
                    minWidth: 0,
                  }}
                >

                  <ComicPanel
                    panel={panel}
                    index={panelIndex}
                    viewIndex={
                      sequenceIndex + 1
                    }
                    noir={noir}
                    sequential={
                      panelUsesGSAP
                    }
                    onRegister={
                      registerPanel
                    }
                    onUnregister={
                      unregisterPanel
                    }
                  />

                </div>

              );

            },
          )}

        </div>

        {/* ====================================================
            PAGE FOOTER
            ==================================================== */}

        <div
          className="page-foot"
        >

          <span>
            EWENZ ORIGINALS
          </span>

          <span>
            END OF PAGE{' '}
            {index + 1}
          </span>

        </div>

      </div>

    </section>

  );
}
