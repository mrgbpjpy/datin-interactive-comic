# DATIN — Ink & Shadow

Interactive React Three Fiber comic with one shared Canvas and a separate Drei View for each scene.

## Run

```bash
npm install
npm run dev
```

Open the local Vite URL and scroll. `npm run build` checks TypeScript and creates a production bundle.

## MVC

- `src/models`: panel content and GLB location.
- `src/controllers`: monochrome toon material conversion, Three.js clip scrubbing, and GSAP scroll tracking.
- `src/views`: the shared Canvas, loaded character, and HTML comic panels.

The **VIEW ORIGINAL / INK MODE** button compares the GLB materials with the comic treatment. Existing texture maps are retained and converted to luminance by the toon shader. The directional key light and three-step lighting ramp create graphic shadows. The CSS supplies borders, halftone and speech balloons.

## Four-panel test page

The reader now renders one test page using `ComicReader → ComicPage → ComicPanel`:

```text
+---------------------------+
| 01 — HERO REACH            |
| Animated body + camera     |
+-------------+-------------+
| 02 — DATIN  | 03 — DATIN  |
| Static     | Static      |
+-------------+-------------+
| 04 — DATIN                 |
| Static                    |
+---------------------------+
```

All four panels share `public/models/Datin_ComicV2.glb` through the GLTF cache, but own separate cloned skeletons/scenes and cameras. Panels 02–04 explicitly restore the rig's **A-shaped bind pose** and do not select or advance animation clips. They are test placeholders, not frame-zero samples of the Hero Reach shot.

Panel 01 plays:

- Body: `Body_P01_HeroReach`.
- Camera: the exported `Camera` object, animated by `Cam_P01_HeroReach`.
- Duration: 3 seconds; both clips share one panel-local clock and mixer.
- Framing: the authored 16:9 artwork rectangle, letterboxed if a future panel has a different aspect ratio.

The shot autoplays once when visible and holds its final frame. **Play/Pause**, **Restart**, and the **Shot time** slider control both body and camera together. Scrubbing pauses playback; Play resumes it. Leaving the viewport or hiding the tab suspends advancement without changing the saved position or the user's play/pause intent. Switching ink mode does not restart the shot.

The Blender camera stays inside the panel's cloned hierarchy and is installed only in that View's camera state. Automatic framing is bypassed for P01. The three static panels use the existing automatic Datin framing with fixed camera angles.

Page layouts and panel settings live in `src/models/Comic.model.ts`. The desktop layout uses a wide top panel, two square middle panels, and a wide bottom panel; mobile stacks them in reading order. Pages can define their own CSS Grid areas, columns, gutters, and mobile overrides without changing the renderer. Normal document-scroll navigation and the global ink toggle are retained. Compare P01 with the Blender camera view before producing more shots.

### Playback tests

Using Node 22.17+ (the runner uses Node's experimental TypeScript transform):

```bash
npm run test:p01
npm run build
```

Tests cover synchronization with different clip lengths, pause/resume, reverse scrubbing after the last frame, restart, looping/speed, cleanup, and isolated cloned cameras/skeletons using the actual P01 GLB. Headless asset tests omit image decoding; visual rendering should also be checked in a browser.

## Model and deployment

The older model was **195,520,308 bytes**. glTF Transform reduced it to
**67,961,480 bytes** (65.24% smaller): textures are capped at 2048 pixels and
encoded as lossless WebP; geometry uses Meshopt compression without lossy
quantization or mesh simplification. All 19 meshes, 10 materials, 474 rig joints,
both animation clips and their samples, and the dome/floor are preserved.
Texture resizing reduces resolution; lossless encoding adds no further image loss.

`Character.tsx` explicitly enables Drei's bundled Meshopt decoder and disables
unused Draco loading. `EXT_texture_webp` uses native browser WebP decoding;
no external decoder CDN or WASM download is required.

The byte-identical source backup is outside the project at:

```text
C:\Users\nap2k\Documents\datin-noir-source-assets\Datin.original-28f53bc7ab6b.glb
SHA-256: 28f53bc7ab6b0faf1e8d1a5f844950b1cea4185564accda3164368d25b0f1074
```

Do not copy that backup into `public`: Vite copies public assets into every build.
The test page loads `Datin_ComicV2.glb`; `Datin.web.glb` is retained as the older
asset. The new P01 export is approximately 196 MB and has not yet received the older model's
web-optimization pass. Initial loading can take time. Preserve its animation,
camera, and shot timing when optimizing it. Keep unused exports and optimization
intermediates outside `public`.

Deploy from this project root. `vercel.json` selects Vite, runs `npm ci` and
`npm run build`, and serves `dist`. `.vercelignore` excludes local build output,
installed dependencies, source models, backups, and archives from source uploads.
Vercel generates `dist` remotely; its locally generated copy is not uploaded with
the sources. `.gitignore` also excludes those local artifacts for Git deployments.

In automatic camera mode, the controller fits the posed character only, using the verified Y-up,
+Z-facing orientation. The dome and floor remain in the scene, and the dome uses
an inward-facing material separate from the character's ink conversion.
