# DATIN — Ink & Shadow

**An Interactive 3D Comic Experience Built with React, TypeScript, Three.js, and React Three Fiber**

**Live Demo:** https://datin-noir.vercel.app/

## Project Overview

**DATIN — Ink & Shadow** is an interactive, cinematic comic book that combines traditional comic storytelling with real-time 3D animation.

Built with React Three Fiber (R3F), Drei, Three.js, and GSAP, the application transforms animated 3D characters into stylized, monochromatic comic artwork.

The experience uses a single shared WebGL Canvas with independent Drei Views for each comic panel, allowing multiple scenes to coexist within one continuous reading experience.

### Key Features

- **Interactive 3D Comic Panels:** Individual panels display animated or static 3D scenes.
- **Cinematic Camera Animation:** Blender-authored camera movements are synchronized with character animation.
- **Ink Mode:** Switch between original GLB materials and a stylized black-and-white comic appearance.
- **Scroll-Based Storytelling:** GSAP supports scroll tracking and interactive navigation.
- **Independent Scene Management:** Each panel maintains its own camera, character instance, and animation state.
- **Responsive Comic Layouts:** CSS Grid supports desktop and mobile reading experiences.
- **Animation Playback Controls:** Play, pause, restart, and scrub through animated sequences.
- **Optimized Rendering Architecture:** A shared Canvas reduces the overhead of managing multiple WebGL contexts.

---

## Technology Stack

| Technology | Purpose |
|---|---|
| React | Component-based user interface |
| TypeScript | Type safety and application architecture |
| Vite | Development server and production builds |
| Three.js | 3D rendering and animation |
| React Three Fiber | React integration with Three.js |
| Drei | Scene utilities, Views, and GLTF loading |
| GSAP | Scroll tracking and animation coordination |
| Blender | Character animation, rigging, and cinematic cameras |
| CSS Grid | Responsive comic book layouts |
| Vercel | Production hosting and deployment |

---

## Getting Started

### Prerequisites

- Node.js 22.17 or newer
- npm
- A modern browser with WebGL support

### Installation

Clone the repository and install dependencies.

```bash
npm install
```

Start the development server.

```bash
npm run dev
```

Open the local URL displayed by Vite to explore the interactive comic.

### Production Build

```bash
npm run build
```

This command validates TypeScript and generates the production-ready application in the `dist` directory.

---

## Application Architecture — MVC

The application follows a **Model–View–Controller (MVC)** architecture to separate content, presentation, and application behavior.

### Model — `src/models`

Responsible for defining the comic's data and configuration.

Includes:

- Comic page definitions
- Panel content and identifiers
- GLB asset locations
- Animation clip references
- Camera configurations
- Panel dimensions and responsive layout settings

**Primary configuration:** `src/models/Comic.model.ts`

### View — `src/views`

Responsible for presenting the interactive comic experience.

Includes:

- Shared React Three Fiber Canvas
- Drei Views
- Animated 3D characters
- Comic page and panel components
- HTML overlays and speech balloons
- Responsive page layouts
- Playback controls

### Controller — `src/controllers`

Responsible for coordinating scene behavior and application logic.

Includes:

- Monochrome toon material conversion
- Three.js animation playback and scrubbing
- Character and camera synchronization
- GSAP scroll tracking
- Automatic camera framing
- Playback state management

This separation allows additional comic pages, animation sequences, and camera shots to be introduced without restructuring the rendering system.

---

## Visual Design — Original vs. Ink Mode

The application includes a **VIEW ORIGINAL / INK MODE** toggle that allows readers to compare the original 3D materials against the stylized comic presentation.

### Original Mode

Displays the character using its original GLB materials and textures.

### Ink Mode

Applies a monochromatic toon-shading treatment designed to resemble graphic novel artwork.

The rendering pipeline includes:

- Texture luminance conversion
- Preservation of existing texture maps
- Three-step toon lighting
- Directional key lighting
- Graphic shadow separation
- CSS-based comic borders
- Halftone effects
- Speech balloons

The directional lighting and stepped shading create a dramatic, high-contrast appearance.

Switching between modes does not restart or reset the active animation.

---

## Interactive Comic Page

The current implementation includes a four-panel test page.

The component hierarchy follows:

```text
ComicReader
    |
    +-- ComicPage
          |
          +-- ComicPanel 01
          |     Animated Hero Reach
          |
          +-- ComicPanel 02
          |     Static Datin
          |
          +-- ComicPanel 03
          |     Static Datin
          |
          +-- ComicPanel 04
                Static Datin
```

### Desktop Panel Layout

```text
+----------------------------------+
|                                  |
|       01 — HERO REACH            |
|     Animated Body + Camera       |
|                                  |
+----------------+-----------------+
|                |                 |
|  02 — DATIN    |  03 — DATIN     |
|                |                 |
|  Static Pose   |  Static Pose    |
|                |                 |
+----------------+-----------------+
|                                  |
|          04 — DATIN              |
|          Static Pose             |
|                                  |
+----------------------------------+
```

On mobile devices, the panels stack vertically in their intended reading order.

### Shared Assets and Independent Scenes

All four panels load the same GLB asset:

`public/models/Datin_ComicV2.glb`

The GLTF cache allows the application to reuse the loaded asset while creating independent scene instances.

Each panel maintains:

- Its own cloned character hierarchy
- An independent skeleton
- Its own camera
- Independent scene and animation state

Panels 02–04 restore the character's original **A-shaped bind pose**.

These panels intentionally do not select or advance animation clips. They are static placeholders rather than samples taken from the first frame of Panel 01.

---

## Panel 01 — Hero Reach Animation

Panel 01 demonstrates synchronized character and cinematic camera animation exported from Blender.

### Animation Configuration

| Property | Configuration |
|---|---|
| Panel | P01 — Hero Reach |
| Character Animation | `Body_P01_HeroReach` |
| Camera Animation | `Cam_P01_HeroReach` |
| Camera Object | `Camera` |
| Duration | 3 seconds |
| Playback | Autoplay once when visible |
| Final State | Hold final frame |
| Aspect Ratio | Authored 16:9 artwork |

Both animation clips are coordinated through one panel-local clock and animation mixer.

### Playback Controls

**Play / Pause**

Starts or pauses the synchronized character and camera animations.

**Restart**

Returns both animations to the beginning and restarts playback.

**Shot Time Slider**

Allows the reader to scrub through the animation timeline.

Scrubbing automatically pauses playback. Selecting Play resumes the animation from the selected position.

### Visibility Management

Playback automatically suspends when:

- The panel leaves the viewport.
- The browser tab becomes hidden.

Suspension preserves the current animation position and the reader's playback intent.

When the panel becomes visible again, playback resumes only when appropriate to the saved state.

### Camera Management

The exported Blender camera remains within the cloned scene hierarchy.

For Panel 01:

- The authored camera is used directly.
- The camera is assigned only to its corresponding Drei View.
- Automatic character framing is disabled.
- The original Blender composition is preserved.
- The artwork uses its authored 16:9 framing, with letterboxing when necessary.

Panels 02–04 continue using automatic character framing with fixed camera angles.

**Production note:** Compare Panel 01 against the original Blender camera view before creating additional cinematic shots.

---

## Responsive Page Layout System

Page layouts and panel configurations are defined in:

`src/models/Comic.model.ts`

Each page can specify its own:

- CSS Grid areas
- Column arrangements
- Panel dimensions
- Gutters
- Desktop layouts
- Mobile overrides

The rendering components do not need to be rewritten when introducing new page layouts.

The application retains standard document scrolling and a global Ink Mode toggle.

---

## Testing and Validation

The project includes automated tests for Panel 01's animation and scene management.

### Run Tests

Node.js 22.17 or newer is required because the test runner uses Node's experimental TypeScript transformation.

```bash
npm run test:p01
npm run build
```

### Test Coverage

The test suite covers:

- Character and camera synchronization
- Animation clips with different durations
- Pause and resume behavior
- Reverse scrubbing after reaching the final frame
- Restart functionality
- Playback speed and looping
- Animation cleanup
- Independent cloned skeletons
- Independent camera instances
- Actual P01 GLB asset integration

Headless asset tests intentionally omit image decoding.

Final visual validation should also be performed in a browser to verify camera framing, materials, lighting, and rendering.

---

## GLB Optimization and Asset Management

The project uses GLB assets exported from Blender.

An earlier character model underwent a web-optimization process using glTF Transform.

### Optimization Results

| Metric | Result |
|---|---|
| Original Size | 195,520,308 bytes |
| Optimized Size | 67,961,480 bytes |
| Reduction | 65.24% |
| Maximum Texture Resolution | 2048 px |
| Texture Encoding | Lossless WebP |
| Geometry Compression | Meshopt |
| Meshes Preserved | 19 |
| Materials Preserved | 10 |
| Rig Joints Preserved | 474 |
| Animation Clips Preserved | 2 |

The optimization retains the character's geometry, rig, animation clips, animation samples, and environmental elements.

### Optimization Techniques

**Texture Optimization**

Textures are resized to a maximum dimension of 2048 pixels and encoded using lossless WebP.

Resizing reduces texture resolution, while the lossless WebP encoding introduces no additional image degradation.

**Geometry Compression**

Meshopt compression reduces geometry storage without using lossy quantization or mesh simplification.

**Animation Preservation**

The optimization retains the original animation clips and their samples.

**Environment Preservation**

The dome and floor remain part of the scene.

### Decoder Configuration

`Character.tsx` explicitly enables Drei's bundled Meshopt decoder and disables unused Draco loading.

The `EXT_texture_webp` extension uses native browser WebP decoding.

No additional decoder CDN or WASM download is required for WebP textures.

---

## Asset Versions

### Current Test Asset

```text
public/models/Datin_ComicV2.glb
```

This asset contains the current Hero Reach animation and camera setup.

The new P01 export is approximately 196 MB and has not yet undergone the earlier model's optimization process.

Initial loading may therefore take additional time.

Future optimization must preserve:

- Character animation
- Camera animation
- Camera hierarchy
- Clip timing
- Rig integrity
- Shot composition

### Previous Web Asset

```text
public/models/Datin.web.glb
```

This file is retained as the older optimized asset.

### Original Source Backup

The byte-identical source backup is stored outside the project directory.

```text
C:\Users\nap2k\Documents\datin-noir-source-assets\Datin.original-28f53bc7ab6b.glb
```

SHA-256:

```text
28f53bc7ab6b0faf1e8d1a5f844950b1cea4185564accda3164368d25b0f1074
```

**Important:** Do not place source backups, unused GLB exports, or optimization intermediates inside `public`.

Vite copies public assets into production builds, even when they are not referenced by the application.

---

## Automatic Camera Framing

Static comic panels use automatic camera framing.

The camera controller calculates framing based on the posed character rather than the entire environment.

The model uses the verified coordinate orientation:

- **Up Axis:** +Y
- **Forward Direction:** +Z

The dome and floor remain in the scene but are excluded from the character-fitting calculation.

The dome uses a separate inward-facing material and is not processed through the character's Ink Mode conversion.

Panel 01 bypasses automatic framing to preserve the cinematic camera exported from Blender.

---

## Deployment — Vercel

The application is deployed using Vercel.

**Production URL:** https://datin-noir.vercel.app/

### Deployment Configuration

The `vercel.json` configuration:

1. Selects the Vite framework.
2. Installs dependencies using `npm ci`.
3. Executes `npm run build`.
4. Publishes the generated `dist` directory.

### Deployment Exclusions

`.vercelignore` excludes unnecessary local files from source uploads, including:

- Local build output
- Installed dependencies
- Source models and backups
- Archived assets
- Optimization intermediates

Vercel generates the production `dist` directory remotely.

The locally generated `dist` directory is not uploaded with the project sources.

`.gitignore` also excludes local artifacts that should not be committed to Git.

Deployments should be initiated from the project root.

---

## Development Roadmap

The current four-panel implementation establishes the technical foundation for a larger interactive comic experience.

Planned development areas include:

- Additional comic pages and cinematic sequences
- Expanded character animations
- New Blender-authored camera shots
- Scene-specific lighting and composition
- Additional speech balloons and narrative content
- Improved asset loading performance
- Further GLB optimization
- Expanded interactive storytelling
- Mobile presentation refinements

The long-term objective is to combine the visual language of traditional comics with the cinematic possibilities of real-time 3D animation.

---

## Project Vision

**DATIN — Ink & Shadow** explores a different approach to digital comic storytelling.

Instead of relying entirely on static illustrations, the project incorporates animated 3D performances, cinematic camera movements, stylized lighting, and interactive playback into a comic book format.

By combining Blender's animation pipeline with React Three Fiber and modern web technologies, the project aims to create a reading experience that feels like a graphic novel brought to life.

**Built with React, TypeScript, Three.js, React Three Fiber, Drei, GSAP, and Blender.**
