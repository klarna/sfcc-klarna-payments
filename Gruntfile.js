
module.exports = initSrc;

/**
 * Loads the grunt tasks of src.
 * These contain:
 * - Doc generation
 * - Code tests
 *
 * @param {Object} grunt The running grunt.
 */
function initSrc( grunt )
{
	'use strict';
	var jsdocPath = ['**/cartridge/scripts/**/*.js', '**/cartridge/controllers/*.js', '!/node_modules', '!**/cartridge/scripts/util/Class.js', '!**/cartridge/scripts/util/Browsing.js', '!**/cartridge/scripts/guard.js', '!**/cartridge/scripts/app.js'];
	var jscsPath = ['**/cartridge/scripts/**/*.js', '**/cartridge/controllers/*.js', '!/node_modules', '!**/cartridge/scripts/util/Class.js', '!**/cartridge/scripts/util/Browsing.js', '!**/cartridge/scripts/guard.js', '!**/cartridge/scripts/app.js'];
	var eslintPath = ['**/cartridge/scripts/**/*.js', '**/cartridge/controllers/*.js', '!/node_modules', '!**/cartridge/scripts/util/Class.js', '!**/cartridge/scripts/util/Browsing.js', '!**/cartridge/scripts/guard.js', '!**/cartridge/scripts/app.js'];

	grunt.loadNpmTasks( 'grunt-jsdoc' );
	grunt.loadNpmTasks( 'grunt-jscs' );
	grunt.loadNpmTasks( 'grunt-eslint' );
	grunt.loadNpmTasks( 'grunt-contrib-watch' );

	grunt.initConfig( {
		jsdoc : {
			dist : {
				src : jsdocPath,
				options : {
					destination : 'doc',
					configure : 'jsdoc.conf.json'
				}
			}
		},
		jscs : {
			cmd : {
				src : jscsPath,
				options : {
					config : '.jscsrc',
					esnext : false, // If you use ES6 http://jscs.info/overview.html#esnext
					verbose : true, // If you need output with rule names http://jscs.info/overview.html#verbose
					fix : false, // Autofix code style violations when possible.
					maxErrors : 9999,
					force : false
				}
			},
			junit : {
				src : jscsPath,
				options : {
					config : '.jscsrc',
					esnext : false, // If you use ES6 http://jscs.info/overview.html#esnext
					verbose : true, // If you need output with rule names http://jscs.info/overview.html#verbose
					fix : false, // Autofix code style violations when possible.
					maxErrors : 9999,
					force : true,
					reporter : 'junit',
					reporterOutput : 'junit.jscs.xml'
				}
			}
		},
		eslint : {
			cmd : {
				src : eslintPath
			},
			junit : {
				src : eslintPath,
				options : {
					outputFile : 'junit.eslint.xml',
					format : 'junit'
				}
			}
		},
		watch: {
			js: {
				files: jsdocPath,
				tasks: ['jscs:cmd', 'eslint:cmd']
			}
		},
	} );

	grunt.registerTask( 'default', ['jsdoc'] );
	grunt.registerTask( 'test', ['jscs:cmd', 'eslint:cmd'] );
	grunt.registerTask( 'test_junit', ['jscs:junit', 'eslint:junit'] );

};
