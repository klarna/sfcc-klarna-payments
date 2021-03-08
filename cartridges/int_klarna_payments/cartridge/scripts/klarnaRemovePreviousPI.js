/**
* Script removing all previous added payment instruments from the provided basket
*
* @module cartridge/scripts/klarnaRemovePreviousPI
* 
* @input Basket : dw.order.Basket The basket
*/

'use strict';

var PaymentInstrument = require( 'dw/order/PaymentInstrument' );

/**
 * Function that can be called by pipelines
 *
 * @param {Object} args Object parameters
 * @return {number} status
 */
function execute( args ) {
    var result = removePaymentInstruments( args );

    if ( result && !result.success ) {
        return PIPELET_ERROR;
    }

    return PIPELET_NEXT;
}

/**
 * Function to remove payment instrument from basket
 *
 * @param {Object} args Object containing basket
 * @return {Object} object containing success status
 */
function removePaymentInstruments( args ) {
    var basket = args.Basket;

    if ( basket === null ) {
        return {
            success: false
        };
    }

    var paymentInstrs = basket.getPaymentInstruments();
    var iter = paymentInstrs.iterator();
    var existingPI = null;

    // remove all PI except gift certificates
    while ( iter.hasNext() ) {
        existingPI = iter.next();
        if ( !PaymentInstrument.METHOD_GIFT_CERTIFICATE.equals( existingPI.paymentMethod ) ) {
            basket.removePaymentInstrument( existingPI );
        }
    }

    return {
        success: true
    };
}

module.exports = {
    removePaymentInstruments: removePaymentInstruments
};