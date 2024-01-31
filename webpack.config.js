/* globals cat, cd, cp, echo, exec, exit, find, ls, mkdir, rm, target, test */
'use strict';

require( 'shelljs/make' );
var path = require( 'path' );
var ExtractTextPlugin = require( 'sgmf-scripts' )['extract-text-webpack-plugin'];
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
		'klarnaExpressMiniCart': path.join(__dirname, cartridgePath + '/client/default/js/klarnaExpressMiniCart.js'),
		'klarnaExpressCheckoutPDP': path.join(__dirname, cartridgePath + '/client/default/js/klarnaExpressCheckoutPDP.js')
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
		'klarnaExpress': path.join( __dirname, cartridgePath + '/client/default/scss/klarnaExpress.scss' )
	},
	output: {
		path: path.resolve( cartridgePath + './static/default/css/' ),
		filename: '[name].css'
	},
	module: {
		rules: [{
			test: /\.scss$/,
			use: ExtractTextPlugin.extract( {
				use: [{
					loader: 'css-loader',
					options: {
						url: false,
						minimize: true
					}
				}, {
					loader: 'postcss-loader',
					options: {
						plugins: [
							require( 'autoprefixer' )()
						]
					}
				}, {
					loader: 'sass-loader',
					options: {
						includePaths: [
							path.resolve( 'node_modules' ),
							path.resolve( 'node_modules/flag-icon-css/sass' )
						]
					}
				}]
			} )
		}]
	},
	plugins: [
		new ExtractTextPlugin( { filename: '[name].css' } )
	]
}];
