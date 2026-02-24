import path from 'path';
import webpack from 'webpack';
import HtmlWebPackPlugin from 'html-webpack-plugin';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

const isDevelopment = process.env.NODE_ENV !== 'production';

module.exports = {
  mode: isDevelopment ? 'development' : 'production',
  devtool: isDevelopment ? 'source-map' : false,
  watchOptions: {
    poll: 1000,
    aggregateTimeout: 1000,
    ignored: ['**/node_modules'],
  },
  entry: './src/index.tsx',
  devServer: {
    port: 8080,
    allowedHosts: 'all',
    hot: true,
    historyApiFallback: true,
  },
  output: { path: path.resolve(__dirname, 'build') },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.scss', '.css'],
  },
  module: {
    rules: [
      {
        test: /\.(t|j)sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              // https://babeljs.io/docs/en/babel-preset-env
              '@babel/preset-env',
              // https://babeljs.io/docs/en/babel-preset-typescript
              '@babel/preset-typescript',
              // https://babeljs.io/docs/en/babel-preset-react
              ['@babel/preset-react', { development: isDevelopment }],
            ],
            plugins: [
              isDevelopment && require.resolve('react-refresh/babel'),
            ].filter(Boolean),
          },
        },
      },
      {
        test: /\.s?[ac]ss$/i,
        use: [
          isDevelopment
            ? 'style-loader'
            : {
                // save the css to external file
                loader: MiniCssExtractPlugin.loader,
                options: {
                  esModule: false,
                },
              },
          {
            // https://www.npmjs.com/package/css-loader
            loader: 'css-loader',
            options: {
              esModule: false,
              importLoaders: 2, // 2 other loaders used first, postcss-loader
              sourceMap: isDevelopment,
            },
          },
          {
            // process tailwind stuff
            // https://webpack.js.org/loaders/postcss-loader/
            loader: 'postcss-loader',
            options: {
              sourceMap: isDevelopment,
              postcssOptions: {
                plugins: [
                  require('@tailwindcss/postcss'),
                  // add addtional postcss plugins here
                  // easily find plugins at https://www.postcss.parts/
                ],
              },
            },
          },
        ],
      },
      {
        test: /\.html$/i,
        loader: 'html-loader',
        options: {
          esModule: false,
        },
      },
      {
        test: /\.(ico)$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]',
          esModule: false,
        },
      },
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      React: 'react',
    }),
    new HtmlWebPackPlugin({
      template: './src/index.html',
      filename: './index.html',
    }),
    isDevelopment && new ReactRefreshWebpackPlugin(),
  ],
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  },
};
