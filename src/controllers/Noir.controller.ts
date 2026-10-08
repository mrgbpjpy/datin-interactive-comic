/**
 * MVC-inspired rendering controller called by Character's noir-mode effect.
 * Three.js supplies toon materials and a tiny data texture; no React state is
 * stored here. The returned cleanup restores materials when the effect ends.
 * Concepts: typed resource inventories, luminance, nearest-filtered gradients,
 * shader customization, shared textures, and explicit GPU-resource disposal.
 * https://threejs.org/docs/pages/MeshToonMaterial.html
 * https://threejs.org/docs/pages/DataTexture.html
 * https://threejs.org/docs/pages/Material.html
 * https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
 */

import * as THREE from 'three';

/* ============================================================
   DATIN — NOIR MATERIAL CONTROLLER
   ============================================================ */

/**
 * Applies black-and-white toon shading to every mesh
 * in the supplied scene.
 *
 * Supports:
 * - Datin character geometry
 * - Recording studio geometry
 * - Furniture and props
 * - Textured materials
 * - Multiple materials per mesh
 * - Skinned meshes
 *
 * Original materials are restored during cleanup.
 */

export function makeNoirMaterials(
  root: THREE.Object3D,
): () => void {

  const replacements: Array<{
    mesh: THREE.Mesh;
    original:
      | THREE.Material
      | THREE.Material[];
  }> = [];

  const created:
    THREE.Material[] = [];

  /* ==========================================================
     THREE-TONE NOIR GRADIENT
     ========================================================== */

  // Three RGBA texels define discrete lighting bands. Nearest filtering avoids
  // blending adjacent bands into a smooth gradient; needsUpdate uploads the data.
  const ramp = new THREE.DataTexture(
    new Uint8Array([
      12, 12, 12, 255,
      115, 115, 115, 255,
      252, 252, 252, 255,
    ]),
    3,
    1,
    THREE.RGBAFormat,
  );

  ramp.minFilter =
    THREE.NearestFilter;

  ramp.magFilter =
    THREE.NearestFilter;

  ramp.generateMipmaps = false;

  ramp.needsUpdate = true;

  /* ==========================================================
     MATERIAL CONVERSION
     ========================================================== */

  const convertMaterial = (
    material: THREE.Material,
  ): THREE.Material => {

    // This assertion guides TypeScript; it does not convert the source at runtime.
    // Property fallbacks below accommodate materials lacking standard-map fields.
    const source =
      material as THREE.MeshStandardMaterial;

    const color =
      source.color instanceof THREE.Color
        ? source.color
        : new THREE.Color('#ffffff');

    // Weighted RGB luminance estimates brightness; the 0.48 floor below prevents
    // dark base colors from becoming uniformly black in the toon conversion.
    const luminance =
      color.r * 0.2126 +
      color.g * 0.7152 +
      color.b * 0.0722;

    const toon =
      new THREE.MeshToonMaterial({

        color:
          new THREE.Color().setScalar(
            Math.max(
              0.48,
              luminance,
            ),
          ),

        map: source.map ?? null,

        alphaMap:
          source.alphaMap ?? null,

        alphaTest:
          source.alphaTest ?? 0,

        normalMap:
          source.normalMap ?? null,

        transparent:
          source.transparent ?? false,

        opacity:
          source.opacity ?? 1,

        side:
          source.side ??
          THREE.FrontSide,

        depthWrite:
          source.depthWrite ?? true,

        gradientMap: ramp,

      });

    /* ========================================================
       GRAYSCALE TEXTURES
       ======================================================== */

    // The WebGL material hook inserts GLSL after map sampling, so texture color
    // contributes to grayscale too. It leaves the shared source image untouched.
    toon.onBeforeCompile = shader => {

      shader.fragmentShader =
        shader.fragmentShader.replace(
          '#include <map_fragment>',
          `
          #include <map_fragment>

          float inkLuma = dot(
            diffuseColor.rgb,
            vec3(
              0.2126,
              0.7152,
              0.0722
            )
          );

          diffuseColor.rgb =
            vec3(inkLuma);
          `,
        );

    };

    created.push(toon);

    return toon;
  };

  /* ==========================================================
     PROCESS ALL MESHES
     ========================================================== */

  let processedMeshes = 0;

  root.traverse(object => {

    if (
      !(object instanceof THREE.Mesh)
    ) {
      return;
    }

    const mesh = object;

    const original =
      mesh.material;

    if (!original) {
      return;
    }

    if (
      Array.isArray(original)
    ) {

      mesh.material =
        original.map(
          convertMaterial,
        );

    } else {

      mesh.material =
        convertMaterial(
          original,
        );

    }

    replacements.push({
      mesh,
      original,
    });

    processedMeshes++;

  });

  console.log(
    '[DATIN NOIR] Processed meshes:',
    processedMeshes,
  );

  /* ==========================================================
     RESTORE ORIGINAL MATERIALS
     ========================================================== */

  return () => {

    for (
      const {
        mesh,
        original,
      } of replacements
    ) {

      mesh.material = original;

    }

    for (
      const material of created
    ) {

      material.dispose();

    }

    // The ramp belongs to this conversion. Source texture maps were reused and
    // remain owned by the GLB cache, so cleanup does not dispose those maps.
    ramp.dispose();

  };
}
