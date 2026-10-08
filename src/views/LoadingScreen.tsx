/**
 * Loading-stage DOM overlay in the MVC-inspired view layer.
 * LoadingCanvas renders the record player; its needle callback is forwarded to
 * ComicReader. React useEffect logs mounting. The parent controls when this
 * screen ends, so the loading label is not a measured asset-progress indicator.
 * Concepts: typed function props, event forwarding, effects and accessible status.
 * https://react.dev/reference/react/useEffect
 * https://www.typescriptlang.org/docs/handbook/2/functions.html
 * https://www.typescriptlang.org/docs/handbook/jsx.html
 */
import {
  useEffect,
} from 'react';

import {
  LoadingCanvas,
} from './LoadingCanvas';


type LoadingScreenProps = {
  // Required at this boundary: ComicReader supplies the vinyl playback callback.
  onNeedleTouch: () => void;
};


export function LoadingScreen({
  onNeedleTouch,
}: LoadingScreenProps) {

  useEffect(
    () => {

      console.log(
        '[DATIN LOADING] LoadingScreen mounted',
      );

    },
    [],
  );


  // The status region announces loading text politely. Its canvas and DOM overlay
  // are siblings in the view, with the callback passed downward as a prop.
  return (

    <main
      className="loading-screen"
      role="status"
      aria-live="polite"
      aria-label="Loading comic"
    >

      <LoadingCanvas
        onNeedleTouch={() => {

          console.log(
            '[DATIN AUDIO] LoadingScreen received needle touch.',
          );

          onNeedleTouch();

        }}
      />


      <div
        className="loading-overlay"
      >

        <div
          className="loading-brand"
        >
          DATIN
          <span className="red">
            .
          </span>
        </div>


        <div
          className="loading-status"
        >
          LOADING COMIC
        </div>


        <div
          className="loading-dots"
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </div>

      </div>

    </main>

  );

}
