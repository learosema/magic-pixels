import { Object3D } from 'magic-pixels';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Mouse and touch controls that orbit a camera around a point: drag to
 * turn, right-drag (or shift-drag) to pan, wheel to zoom.
 *
 * The camera becomes the child of a small rig of two objects:
 *
 *   rig        at the target, turns around Y (the yaw)
 *   └ tilt     turns around X (the pitch)
 *     └ camera at (0, 0, distance), looking down its own -Z
 *
 * so the camera never needs `lookAt`: turning the rig or the tilt object
 * swings it around the target, and it keeps looking at it. Add `rig` to the
 * scene, that is what makes the camera part of the scene graph.
 *
 * The controls only change goals; `update(dt)` moves the real values a
 * fraction of the way there each frame, which is what makes it feel smooth.
 */
export class OrbitControls {
  /**
   * @param {import('magic-pixels').PerspectiveCamera} camera
   * @param {HTMLElement} element the element that receives the pointer events
   * @param {object} [options]
   * @param {number} [options.distance] start distance to the target
   * @param {number} [options.yaw] start angle around Y, radians
   * @param {number} [options.pitch] start elevation, radians (0 = horizon)
   * @param {number} [options.minDistance]
   * @param {number} [options.maxDistance]
   * @param {number} [options.minPitch] keep above the ground
   * @param {number} [options.maxPitch] and below straight down
   * @param {number} [options.panLimit] the target stays within +-panLimit
   * @param {number} [options.autoRotate] radians per second while idle
   * @param {number} [options.damping] how fast the values catch up, per second
   */
  constructor(camera, element, options = {}) {
    const {
      distance = 40,
      yaw = Math.PI / 4,
      pitch = 0.45,
      minDistance = 8,
      maxDistance = 80,
      minPitch = 0.05,
      maxPitch = 1.5,
      panLimit = 30,
      autoRotate = 0,
      damping = 10,
    } = options;
    Object.assign(this, {
      camera,
      element,
      minDistance,
      maxDistance,
      minPitch,
      maxPitch,
      panLimit,
      autoRotate,
      damping,
    });

    this.rig = new Object3D();
    this.tilt = new Object3D();
    this.rig.add(this.tilt);
    this.tilt.add(camera);

    // where the user wants to be, and where the camera is right now
    this.goal = { x: 0, z: 0, yaw, pitch, distance };
    this.state = { ...this.goal };
    this.dragging = false;
    this.#apply();

    // touch: without this the browser scrolls the page instead of sending
    // pointermove events
    element.style.touchAction = 'none';
    element.addEventListener('pointerdown', this.#onPointerDown);
    element.addEventListener('pointermove', this.#onPointerMove);
    element.addEventListener('pointerup', this.#onPointerUp);
    element.addEventListener('pointercancel', this.#onPointerUp);
    element.addEventListener('wheel', this.#onWheel, { passive: false });
    element.addEventListener('contextmenu', this.#onContextMenu);
  }

  /** Call once per frame with the seconds since the last one. */
  update(dt) {
    const { goal, state } = this;
    if (this.autoRotate && !this.dragging) {
      goal.yaw += this.autoRotate * dt;
    }
    const k = 1 - Math.exp(-this.damping * dt);
    for (const key of Object.keys(goal)) {
      state[key] += (goal[key] - state[key]) * k;
    }
    this.#apply();
  }

  dispose() {
    const { element } = this;
    element.removeEventListener('pointerdown', this.#onPointerDown);
    element.removeEventListener('pointermove', this.#onPointerMove);
    element.removeEventListener('pointerup', this.#onPointerUp);
    element.removeEventListener('pointercancel', this.#onPointerUp);
    element.removeEventListener('wheel', this.#onWheel);
    element.removeEventListener('contextmenu', this.#onContextMenu);
  }

  #apply() {
    const { state } = this;
    this.rig.position.set(state.x, 0, state.z);
    this.rig.rotation.y = state.yaw;
    // a positive pitch lifts the camera above the target, which is a
    // negative turn around X
    this.tilt.rotation.x = -state.pitch;
    this.camera.position.set(0, 0, state.distance);
  }

  #rotate(dx, dy) {
    const { goal } = this;
    // one drag across the element height is a full half turn
    const perPixel = Math.PI / this.element.clientHeight;
    // dragging right swings the camera left; dragging down lifts it
    goal.yaw -= dx * perPixel;
    goal.pitch = clamp(
      goal.pitch + dy * perPixel,
      this.minPitch,
      this.maxPitch
    );
  }

  #pan(dx, dy) {
    const { goal } = this;
    // how many world units one pixel covers at the target's distance
    const perPixel =
      (2 * goal.distance * Math.tan((this.camera.fov * Math.PI) / 360)) /
      this.element.clientHeight;
    // the rig's local +X and -Z axes on the ground, after turning by yaw
    const sin = Math.sin(goal.yaw);
    const cos = Math.cos(goal.yaw);
    // the ground follows the pointer, so the target moves the other way
    goal.x += (-cos * dx - sin * dy) * perPixel;
    goal.z += (sin * dx - cos * dy) * perPixel;
    goal.x = clamp(goal.x, -this.panLimit, this.panLimit);
    goal.z = clamp(goal.z, -this.panLimit, this.panLimit);
  }

  #onPointerDown = (event) => {
    this.dragging = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    // keeps the events coming when the pointer leaves the element
    this.element.setPointerCapture(event.pointerId);
  };

  #onPointerMove = (event) => {
    if (!this.dragging) {
      return;
    }
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    // left button turns, the others (or shift) pan
    if (event.buttons & 1 && !event.shiftKey) {
      this.#rotate(dx, dy);
    } else {
      this.#pan(dx, dy);
    }
  };

  #onPointerUp = (event) => {
    this.dragging = false;
    if (this.element.hasPointerCapture(event.pointerId)) {
      this.element.releasePointerCapture(event.pointerId);
    }
  };

  #onWheel = (event) => {
    event.preventDefault();
    // deltaMode 1 counts in lines, not pixels
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    // multiplying keeps the zoom feeling the same near and far
    this.goal.distance = clamp(
      this.goal.distance * Math.exp(delta * 0.001),
      this.minDistance,
      this.maxDistance
    );
  };

  #onContextMenu = (event) => event.preventDefault();
}
