const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = [
  {
    context: path.join(__dirname, 'src'),
    entry: {
      bundle: './tree-ui.js'
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
  },
  {
    context: path.join(__dirname, 'src'),
    entry: {
      bundle: './tree-ui.scss'
    },
    output: {
      path: path.join(__dirname, 'public/css'),
      filename: '[name].css'
    },
    module: {
      rules: [
        {
          test: /\.scss$/,
          use: ExtractTextPlugin.extract(
            {
              fallback: "style-loader",
              use: ["css-loader", "sass-loader"]
            }
          )
        }
      ]
    },
    plugins: [
      new ExtractTextPlugin('bundle.css')
    ]
  }
]