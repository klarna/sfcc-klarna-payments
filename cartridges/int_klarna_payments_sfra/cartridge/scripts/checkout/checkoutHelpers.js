'use strict';

var superMdl = module.superModule;

var KlarnaPaymentsConstants = require('*/cartridge/scripts/util/KlarnaPaymentsConstants.js');

var KLARNA_PAYMENT_METHOD = KlarnaPaymentsConstants.PAYMENT_METHOD;
var KLARNA_FRAUD_STATUSES = KlarnaPaymentsConstants.FRAUD_STATUS;

var Transaction = require('dw/system/Transaction');
var Status = require('dw/system/Status');
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');

/**
 *
 * @param {dw.order.Order} order - The order object to be placed
 * @returns {string} Klarna Payments Fraud Status
 */
function getKlarnaPaymentTransactionFraudStatus(order) {
    var paymentInstrument = order.getPaymentInstruments(KLARNA_PAYMENT_METHOD)[0];
    var paymentTransaction = paymentInstrument.paymentTransaction;

    return paymentTransaction.custom.kpFraudStatus;
}

/**
 * Attempts to place the order
 * @param {dw.order.Order} order - The order object to be placed
 * @returns {Object} an error object
 */
superMdl.placeOrder = function (order) {
    var result = { error: false };
    var kpFraudStatus = getKlarnaPaymentTransactionFraudStatus(order);

    try {
        Transaction.begin();

        if (kpFraudStatus === KLARNA_FRAUD_STATUSES.PENDING) {
            order.setExportStatus(order.EXPORT_STATUS_NOTEXPORTED);
            order.setConfirmationStatus(order.CONFIRMATION_STATUS_NOTCONFIRMED);
            order.setPaymentStatus(order.PAYMENT_STATUS_NOTPAID);
        } else {
            var placeOrderStatus = OrderMgr.placeOrder(order);
            if (placeOrderStatus === Status.ERROR) {
                throw new Error();
            }

            order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
            order.setExportStatus(Order.EXPORT_STATUS_READY);
        }

        Transaction.commit();
    } catch (e) {
        Transaction.wrap(function () { OrderMgr.failOrder(order); });
        result.error = true;
    }

    return result;
};

module.exports = superMdl;