/**
 * Timed-shot playback UI in DATIN's MVC-inspired view layer.
 * ComicPanel supplies an AnimationController; React's useSyncExternalStore
 * subscribes to that external clock. The type-only controller import adds no
 * runtime dependency here. Buttons/slider issue commands without owning time.
 * Concepts: external snapshots, typed props, controlled inputs and derived state.
 * https://react.dev/reference/react/useSyncExternalStore
 * https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
 */
import { useSyncExternalStore } from 'react';
import type { AnimationController } from '../controllers/Animation.controller';

export function PlaybackControls({ controller, active, label }: {
  controller: AnimationController;
  active: boolean;
  label: string;
}) {
  // React subscribes/unsubscribes through the controller contract. Stable snapshot
  // identity between changes avoids reporting a different value on every read.
  const { time, duration, playing } = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const ended = duration > 0 && time >= duration;
  return (
    <div className="playback-controls" role="group" aria-label={`${label} playback`}>
      <div className="playback-buttons">
        <button type="button" disabled={duration <= 0} onClick={() => playing ? controller.pause() : controller.play()}>
          {playing ? 'Pause' : ended ? 'Replay' : 'Play'}
        </button>
        <button type="button" disabled={duration <= 0} onClick={() => controller.restart()}>Restart</button>
        <span>{playing ? active ? 'Playing' : 'Paused offscreen' : ended ? 'Finished' : 'Paused'}</span>
      </div>
      <label className="playback-timeline">
        <span>Shot time</span>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.001}
          value={time}
          disabled={duration <= 0}
          aria-label={`${label} shot time`}
          aria-valuetext={`${time.toFixed(2)} of ${duration.toFixed(2)} seconds`}
          onChange={event => {
            // Manual seeking pauses timed playback before sampling absolute seconds;
            // Character's decorated setter also updates that shot's camera/props.
            controller.pause();
            controller.setTime(Number(event.target.value));
          }}
        />
        <output>{time.toFixed(2)} / {duration.toFixed(2)}s</output>
      </label>
    </div>
  );
}
