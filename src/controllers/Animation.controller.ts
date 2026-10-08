/**
 * MVC-inspired animation controller shared by Character, scroll wiring and UI.
 * Three.js supplies clips (keyframe data), actions (playback state), and a mixer
 * bound to a specific Object3D root. No React hooks are required by this class.
 * Concepts: encapsulated state, typed subscriptions, absolute time in seconds,
 * reversible seeking, and releasing mixer bindings during cleanup.
 * https://threejs.org/docs/pages/AnimationMixer.html
 * https://threejs.org/docs/pages/AnimationClip.html
 * https://threejs.org/docs/pages/AnimationAction.html
 * https://www.typescriptlang.org/docs/handbook/2/classes.html
 * https://react.dev/reference/react/useSyncExternalStore
 */

import * as THREE from 'three';

/* ============================================================
   DATIN — ANIMATION CONTROLLER
   ============================================================ */

export interface PlaybackSnapshot {
  time: number;
  duration: number;
  playing: boolean;
}

export interface PlaybackOptions {
  loop?: boolean;
  speed?: number;

  /**
   * Optional shared timeline duration.
   *
   * Useful when the Blender camera animation
   * is longer than the body animation.
   */
  duration?: number;
}

/* ============================================================
   ANIMATION CONTROLLER
   ============================================================ */

export class AnimationController {

  private mixer:
    | THREE.AnimationMixer
    | null = null;

  private actions:
    THREE.AnimationAction[] = [];

  private snapshot:
    PlaybackSnapshot = {
      time: 0,
      duration: 0,
      playing: false,
    };

  private listeners =
    new Set<() => void>();

  private loop = false;

  private speed = 1;

  private clipDuration = 0;

  readonly clipNames: string[];

  constructor(
    private root: THREE.Object3D,
    private clips: THREE.AnimationClip[],
  ) {
    this.clipNames =
      clips.map(clip => clip.name);
  }

  /* ==========================================================
     EXTERNAL STORE
     ========================================================== */

  // Arrow-function fields keep this bound when React calls them as callbacks.
  // The same snapshot object is returned until publish observes a real change.
  getSnapshot = () =>
    this.snapshot;

  // Set<() => void> describes zero-argument listeners, not stored snapshots.
  // Returning an unsubscribe function lets useSyncExternalStore clean up.
  subscribe = (
    listener: () => void,
  ) => {

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(
    next: PlaybackSnapshot,
  ) {

    if (
      next.time === this.snapshot.time &&
      next.duration === this.snapshot.duration &&
      next.playing === this.snapshot.playing
    ) {
      return;
    }

    this.snapshot = next;

    this.listeners.forEach(
      listener => listener(),
    );
  }

  /* ==========================================================
     ACTION SELECTION
     ========================================================== */

  selectByName(
    name: string,
    options: PlaybackOptions = {},
  ): boolean {

    return this.selectByNames(
      [name],
      options,
    );
  }

  select(index: number): void {

    const clip = this.clips[index];

    if (!clip) {
      return;
    }

    this.selectByName(clip.name);
  }

  /**
   * Select one or more Blender Actions.
   *
   * All selected clips use:
   *
   * - One AnimationMixer
   * - One target scene
   * - One shared animation clock
   *
   * Actions must not contain overlapping tracks.
   */
  selectByNames(
    names: string[],
    options: PlaybackOptions = {},
  ): boolean {

    this.dispose();

    const selected:
      THREE.AnimationClip[] = [];

    const bindings =
      new Set<string>();

    /* --------------------------------------------------------
       FIND REQUESTED CLIPS
       -------------------------------------------------------- */

    for (const name of new Set(names)) {

      const clip =
        this.clips.find(
          candidate =>
            candidate.name === name,
        );

      if (!clip) {

        console.warn(
          `[DATIN ANIMATION] Missing clip: ${name}`,
          this.clipNames,
        );

        return false;
      }

      /* ------------------------------------------------------
         PREVENT OVERLAPPING TRACKS
         ------------------------------------------------------ */

      // Two actions writing the same named property would compete in the mixer.
      // This controller rejects that selection instead of blending implicitly.
      for (const track of clip.tracks) {

        if (bindings.has(track.name)) {

          console.warn(
            '[DATIN ANIMATION] Overlapping track:',
            track.name,
          );

          return false;
        }

        bindings.add(track.name);
      }

      selected.push(clip);
    }

    if (selected.length === 0) {
      return false;
    }

    /* ========================================================
       PLAYBACK SETTINGS
       ======================================================== */

    this.loop =
      options.loop ?? false;

    this.speed =
      Number.isFinite(options.speed)
        ? Math.max(
            0,
            options.speed!,
          )
        : 1;

    /* ========================================================
       CREATE MIXER
       ======================================================== */

    this.mixer =
      new THREE.AnimationMixer(
        this.root,
      );

    this.actions =
      selected.map(clip => {

        const action =
          this.mixer!.clipAction(clip);

        action.setLoop(
          THREE.LoopOnce,
          1,
        );

        action.clampWhenFinished = true;

        action.enabled = true;

        action.setEffectiveWeight(1);

        action.setEffectiveTimeScale(1);

        action.play();

        return action;
      });

    /* ========================================================
       DETERMINE DURATION
       ======================================================== */

    this.clipDuration =
      Math.max(
        ...selected.map(
          clip => clip.duration,
        ),
      );

    // A longer master timeline holds shorter LoopOnce clips at their final pose;
    // it does not stretch their keyframes to a different playback speed.
    const requestedDuration =
      options.duration;

    const duration =
      requestedDuration !== undefined &&
      Number.isFinite(requestedDuration)
        ? Math.max(
            this.clipDuration,
            requestedDuration,
          )
        : this.clipDuration;

    this.publish({
      time: 0,
      duration,
      playing: false,
    });

    /* --------------------------------------------------------
       INITIALIZE FIRST FRAME
       -------------------------------------------------------- */

    this.setTime(0);

    console.log(
      '[DATIN ANIMATION] Selected:',
      selected.map(clip => ({
        name: clip.name,
        duration: clip.duration,
      })),
    );

    return true;
  }

  /* ============================================================
     MASTER TIMELINE DURATION
     ============================================================ */

  /**
   * Extend the playback timeline to include
   * longer camera or environmental animations.
   *
   * Example:
   *
   * Body:   12 seconds
   * Camera: 15.83 seconds
   *
   * Master: 15.83 seconds
   */
  setDuration(
    duration: number,
  ): void {

    if (
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      return;
    }

    const nextDuration =
      Math.max(
        this.clipDuration,
        duration,
      );

    this.publish({
      ...this.snapshot,
      duration: nextDuration,
    });
  }

  /* ============================================================
     TIME / GSAP SCROLL SCRUBBING
     ============================================================ */

  /**
   * GSAP supplies normalized progress:
   *
   * 0 = beginning
   * 1 = end
   *
   * Scroll down:
   * Progress increases.
   *
   * Scroll up:
   * Progress decreases.
   *
   * This function does not start autoplay.
   */
  setProgress(
    progress: number,
  ): void {

    if (!Number.isFinite(progress)) {
      return;
    }

    const normalized =
      THREE.MathUtils.clamp(
        progress,
        0,
        1,
      );

    this.setTime(
      normalized *
      this.snapshot.duration,
    );
  }

  /**
   * Set the exact animation time.
   *
   * Unlike ordinary autoplay, this supports
   * arbitrary forward and backward seeking.
   *
   * GSAP ScrollTrigger will call this method
   * as the user scrolls through each panel.
   */
  setTime(
    time: number,
  ): void {

    if (
      !this.mixer ||
      !Number.isFinite(time)
    ) {
      return;
    }

    const sampled =
      THREE.MathUtils.clamp(
        time,
        0,
        this.snapshot.duration,
      );

    /**
     * Re-enable actions before seeking.
     *
     * This matters when a LoopOnce animation
     * previously reached its final frame.
     *
     * reset() is intentionally avoided here
     * so that we do not rebuild the action
     * state on every scroll update.
     */
    for (const action of this.actions) {

      action.enabled = true;

      action.paused = false;

      action.setEffectiveWeight(1);

      action.setEffectiveTimeScale(1);
    }

    /**
     * Absolute-time sampling.
     *
     * A backwards scroll can move directly
     * from frame 380 to frame 100.
     */
    // This is an absolute sample, not a delta: scrolling backward needs no
    // negative-speed playback and can return to any previously sampled pose.
    this.mixer.setTime(sampled);

    this.root.updateMatrixWorld(true);

    this.publish({
      ...this.snapshot,
      time: sampled,
    });
  }

  /* ============================================================
     PLAYBACK
     ============================================================ */

  play(): void {

    if (
      !this.mixer ||
      this.snapshot.duration <= 0
    ) {
      return;
    }

    if (
      this.snapshot.time >=
      this.snapshot.duration
    ) {
      this.setTime(0);
    }

    this.publish({
      ...this.snapshot,
      playing: true,
    });
  }

  pause(): void {

    this.publish({
      ...this.snapshot,
      playing: false,
    });
  }

  restart(): void {

    this.setTime(0);

    this.play();
  }

  /* ============================================================
     FRAME ADVANCEMENT
     ============================================================ */

  /**
   * Used for autoplay panels only.
   *
   * Scroll-controlled panels remain paused
   * and receive time from GSAP instead.
   */
  advance(
    delta: number,
  ): void {

    if (
      !this.snapshot.playing ||
      !Number.isFinite(delta) ||
      delta <= 0
    ) {
      return;
    }

    const duration =
      this.snapshot.duration;

    if (duration <= 0) {
      return;
    }

    const nextTime =
      this.snapshot.time +
      delta * this.speed;

    if (this.loop) {

      this.setTime(
        nextTime % duration,
      );

      return;
    }

    if (nextTime >= duration) {

      this.setTime(duration);

      this.pause();

      return;
    }

    this.setTime(nextTime);
  }

  /* ============================================================
     CLEANUP
     ============================================================ */

  dispose(): void {

    if (this.mixer) {

      this.mixer.stopAllAction();

      // Release animation bindings only; cached GLB geometry/textures are owned
      // elsewhere and must not be disposed by an animation controller.
      this.mixer.uncacheRoot(
        this.root,
      );

      this.mixer = null;
    }

    this.actions = [];

    this.clipDuration = 0;

    this.publish({
      time: 0,
      duration: 0,
      playing: false,
    });
  }
}
