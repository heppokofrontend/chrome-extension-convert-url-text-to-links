/// <reference types="node" />
import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const options = {
  entryPoints: ['src/worker.ts', 'src/content_scripts.ts', 'src/popup.ts'],
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  outdir: 'package',
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
};

if (isWatch) {
  const ctx = await esbuild.context(options);

  await ctx.watch();
} else {
  await esbuild.build(options);
}
