/**
 * Top-level MVC-inspired view/coordinator mounted by main.tsx.
 * React manages front/loading/comic stages, audio lifetimes and the noir toggle.
 * The pages model feeds ComicPage; ComicCanvas supplies the shared comic renderer.
 * IntroScreen, LoadingScreen and MusicControls handle the surrounding DOM UI;
 * GSAP refreshes scroll measurements after the comic stage mounts or resizes.
 * Concepts: finite stage unions, lazy state, refs, async callbacks and cleanup.
 * https://react.dev/reference/react/useState
 * https://react.dev/reference/react/useEffect
 * https://react.dev/reference/react/useRef
 * https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
 * https://gsap.com/docs/v3/Plugins/ScrollTrigger/
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { ComicCanvas } from './ComicCanvas';
import { ComicPage } from './ComicPage';
import { IntroScreen } from './IntroScreen';
import { LoadingScreen } from './LoadingScreen';
import { MusicControls } from './MusicControls';

import { pages } from '../models/Comic.model';

import './comic.css';
import './framing.css';

gsap.registerPlugin(ScrollTrigger);

/* ============================================================
   CONFIGURATION
   ============================================================ */

const SOUNDTRACK = '/music/Pitched_Up_Soul.mp3';
const VINYL_SOUND = '/music/Vinyl.mp3';

const DEFAULT_VOLUME = 0.25;
const VINYL_VOLUME = 0.4;

// Loading screen lasts 25 seconds.
const LOADING_DURATION = 25000;

// A union of literal strings restricts the UI to three named stages. The loading
// interval is a fixed timer, not a measurement of GLB download completion.
type ExperienceStage =
  | 'front'
  | 'loading'
  | 'comic';

/* ============================================================
   COMIC READER
   ============================================================ */

export function ComicReader() {
  const [noir, setNoir] = useState(true);

  const [stage, setStage] =
    useState<ExperienceStage>('front');

  // Lazy initializers supply stable media objects for this component's lifetime;
  // playback/load side effects belong to effects and user-triggered callbacks.
  const [audio] = useState(
    () => new Audio(),
  );

  const [vinylAudio] = useState(
    () => new Audio(),
  );

  const container = useRef<HTMLElement>(null!);

  // ReturnType derives the timer-handle type from the function instead of guessing
  // it. null distinguishes 'no pending timer' from a handle needing cancellation.
  const loadingTimer =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  const vinylTriggered = useRef(false);
  const starting = useRef(false);

  /* ==========================================================
     MAIN SOUNDTRACK
     ========================================================== */

  useEffect(() => {
    audio.src = SOUNDTRACK;
    audio.loop = true;
    audio.preload = 'auto';

    audio.volume =
      DEFAULT_VOLUME * DEFAULT_VOLUME;

    audio.muted = true;
    audio.load();

    return () => {
      audio.pause();
    };
  }, [audio]);

  /* ==========================================================
     VINYL AUDIO
     ========================================================== */

  useEffect(() => {
    vinylAudio.src = VINYL_SOUND;
    vinylAudio.preload = 'auto';
    vinylAudio.loop = false;
    vinylAudio.volume = VINYL_VOLUME;
    vinylAudio.muted = false;

    const handleReady = () => {
      console.log(
        '[DATIN VINYL] Vinyl.mp3 ready.',
      );
    };

    const handlePlaying = () => {
      console.log(
        '[DATIN VINYL] Vinyl.mp3 playback started.',
      );
    };

    const handleEnded = () => {
      console.log(
        '[DATIN VINYL] Vinyl.mp3 finished.',
      );
    };

    const handleError = () => {
      console.error(
        '[DATIN VINYL] Audio error:',
        vinylAudio.error,
      );
    };

    vinylAudio.addEventListener(
      'canplaythrough',
      handleReady,
    );

    vinylAudio.addEventListener(
      'playing',
      handlePlaying,
    );

    vinylAudio.addEventListener(
      'ended',
      handleEnded,
    );

    vinylAudio.addEventListener(
      'error',
      handleError,
    );

    vinylAudio.load();

    return () => {
      vinylAudio.pause();

      vinylAudio.removeEventListener(
        'canplaythrough',
        handleReady,
      );

      vinylAudio.removeEventListener(
        'playing',
        handlePlaying,
      );

      vinylAudio.removeEventListener(
        'ended',
        handleEnded,
      );

      vinylAudio.removeEventListener(
        'error',
        handleError,
      );
    };
  }, [vinylAudio]);

  /* ==========================================================
     PLAY VINYL WHEN NEEDLE TOUCHES RECORD
     ========================================================== */

  const playVinylSound = useCallback(
    async () => {
      if (vinylTriggered.current) {
        return;
      }

      vinylTriggered.current = true;

      console.log(
        '[DATIN VINYL] Needle touched record.',
      );

      try {
        vinylAudio.pause();
        vinylAudio.currentTime = 0;
        vinylAudio.muted = false;
        vinylAudio.volume = VINYL_VOLUME;

        await vinylAudio.play();

        console.log(
          '[DATIN VINYL] Vinyl.mp3 IS PLAYING.',
        );
      } catch (error) {
        vinylTriggered.current = false;

        console.error(
          '[DATIN VINYL] Playback failed:',
          error,
        );
      }
    },
    [vinylAudio],
  );

  /* ==========================================================
     START LOADING EXPERIENCE
     ========================================================== */

  const startLoadingSequence = useCallback(
    async () => {
      // Refs change synchronously, so this gate handles repeated clicks even
      // before a state update has rendered the next screen.
      if (starting.current || stage !== 'front') {
        return;
      }

      starting.current = true;
      vinylTriggered.current = false;

      /*
       * Unlock main soundtrack during user click.
       */
      try {
        audio.muted = true;
        audio.currentTime = 0;

        await audio.play();

        console.log(
          '[DATIN AUDIO] Main soundtrack unlocked.',
        );
      } catch (error) {
        console.warn(
          '[DATIN AUDIO] Soundtrack unlock failed:',
          error,
        );
      }

      /*
       * Unlock vinyl sound during user click.
       */
      try {
        vinylAudio.muted = true;
        vinylAudio.currentTime = 0;

        await vinylAudio.play();

        vinylAudio.pause();
        vinylAudio.currentTime = 0;
        vinylAudio.muted = false;

        console.log(
          '[DATIN VINYL] Vinyl audio unlocked.',
        );
      } catch (error) {
        vinylAudio.pause();
        vinylAudio.muted = false;

        console.warn(
          '[DATIN VINYL] Audio unlock failed:',
          error,
        );
      }

      /* FRONT -> LOADING */

      setStage('loading');

      loadingTimer.current = window.setTimeout(
        () => {
          /*
           * Begin soundtrack when comic appears.
           */
          audio.currentTime = 0;
          audio.muted = false;

          if (audio.paused) {
            void audio.play().catch(error => {
              console.error(
                '[DATIN AUDIO] Soundtrack failed:',
                error,
              );
            });
          }

          /* LOADING -> COMIC */

          setStage('comic');

          loadingTimer.current = null;
        },
        LOADING_DURATION,
      );
    },
    [audio, vinylAudio, stage],
  );

  /* ==========================================================
     CLEANUP LOADING TIMER
     ========================================================== */

  useEffect(() => {
    return () => {
      if (loadingTimer.current !== null) {
        window.clearTimeout(
          loadingTimer.current,
        );

        loadingTimer.current = null;
      }
    };
  }, []);

  /* ==========================================================
     GSAP — COMIC ONLY
     ========================================================== */

  useEffect(() => {
    if (stage !== 'comic') {
      return;
    }

    /*
     * The loading screen does not use GSAP.

     * Refresh ScrollTrigger after comic panels
     * and their layout have mounted.
     *
     * Individual panels register their own
     * scroll-controlled animation timelines.
     */
    // Measure after mounting DOM panels. This refresh updates trigger geometry;
    // actual animation sampling remains owned by each registered panel clock.
    const frame = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });

    const handleResize = () => {
      ScrollTrigger.refresh();
    };

    window.addEventListener(
      'resize',
      handleResize,
    );

    return () => {
      cancelAnimationFrame(frame);

      window.removeEventListener(
        'resize',
        handleResize,
      );
    };
  }, [stage]);

  /* ==========================================================
     FRONT SCREEN
     ========================================================== */

  if (stage === 'front') {
    return (
      <IntroScreen
        onEnter={startLoadingSequence}
      />
    );
  }

  /* ==========================================================
     LOADING SCREEN
     ========================================================== */

  if (stage === 'loading') {
    return (
      <LoadingScreen
        onNeedleTouch={playVinylSound}
      />
    );
  }

  /* ==========================================================
     COMIC EXPERIENCE
     ========================================================== */

  return (
    <main ref={container}>
      {/* MASTHEAD */}

      <header className="masthead">
        <MusicControls audio={audio} />

        <span>
          DATIN
          <span className="red">.</span>
        </span>

        <small>
          AN INTERACTIVE GRAPHIC NOVEL
        </small>

        <div className="creator-credit">
          <div>
            Created by{' '}
            <strong>Erick Esquilin</strong>
            {' '}· Mr. E
          </div>

          <a href="mailto:mrgbpjpy@gmail.com">
            mrgbpjpy@gmail.com
          </a>

          <div>
            © {new Date().getFullYear()}{' '}
            Erick Esquilin.
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setNoir(value => !value);
          }}
          aria-label="Toggle original and ink rendering"
        >
          {noir
            ? 'VIEW ORIGINAL'
            : 'INK MODE'}
        </button>
      </header>

      {/* SCROLL HINT */}

      <div className="scroll-hint">
        SCROLL TO TURN THE PAGE
        <span>↓</span>
      </div>

      {/* COMIC PAGES */}

      {pages.map((page, index) => {
        const viewOffset = pages
          .slice(0, index)
          .reduce(
            (count, previous) =>
              count + previous.panels.length,
            0,
          );

        return (
          <ComicPage
            key={page.id}
            page={page}
            index={index}
            viewOffset={viewOffset}
            noir={noir}
          />
        );
      })}

      {/* FOOTER */}

      <footer>
        DATIN

        <small>
          © {new Date().getFullYear()}{' '}
          AN INTERACTIVE CHARACTER STUDY
          {' '}—{' '}
          Created by Erick Esquilin.
          All rights reserved.
        </small>
      </footer>

      {/* SHARED THREE.JS CANVAS */}

      <ComicCanvas eventSource={container} />
    </main>
  );
}
