import { 
  AlphaMode,
  AmbientLight,
  createPlaneGeometry,
  createPbrMaterial,
  DirectionalLight,
  Scene, 
  Mesh,
  PerspectiveCamera,
  Stopwatch,
  Vector,
  WebGL2Renderer, 
  Wrapping,
  Filter,
  Texture
} from 'magic-pixels';

import { pattern, normalPattern } from './patterns.js'
import { createHouseKit } from './houses.js'
import { createPostProcessing } from './post-processing.js'
import { createRoads } from './roads.js'
import { createForest } from './forest.js'
import { createWater } from './water.js'
import { createGroundMaterial } from './ground.js'
import { OrbitControls } from './orbit-controls.js'
import { createIsland, displacePlane } from './terrain.js'

const width = 256
const height = 256
const darkgrey = [.1,.1,.1]
const grey = [.5, .5, .5]
const white = [1., 1., 1.]
const darkgreen = [.1, .2, .1]
const green = [0.04, 0.7, 0.3]
const orange = [.8, .4, .1];
const brown = [.2, .1, .1];
const lightyellow=[1., .8, .7]
const smurf = [.2, .4, .8]
const blue = [0, .2, .5]
const darkblue = [0, .1, .2]

const assets = {
  concrete: pattern(width, height, .125, grey),
  // Normal maps of the buildings: the same noise as their colour patterns
  // (same freq, seed and octaves), so the bumps sit where the pattern is light
  // and dark. The strength is set per pattern: the slope of noise grows with
  // its frequency, so smooth low-frequency plaster takes more than concrete.
  plasterNormal: normalPattern(width, height, [0.06, 0.07], 4),
  concreteNormal: normalPattern(width, height, .125, 2),
  woodNormal: normalPattern(width, height, [.1, 0.01], 2),
  whiteConcrete: pattern(width, height, .125, white),
  grassland: pattern(width, height, 0.04, green, darkgreen, darkgrey),
  // bumps at the scale of the colour pattern (same freq), so they follow the
  // mottling; the strength is raised because low-frequency noise is flat
  grassNormal: normalPattern(width, height, 0.04, 2.5, 8, 3),
  // warm grey rock, with strong light and dark
  rock: pattern(width, height, .07, [.6, .56, .5], [.5, .4, .35], [.02, .02, .02], 5, 4),
  beach: pattern(width, height, .18, [.95, .85, .6], [.2, .16, .1], [.1, .08, .05]),
  wood: pattern(width, height, [.1, 0.01], orange, brown),
  putz: pattern(width, height, [0.06, 0.07], lightyellow, grey, brown),
  water: pattern(width, height, [.01, .05], smurf, blue, darkblue),

  // the last argument fades the left and right edge out (an alpha mask), for the roads
  sand: pattern(width, height, .12, [.9, .78, .5], [.25, .2, .12], [.08, .06, .03], 8, 2, .3),
  bush: pattern(width, height, .25, darkgreen, green, darkgrey)
};

// the patterns are colour images, so they are sRGB; mipmaps keep them calm
// at grazing angles; `repeat` is for surfaces whose UVs are scaled to tile
// `linear` is for textures that hold data, not colours: a normal map
const loadTexture = (url, { repeat = false, linear = false } = {}) =>
  Texture.fromImageUrl(url, {
    colorSpace: linear ? 'linear' : 'srgb',
    wrapS: repeat ? Wrapping.REPEAT : Wrapping.CLAMP_TO_EDGE,
    wrapT: repeat ? Wrapping.REPEAT : Wrapping.CLAMP_TO_EDGE,
    minFilter: Filter.LINEAR_MIPMAP_LINEAR,
    magFilter: Filter.LINEAR
  })

const [grass, grassNormal, beach, rock, plaster, concrete, waterTexture, wood, sand, bush, plasterNormal, concreteNormal, woodNormal] = await Promise.all([
  loadTexture(assets.grassland, { repeat: true }),
  loadTexture(assets.grassNormal, { repeat: true, linear: true }),
  loadTexture(assets.beach, { repeat: true }),
  loadTexture(assets.rock, { repeat: true }),
  loadTexture(assets.putz),
  loadTexture(assets.whiteConcrete, {repeat: true}),
  loadTexture(assets.water, { repeat: true }),
  loadTexture(assets.wood),
  loadTexture(assets.sand, { repeat: true }),
  loadTexture(assets.bush),
  loadTexture(assets.plasterNormal, { linear: true }),
  loadTexture(assets.concreteNormal, { repeat: true, linear: true }),
  loadTexture(assets.woodNormal, { linear: true }),
])

const canvas = document.querySelector('#canvas');
const renderer = new WebGL2Renderer(canvas);
const scene = new Scene();

// the sky: the clear colour, which the far sea also reflects
const SKY = '#a8bbde';
renderer.setClearColor(SKY);

// the houses stand within a square of this size; the camera may not pan away
const CITY_SIZE = 40;

// far enough to see the whole fading sea from anywhere the camera can go
const camera = new PerspectiveCamera(25, innerWidth / innerHeight, .1, 400);
// the camera lives in a rig that orbits the middle of the city; the rig is
// what goes into the scene, so the camera is part of the scene graph
const controls = new OrbitControls(camera, canvas, {
  distance: 45,
  panLimit: CITY_SIZE / 2,
});
scene.add(controls.rig);

// The miniature look: the foreground melts into a blur while the middle stays
// sharp. ?dof=0 in the address shows the plain picture, to compare.
const post =
  new URLSearchParams(location.search).get('dof') === '0'
    ? null
    : createPostProcessing(renderer, canvas, camera);

// the ground is a plane cut into small squares, each vertex lifted by a
// height function: gentle hills in the middle, sinking to -1 at the border
const WATER_LEVEL = 0;
const SIZE = 80;
const heightAt = createIsland({ size: SIZE, seed: 3 });

const groundGeometry = createPlaneGeometry(SIZE, SIZE, 128, 128);
displacePlane(groundGeometry, heightAt);

// grass with a bump map, a sandy beach where the ground is low and rock on the
// hilltops (ground.js)
const floor = new Mesh(
  groundGeometry,
  createGroundMaterial({ grass, grassNormal, sand: beach, rock })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
for (let i = 0; i < floor.geometry.attributes.uv.data.length; i++) {
  floor.geometry.attributes.uv.data[i] *= 10;
}

// the sea: waves, shallows and foam, fading out to the sky (see water.js)
const water = createWater({
  heightAt,
  groundSize: SIZE,
  waterLevel: WATER_LEVEL,
  texture: waterTexture,
  sky: SKY,
});

scene.add(floor, water.mesh)
// the same random city on every load (Park-Miller), so a change of look can
// be compared with the picture before it
let seed = 7;
function random() {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}

const HOUSE_COUNT = 12;
// the gap between the circles two buildings stand in
const HOUSE_GAP = 0.8;

const { planHouse, buildHouse, smoke } = createHouseKit(
  {
    plaster,
    stone: concrete,
    wood,
    roof: concrete,
    normals: {
      plaster: plasterNormal,
      stone: concreteNormal,
      wood: woodNormal,
      roof: concreteNormal,
    },
  },
  random
);
// The smoke is drawn in a scene of its own, after the sea. The renderer sorts
// see-through meshes by the distance of their middle, and the sea is one huge
// mesh whose middle is the island's: smoke behind the island would be drawn
// before the sea and painted over by it. Drawn afterwards, the smoke is tested
// against the sea's depth like anything else.
const smokeScene = new Scene();
smokeScene.add(smoke.object);

// Plan a building, throw it at a random spot and keep it if it has room:
// far enough from the ones already placed, given both their sizes, and on
// dry land. The tries are capped, so a crowded city cannot hang.
const placed = [];
for (let tries = 0; placed.length < HOUSE_COUNT && tries < 2000; tries++) {
  const plan = planHouse();
  const x = (random() - 0.5) * CITY_SIZE;
  const z = (random() - 0.5) * CITY_SIZE;
  if (
    placed.some(
      (p) => Math.hypot(p.x - x, p.z - z) < p.radius + plan.radius + HOUSE_GAP
    )
  ) {
    continue;
  }
  // the ground under the house: the middle and a ring of points around it. A
  // house on the coast would stand in the water, and one on a slope would
  // hang over its low side, unless its base sits at the lowest point
  const ground = [[0, 0]];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    ground.push([Math.cos(angle) * plan.radius, Math.sin(angle) * plan.radius]);
  }
  const base = Math.min(...ground.map(([dx, dz]) => heightAt(x + dx, z + dz)));
  if (base < WATER_LEVEL + 0.1) {
    continue;
  }
  const house = buildHouse(plan);
  house.position.set(x, base, z);
  scene.add(house);
  placed.push({ x, z, radius: plan.radius, house });
}

// Roads between the houses. This also turns every house to face its nearest
// neighbour, so the smoke starts only afterwards: where the chimney is
// depends on the way the house is turned.
const roadMaterial = createPbrMaterial({
  baseColorMap: sand,
  // the sand texture is see-through at its edges: blended, the roads fade
  // into the grass
  alphaMode: AlphaMode.BLEND,
  metallicFactor: 0,
  roughnessFactor: 0.95,
});
const ROAD_WIDTH = 1.2;
const roads = createRoads(placed, heightAt, {
  waterLevel: WATER_LEVEL,
  random,
  width: ROAD_WIDTH,
});
scene.add(new Mesh(roads.geometry, roadMaterial));
placed.forEach(({ house }) => smoke.add(house));

// Trees, in woods with meadows between them; not on the houses or the roads.
// All trunks are one mesh and all crowns another: two draw calls.
const forest = createForest({
  wood,
  bush,
  heightAt,
  random,
  size: SIZE,
  waterLevel: WATER_LEVEL,
  houses: placed,
  routes: roads.routes,
  roadWidth: ROAD_WIDTH,
});
scene.add(forest.object);

const ambientLight = new AmbientLight('#2a3350', 0.5)
scene.add(ambientLight);

const sun = new DirectionalLight('#fff1d6', 1.2);
sun.position.set(40,40,40);
sun.lookAt(new Vector(0,0,0));
scene.add(sun);

const clock = new Stopwatch().start();

function resize() {
  const { innerWidth: width, innerHeight: height } = window;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)).setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  post?.resize();
}

let lastTime = 0;

function animation() {
  const t = clock.elapsedTime / 1000;
  controls.update(t - lastTime);
  lastTime = t;

  water.update(t);
  smoke.update(t);

  // what is sharp is what the camera orbits around, at its distance
  if (post) {
    post.render([scene, smokeScene], controls.state.distance);
  } else {
    renderer.render(scene, camera);
    renderer.autoClear = false;
    renderer.render(smokeScene, camera);
    renderer.autoClear = true;
  }

  requestAnimationFrame(animation)
}


resize();
window.addEventListener('resize', resize, false);

animation();

