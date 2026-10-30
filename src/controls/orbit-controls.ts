// Everything from the core comes through its public entry point: the build
// turns this import into one of 'magic-pixels', so the controls share the
// core's classes instead of bundling copies of them.
import { Vector, clamp } from '../index';
import type { Box3, PerspectiveCamera } from '../index';

/**
 * Where an orbiting camera is: the point it looks at, and its position on a
 * sphere around that point.
 */
export interface OrbitState {
  /** the point the camera orbits and looks at */
  target: Vector;
  /** distance from the target */
  distance: number;
  /** angle around the vertical (Y) axis in radians; 0 looks down -Z */
  yaw: number;
  /** elevation above the target's horizon in radians; positive is above */
  pitch: number;
}

/** Options for {@link OrbitControls}; every one but `keyboard` is also a property. */
export interface OrbitControlsOptions {
  /** the point to orbit, the origin by default */
  target?: Vector;
  /**
   * Start distance, yaw and pitch. Each one left out is taken from where
   * the camera is relative to the target, so a camera placed before the
   * controls are created stays where it is.
   */
  distance?: number;
  yaw?: number;
  pitch?: number;
  /** closest zoom, 0 by default */
  minDistance?: number;
  /** farthest zoom, unlimited by default */
  maxDistance?: number;
  /**
   * lowest elevation in radians; by default almost -π/2, looking up from
   * straight below
   */
  minPitch?: number;
  /**
   * highest elevation in radians; by default almost π/2, looking down from
   * straight above
   */
  maxPitch?: number;
  /**
   * The box the target stays inside, e.g. the playable part of a map;
   * unlimited when null (the default). It limits the target, not the
   * camera, which can be up to `maxDistance` outside of it. The box is 3D:
   * with ground panning, give it a `min.y` and `max.y` around the ground's
   * height.
   */
  targetBounds?: Box3 | null;
  /**
   * false (the default) pans the target over the horizontal plane it is
   * in, like moving over a map; true pans in the screen plane, which keeps
   * a model under the pointer from any angle
   */
  screenSpacePanning?: boolean;
  /**
   * true listens to the keyboard on the element's window: WASD or the arrow
   * keys move over the ground, Q and E turn. Off by default.
   */
  keyboard?: boolean;
  /** keyboard movement speed in distances per second, 1 by default */
  keyPanSpeed?: number;
  /** keyboard turning speed in radians per second, π/2 by default */
  keyTurnSpeed?: number;
  /** turn by this many radians per second while nobody is touching */
  autoRotate?: number;
  /**
   * how fast the camera catches up with the input, per second; higher is
   * snappier, `Infinity` jumps straight there
   */
  damping?: number;
}

/** keeps `lookAt` away from looking straight up or down, where "up" is undefined */
const MAX_PITCH = Math.PI / 2 - 1e-3;

/** `KeyboardEvent.code` (the key's place, whatever the layout) to a movement */
const KEYS: Record<
  string,
  { right?: number; forward?: number; turn?: number }
> = {
  KeyW: { forward: 1 },
  ArrowUp: { forward: 1 },
  KeyS: { forward: -1 },
  ArrowDown: { forward: -1 },
  KeyA: { right: -1 },
  ArrowLeft: { right: -1 },
  KeyD: { right: 1 },
  ArrowRight: { right: 1 },
  KeyQ: { turn: 1 },
  KeyE: { turn: -1 },
};

/** the angle between two directions, in (-π, π] */
function angleBetween(from: number, to: number): number {
  const delta = (to - from) % (2 * Math.PI);
  return delta > Math.PI
    ? delta - 2 * Math.PI
    : delta <= -Math.PI
      ? delta + 2 * Math.PI
      : delta;
}

/**
 * Mouse, touch and keyboard controls that orbit a {@link PerspectiveCamera}
 * around a target point, for looking at a model or exploring a map.
 *
 * - drag (or one finger) turns around the target
 * - right-drag, shift-drag or two fingers pan
 * - the wheel, a trackpad pinch or a two-finger pinch zooms
 * - twisting two fingers turns
 * - with `keyboard: true`, WASD or the arrow keys move and Q/E turn
 *
 * The position is kept as spherical coordinates around the target
 * (`distance`, `yaw`, `pitch`). Input only changes the {@link goal};
 * {@link update} moves the {@link current} values a fraction of the way
 * there each frame, places the camera and points it at the target with
 * `lookAt`. The camera's position is in its parent's space, so a camera
 * without a parent (or one directly in the scene) orbits in world space.
 *
 * Imported from its own entry point, `magic-pixels/controls`.
 *
 * ```ts
 * import { OrbitControls } from 'magic-pixels/controls';
 *
 * const controls = new OrbitControls(camera, canvas);
 * function frame(dt: number) {
 *   controls.update(dt);
 *   renderer.render(scene, camera);
 * }
 * ```
 */
export class OrbitControls {
  /** where the input wants the camera to be */
  readonly goal: OrbitState;
  /** where the camera is now, eased towards `goal` by `update()` */
  readonly current: OrbitState;

  /** false ignores all input, e.g. while a menu is open */
  enabled = true;
  minDistance: number;
  maxDistance: number;
  minPitch: number;
  maxPitch: number;
  targetBounds: Box3 | null;
  screenSpacePanning: boolean;
  keyPanSpeed: number;
  keyTurnSpeed: number;
  autoRotate: number;
  damping: number;

  /** the pointers that are down, by `pointerId`, at their last position */
  private readonly pointers = new Map<number, { x: number; y: number }>();
  /** the movement keys held down, by `KeyboardEvent.code` */
  private readonly keys = new Set<string>();
  /** where the key listeners are, if `keyboard` is on */
  private readonly keyTarget: EventTarget | null;

  /**
   * @param camera the camera to move
   * @param element the element that receives the pointer events, usually
   * the canvas
   */
  constructor(
    readonly camera: PerspectiveCamera,
    readonly element: HTMLElement,
    options: OrbitControlsOptions = {}
  ) {
    const target = options.target?.clone() ?? new Vector(0, 0, 0);
    const offset = camera.position.sub(target);
    const length = offset.length;
    this.goal = {
      target,
      distance: options.distance ?? (length || 1),
      yaw: options.yaw ?? (length ? Math.atan2(offset.x, offset.z) : 0),
      pitch:
        options.pitch ??
        (length ? Math.asin(clamp(offset.y / length, -1, 1)) : 0),
    };
    this.current = { ...this.goal, target: target.clone() };
    this.minDistance = options.minDistance ?? 0;
    this.maxDistance = options.maxDistance ?? Infinity;
    this.minPitch = options.minPitch ?? -MAX_PITCH;
    this.maxPitch = options.maxPitch ?? MAX_PITCH;
    this.targetBounds = options.targetBounds ?? null;
    this.screenSpacePanning = options.screenSpacePanning ?? false;
    this.keyPanSpeed = options.keyPanSpeed ?? 1;
    this.keyTurnSpeed = options.keyTurnSpeed ?? Math.PI / 2;
    this.autoRotate = options.autoRotate ?? 0;
    this.damping = options.damping ?? 10;
    this.snap();

    // without this a touch scrolls or zooms the page instead of sending
    // pointermove events
    element.style.touchAction = 'none';
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointercancel', this.onPointerUp);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('contextmenu', this.onContextMenu);

    // keys go to whatever has the focus, so they are heard on the window,
    // not on the canvas (which only gets them once it was clicked)
    this.keyTarget = options.keyboard
      ? (element.ownerDocument?.defaultView ?? null)
      : null;
    this.keyTarget?.addEventListener(
      'keydown',
      this.onKeyDown as EventListener
    );
    this.keyTarget?.addEventListener('keyup', this.onKeyUp as EventListener);
    // a key released while another window has the focus never sends keyup
    this.keyTarget?.addEventListener('blur', this.onBlur);
  }

  /** true while at least one pointer or movement key is down */
  get dragging(): boolean {
    return this.pointers.size > 0 || this.keys.size > 0;
  }

  /**
   * Ease the camera towards the goal and place it. Call once per frame.
   * @param dt seconds since the last call
   */
  update(dt: number): void {
    const { goal, current } = this;
    if (this.autoRotate && !this.dragging) {
      goal.yaw += this.autoRotate * dt;
    }
    this.applyKeys(dt);
    this.clampGoal();
    // exponential smoothing: the same fraction of the remaining way per
    // second, whatever the frame rate
    const k = 1 - Math.exp(-this.damping * dt);
    current.distance += (goal.distance - current.distance) * k;
    current.yaw += (goal.yaw - current.yaw) * k;
    current.pitch += (goal.pitch - current.pitch) * k;
    const { target } = current;
    target.set(
      target.x + (goal.target.x - target.x) * k,
      target.y + (goal.target.y - target.y) * k,
      target.z + (goal.target.z - target.z) * k
    );
    this.apply();
  }

  /** Jump to the goal without easing, e.g. after setting a new one. */
  snap(): void {
    const { goal, current } = this;
    this.clampGoal();
    current.distance = goal.distance;
    current.yaw = goal.yaw;
    current.pitch = goal.pitch;
    current.target.set(goal.target.x, goal.target.y, goal.target.z);
    this.apply();
  }

  /** Remove the event listeners. */
  dispose(): void {
    const { element, keyTarget } = this;
    element.removeEventListener('pointerdown', this.onPointerDown);
    element.removeEventListener('pointermove', this.onPointerMove);
    element.removeEventListener('pointerup', this.onPointerUp);
    element.removeEventListener('pointercancel', this.onPointerUp);
    element.removeEventListener('wheel', this.onWheel);
    element.removeEventListener('contextmenu', this.onContextMenu);
    keyTarget?.removeEventListener('keydown', this.onKeyDown as EventListener);
    keyTarget?.removeEventListener('keyup', this.onKeyUp as EventListener);
    keyTarget?.removeEventListener('blur', this.onBlur);
    this.pointers.clear();
    this.keys.clear();
  }

  private clampGoal(): void {
    const { goal, targetBounds } = this;
    goal.distance = clamp(goal.distance, this.minDistance, this.maxDistance);
    goal.pitch = clamp(
      goal.pitch,
      Math.max(this.minPitch, -MAX_PITCH),
      Math.min(this.maxPitch, MAX_PITCH)
    );
    if (targetBounds) {
      const { min, max } = targetBounds;
      const { target } = goal;
      target.set(
        clamp(target.x, min.x, max.x),
        clamp(target.y, min.y, max.y),
        clamp(target.z, min.z, max.z)
      );
    }
  }

  /** Spherical to cartesian: put the camera on its sphere, facing the target. */
  private apply(): void {
    const { camera } = this;
    const { target, distance, yaw, pitch } = this.current;
    const horizontal = distance * Math.cos(pitch);
    camera.position.set(
      target.x + horizontal * Math.sin(yaw),
      target.y + distance * Math.sin(pitch),
      target.z + horizontal * Math.cos(yaw)
    );
    camera.lookAt(target);
  }

  /** Move and turn by the held keys, for `dt` seconds. */
  private applyKeys(dt: number): void {
    if (!this.enabled || this.keys.size === 0) {
      return;
    }
    let right = 0;
    let forward = 0;
    let turn = 0;
    for (const code of this.keys) {
      const key = KEYS[code];
      right += key.right ?? 0;
      forward += key.forward ?? 0;
      turn += key.turn ?? 0;
    }
    // speed in distances per second: the same keys cross the screen in the
    // same time whether zoomed in or out
    const step = this.keyPanSpeed * this.goal.distance * dt;
    this.moveOnGround(right * step, forward * step);
    // turning left swings the camera to the right around the target
    this.goal.yaw += turn * this.keyTurnSpeed * dt;
  }

  /** Move the target over its horizontal plane, relative to the view. */
  private moveOnGround(right: number, forward: number): void {
    const sinYaw = Math.sin(this.goal.yaw);
    const cosYaw = Math.cos(this.goal.yaw);
    // the camera's right axis (cos, 0, -sin) and its forward axis
    // flattened onto the ground (-sin, 0, -cos)
    const { target } = this.goal;
    target.set(
      target.x + cosYaw * right - sinYaw * forward,
      target.y,
      target.z - sinYaw * right - cosYaw * forward
    );
  }

  private rotate(dx: number, dy: number): void {
    // a drag across the element's height is half a turn
    const perPixel = Math.PI / this.element.clientHeight;
    // dragging right swings the camera left, dragging down lifts it
    this.goal.yaw -= dx * perPixel;
    this.goal.pitch += dy * perPixel;
  }

  private pan(dx: number, dy: number): void {
    const { goal, camera } = this;
    // world units per pixel at the target's distance: the visible height
    // there is 2 × distance × tan(fov / 2)
    const perPixel =
      (2 * goal.distance * Math.tan((camera.fov * Math.PI) / 360)) /
      this.element.clientHeight;
    // the scene follows the pointer, so the target moves the other way:
    // left for a drag to the right
    if (!this.screenSpacePanning) {
      // and forward, away from the camera, for a drag down
      this.moveOnGround(-dx * perPixel, dy * perPixel);
      return;
    }
    // and up along the camera's up axis, which is tilted back by the pitch
    const sinYaw = Math.sin(goal.yaw);
    const cosYaw = Math.cos(goal.yaw);
    const sinPitch = Math.sin(goal.pitch);
    const cosPitch = Math.cos(goal.pitch);
    const { target } = goal;
    target.set(
      target.x - (cosYaw * dx + sinPitch * sinYaw * dy) * perPixel,
      target.y + cosPitch * dy * perPixel,
      target.z + (sinYaw * dx - sinPitch * cosYaw * dy) * perPixel
    );
  }

  /** multiply the distance; the same factor feels the same near and far */
  private zoom(factor: number): void {
    this.goal.distance *= factor;
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.enabled) {
      return;
    }
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    // keeps the events coming when the pointer leaves the element
    this.element.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent): void => {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer || !this.enabled) {
      return;
    }
    const before = this.pinch();
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (before) {
      // two fingers: the change of their spread zooms, their midpoint
      // pans, and turning the line between them turns the view with it
      const after = this.pinch()!;
      if (after.spread > 0) {
        this.zoom(before.spread / after.spread);
      }
      this.pan(after.x - before.x, after.y - before.y);
      this.goal.yaw += angleBetween(before.angle, after.angle);
    } else if (event.buttons & 1 && !event.shiftKey) {
      this.rotate(dx, dy);
    } else {
      this.pan(dx, dy);
    }
  };

  /** the first two pointers' midpoint, distance and direction, if two are down */
  private pinch(): {
    x: number;
    y: number;
    spread: number;
    angle: number;
  } | null {
    if (this.pointers.size < 2) {
      return null;
    }
    const [a, b] = this.pointers.values();
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      spread: Math.hypot(a.x - b.x, a.y - b.y),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  private onPointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.element.hasPointerCapture(event.pointerId)) {
      this.element.releasePointerCapture(event.pointerId);
    }
  };

  private onWheel = (event: WheelEvent): void => {
    if (!this.enabled) {
      return;
    }
    event.preventDefault();
    // deltaMode 1 counts lines, not pixels
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    // a trackpad pinch arrives as a wheel event with ctrlKey and much
    // smaller deltas than a wheel
    this.zoom(Math.exp(delta * (event.ctrlKey ? 0.01 : 0.001)));
  };

  private onContextMenu = (event: Event): void => event.preventDefault();

  private onKeyDown = (event: KeyboardEvent): void => {
    if (
      !this.enabled ||
      !(event.code in KEYS) ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      isTextField(event.target)
    ) {
      return;
    }
    // the arrow keys would scroll the page as well
    event.preventDefault();
    this.keys.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private onBlur = (): void => this.keys.clear();
}

/** true for an element that takes typing, where WASD are letters */
function isTextField(target: EventTarget | null): boolean {
  const element = target as Partial<HTMLElement> | null;
  return Boolean(
    element?.isContentEditable ||
    (element?.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName))
  );
}
