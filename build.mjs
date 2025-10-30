// build.mjs
import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/main.js',
  platform: 'node',
  target: 'node16',
  external: [
    'fs',
    'path',
    'electron',
    'obsidian', // 👈 不打包 obsidian
  ],
  format: 'cjs',
  minify: false,      // ❌ 禁用压缩
  sourcemap: true,    // ✅ 保留源码映射，便于调试
  treeShaking: true,  // ✅ 摇除未使用代码
  legalComments: 'none', // 可选：移除许可证注释
});