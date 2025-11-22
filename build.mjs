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

// 复制 CSS 文件（同步方式）
try {
  const cssContent = readFileSync('src/styles.css', 'utf8');
  writeFileSync('dist/styles.css', cssContent);
  console.log('✅ styles.css 复制成功');
} catch (error) {
  console.error('❌ styles.css 复制失败:', error);
}