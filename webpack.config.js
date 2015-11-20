var webpack = require('webpack');

module.exports = {
  entry: [
    './app/index'
  ],
  output: {
    path: __dirname + '/build/',
    filename: 'bundle.js',
    publicPath: '/build/'
  },
  plugins: [
    new webpack.NoErrorsPlugin(),
    new webpack.optimize.UglifyJsPlugin({
	     compress: {
	         warnings: false
	     }
	 })
  ],
  resolve: {
    extensions: ['', '.js','.scss']
  },
  module: {
    loaders: [
      { test: /\.js?$/, loader: 'babel?presets[]=es2015', exclude: /node_modules/ },
      { test: /\.css$/, loader: "style!css" },
      { test: /\.scss$/, loader: "style!css!sass" },
      { test: /.*\.gif$/, loader: "file" },
      { test: /.*\.svg$/,loaders: ['file','svgo-loader?useConfig=svgoConfig1'] }
    ]
  },
  svgoConfig1: {
    plugins: [
      {removeTitle: true},
      {convertColors: {shorthex: false}},
      {convertPathData: false}
    ]
  }
};