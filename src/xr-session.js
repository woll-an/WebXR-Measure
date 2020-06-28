import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

var container;
var camera, scene, renderer;
var controller;

var reticle;

var hitTestSource = null;
var hitTestSourceRequested = false;

let measurements = [];

function matrixToVector(matrix) {
  let vector = new THREE.Vector3();
  vector.setFromMatrixPosition(matrix);
  return vector;
}

function getLineFromMeasurements() {
  var lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    linewidth: 5,
    linecap: 'round'
  });

  var lineGeometry = new THREE.BufferGeometry().setFromPoints(measurements);
  return new THREE.Line(lineGeometry, lineMaterial);
}

function initReticle() {
  let ring = new THREE.RingBufferGeometry(0.07, 0.1, 32).rotateX(- Math.PI / 2);
  let dot = new THREE.CircleBufferGeometry(0.01, 32).rotateX(- Math.PI / 2);
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

function getMarkerFromSelection(matrix) {
  var circleGeometry = new THREE.CircleBufferGeometry(0.01, 32).rotateX(- Math.PI / 2);
  var material = new THREE.MeshPhongMaterial({ color: 0xffffff * Math.random() });
  var mesh = new THREE.Mesh(circleGeometry, material);
  mesh.position.setFromMatrixPosition(matrix);
  return mesh
}

function getDistanceFromMeasurements() {
  let p1 = measurements[0];
  let p2 = measurements[1];
  return p1.distanceTo(p2);
}

function initXR() {

  container = document.createElement('div');
  document.body.appendChild(container);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  var light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
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
      console.log(getDistanceFromMeasurements());
      scene.add(getLineFromMeasurements());
      measurements = [];
    }
    scene.add(getMarkerFromSelection(reticle.matrix));
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

    var referenceSpace = renderer.xr.getReferenceSpace();
    var session = renderer.xr.getSession();

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

      var hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length) {

        var hit = hitTestResults[0];

        reticle.visible = true;
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);

      } else {

        reticle.visible = false;

      }

    }

  }

  renderer.render(scene, camera);

}

export { initXR }