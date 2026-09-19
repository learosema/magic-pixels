---
title: Rendering to textures
children:
  - ./render-targets.md
  - ./tone-mapping.md
---

# Rendering to textures

Everything so far ended on the canvas. This chapter is about drawing into a
texture instead, and what that makes possible: the picture can be processed
before anyone sees it, and it can be used as an input to the next draw.
Shadows, reflections, picking and post-processing all start here.

- [Render targets](./render-targets.md): framebuffers and their attachments,
  and how a {@link RenderTarget} maps onto them.
- [Tone mapping](./tone-mapping.md): why the scene is rendered in linear HDR
  and converted to sRGB in a final pass, and how a fullscreen pass works.
