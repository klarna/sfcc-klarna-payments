'use strict';

/* global dw */

/**
 * Handle entry point for SG integration
 * @param {Object} basket Basket
 * @returns {Object} processor result
 */
function Handle( basket ) {
	var result = require( '~/cartridge/scripts/klarna_payments/processor' ).handle( basket );
	return result;
}

/**
 * Authorize entry point for SG integration
 * @param {Object} orderNumber order numebr
 * @param {Object} paymentInstrument payment intrument
 * @returns {Object} processor result
 */
function Authorize( orderNumber, paymentInstrument ) {
	var order = dw.order.OrderMgr.getOrder( orderNumber );
	var result = require( '~/cartridge/scripts/klarna_payments/processor' ).authorize( order, orderNumber, paymentInstrument );
	return result;
}

exports.Handle = Handle;
exports.Authorize = Authorize;
