# DATIN student code guide

This guide describes the existing implementation. The accompanying source edits
add or clarify comments only. DATIN is **MVC-inspired**: models describe data,
controllers contain imperative operations, and React views compose the experience.
React components also manage state and lifecycle; this is not traditional MVC.

## Source inventory

All 23 `.ts` and `.tsx` files under `src/` are documented.

| File (relative to `src/`) | Responsibility and connections |
| --- | --- |
| `main.tsx` | Mounts `ComicReader` through React DOM with development StrictMode checks. |
| `models/Comic.model.ts` | Defines typed pages, layout, asset URLs, requested clip names and playback modes. Exports weighted-progress helpers not used by current scroll wiring. |
| `controllers/Animation.controller.ts` | Owns a root-bound mixer, action selection, absolute seeking, playback snapshots and subscriptions. Used by `Character`, scroll wiring and playback UI. |
| `controllers/Audio.controller.ts` | Standalone browser-audio wrapper; currently not instantiated by the views. |
| `controllers/Camera.controller.ts` | Classifies character meshes and calculates bounds-based automatic camera framing. Exported-camera panels use a different path. |
| `controllers/Environment.controller.ts` | Reversibly adjusts character-clone visibility, shadow flags and enclosing-sphere materials. |
| `controllers/Noir.controller.ts` | Replaces mesh materials with grayscale toon shading and returns restoration/disposal logic. |
| `controllers/Scroll.controller.ts` | Maps DOM scroll ranges to panel progress and animation time through independent ScrollTriggers. |
| `views/Character.tsx` | Loads and clones character/shot assets, configures controllers and materials, and renders both scene roots. |
| `views/ComicCanvas.tsx` | Supplies the comic-stage shared WebGL Canvas, clearing pass and Drei `View.Port`. |
| `views/ComicPage.tsx` | Builds page grids, collects panel-controller registrations and connects ready scroll panels. |
| `views/ComicPanel.tsx` | Builds panel DOM and a Drei View, manages visibility/readiness, registers its controller and displays timed controls. |
| `views/ComicReader.tsx` | Coordinates front/loading/comic stages, audio lifetimes, noir mode, pages and the shared comic Canvas. |
| `views/ComicScene.tsx` | Composes lighting, Character, per-view cameras, timed playback, error handling and WebGL dialogue. |
| `views/IntroCanvas.tsx` | Empty implementation placeholder; now contains a documentation header only. |
| `views/IntroScene.tsx` | Empty implementation placeholder; now contains a documentation header only. |
| `views/IntroScreen.tsx` | DOM entry screen that invokes the parent's `onEnter` callback. |
| `views/LoadingCanvas.tsx` | Separate loading-stage Canvas with lights, camera, Suspense and RecordPlayerScene. |
| `views/LoadingScreen.tsx` | Loading DOM overlay that forwards the record-player callback to ComicReader. |
| `views/MusicControls.tsx` | Controls the soundtrack element supplied by ComicReader; synchronizes play/mute UI with media events. |
| `views/PlaybackControls.tsx` | Subscribes to the animation controller and exposes timed-shot playback and seeking controls. |
| `views/RecordPlayerScene.tsx` | Loads the record-player asset, runs its own mixer and fires a configured needle-time callback. |
| `views/SpeechBubble.tsx` | Reusable Drei Html dialogue helper; the current ComicScene instead uses its own WebGL CanvasSpeechBubble. |

## Follow the data and rendering pipeline

### 1. Entry and loading stages

`main.tsx` mounts `ComicReader`. Its stage union allows `front`, `loading` and
`comic`. The entry button calls the parent's start handler. That handler attempts
to unlock browser audio during the user interaction, switches to loading, and
sets a **25-second timer**. This timer is not a download-progress calculation.

The loading stage mounts `LoadingCanvas` and `RecordPlayerScene`. The latter
requests `CoverAction`, `NeedleAction` and `RecordAction` by name. Missing clips
are logged and skipped. The record action is configured to repeat, while other
selected actions play once and hold their final frame.

R3F's `useFrame` supplies elapsed seconds to `mixer.update(delta)`. When the
needle action reaches the configured `135 / 24 = 5.625` seconds threshold, a ref
prevents repeated callbacks. The callback travels to ComicReader, which plays
the vinyl audio. This is a configured cue, not collision detection or verification
of Blender's displayed frame numbering.

### 2. Models describe panels; views compose them

`Comic.model.ts` contains data rather than loading/rendering code. Its
discriminated unions distinguish automatic/exported cameras and static/timed/scroll
playback. A consumer checks `mode` or `playback` before using branch-specific
properties. Type annotations disappear at runtime; they do not inspect GLB files.

`ComicReader` passes page definitions into `ComicPage`, which renders `ComicPanel`
instances in a grid. Each panel supplies a DOM tracking rectangle and a Drei
`View`. During the comic stage these Views share `ComicCanvas` and its renderer;
the earlier loading stage has its own Canvas.

### 3. GLB assets become Three.js scene graphs

`Character` calls Drei `useGLTF`, a convenience hook built on loading infrastructure
using `GLTFLoader`. Loaded scenes and clips are cached. The character asset supplies
visible skinned Datin geometry; the panel's shot asset supplies requested animation
clips, a camera, environment and props.

`SkeletonUtils.clone` creates panel-local object/bone hierarchies while reusing
geometry and materials by reference. A separate effect isolates material objects.
This distinction matters: a new scene root does not imply new copies of every
GPU resource.

The shot's duplicate skinned meshes are hidden, with protection for the microphone
assembly and its ancestors. The hierarchy remains available for animation binding.
Both the character and shot roots are mounted through R3F `primitive` elements.
Three.js applies parent transforms to descendants to produce `matrixWorld`.

### 4. One master time drives each comic shot

An `AnimationClip` stores tracks; an `AnimationAction` holds playback settings;
an `AnimationMixer` binds those tracks to a root and samples them over time.
Names requested by the model are checked against loaded clips at runtime.

`Character` creates a body controller on the visible character root and additional
controllers for selected clips on the shot root. It rejects overlapping shot
track names. The longest selected clip determines the master duration. Shorter
clips hold at their end rather than being stretched to the master duration.

The body controller's `setTime` is decorated to send its sampled seconds to the
shot controllers, then update both hierarchies. Thus body, camera and props use
the same time source even though their mixers have different roots.

For P04, the configuration requests `Body_P01_HeroReach` on both roots and
`Microphone_Action` on the shot root. This also animates the shot hand hierarchy
used by the microphone, while duplicate shot character geometry remains hidden.

### 5. Autoplay and scrolling have different owners

- **P01:** autoplay. `ShotPlayback` advances the controller with frame delta while
  active. It skips the first resumed frame to avoid applying a stale large delta.
- **P02/P03/P04:** scroll-controlled. ComicPage registers these panels and connects
  ScrollTriggers only after all their controllers are ready.
- **Manual timed controls:** `PlaybackControls` observes snapshots through
  `useSyncExternalStore`; slider interaction pauses and seeks the master clock.

ScrollTrigger progress is normalized to `[0, 1]`. `setProgress` maps this fraction
to seconds; `setTime` performs an absolute sample. Re-enabling clamped actions
allows backward seeking after the final frame.

Despite the name `connectSequentialPageScroll`, current scroll behavior uses
independent DOM-based ranges, not the weighted helper ranges in the model. Panels
on the same grid row may share ranges. Normal endpoints are clamped to maximum
document scroll; unusually short elements use a relative minimum range instead.

### 6. Cameras, noir shading and cleanup

`ComicScene` installs the exported camera into its View's R3F store, preserving
the camera's place in the animated shot hierarchy. Automatic camera mode instead
uses measured character bounds and perspective math in `CameraController`.

Noir mode constructs a three-texel gradient texture and toon materials, preserving
selected source maps and opacity settings. A WebGL shader hook converts sampled
color to grayscale. Cleanup restores previous materials and disposes owned
materials/gradient textures, not shared GLB texture maps.

Effects also return cleanup for DOM listeners, timers, animation bindings and
ScrollTriggers. StrictMode can exercise setup/cleanup again during development.
Refs retain mutable imperative handles; state changes notify React when the UI
needs to render.

## Glossary

| Term | Meaning in this project |
| --- | --- |
| Interface / type alias | Compile-time descriptions of data and component contracts. |
| Discriminated union | Alternatives selected by a literal field such as `playback` or `mode`. |
| Generic | A type parameter that specializes a container, e.g. `Map<string, ComicPanelRegistration>`. |
| Nullability | An explicit absent/not-ready state, checked before using a controller or camera. |
| Ref | Persistent mutable storage whose changes do not themselves trigger React rendering. |
| Effect | React lifecycle integration for subscriptions and imperative resources, with cleanup. |
| Memoization | Reusing a calculated object/value while its dependencies stay the same. |
| Scene graph | Parent/child Object3D hierarchy carrying transforms and renderable objects. |
| Skinned mesh | Geometry deformed by a skeleton's bones. |
| Local / world space | Coordinates relative to a parent / after the ancestor transforms are applied. |
| GLB | Binary glTF asset containing scene data and potentially geometry, materials and animation. |
| Clip / action / mixer | Animation data / playback instance / root-bound animation evaluator. |
| Normalized progress | A fraction from 0 to 1, converted to time using a duration. |
| View / scissor | A panel's rendering portal / rectangular restriction on the shared drawing surface. |
| FOV | Field of view; determines visible extent at a given camera distance. |
| Disposal | Explicit release of an owned resource; ownership determines what may be released. |

## Verified official documentation index

All 34 links below were checked live during this documentation pass and returned
their expected documentation pages. Three.js links use current direct API pages.
These sites track their current documentation; installed dependency versions are
recorded in the project's package files.

### React Three Fiber

- [Canvas and renderer configuration](https://r3f.docs.pmnd.rs/api/canvas)
- [Hooks, frame priorities and loading](https://r3f.docs.pmnd.rs/api/hooks)
- [Objects, properties, primitives and disposal](https://r3f.docs.pmnd.rs/api/objects)

### TypeScript

- [Everyday types, interfaces, optional values and null assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [Narrowing and discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Classes](https://www.typescriptlang.org/docs/handbook/2/classes.html)
- [Function types and callbacks](https://www.typescriptlang.org/docs/handbook/2/functions.html)
- [JSX](https://www.typescriptlang.org/docs/handbook/jsx.html)

### Three.js

- [Object3D](https://threejs.org/docs/pages/Object3D.html)
- [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [SkeletonUtils](https://threejs.org/docs/pages/module-SkeletonUtils.html)
- [AnimationClip](https://threejs.org/docs/pages/AnimationClip.html)
- [AnimationAction](https://threejs.org/docs/pages/AnimationAction.html)
- [AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html)
- [PerspectiveCamera](https://threejs.org/docs/pages/PerspectiveCamera.html)
- [Box3](https://threejs.org/docs/pages/Box3.html)
- [Material](https://threejs.org/docs/pages/Material.html)
- [MeshToonMaterial](https://threejs.org/docs/pages/MeshToonMaterial.html)
- [DataTexture](https://threejs.org/docs/pages/DataTexture.html)
- [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)

### React, Drei and GSAP

- [React DOM createRoot](https://react.dev/reference/react-dom/client/createRoot)
- [StrictMode](https://react.dev/reference/react/StrictMode)
- [useEffect](https://react.dev/reference/react/useEffect)
- [useRef](https://react.dev/reference/react/useRef)
- [useMemo](https://react.dev/reference/react/useMemo)
- [useState](https://react.dev/reference/react/useState)
- [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- [Suspense](https://react.dev/reference/react/Suspense)
- [Component and error boundaries](https://react.dev/reference/react/Component)
- [Drei View](https://drei.docs.pmnd.rs/portals/view)
- [Drei useGLTF](https://drei.docs.pmnd.rs/loaders/gltf-use-gltf)
- [Drei Html](https://drei.docs.pmnd.rs/misc/html)
- [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)

## Corrections to existing comments

- **Scroll.controller:** replaced stale P02-autoplay/P04-future descriptions;
  clarified per-panel start/end semantics, the minimum-range fallback, and that
  the single-panel connector is not the current page wiring.
- **ComicPanel:** corrected P02 to scroll and described the page-managed scroll
  connection instead of implying a single page timeline.
- **Camera.controller:** described the implemented Y-up/+Z convention rather than
  presenting a historical export-verification claim as a fresh inspection.
- **Character:** clarified material isolation as effect setup with restoration,
  accounting for repeated StrictMode setup rather than saying it runs only once.
- **MusicControls:** corrected the single-audio-element claim: ComicReader owns
  a soundtrack element and a separate vinyl element.
- **LoadingCanvas / RecordPlayerScene:** clarified the configured action-time cue
  and replaced the obsolete statement that its audio callback would be connected
  in the future; the current component chain already connects it.

The two placeholder files have no executable API usage to explain; their headers
say so and cite JSX language background only. Exported helpers without current
callers are identified explicitly. There are no unverified documentation links.

## Verification approach

Before editing, exact originals of all 23 source files were saved outside the
project. A TypeScript-parser-based comparison checks every non-comment token,
including JSX and template-literal text. A second check compares transpiled
JavaScript with comments removed. These checks detect changes to imports, types,
expressions, strings and JSX as well as executable output.

Recorded project commands: `npm run build` runs `tsc -b && vite build`;
`npm run test:p01` is the existing animation suite. Direct type validation uses
`npx tsc --noEmit`. No new dependencies or test files are needed for this pass.

### Results of this documentation pass

- **Passed:** all 23 files retain identical non-comment tokens and identical
  comment-free transpiled JavaScript relative to the saved originals.
- **Passed:** `npx tsc --noEmit`.
- **Passed:** `npm run build`. Vite still reports its existing large-chunk warning.
- **Passed:** all 34 documentation URLs resolve to the expected official pages.
- The animation test suite was not rerun for comment-only changes. Its previously
  observed legacy V2-camera FOV assertion failure is separate from this pass.
