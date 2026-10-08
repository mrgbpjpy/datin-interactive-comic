/**
 * Standalone soundtrack wrapper in the MVC-inspired controller layer.
 * It has no imports: HTMLAudioElement and Audio are browser APIs. The current
 * ComicReader does not instantiate this class; it owns audio elements directly
 * and passes its soundtrack to MusicControls instead.
 * Concepts: private fields, getters, bound event handlers, async return values,
 * and symmetric subscription/disposal. This is not a Three.js audio graph.
 * https://www.typescriptlang.org/docs/handbook/2/classes.html
 * https://www.typescriptlang.org/docs/handbook/2/functions.html
 */
/* ============================================================
   COMIC AUDIO CONTROLLER
   ============================================================ */

export class AudioController {

  private audio: HTMLAudioElement;

  private _playing = false;

  private _volume = 0.25;


  constructor(
    source: string,
  ) {

    this.audio =
      new Audio(source);


    /* --------------------------------------------------------
       LOOP

       Keep the comic soundtrack running continuously.
       -------------------------------------------------------- */

    this.audio.loop = true;


    /* --------------------------------------------------------
       PRELOAD
       -------------------------------------------------------- */

    this.audio.preload = 'auto';


    /* --------------------------------------------------------
       DEFAULT VOLUME
       -------------------------------------------------------- */

    this.audio.volume =
      this._volume;


    /* --------------------------------------------------------
       EVENTS
       -------------------------------------------------------- */

    this.audio.addEventListener(
      'play',
      this.handlePlay,
    );


    this.audio.addEventListener(
      'pause',
      this.handlePause,
    );


    this.audio.addEventListener(
      'ended',
      this.handlePause,
    );
  }


  /* ==========================================================
     EVENT HANDLERS
     ========================================================== */

  // Field arrows preserve the instance's this when invoked by the DOM event
  // system; their stable identity also permits removeEventListener in dispose.
  private handlePlay = () => {

    this._playing = true;

  };


  private handlePause = () => {

    this._playing = false;

  };


  /* ==========================================================
     STATE
     ========================================================== */

  get playing() {

    return this._playing;

  }


  get volume() {

    return this._volume;

  }


  get currentTime() {

    return this.audio.currentTime;

  }


  /* ==========================================================
     PLAY
     ========================================================== */

  // The inferred result is Promise<boolean>: awaiting the media play request
  // lets callers distinguish a successful start from a rejected request.
  async play() {

    try {

      await this.audio.play();

      this._playing = true;

      return true;

    }

    catch (error) {

      console.warn(
        'Comic soundtrack could not start.',
        error,
      );

      this._playing = false;

      return false;

    }
  }


  /* ==========================================================
     PAUSE
     ========================================================== */

  pause() {

    this.audio.pause();

    this._playing = false;

  }


  /* ==========================================================
     TOGGLE
     ========================================================== */

  async toggle() {

    if (this._playing) {

      this.pause();

      return false;

    }


    return this.play();
  }


  /* ==========================================================
     VOLUME

     Expected range:
     0.0 - 1.0
     ========================================================== */

  setVolume(
    value: number,
  ) {

    // Clamp the requested linear media volume into the browser's [0, 1] range.
    // Unlike MusicControls, this independent wrapper does not square the value.
    const volume =
      Math.min(
        1,
        Math.max(
          0,
          value,
        ),
      );


    this._volume =
      volume;


    this.audio.volume =
      volume;
  }


  /* ==========================================================
     RESTART
     ========================================================== */

  restart() {

    this.audio.currentTime = 0;

  }


  /* ==========================================================
     DISPOSE
     ========================================================== */

  dispose() {

    this.audio.pause();


    this.audio.removeEventListener(
      'play',
      this.handlePlay,
    );


    this.audio.removeEventListener(
      'pause',
      this.handlePause,
    );


    this.audio.removeEventListener(
      'ended',
      this.handlePause,
    );


    this.audio.src = '';

    this.audio.load();

  }
}
