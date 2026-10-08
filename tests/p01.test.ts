import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AnimationController } from '../src/controllers/Animation.controller.ts';

function fixture(options: { loop?: boolean; speed?: number } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Object3D();
  body.name = 'Body';
  const camera = new THREE.PerspectiveCamera();
  camera.name = 'Camera';
  root.add(body, camera);
  const clips = [
    new THREE.AnimationClip('body', 3, [new THREE.NumberKeyframeTrack('Body.position[x]', [0, 3], [0, 30])]),
    new THREE.AnimationClip('camera', 2, [new THREE.NumberKeyframeTrack('Camera.position[z]', [0, 2], [0, 20])]),
  ];
  const controller = new AnimationController(root, clips);
  assert.equal(controller.selectByNames(['body', 'camera'], options), true);
  return { controller, root, body, camera };
}

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} should equal ${expected}`);
}

test('different-length body and camera actions share seconds and hold their final samples', () => {
  const { controller, body, camera } = fixture();
  controller.play();
  controller.advance(1);
  close(body.position.x, 10);
  close(camera.position.z, 10); // Not 2/3 of the camera clip.
  controller.advance(1.5);
  close(body.position.x, 25);
  close(camera.position.z, 20);
  controller.advance(10);
  assert.deepEqual(controller.getSnapshot(), { time: 3, duration: 3, playing: false });
  close(body.position.x, 30);
  close(camera.position.z, 20);
  controller.dispose();
});

test('pause/resume, reverse scrub after completion, restart, and replay retain synchronization', () => {
  const { controller, body, camera } = fixture();
  controller.play();
  controller.advance(1);
  controller.pause();
  const paused = controller.getSnapshot();
  controller.advance(100);
  assert.equal(controller.getSnapshot(), paused);
  controller.play();
  controller.advance(0.25);
  close(body.position.x, 12.5);
  close(camera.position.z, 12.5);
  controller.setProgress(1);
  controller.pause();
  controller.setProgress(0.25);
  close(body.position.x, 7.5);
  close(camera.position.z, 7.5);
  controller.restart();
  assert.deepEqual(controller.getSnapshot(), { time: 0, duration: 3, playing: true });
  controller.advance(3);
  controller.play();
  close(controller.getSnapshot().time, 0);
  controller.dispose();
});

test('looping and speed apply to the shot clock, not independently to its actions', () => {
  const { controller, body, camera } = fixture({ loop: true, speed: 2 });
  controller.play();
  controller.advance(2); // Four seconds wraps the three-second shot to one second.
  close(controller.getSnapshot().time, 1);
  close(body.position.x, 10);
  close(camera.position.z, 10);
  assert.equal(controller.getSnapshot().playing, true);
  controller.dispose();
});

test('disposal restores bindings and zero-duration clips do not start playback', () => {
  const { controller, body, camera } = fixture();
  controller.setTime(1);
  controller.dispose();
  close(body.position.x, 0);
  close(camera.position.z, 0);
  assert.deepEqual(controller.getSnapshot(), { time: 0, duration: 0, playing: false });
  const staticController = new AnimationController(new THREE.Group(), [new THREE.AnimationClip('static', 0, [])]);
  assert.equal(staticController.selectByName('static'), true);
  staticController.play();
  staticController.advance(10);
  assert.equal(staticController.getSnapshot().playing, false);
  staticController.dispose();
});

test('actual P01 export binds both actions and keeps cloned cameras and skeletons isolated', async () => {
  const bytes = await readFile('public/models/Datin_ComicV2.glb');
  const loader = new GLTFLoader();
  loader.register(parser => {
    // This headless test verifies animation/scene data; browser validation covers textures.
    (parser as unknown as { loadTextureImage: () => Promise<null> }).loadTextureImage = () => Promise.resolve(null);
    return { name: 'TEST_SKIP_IMAGES' };
  });
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '');
  const first = clone(gltf.scene);
  const second = clone(gltf.scene);
  const staticPanel = clone(gltf.scene);
  staticPanel.traverse(object => {
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) (object as THREE.SkinnedMesh).skeleton.pose();
  });
  const camera = first.getObjectByName('Camera') as THREE.PerspectiveCamera;
  const otherCamera = second.getObjectByName('Camera') as THREE.PerspectiveCamera;
  assert.ok(camera.isPerspectiveCamera);
  assert.notEqual(camera, otherCamera);
  assert.notEqual(camera, gltf.scene.getObjectByName('Camera'));
  close(camera.aspect, 16 / 9);
  close(camera.fov, 90.83890382759533);

  const pose = (root: THREE.Object3D) => {
    const result: number[] = [];
    root.traverse(object => {
      if ((object as THREE.Bone).isBone) result.push(...object.position.toArray(), ...object.quaternion.toArray());
    });
    return result;
  };
  const untouchedPose = pose(second);
  const untouchedCamera = otherCamera.position.toArray();
  const sourcePose = pose(gltf.scene);
  const bindPose = pose(staticPanel);
  assert.ok(bindPose.length > 0);
  const controller = new AnimationController(first, gltf.animations);
  const other = new AnimationController(second, gltf.animations);
  const names = ['Body_P01_HeroReach', 'Cam_P01_HeroReach'];
  assert.equal(controller.selectByNames(names), true);
  assert.equal(controller.getSnapshot().duration, 3);
  assert.equal(other.selectByNames(names), true);
  const otherStart = pose(second);
  const otherCameraStart = otherCamera.position.toArray();
  controller.setTime(0.5);
  const halfSecondPose = pose(first);
  const halfSecondCamera = camera.position.toArray();
  controller.setTime(3);
  assert.notDeepEqual(pose(first), halfSecondPose);
  assert.notDeepEqual(camera.position.toArray(), halfSecondCamera);
  close(camera.position.x, 0.30970367789268494);
  close(camera.position.y, 0.4992564916610718);
  close(camera.position.z, 1.0630896091461182);
  controller.setTime(0.5);
  assert.deepEqual(pose(first), halfSecondPose);
  assert.deepEqual(camera.position.toArray(), halfSecondCamera);
  assert.deepEqual(pose(second), otherStart);
  assert.deepEqual(otherCamera.position.toArray(), otherCameraStart);
  assert.deepEqual(pose(gltf.scene), sourcePose);
  assert.deepEqual(pose(staticPanel), bindPose);

  controller.dispose();
  other.dispose();
  assert.deepEqual(pose(second), untouchedPose);
  assert.deepEqual(otherCamera.position.toArray(), untouchedCamera);
});
