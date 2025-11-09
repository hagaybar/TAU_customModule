const config = require('./webpack.config');

module.exports = {
  ...config,
  mode: 'production',
  devtool: false, // Disabled source maps for Alma BO upload (source maps not allowed)
};
