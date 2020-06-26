interface XRNavigator extends Navigator {
  xr: any;
}
declare var navigator: XRNavigator;

let xrButton = <HTMLInputElement> document.getElementById('xr-button');
let xrSession:XRSession;
let gl:WebGLRenderingContext;
let xrRefSpace:XRReferenceSpace;

function checkSupportedState() {
  navigator.xr.isSessionSupported('immersive-ar').then((supported:boolean) => {
    if (xrButton) {
      if (supported) {
        xrButton.innerHTML = 'Enter AR';
      } else {
        xrButton.innerHTML = 'AR not found';
      }
  
      xrButton.disabled = !supported;
    }
  });
}

function initXR() {
  if (!window.isSecureContext) {
    let message = "WebXR unavailable due to insecure context";
    let warning = document.getElementById("warning");
    if (warning) {
      warning.innerHTML = message;
    }
  }

  if (navigator.xr) {
    xrButton.addEventListener('click', onButtonClicked);
    navigator.xr.addEventListener('devicechange', checkSupportedState);
    checkSupportedState();
  }
}

function onButtonClicked() {
  if (!xrSession) {
      // Ask for an optional DOM Overlay, see https://immersive-web.github.io/dom-overlays/
      navigator.xr.requestSession('immersive-ar', {
          optionalFeatures: ['dom-overlay'],
          domOverlay: {root: document.getElementById('overlay')}
      }).then(onSessionStarted, onRequestSessionError);
  } else {
    xrSession.end();
  }
}

function onSessionStarted(session:XRSession) {
  xrSession = session;
  xrButton.innerHTML = 'Exit AR';

  session.addEventListener('end', onSessionEnded);
  let canvas = document.createElement('canvas');
  gl = <WebGLRenderingContext> canvas.getContext('webgl', { xrCompatible: true });
  session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
  session.requestReferenceSpace('local').then((refSpace:XRReferenceSpace) => {
    xrRefSpace = refSpace;
    session.requestAnimationFrame(onXRFrame);
  });
}

function onRequestSessionError(ex:any) {
  alert("Failed to start immersive AR session.");
  console.error(ex.message);
}

function onEndSession(session:XRSession) {
  session.end();
}

function onSessionEnded(event:Event) {
  // xrSession = void 0;
  xrButton.innerHTML = 'Enter AR';
  // document.getElementById('session-info').innerHTML = '';
  // gl = null;
}

function onXRFrame(t:DOMHighResTimeStamp, frame:XRFrame) {
  let session = frame.session;
  if (session) {
    session.requestAnimationFrame(onXRFrame);
    let pose = frame.getViewerPose(xrRefSpace);
  
    if (pose && session.renderState.baseLayer) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);
  
      // Update the clear color so that we can observe the color in the
      // headset changing over time. Use a scissor rectangle to keep the AR
      // scene visible.
      const width = session.renderState.baseLayer.framebufferWidth;
      const height = session.renderState.baseLayer.framebufferHeight;
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(width / 4, height / 4, width / 2, height / 2);
      let time = Date.now();
      gl.clearColor(Math.cos(time / 2000), Math.cos(time / 4000), Math.cos(time / 6000), 0.5);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
  }
}

export {initXR}