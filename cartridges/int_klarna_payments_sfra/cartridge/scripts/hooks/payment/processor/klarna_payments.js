'use strict';

/* global dw */

var KlarnaPaymentsProcessor = require('*/cartridge/scripts/payments/processor');

/**
 * Handle entry point for SG integration
 * @param {Object} basket Basket
 * @returns {Object} processor result
 */
function Handle(basket) {
    var result = KlarnaPaymentsProcessor.handle(basket);
    return result;
}

/**
 * Authorize entry point for SG integration
 * @param {Object} orderNumber order numebr
 * @param {Object} paymentInstrument payment intrument
 * @returns {Object} processor result
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor, isReccuringOrder) {
    var order = dw.order.OrderMgr.getOrder(orderNumber);
    var recurringOrder = isReccuringOrder !== 'undefined' ? isReccuringOrder : false;
    var result = KlarnaPaymentsProcessor.authorize(order, orderNumber, paymentInstrument, recurringOrder);
    return result;
}

/**
 * Verifies the required information for billing form is provided.
 * @param {Object} req - The request object
 * @param {Object} paymentForm - the payment form
 * @param {Object} viewFormData - object contains billing form data
 * @returns {Object} an object that has error information or payment information
 */
function processForm(req, paymentForm, viewFormData) {
    var viewData = viewFormData;

    viewData.paymentMethod = {
        value: paymentForm.paymentMethod.value,
        htmlName: paymentForm.paymentMethod.value
    };

    return {
        error: false,
        viewData: viewData
    };
}

exports.Handle = Handle;
exports.Authorize = Authorize;
exports.processForm = processForm;
