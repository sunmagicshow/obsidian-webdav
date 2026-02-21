// build.mjs
/* global console */
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';

// 构建主文件
await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/main.js',
  platform: 'node',
  target: 'node16',
  external: ['fs', 'path', 'electron', 'obsidian'],
  format: 'cjs',
  minify: false,
  sourcemap: true,
  treeShaking: true,
  legalComments: 'none',
});

// 复制文件
try {
    const Content = readFileSync('src/styles.css', 'utf8');
    const Content2 = readFileSync('manifest.json', 'utf8');
    writeFileSync('dist/styles.css', Content);
    writeFileSync('dist/manifest.json', Content2);
    console.log('✅ 文件复制成功');
} catch {
    console.log('❌ 文件复制失败:');
}