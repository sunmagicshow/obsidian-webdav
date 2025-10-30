// webpack.config.js
const path = require('path');

module.exports = {
  entry: './src/main.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  target: 'node',
  externals: {
    fs: 'commonjs fs',
    path: 'commonjs path',
    electron: 'commonjs electron',
    obsidian: 'commonjs obsidian',
  },
  mode: 'none', // 👈 最安全：不启用任何默认优化
  devtool: 'source-map',
  optimization: {
    minimize: false, // 👈 明确关闭压缩
  },
};