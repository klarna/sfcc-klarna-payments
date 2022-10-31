/**
* Creates a Klarna payment instrument for the given basket. If any error occurs the pipelet returns PIPELET_ERROR with
* no payment instrument being created. If the creation succeeded the script returns
* the newly created payment instrument.
*
* @module cartridge/scripts/createKlarnaPaymentInstrument
*
* @input Basket : dw.order.Basket The basket.
* @output PaymentInstrument : dw.order.PaymentInstrument The created payment instrument.
*/

'use strict';

/**
 * Function that can be called by pipelines
 *
 * @param {Object} args Object parameters
 * @return {number} status
 */
function execute( args ) {
    var result = createPaymentIntrument( args );

    if ( empty( result ) ) {
        return PIPELET_ERROR;
    }

    args.PaymentInstrument = result;
    return PIPELET_NEXT;
}

/**
 * Function to calculate order values and create Payment Instrument
 *
 * @param {Object} args Object containing the basket
 * @return {dw.order.PaymentInstrument} created payment instrument
 */
function createPaymentIntrument( args ) {
    var basket = args.Basket;

    // verify that we have a basket and a valid credit card form
    if ( basket === null ) {
        return null;
    }

    // calculate the amount to be charged
    var KlarnaHelper = require( '*/cartridge/scripts/util/klarnaHelper' );
    var amount = KlarnaHelper.calculateOrderTotalValue( basket );

    // create a payment instrument for this payment instrument
    var PAYMENT_METHOD = KlarnaHelper.getPaymentMethod();
    var paymentInstr = basket.createPaymentInstrument( PAYMENT_METHOD, amount );

    paymentInstr = KlarnaHelper.setPaymentCategoryDetails( paymentInstr );

    return paymentInstr;
}

module.exports = {
    createPaymentIntrument: createPaymentIntrument
};
