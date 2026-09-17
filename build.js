import esbuild from 'esbuild';
import { glsl } from 'esbuild-plugin-glsl';

Promise.all([
  esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    format: 'esm',
    minify: false,
    outdir: 'dist',
    plugins: [glsl({ minify: true })],
  }),
  // a classic (non-module) worker script: it importScripts() the Draco
  // decoder, which module workers cannot do
  esbuild.build({
    entryPoints: ['src/loaders/gltf/draco-worker.ts'],
    bundle: true,
    format: 'iife',
    minify: false,
    outfile: 'dist/draco-worker.js',
  }),
]).catch(() => process.exit(1));
