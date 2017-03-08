'use strict';

/**
 * Controller for all storefront processes.
 *
 * @module controllers/Klarna
 */

/* API Includes */
const Logger = require( 'dw/system/Logger' );

/* Script Modules */
const guard = require( '~/cartridge/scripts/guard' );
const log = Logger.getLogger( 'Klarna.js' );