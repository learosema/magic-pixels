---
title: Compression
---

# Compression

A glTF file's biggest cost is usually its vertex data: positions, normals,
UVs and indices, one binary blob per attribute. [Typed vertex
attributes](./typed-attributes.md) already shrinks that blob by storing
each attribute in the smallest integer type that holds it
(`KHR_mesh_quantization`). This step covers the two extensions that
compress it further still, `EXT_meshopt_compression` and
`KHR_draco_mesh_compression`, and needs nothing beyond passing a decoder
in - the extensions do the rest.

## Two different kinds of compression

Quantization shrinks data by storing fewer bits per number; it is
essentially free to decode, because the GPU already divides an integer by
its maximum value to get `0..1` or `-1..1` (the [typed
attributes](./typed-attributes.md) step covered that mapping). The two
extensions below shrink the file further by compressing the _bytes_, the
way a `.zip` does, and have to be un-compressed with actual CPU work
before the GPU ever sees them.

**`EXT_meshopt_compression`** ([meshoptimizer](https://github.com/zeux/meshoptimizer),
produced by its `gltfpack` tool) treats each attribute stream and the
index buffer as a sequence of similar, small numbers and encodes the
_differences_ between consecutive elements with an entropy coder, rather
than the raw values. Two optional pre-processing filters make more
attributes fit that pattern: `OCTAHEDRAL` maps a unit vector (a normal or
a tangent) to two bytes on the octahedron's unfolded faces instead of
three components, and `QUATERNION` does the analogous thing for
rotations. Decoding is a straight, branch-light byte-stream expansion -
fast enough to run on the main thread for most models - and the
compression ratio is decent: on top of quantization, another 2-3x
smaller.

**`KHR_draco_mesh_compression`** ([Draco](https://github.com/google/draco))
compresses the _mesh_, not just its attribute streams: it re-derives the
triangle connectivity with an [Edgebreaker](https://en.wikipedia.org/wiki/Edgebreaker)-style
traversal (each new triangle is described relative to the ones already
visited, which takes only a couple of bits per triangle instead of three
indices) and predicts each vertex's attributes from its already-decoded
neighbours before entropy-coding the (small) prediction error. The result
compresses several times smaller than meshopt for the same quantization,
at the cost of a heavier decoder (a few hundred KB of WebAssembly) and
slower decoding, since the traversal cannot be as branch-light as
meshopt's flat byte expansion. Meshopt suits models that stream in on
every frame or page load; Draco suits models that are downloaded once and
kept, where the extra decode time is paid back by less network transfer.

Both extensions compress in a way that has nothing to do with quantized
_attribute_ storage (`KHR_mesh_quantization`) but pairs well with it - a
`gltfpack`-optimized file typically uses both together, quantizing first
and compressing the quantized bytes.

## The design: decoders are passed in, never bundled

Both compression formats need a decoder: `meshoptimizer` is a small
WebAssembly module, `draco3d` a larger one. Bundling either would force
every magic-pixels user to ship it, even the majority who load
uncompressed or merely quantized files - so, matching the
[loader's](./loader-core.md) general approach to third-party code,
`loadGltf`/`parseGltf` accept a decoder as an option and call it only
when a file actually needs it:

```ts
import { MeshoptDecoder } from 'meshoptimizer';
import { loadGltf } from 'magic-pixels';

const model = await loadGltf('model.glb', { meshopt: MeshoptDecoder });
```

```ts
import { createDecoderModule } from 'draco3d';
import { loadGltf } from 'magic-pixels';

const model = await loadGltf('model.glb', {
  draco: await createDecoderModule(),
});
```

Neither option is typed against the npm package directly (magic-pixels
has no dependency on either): `MeshoptDecoder` and `DracoDecoderModule`
are _structural_ interfaces, just the handful of properties and methods
`parseGltf` actually calls. Anything with that shape works - the
`meshoptimizer` package's export, the CDN build's `MeshoptDecoder`
global, `draco3d`'s `createDecoderModule()` result, or the CDN build's
`DracoDecoderModule({...})` factory. A file that uses either extension
without the matching option throws an error naming the option, so the
failure points straight at the fix.

The two extensions also compress differently shaped things, which shows
up in where the loader hooks in:

- `EXT_meshopt_compression` marks individual **bufferViews** as
  compressed - vertex attributes and indices are still ordinary
  accessors pointing at ordinary bufferViews once decoded, so the loader
  decodes every compressed bufferView once, up front, before any accessor
  is read; from there on, accessors, sparse substitution, de-interleaving
  and bounding boxes all work exactly as with an uncompressed file.
- `KHR_draco_mesh_compression` marks a whole **primitive** as compressed:
  the compressed bytes describe an entire mesh (connectivity and
  attributes together), so there is no bufferView to patch. The loader
  decodes the primitive directly into geometry attributes and an index
  array, bypassing the accessor path for that primitive only; the
  accessors still carry the shape (`count`, `componentType`, `type`) the
  decoded data is read into, since Draco's own attributes are just flat
  numbers with no glTF type attached.

## File by file

- `src/loaders/gltf/meshopt.ts`: `decodeMeshoptBufferViews(json, buffers, decoder)`.
  A pure function - it changes nothing in place - that finds every
  bufferView carrying `EXT_meshopt_compression`, decodes its bytes with
  `decoder.decodeGltfBuffer(target, count, size, source, mode, filter)`
  and returns a patched `json`/`buffers` pair with those bufferViews
  redirected at the decoded bytes. A meshopt-compressed buffer set also
  includes a data-less "fallback" buffer (present only for bookkeeping;
  every real bufferView is always redirected by its own extension), which
  the loader recognises and skips rather than trying to fetch.
- `src/loaders/gltf/draco.ts`: `decodeDracoPrimitive(json, primitive, ext, buffers, module)`.
  Reads the compressed bufferView into a `DecoderBuffer`, decodes it to a
  Draco `Mesh`, then reads each attribute the extension lists by its
  unique id and the triangle indices, through the decoder module's
  `_malloc`/`HEAP*` pair - the only Draco API that returns every
  component type, not floats only, which matters because JOINTS/WEIGHTS
  and quantized positions are integers. Every Draco object is
  `destroy()`ed before returning, decoded or not.
- `src/loaders/gltf/loader.ts`: `GltfLoaderOptions.meshopt`/`.draco`;
  `parse()` calls `decodeMeshoptBufferViews()` right after the buffers
  are loaded and keeps the _original_, un-patched document as
  `result.json` even though the patched one is what accessors actually
  read from; `loadPrimitive()` branches to `decodeDracoPrimitive()` when
  a primitive carries `KHR_draco_mesh_compression`. Both extensions were
  added to `SUPPORTED_EXTENSIONS`, so a file that requires one passes the
  early extension check and fails later with the more specific "pass
  options.meshopt/options.draco" error instead.
- `src/loaders/gltf/types.ts`: `GltfMeshoptCompression` (a bufferView's
  extension object) and `GltfDracoMeshCompression` (a primitive's).
- `src/loaders/gltf/fixtures/`: `quantized()` (a `KHR_mesh_quantization`
  fixture using `Int16`/`Uint8` attributes, needing nothing from this
  step but pinning down that the extension is accepted without warning),
  `meshoptCompressed()` (a bufferView layout shaped like real `gltfpack
-cc` output, verified against the real tool while writing this step),
  `dracoCompressed()` and `draco-stub.ts`'s `createDracoStub()` (a stub
  Draco module implementing just the calls `decodeDracoPrimitive` makes,
  backed by a fixed decoded mesh instead of a real `.drc` bitstream).

## Try it

The [glTF loader example](https://learosema.github.io/magic-pixels/examples/10-gltf-loader/)
loads `meshoptimizer` as an ES module and the Draco decoder as a classic
script, both from a CDN, and its model list has two compressed entries -
a box compressed with `gltfpack -cc` and the Khronos sample box
Draco-compressed - embedded directly in the page so the demo needs no
server for them. Things to change:

- Pass a URL of your own: the demo's `sample()` helper wraps
  `loadGltf(url)`; point it at any `EXT_meshopt_compression` file (run
  `gltfpack -cc -i model.gltf -o model.glb` on a Khronos sample to make
  one) or a `KHR_draco_mesh_compression` sample from the [glTF sample
  assets](https://github.com/KhronosGroup/glTF-Sample-Assets) (several
  models have a `glTF-Draco/` variant, `CesiumMilkTruck` and `BoomBox`
  among them) and pass the matching option.
- Compare file sizes: `Box/glTF-Binary/Box.glb` from the sample list is
  about 15 KB; the embedded compressed box is under 2 KB, for the same
  eight vertices - most of the saving on a model this tiny is the
  quantization, but the ratio grows with mesh size.
- Drop a compressed file that needs no decoder you have not passed: the
  loader's error names the missing option instead of failing to parse.

## Further reading

- [meshoptimizer: vertex/index buffer compression](https://github.com/zeux/meshoptimizer#compression):
  the encoding scheme in the library's own words, with the filters
  described.
- [`EXT_meshopt_compression` specification](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_meshopt_compression):
  the extension's bufferView layout and the fallback-buffer mechanism.
- [Draco: 3D data compression](https://github.com/google/draco#readme)
  and its [design documentation](https://google.github.io/draco/spec/):
  the codec's own overview and the on-disk format.
- [`KHR_draco_mesh_compression` specification](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_draco_mesh_compression):
  the primitive-level extension this step reads.
- [Rossignac, "Edgebreaker": mesh connectivity compression](https://www.cc.gatech.edu/~jarek/papers/EdgeBreaker.pdf):
  the traversal-based connectivity encoding Draco builds on.
- [three.js: `DRACOLoader` source](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/loaders/DRACOLoader.js):
  another implementation of the same Draco decode path, including the
  worker offload this step's follow-up (`TODOS.md`) leaves for later.
