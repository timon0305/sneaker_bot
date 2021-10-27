const path = require('path');

module.exports = {
  mode: 'development',
  output: {
    path: path.resolve(__dirname, '..', 'dist'),
    filename: '[name].js',
  },
  node: {
    __dirname: false,
    __filename: true,
  },
  resolve: {
    extensions: ['.js', '.json'],
  },
  plugins: [],
};
