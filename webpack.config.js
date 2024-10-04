/* globals cat, cd, cp, echo, exec, exit, find, ls, mkdir, rm, target, test */
'use strict';

require( 'shelljs/make' );
var path = require( 'path' );
var MiniCssExtractPlugin = require('mini-css-extract-plugin');
var CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
var RemoveEmptyScriptsPlugin = require('webpack-remove-empty-scripts');
var cartridgePath = './cartridges/int_klarna_payments_sfra/cartridge/';

module.exports = [{
	mode: 'production',
	name: 'js',
	entry: {
		'klarnaPayments': path.join( __dirname, cartridgePath + '/client/default/js/klarnaPayments.js' ),
		'klarnaOsm': path.join( __dirname, cartridgePath + '/client/default/js/klarnaOsm.js' ),
		'klarnaExpressButton': path.join( __dirname, cartridgePath + '/client/default/js/klarnaExpressButton.js' ),
		'klarnaMiniCart': path.join( __dirname, cartridgePath + '/client/default/js/klarnaMiniCart.js' ),
		'klarnaSubscriptions': path.join(__dirname, cartridgePath + '/client/default/js/klarnaSubscriptions.js'),
		'klarnaExpressCheckout': path.join(__dirname, cartridgePath + '/client/default/js/klarnaExpressCheckout.js'),
		'klarnaExpressCheckoutPDP': path.join(__dirname, cartridgePath + '/client/default/js/klarnaExpressCheckoutPDP.js'),
		'klarnaExpressMiniCart': path.join(__dirname, cartridgePath + '/client/default/js/klarnaExpressMiniCart.js'),
		'klarnaSignIn': path.join(__dirname, cartridgePath + '/client/default/js/klarnaSignIn.js')
	},
	output: {
		path: path.resolve( cartridgePath + './static/default/js/' ),
		filename: '[name].js'
	},
	optimization: {
		// We no not want to minimize our code.
		minimize: true
	}
}, {
	mode: 'production',
	name: 'scss',
	entry: {
		'klarnaPayments': path.join( __dirname, cartridgePath + '/client/default/scss/klarnaPayments.scss' ),
		'klarnaExpress': path.join( __dirname, cartridgePath + '/client/default/scss/klarnaExpress.scss' ),
		'klarnaSignIn': path.join( __dirname, cartridgePath + '/client/default/scss/klarnaSignIn.scss' )
	},
	output: {
		path: path.resolve(cartridgePath + './static/default/css/')
	},
	module: {
		rules: [
			{
				test: /\.scss$/,
				use: [
					{
						loader: MiniCssExtractPlugin.loader,
						options: {
							esModule: false
						}
					},
					{
						loader: 'css-loader',
						options: {
							url: false
						}
					},
					{
						loader: 'postcss-loader',
						options: {
							postcssOptions: {
								plugins: [require('autoprefixer')()]
							}
						}
					},
					{
						loader: 'sass-loader',
						options: {
							implementation: require('sass'),
							sassOptions: {
								includePaths: [
									path.resolve('node_modules'),
									path.resolve(
										'node_modules/flag-icon-css/sass'
									)
								]
							}
						}
					}
				]
			}
		]
	},
	plugins: [
		new RemoveEmptyScriptsPlugin(),
		new MiniCssExtractPlugin({
			filename: '[name].css',
			chunkFilename: '[name].css'
		})
	],
	optimization: {
		minimizer: ['...', new CssMinimizerPlugin()]
	}
}];
