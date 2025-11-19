/* globals session */

'use strict';

var superMdl = module.superModule;

var placeOrderParent = superMdl.placeOrder;
var KlarnaPaymentsConstants = require('*/cartridge/scripts/util/klarnaPaymentsConstants');

var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');
var KLARNA_PAYMENT_METHOD = KlarnaHelper.getPaymentMethod();
var KLARNA_FRAUD_STATUSES = KlarnaPaymentsConstants.FRAUD_STATUS;

var Transaction = require('dw/system/Transaction');
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var PaymentMgr = require('dw/order/PaymentMgr');
var HookMgr = require('dw/system/HookMgr');
var Logger = require('dw/system/Logger');

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
            if (placeOrderStatus.error) {
                throw new Error();
            }
            if (session.privacy.customer_token) {
                var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');
                SubscriptionHelper.updateCustomerSubscriptionData(order);
            }

            order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
            order.setExportStatus(Order.EXPORT_STATUS_READY);
        }

        Transaction.commit();
    } catch (e) {
        Transaction.wrap(function () { OrderMgr.failOrder(order); });
        result.error = true;
        Logger.error('Error in place order: ' + e);
    }

    return result;
};

/**
 * handles the payment authorization for each payment instrument
 * @param {dw.order.Order} order - the order object
 * @param {string} orderNumber - The order number for the order
 * @param {boolean} isRecurringOrder - indicates whether the order is a recurring order
 * @returns {Object} an error object
 */
superMdl.handlePayments = function (order, orderNumber, isRecurringOrder) {
    var result = {};

    if (order.totalNetPrice !== 0.00) {
        var paymentInstruments = order.paymentInstruments;

        if (paymentInstruments.length === 0) {
            Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
            result.error = true;
        }

        if (!result.error) {
            for (var i = 0; i < paymentInstruments.length; i++) { // eslint-disable-line no-plusplus
                var paymentInstrument = paymentInstruments[i];
                var paymentProcessor = PaymentMgr
                    .getPaymentMethod(paymentInstrument.paymentMethod)
                    .paymentProcessor;
                var authorizationResult;
                if (paymentProcessor === null) {
                    Transaction.begin();
                    paymentInstrument.paymentTransaction.setTransactionID(orderNumber);
                    Transaction.commit();
                } else {
                    if (HookMgr.hasHook('app.payment.processor.' + paymentProcessor.ID.toLowerCase())) {
                        authorizationResult = HookMgr.callHook(
                            'app.payment.processor.' + paymentProcessor.ID.toLowerCase(),
                            'Authorize',
                            orderNumber,
                            paymentInstrument,
                            paymentProcessor,
                            isRecurringOrder
                        );
                    } else {
                        authorizationResult = HookMgr.callHook(
                            'app.payment.processor.default',
                            'Authorize'
                        );
                    }

                    if (authorizationResult.error) {
                        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
                        result.error = true;
                        break;
                    }
                }
            }
        }
    }

    return result;
};

/**
 * Attempts to create an order from the current basket
 * @param {dw.order.Basket} currentBasket - The current basket
 * @returns {dw.order.Order|null} The order object created from the current basket
 */
superMdl.createOrder = function (currentBasket) {
    var order;

    try {
        order = Transaction.wrap(function () {
            return OrderMgr.createOrder(currentBasket);
        });
    } catch (error) {
        Logger.error(error);
        Logger.error(error.stack);
        return null;
    }
    return order;
};

module.exports = superMdl;
