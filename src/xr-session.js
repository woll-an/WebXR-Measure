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

function makeTextSprite( text )
{
  var size = 20
	var canvas = document.createElement("canvas");
  var context = canvas.getContext("2d");

  context.strokeStyle = "white";
  context.font = size + "pt Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "black";
  context.strokeText(text, canvas.width / 2, canvas.height / 2)
  context.fillText(text, canvas.width / 2, canvas.height / 2);
	
	// canvas contents will be used for a texture
  var texture = new THREE.Texture(canvas)
  texture.needsUpdate = true;
  var spriteMaterial = new THREE.SpriteMaterial({ map: texture} );
  spriteMaterial.depthWrite = false;
  spriteMaterial.depthTest = false;
	var sprite = new THREE.Sprite(spriteMaterial);
	sprite.scale.set(0.25,0.25,1.0);
	return sprite;	
}

function matrixToVector(matrix) {
  let vector = new THREE.Vector3();
  vector.setFromMatrixPosition(matrix);
  return vector;
}

function getLine(points) {
  var lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    linewidth: 5,
    linecap: 'round'
  });

  var lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
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

function getDistance(points) {
  if (points.length == 2)
    return points[0].distanceTo(points[1]);
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
      console.log(getDistance(measurements));
      scene.add(getLine(measurements));
      var sprite = makeTextSprite(Math.round(getDistance(measurements)*100) + ' cm');
      sprite.position.setFromMatrixPosition(reticle.matrix);
      scene.add(sprite);
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