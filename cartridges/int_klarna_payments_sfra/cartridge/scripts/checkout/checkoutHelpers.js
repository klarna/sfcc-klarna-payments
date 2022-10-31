'use strict';

var superMdl = module.superModule;

var placeOrderParent = superMdl.placeOrder;
var KlarnaPaymentsConstants = require('*/cartridge/scripts/util/klarnaPaymentsConstants');

var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');
var KLARNA_PAYMENT_METHOD = KlarnaHelper.getPaymentMethod();
var KLARNA_FRAUD_STATUSES = KlarnaPaymentsConstants.FRAUD_STATUS;

var Transaction = require('dw/system/Transaction');
var Status = require('dw/system/Status');
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');

/**
 * Find the first klarna payment transaction within the order (if exists).
 *
 * @param {dw.order.Order} order - The Order currently being placed.
 * @returns {dw.order.PaymentTransaction} Klarna Payment Transaction
 */
function findKlarnaPaymentTransaction(order) {
    var paymentTransaction = null;
    var paymentInstruments = order.getPaymentInstruments(KLARNA_PAYMENT_METHOD);

    if (paymentInstruments && paymentInstruments.length) {
        paymentTransaction = paymentInstruments[0].paymentTransaction;
    }

    return paymentTransaction;
}

/**
 * Attempts to place the order
 * @param {dw.order.Order} order - The order object to be placed
 * @param {Object} fraudDetectionStatus - an Object returned by the fraud detection hook
 * @returns {Object} an error object
 */
superMdl.placeOrder = function (order, fraudDetectionStatus) {
    var result = { error: false };
    var klarnaPaymentTransaction = findKlarnaPaymentTransaction(order);

    if (!klarnaPaymentTransaction) {
        return placeOrderParent(order, fraudDetectionStatus);
    }

    var kpFraudStatus = klarnaPaymentTransaction.custom.kpFraudStatus;

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
