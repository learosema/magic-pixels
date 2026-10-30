import { Box3, PerspectiveCamera, Vector, prepareScene, Scene } from '../index';
import { OrbitControls } from './orbit-controls';

/** Just enough of an element for the controls: events, a size, capture. */
class FakeElement extends EventTarget {
  clientWidth = 800;
  clientHeight = 600;
  style = { touchAction: '' };
  ownerDocument = { defaultView: new EventTarget() };
  captured = new Set<number>();
  setPointerCapture(id: number) {
    this.captured.add(id);
  }
  hasPointerCapture(id: number) {
    return this.captured.has(id);
  }
  releasePointerCapture(id: number) {
    this.captured.delete(id);
  }
}

function setup(options: ConstructorParameters<typeof OrbitControls>[2] = {}) {
  const element = new FakeElement();
  const camera = new PerspectiveCamera(60, 4 / 3);
  const controls = new OrbitControls(
    camera,
    element as unknown as HTMLElement,
    { damping: Infinity, ...options }
  );
  const window = element.ownerDocument.defaultView;
  const send = (
    type: string,
    props: Record<string, unknown> = {},
    to: EventTarget = element
  ) => {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      buttons: 1,
      shiftKey: false,
      ctrlKey: false,
      deltaMode: 0,
      deltaY: 0,
      code: '',
      ...props,
    });
    to.dispatchEvent(event);
    return event;
  };
  const key = (type: string, code: string, props = {}) =>
    send(type, { code, ...props }, window);
  return { element, camera, controls, send, key };
}

/** the target in the camera's view space; straight ahead is (0, 0, -distance) */
function targetInView(camera: PerspectiveCamera, target: Vector): number[] {
  prepareScene(new Scene(), camera);
  const v = camera.viewMatrix
    .toMatrix()
    .mul(new Vector(target.x, target.y, target.z, 1)) as Vector;
  return [v.x, v.y, v.z];
}

function expectClose(actual: number[], expected: number[]) {
  expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 5));
}

describe('OrbitControls', () => {
  test('starts from where the camera already is', () => {
    const element = new FakeElement();
    const camera = new PerspectiveCamera();
    camera.position.set(3, 4, 0);
    const controls = new OrbitControls(
      camera,
      element as unknown as HTMLElement
    );
    expect(controls.goal.distance).toBeCloseTo(5);
    expect(controls.goal.yaw).toBeCloseTo(Math.PI / 2);
    expect(controls.goal.pitch).toBeCloseTo(Math.asin(4 / 5));
    expectClose(camera.position.values, [3, 4, 0]);
    expect(element.style.touchAction).toBe('none');
  });

  test('places the camera on its sphere, looking at the target', () => {
    const target = new Vector(1, 2, 3);
    const { camera } = setup({ target, distance: 10, yaw: 0.7, pitch: 0.4 });
    expect(camera.position.sub(target).length).toBeCloseTo(10);
    expect(camera.position.y - target.y).toBeCloseTo(10 * Math.sin(0.4));
    expectClose(targetInView(camera, target), [0, 0, -10]);
  });

  test('dragging right turns the camera left, dragging down lifts it', () => {
    const { controls, send } = setup({ distance: 5, yaw: 0, pitch: 0 });
    send('pointerdown');
    send('pointermove', { clientX: 60, clientY: 30 });
    send('pointerup');
    // half a turn per element height (600 px)
    expect(controls.goal.yaw).toBeCloseTo(-Math.PI / 10);
    expect(controls.goal.pitch).toBeCloseTo(Math.PI / 20);
  });

  test('ignores moves without a pointer down', () => {
    const { controls, send } = setup({ yaw: 0 });
    send('pointermove', { clientX: 100 });
    expect(controls.goal.yaw).toBe(0);
  });

  test('update eases towards the goal, independent of the frame rate', () => {
    const { controls } = setup({ distance: 10, damping: 2 });
    controls.goal.distance = 20;
    controls.update(0.5);
    const once = controls.current.distance;
    expect(once).toBeCloseTo(20 - 10 * Math.exp(-1));

    const { controls: twice } = setup({ distance: 10, damping: 2 });
    twice.goal.distance = 20;
    twice.update(0.25);
    twice.update(0.25);
    expect(twice.current.distance).toBeCloseTo(once);
  });

  test('keeps the goal inside the limits', () => {
    const bounds = new Box3(new Vector(-1, 0, -1), new Vector(1, 0, 1));
    const { controls } = setup({
      minDistance: 2,
      maxDistance: 8,
      minPitch: 0,
      maxPitch: 1,
      targetBounds: bounds,
    });
    controls.goal.distance = 100;
    controls.goal.pitch = -1;
    controls.goal.target.set(5, 5, -5);
    controls.update(1 / 60);
    expect(controls.current.distance).toBe(8);
    expect(controls.current.pitch).toBe(0);
    expectClose(controls.current.target.values, [1, 0, -1]);

    controls.goal.pitch = 10;
    controls.goal.distance = 0;
    controls.snap();
    expect(controls.current.pitch).toBe(1);
    expect(controls.current.distance).toBe(2);
  });

  test('never looks straight up or down, where lookAt has no up', () => {
    const { controls } = setup({ maxPitch: Math.PI });
    controls.goal.pitch = Math.PI;
    controls.snap();
    expect(controls.current.pitch).toBeLessThan(Math.PI / 2);
  });

  test('the wheel zooms by a factor and stops the page from scrolling', () => {
    const { controls, send } = setup({ distance: 10 });
    const event = send('wheel', { deltaY: 100 });
    expect(event.defaultPrevented).toBe(true);
    expect(controls.goal.distance).toBeCloseTo(10 * Math.exp(0.1));
    send('wheel', { deltaY: -100 });
    expect(controls.goal.distance).toBeCloseTo(10);
  });

  test('right-drag pans the target over the ground', () => {
    const { controls, send } = setup({ distance: 10, yaw: 0, pitch: 0.5 });
    send('pointerdown', { buttons: 2 });
    send('pointermove', { buttons: 2, clientX: 30, clientY: 20 });
    const { target } = controls.goal;
    // the scene follows the pointer: the target moves left and away
    expect(target.x).toBeLessThan(0);
    expect(target.y).toBe(0);
    expect(target.z).toBeLessThan(0);
  });

  test('screen-space panning moves the target along the camera axes', () => {
    const { controls, camera, send } = setup({
      distance: 10,
      yaw: 0.3,
      pitch: 0.5,
      screenSpacePanning: true,
    });
    send('pointerdown', { shiftKey: true });
    send('pointermove', { shiftKey: true, clientY: 20 });
    controls.update(1);
    // seen from the camera, the old target moved down with the pointer
    const [x, y, z] = targetInView(camera, new Vector(0, 0, 0));
    expect(x).toBeCloseTo(0);
    expect(y).toBeLessThan(0);
    expect(z).toBeCloseTo(-10);
  });

  test('two fingers moving apart zoom in, their midpoint pans', () => {
    const { controls, send } = setup({ distance: 10, yaw: 0, pitch: 0.5 });
    send('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
    send('pointerdown', { pointerId: 2, clientX: 200, clientY: 100 });
    send('pointermove', { pointerId: 2, clientX: 300, clientY: 100 });
    // the spread doubled
    expect(controls.goal.distance).toBeCloseTo(5);
    expect(controls.goal.yaw).toBe(0);
    // the midpoint moved 50 px to the right
    expect(controls.goal.target.x).toBeLessThan(0);

    // lifting one finger leaves the other turning, without a jump
    send('pointerup', { pointerId: 2 });
    send('pointermove', { pointerId: 1, clientX: 100, clientY: 100 });
    expect(controls.goal.yaw).toBe(0);
    send('pointermove', { pointerId: 1, clientX: 160, clientY: 100 });
    expect(controls.goal.yaw).toBeCloseTo(-Math.PI / 10);
  });

  test('twisting two fingers turns the view with them', () => {
    const { controls, send } = setup({ distance: 10, yaw: 0 });
    send('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
    send('pointerdown', { pointerId: 2, clientX: 200, clientY: 100 });
    // a quarter turn clockwise on the screen, same spread
    send('pointermove', { pointerId: 2, clientX: 100, clientY: 200 });
    expect(controls.goal.yaw).toBeCloseTo(Math.PI / 2);
    expect(controls.goal.distance).toBeCloseTo(10);
    // and back across the ±π seam without a full spin
    send('pointermove', { pointerId: 2, clientX: 0, clientY: 99 });
    send('pointermove', { pointerId: 2, clientX: 0, clientY: 101 });
    expect(controls.goal.yaw).toBeCloseTo(Math.PI - 0.01, 2);
  });

  test('ignores input while disabled', () => {
    const { controls, send } = setup({ distance: 10, yaw: 0 });
    controls.enabled = false;
    send('pointerdown');
    send('pointermove', { clientX: 100 });
    const wheel = send('wheel', { deltaY: 100 });
    expect(controls.goal.yaw).toBe(0);
    expect(controls.goal.distance).toBe(10);
    expect(wheel.defaultPrevented).toBe(false);
    expect(controls.dragging).toBe(false);
  });

  describe('keyboard', () => {
    test('is off unless asked for', () => {
      const { controls, key } = setup({ distance: 10, yaw: 0 });
      key('keydown', 'KeyW');
      controls.update(1);
      expectClose(controls.current.target.values, [0, 0, 0]);
    });

    test('WASD move over the ground at distances per second', () => {
      const { controls, key } = setup({
        keyboard: true,
        distance: 10,
        yaw: 0,
        pitch: 0.5,
      });
      const down = key('keydown', 'KeyW');
      expect(down.defaultPrevented).toBe(true);
      expect(controls.dragging).toBe(true);
      controls.update(0.5);
      // forward is -Z at yaw 0, half a second at one distance per second
      expectClose(controls.current.target.values, [0, 0, -5]);
      key('keydown', 'KeyD');
      key('keyup', 'KeyW');
      controls.update(0.5);
      expectClose(controls.current.target.values, [5, 0, -5]);
      key('keyup', 'KeyD');
      controls.update(0.5);
      expectClose(controls.current.target.values, [5, 0, -5]);
    });

    test('Q and E turn', () => {
      const { controls, key } = setup({
        keyboard: true,
        yaw: 0,
        keyTurnSpeed: 1,
      });
      key('keydown', 'KeyQ');
      controls.update(0.5);
      expect(controls.current.yaw).toBeCloseTo(0.5);
      key('keyup', 'KeyQ');
      key('keydown', 'KeyE');
      controls.update(1);
      expect(controls.current.yaw).toBeCloseTo(-0.5);
    });

    test('leaves typing, shortcuts and other keys alone', () => {
      const { controls, key } = setup({ keyboard: true, distance: 10 });
      const element = controls.element.ownerDocument.defaultView!;
      const typing = Object.assign(new Event('keydown', { cancelable: true }), {
        code: 'KeyW',
      });
      Object.defineProperty(typing, 'target', { value: { tagName: 'INPUT' } });
      element.dispatchEvent(typing);
      expect(typing.defaultPrevented).toBe(false);
      expect(key('keydown', 'KeyS', { ctrlKey: true }).defaultPrevented).toBe(
        false
      );
      expect(key('keydown', 'Space').defaultPrevented).toBe(false);
      expect(controls.dragging).toBe(false);
    });

    test('forgets held keys when the window loses the focus', () => {
      const { controls, key, send } = setup({ keyboard: true });
      key('keydown', 'KeyA');
      send('blur', {}, controls.element.ownerDocument.defaultView!);
      expect(controls.dragging).toBe(false);
    });
  });

  test('auto-rotates only while nobody is touching', () => {
    const { controls, send } = setup({ yaw: 0, autoRotate: 1 });
    controls.update(0.5);
    expect(controls.current.yaw).toBeCloseTo(0.5);
    send('pointerdown');
    expect(controls.dragging).toBe(true);
    controls.update(0.5);
    expect(controls.current.yaw).toBeCloseTo(0.5);
    send('pointerup');
    expect(controls.dragging).toBe(false);
  });

  test('dispose removes the listeners', () => {
    const { controls, send } = setup({ distance: 10 });
    controls.dispose();
    send('wheel', { deltaY: 100 });
    expect(controls.goal.distance).toBe(10);
  });
});
