---
title: Rendering concepts
---

# Rendering concepts

This page introduces the terms and concepts the glTF relies on.
Nothing here is specific to magic-pixels.

## Linear and sRGB color

Monitors are not linear. Doubling the number sent to a pixel does not double
the light it emits; the curve is steeper at the top. Image files compensate
by storing values on the inverse curve, called _sRGB_ encoding: a stored 0.5
shows up as about 21% of full brightness, which our eyes, also non-linear,
perceive as roughly half. Every PNG or JPEG you have ever seen is sRGB.

This is a different kind of "color space" than HSV or OKLCH. Those use
different axes entirely - hue/saturation/value, or perceptual
lightness/chroma/hue - and converting between them and RGB is a real change
of coordinates. Linear and sRGB use the exact same red/green/blue axes and
the same gamut; only the number-to-light mapping within that gamut differs.
Converting sRGB to linear does not change which colors exist, only what a
given stored number means.

Lighting math assumes linear light: two lights of intensity 1 make intensity 2. Feeding sRGB-encoded texels into that math gives colors that are too dark
in the mid tones and highlights that wash out. So a renderer works in linear
space and converts at the borders:

- **Input:** color textures (base color, emissive) are decoded from sRGB to
  linear when sampled. The GPU does that for free if the texture is uploaded
  with an sRGB internal format, which is what `Texture.colorSpace = 'srgb'`
  requests. Data textures (normals, roughness, occlusion) are already linear
  and must _not_ be decoded.
- **Output:** the final linear color is encoded back to sRGB before it is
  written to the canvas. The approximation `pow(color, 1.0 / 2.2)` is close
  enough for a hand-written shader; the exact curve has a linear toe near
  black, and the PBR material uses it.

The rule of thumb: if a texture is something you would look at as a picture,
it is sRGB. If it is numbers that happen to be stored as an image, it is
linear.

## What a light is, to a shader

A shader knows nothing about lights until you hand it numbers. A
_directional light_ is a direction and a color: sunlight, the same
everywhere. A _point light_ is a position and a color, and it gets weaker with
distance. An _ambient light_ is a flat color added everywhere, a cheap stand-in
for light bouncing around the room.

For every fragment the shader asks, for every light: how much of this light
reaches me, and how much of it bounces towards the camera? The first part is
the geometry term: a surface facing the light gets all of it, a surface at a
grazing angle gets less, in proportion to `max(dot(N, L), 0.0)` where `N` is
the surface normal and `L` the direction towards the light. That single dot
product is Lambert's law and is where all shading starts.

The renderer passes lights to the shader in _view space_, the coordinate
system of the camera, because the vertex shader already produces the position
and normal in view space (`vPosition`, `vNormal` in the default shader).
Everything in the lighting equation must be in the same space. The
[Lights](./lights.md) page has the three light types and the uniforms.

## What a BRDF is

The second question, how much light bounces towards the camera, is answered
by the _bidirectional reflectance distribution function_, or BRDF. It takes
the light direction `L`, the view direction `V` and the normal `N` and returns
a ratio. A different function per material is what makes chalk look like
chalk and chrome look like chrome.

The glTF material uses one specific BRDF with two halves:

- **Diffuse.** Light that enters the surface, scatters and leaves in a
  random direction. It looks the same from every angle, so it is just the
  base color times the Lambert term.
- **Specular.** Light that reflects off the surface like a mirror. It depends
  on the angle between `V` and the mirror direction of `L`. A perfectly
  smooth surface reflects in exactly one direction (a sharp highlight); a
  rough one spreads it out (a broad, dim highlight).

The specular half is the _Cook-Torrance_ model, a product of three terms that
the [PBR material](./pbr-material.md) page goes through one by one: a
distribution term (how many microscopic facets point the right way,
controlled by roughness), a geometry term (how many of those facets are
shadowed by their neighbours), and a Fresnel term (surfaces reflect more at
grazing angles; look at a lake from above versus from the shore).

## Metallic and roughness

Instead of asking artists for specular colors and shininess exponents, the
glTF material asks two questions that have physical meaning:

- **Metallic** (0 or 1, values in between only at texture edges): is this
  surface a metal? Metals have no diffuse reflection; their base color _is_
  the color of their specular reflection (gold reflects gold light). Non-metals
  (dielectrics) reflect about 4% of light as a colorless specular highlight
  and the rest diffusely in their base color.
- **Roughness** (0 to 1): how rough is the surface at a microscopic scale?
  Zero is a mirror, one is chalk. It controls the width of the specular
  highlight.

Both can come from a texture. glTF packs them into one image: roughness in
the green channel, metalness in the blue channel, so a single texture fetch
gets both.

## Normal, occlusion and emissive maps

- A **normal map** stores a per-texel normal in _tangent space_, a coordinate
  system aligned with the surface: `x` along the U texture direction, `y`
  along V, `z` pointing out. To use it the shader needs the surface's
  tangent vector, either from a `TANGENT` attribute or reconstructed from
  screen-space derivatives. The result fakes small bumps without extra
  geometry.
- An **occlusion map** darkens crevices where ambient light would not reach.
  It only affects the ambient term.
- An **emissive map** is color the surface emits on its own, added after
  lighting. It is sRGB, like base color.

## Alpha modes and blending

A fragment's alpha can mean three things in glTF:

- `OPAQUE`: ignored.
- `MASK`: the fragment is either fully visible or discarded, depending on
  whether alpha is above a cutoff. Used for leaves and fences. Works with the
  depth buffer like any opaque surface.
- `BLEND`: the fragment is mixed with what is already in the framebuffer,
  `result = src * alpha + dst * (1 - alpha)`. Glass, smoke. This is GPU
  blend state, and it has a catch: the depth buffer cannot sort transparent
  surfaces for you, so they must be drawn after all opaque ones, farthest
  first, with depth writes off.

## Quaternions, briefly

An Euler rotation is three angles applied in sequence. It is easy to read
but has two problems: applying rotations in sequence can align two axes so
one degree of freedom is lost (gimbal lock), and there is no clean way to
interpolate between two Euler rotations. A quaternion is four numbers
`(x, y, z, w)` that encode a rotation axis `(x, y, z) * sin(angle / 2)` and
`w = cos(angle / 2)`. Multiplying two unit quaternions composes the
rotations, and _slerp_ (spherical linear interpolation) moves between two of
them along the shortest arc at constant speed. glTF uses them for every node
rotation and every rotation animation, which is why they come first. The
[Quaternions](./quaternions.md) page has the math and the implementation.

## Further reading

- [John Novak: What every coder should know about gamma](https://blog.johnnovak.net/2016/09/21/what-every-coder-should-know-about-gamma/)
  and [Learn OpenGL: Gamma correction](https://learnopengl.com/Advanced-Lighting/Gamma-Correction):
  linear versus sRGB, with pictures of what goes wrong.
- [WebGL2 Fundamentals: Directional lighting](https://webgl2fundamentals.org/webgl/lessons/webgl-3d-lighting-directional.html)
  and [Point lighting](https://webgl2fundamentals.org/webgl/lessons/webgl-3d-lighting-point.html):
  the `dot(N, L)` term and the normal matrix, in a shader.
- [Learn OpenGL: Basic lighting](https://learnopengl.com/Lighting/Basic-Lighting),
  [PBR theory](https://learnopengl.com/PBR/Theory) and
  [PBR lighting](https://learnopengl.com/PBR/Lighting): from Phong to the
  Cook-Torrance BRDF, each term explained and then written in GLSL.
- [Learn OpenGL: Normal mapping](https://learnopengl.com/Advanced-Lighting/Normal-Mapping)
  and [Blending](https://learnopengl.com/Advanced-OpenGL/Blending): tangent
  space, and why transparent objects need sorting.
- [glTF specification, appendix B: BRDF implementation](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#appendix-b-brdf-implementation):
  the exact metallic-roughness model the PBR material implements.
- [Filament: Physically based rendering](https://google.github.io/filament/Filament.html):
  Google's real-time renderer documentation; the most thorough free text on
  the BRDF terms, their approximations and their cost.
- [Physically Based Rendering: From Theory to Implementation](https://pbr-book.org/):
  the book behind the term, for when the above is not deep enough.
- [Ben Eater and Grant Sanderson: Visualizing quaternions](https://eater.net/quaternions)
  and [3D Math Primer, chapter 8](https://gamemath.com/book/orient.html):
  what the four numbers of a quaternion mean, interactively and on paper.
