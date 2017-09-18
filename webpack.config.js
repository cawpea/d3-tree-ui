const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = [
  {
    context: path.join(__dirname, 'src'),
    entry: {
      'd3-tree-ui': './d3-tree-ui.js'
    },
    output: {
      path: path.join(__dirname, 'public'),
      filename: '[name].js'
    },
    module: {
      rules: [
        {
          loader: 'babel-loader',
          exclude: /node_modules/,
          options: {
            presets: ['es2015']
          }
        },
        {
          test: /\.scss$/,
          loaders: [
            'style-loader',
            {
              loader: 'css-loader',
              options: {url: false}
            },
            'sass-loader'
          ]
        }
      ]
    },
    devServer: {
      contentBase: path.resolve(__dirname, 'public'),
      port: 3000
    },
    devtool: 'source-map',
    resolve: {
      extensions: ['.js']
    }
  }
]