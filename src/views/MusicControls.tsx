/**
 * Soundtrack UI in DATIN's MVC-inspired view layer.
 * ComicReader passes the shared HTMLAudioElement; React state reflects play/mute
 * events and slider interactions. useEffect installs and removes media listeners.
 * This view uses browser audio directly, not AudioController or a Three.js sound.
 * Concepts: controlled inputs, event types, async play requests and volume mapping.
 * https://react.dev/reference/react/useState
 * https://react.dev/reference/react/useEffect
 * https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
 */
import {
  useEffect,
  useState,
} from 'react';


interface MusicControlsProps {
  audio: HTMLAudioElement;
}


const DEFAULT_VOLUME = 0.25;


/* ============================================================
   VOLUME CURVE
   ============================================================ */

// Squaring maps 25% on the UI to 0.0625 media volume. This is the application's
// chosen curve, not a decibel conversion or the linear value displayed by the UI.
function getActualVolume(
  uiVolume: number,
) {

  return (
    uiVolume *
    uiVolume
  );
}


/* ============================================================
   MUSIC CONTROLS
   ============================================================ */

export function MusicControls({
  audio,
}: MusicControlsProps) {

  const [
    playing,
    setPlaying,
  ] =
    useState(
      !audio.paused,
    );


  const [
    volume,
    setVolume,
  ] =
    useState(
      DEFAULT_VOLUME,
    );


  const [
    muted,
    setMuted,
  ] =
    useState(
      audio.muted,
    );


  /* ==========================================================
     SYNCHRONIZE UI WITH SHARED AUDIO

     IMPORTANT:
     This does NOT create audio.
     This does NOT autoplay audio.

      ComicReader owns the shared soundtrack element (and a separate vinyl sound).
     ========================================================== */

  useEffect(
    () => {

      const handlePlay =
        () => {

          setPlaying(
            true,
          );

        };


      const handlePause =
        () => {

          setPlaying(
            false,
          );

        };


      // External volumechange events synchronize mute only. Slider volume state
      // is managed by changeVolume rather than inferred from audio.volume here.
      const handleVolumeChange =
        () => {

          setMuted(
            audio.muted,
          );

        };


      audio.addEventListener(
        'play',
        handlePlay,
      );


      audio.addEventListener(
        'pause',
        handlePause,
      );


      audio.addEventListener(
        'volumechange',
        handleVolumeChange,
      );


      /*
       * Synchronize initial UI state.
       */

      setPlaying(
        !audio.paused,
      );


      setMuted(
        audio.muted,
      );


      return () => {

        audio.removeEventListener(
          'play',
          handlePlay,
        );


        audio.removeEventListener(
          'pause',
          handlePause,
        );


        audio.removeEventListener(
          'volumechange',
          handleVolumeChange,
        );

      };

    },
    [
      audio,
    ],
  );


  /* ==========================================================
     PLAY / PAUSE
     ========================================================== */

  const toggleMusic =
    async () => {

      if (
        !audio.paused
      ) {

        audio.pause();

        return;

      }


      try {

        await audio.play();

      }

      catch (
        error
      ) {

        console.error(
          '[DATIN AUDIO] Unable to play soundtrack:',
          error,
        );

      }

    };


  /* ==========================================================
     MUTE / UNMUTE
     ========================================================== */

  const toggleMute =
    () => {

      audio.muted =
        !audio.muted;


      setMuted(
        audio.muted,
      );

    };


  /* ==========================================================
     VOLUME
     ========================================================== */

  // The generic identifies the event target as an HTML input. Its value is still
  // a string at runtime, so Number converts it before arithmetic/media assignment.
  const changeVolume =
    (
      event:
        React.ChangeEvent<HTMLInputElement>,
    ) => {

      const nextVolume =
        Number(
          event.target.value,
        );


      /*
       * UI value:
       *
       * 0.25 = 25%
       * 0.50 = 50%
       * 1.00 = 100%
       */

      setVolume(
        nextVolume,
      );


      /*
       * Convert UI percentage through the
       * perceptual volume curve.
       */

      audio.volume =
        getActualVolume(
          nextVolume,
        );


      /*
       * 0% automatically mutes.
       */

      if (
        nextVolume === 0
      ) {

        audio.muted =
          true;

      }

      /*
       * Moving above 0% automatically unmutes.
       */

      else {

        audio.muted =
          false;

      }


      setMuted(
        audio.muted,
      );

    };


  /* ==========================================================
     UI
     ========================================================== */

  return (

    <div
      className="music-controls"
    >

      {/* ======================================================
          PLAY / PAUSE
          ====================================================== */}

      <button
        type="button"
        className="music-toggle"
        onClick={
          toggleMusic
        }
        aria-label={
          playing
            ? 'Pause soundtrack'
            : 'Play soundtrack'
        }
      >

        <span
          className="music-icon"
          aria-hidden="true"
        >

          {playing
            ? '♫'
            : '♪'}

        </span>


        <span>

          {playing
            ? 'PAUSE SOUNDTRACK'
            : 'PLAY SOUNDTRACK'}

        </span>

      </button>


      {/* ======================================================
          MUTE
          ====================================================== */}

      <button
        type="button"
        className="music-mute"
        onClick={
          toggleMute
        }
        aria-label={
          muted
            ? 'Unmute soundtrack'
            : 'Mute soundtrack'
        }
      >

        {muted ||
        volume === 0
          ? '🔇'
          : '🔊'}

      </button>


      {/* ======================================================
          VOLUME
          ====================================================== */}

      <div
        className="music-volume"
      >

        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={
            volume
          }
          onChange={
            changeVolume
          }
          aria-label="Soundtrack volume"
        />


        <span
          className="music-volume-value"
        >

          {Math.round(
            volume * 100,
          )}%

        </span>

      </div>

    </div>

  );
}
