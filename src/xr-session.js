import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

let container;
let camera, scene, renderer;
let controller;

let hitTestSource = null;
let hitTestSourceRequested = false;

let measurements = [];

let reticle;
let currentLine = null;

function makeTextSprite(text, points) {
  const size = 40
  let canvas = document.createElement("canvas");
  let context = canvas.getContext("2d");

  // context.strokeStyle = "white";
  context.font = size + "pt Helvetica";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "white";
  context.strokeText(text, canvas.width / 2, canvas.height / 2)
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  // canvas contents will be used for a texture
  let texture = new THREE.Texture(canvas)
  texture.needsUpdate = true;
  let spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  spriteMaterial.depthWrite = false;
  spriteMaterial.depthTest = false;
  let sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(0.1, 0.1, 1.0);
  let line = new THREE.Line3(...points)
  let center = line.getCenter();
  sprite.position.set(center.x, center.y, center.z)
  return sprite;
}

function matrixToVector(matrix) {
  let vector = new THREE.Vector3();
  vector.setFromMatrixPosition(matrix);
  return vector;
}

function initLine(point) {
  let lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    linewidth: 5,
    linecap: 'round'
  });

  let lineGeometry = new THREE.BufferGeometry().setFromPoints([point, point]);
  return new THREE.Line(lineGeometry, lineMaterial);
}

function updateLine(matrix) {
  let positions = currentLine.geometry.attributes.position.array;
  positions[3] = matrix.elements[12]
  positions[4] = matrix.elements[13]
  positions[5] = matrix.elements[14]
  currentLine.geometry.attributes.position.needsUpdate = true;
  currentLine.geometry.computeBoundingSphere();
}

function initReticle() {
  let ring = new THREE.RingBufferGeometry(0.045, 0.05, 32).rotateX(- Math.PI / 2);
  let dot = new THREE.CircleBufferGeometry(0.005, 32).rotateX(- Math.PI / 2);
  reticle = new THREE.Mesh(
    BufferGeometryUtils.mergeBufferGeometries([ring, dot]),
    new THREE.MeshBasicMaterial()
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
}

function getDistance(points) {
  if (points.length == 2)
    return points[0].distanceTo(points[1]);
}

function initXR() {
  container = document.createElement('div');
  document.body.appendChild(container);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
  let light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  light.position.set(0.5, 1, 0.25);
  scene.add(light);
  initRenderer()
  container.appendChild(renderer.domElement);
  document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));
  controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  scene.add(controller);
  initReticle();
  scene.add(reticle);
  window.addEventListener('resize', onWindowResize, false);
  animate()
}

function onSelect() {
  if (reticle.visible) {
    measurements.push(matrixToVector(reticle.matrix));
    if (measurements.length == 2) {
      let distance = Math.round(getDistance(measurements) * 100);
      let sprite = makeTextSprite(distance + ' cm', measurements);
      scene.add(sprite);
      measurements = [];
      currentLine = null;
    } else {
      currentLine = initLine(measurements[0]);
      scene.add(currentLine);
    }
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  if (frame) {
    let referenceSpace = renderer.xr.getReferenceSpace();
    let session = renderer.xr.getSession();
    if (hitTestSourceRequested === false) {
      session.requestReferenceSpace('viewer').then(function (referenceSpace) {
        session.requestHitTestSource({ space: referenceSpace }).then(function (source) {
          hitTestSource = source;
        });
      });
      session.addEventListener('end', function () {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });
      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      let hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length) {
        let hit = hitTestResults[0];
        reticle.visible = true;
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
      } else {
        reticle.visible = false;
      }

      if (currentLine) {
        updateLine(reticle.matrix);
      }
    }
  }
  renderer.render(scene, camera);

}

export { initXR }