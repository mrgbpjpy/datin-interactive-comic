/**
 * DOM-only entry screen in DATIN's MVC-inspired view layer.
 * ComicReader passes onEnter to begin its staged loading/audio sequence. There
 * are no explicit imports; the configured React JSX transform supplies rendering
 * support. This view does not own the experience stage or an animation clock.
 * Concepts: interface-based props, callback injection, and declarative JSX.
 * https://www.typescriptlang.org/docs/handbook/jsx.html
 * https://www.typescriptlang.org/docs/handbook/2/functions.html
 */
interface IntroScreenProps {
  // The parent supplies the action; this function type says the child neither
  // passes arguments nor consumes a result when the button invokes it.
  onEnter: () => void;
}


export function IntroScreen({
  onEnter,
}: IntroScreenProps) {

  return (

    <main
      className="intro-screen"
    >

      <div
        className="intro-content"
      >

        <div
          className="intro-kicker"
        >
          EWENZ ORIGINALS PRESENTS
        </div>


        <h1
          className="intro-title"
        >

          DATIN

          <span
            className="red"
          >
            .
          </span>

        </h1>


        <div
          className="intro-subtitle"
        >
          AN INTERACTIVE GRAPHIC NOVEL
        </div>


        <button
          type="button"
          className="intro-enter"
          onClick={
            onEnter
          }
        >
          ENTER COMIC
        </button>


        <div
          className="intro-sound"
        >
          ♪ BEST EXPERIENCED WITH SOUND
        </div>

      </div>

    </main>

  );
}
