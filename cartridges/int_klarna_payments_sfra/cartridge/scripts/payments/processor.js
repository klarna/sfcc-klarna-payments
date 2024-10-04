/* globals empty, session, request */

'use strict';

var KlarnaPaymentsConstants = require('*/cartridge/scripts/util/klarnaPaymentsConstants');

var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');
var PAYMENT_METHOD = KlarnaHelper.getPaymentMethod();
var CREDIT_CARD_PROCESSOR_ID = KlarnaPaymentsConstants.CREDIT_CARD_PROCESSOR_ID;
var NOTIFY_EVENT_TYPES = KlarnaPaymentsConstants.NOTIFY_EVENT_TYPES;
var KLARNA_FRAUD_STATUSES = KlarnaPaymentsConstants.FRAUD_STATUS;

var Transaction = require('dw/system/Transaction');
var PaymentMgr = require('dw/order/PaymentMgr');
var OrderMgr = require('dw/order/OrderMgr');
var Logger = require('dw/system/Logger');
var Site = require('dw/system/Site');
var Status = require('dw/system/Status');
var HookMgr = require('dw/system/HookMgr');
var log = Logger.getLogger('KlarnaPayments');
var PaymentTransaction = require('dw/order/PaymentTransaction');

var KlarnaSessionManager = require('*/cartridge/scripts/common/klarnaSessionManager');
var klarnaSessionManager = new KlarnaSessionManager();

/**
 * Calls Klarna Create Order API.
 *
 * @param {dw.order.Order} order SCC order object
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 *
 * @return {Object|null} Klarna Payments create order response data on success, null on failure.
 */
function callKlarnaCreateOrderAPI(order, localeObject) {
    var klarnaAuthorizationToken = session.privacy.KlarnaPaymentsAuthorizationToken;

    var createOrderHelper = require('*/cartridge/scripts/order/klarnaPaymentsCreateOrder');
    var klarnaCreateOrderResponse = createOrderHelper.createOrder(order, localeObject, klarnaAuthorizationToken);
    return klarnaCreateOrderResponse.response;
}

/**
 * Calls Klarna Create Customer Token API.
 *
 * @param {dw.order.Order} order SCC order object
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 *
 * @return {Object|null} Klarna Payments create customer token response data on success, null on failure.
 */
function callKlarnaCreateCustomerTokenAPI(order, localeObject, kpAuthorizationToken) {
    var klarnaAuthorizationToken = kpAuthorizationToken || session.privacy.KlarnaPaymentsAuthorizationToken;
    var customer = order.customer.authenticated;
    var createCustomerTokenHelper = require('*/cartridge/scripts/order/klarnaPaymentsCreateCustomerToken');
    var klarnaCreateCustomerTokenResponse = createCustomerTokenHelper.createCustomerToken(order, localeObject, klarnaAuthorizationToken);
    return klarnaCreateCustomerTokenResponse.response;
}

/**
 * Calls Klarna Create Recurring Order API.
 *
 * @param {dw.order.Order} order SCC order object
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 *
 * @return {Object|null} Klarna Payments create order response data on success, null on failure.
 */
function callKlarnaCreateRecurringOrderAPI(order, localeObject) {
    var customer = order.customer;
    if (!customer) {
        return null;
    }
    var customerToken = order.custom.kpCustomerToken;
    var createOrderHelper = require('*/cartridge/scripts/order/klarnaPaymentsCreateRecurringOrder');
    var klarnaCreateOrderResponse = createOrderHelper.createOrder(order, localeObject, customerToken);
    return klarnaCreateOrderResponse.response;
}

/**
 * Cancels a Klarna order through Klarna API
 * @param {dw.order.Order} order SCC order object
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 *
 * @return {boolean} true if order has been successfully cancelled, otherwise false
 */
function cancelOrder(order, localeObject) {
    var klarnaPaymentsCancelOrderHelper = require('*/cartridge/scripts/order/klarnaPaymentsCancelOrder');
    var cancelResult = klarnaPaymentsCancelOrderHelper.cancelOrder(localeObject, order);
    return cancelResult.success;
}

/**
 * Handle auto-capture functionality.
 *
 * @param {dw.order.Order} dwOrder DW Order object.
 * @param {string} kpOrderId Klarna Payments Order ID
 * @param {dw.object.CustomObject} localeObject locale object (KlarnaCountries).
 */
function handleAutoCapture(dwOrder, kpOrderId, localeObject) {
    Transaction.wrap(function () {
        var klarnaPaymentsCaptureOrderHelper = require('*/cartridge/scripts/order/klarnaPaymentsCaptureOrder');
        klarnaPaymentsCaptureOrderHelper.handleAutoCapture(dwOrder, kpOrderId, localeObject);
    });
}

/**
 * Place an order using OrderMgr. If order is placed successfully,
 * its status will be set as confirmed, and export status set to ready.
 * Autocapture is handled after placing the order if enabled).
 *
 * @param {dw.order.Order} order SCC order object
 * @param {string} klarnaPaymentsOrderID Klarna Payments Order ID
 * @param {dw.object.CustomObject} localeObject Klarna Payments locale Object
 *
 * @return {void}
 */
function placeOrder(order, klarnaPaymentsOrderID, localeObject) {
    Transaction.wrap(function () {
        var placeOrderStatus = OrderMgr.placeOrder(order);
        if (placeOrderStatus === Status.ERROR) {
            OrderMgr.failOrder(order);
            throw new Error('Failed to place order.');
        }
        order.setConfirmationStatus(order.CONFIRMATION_STATUS_CONFIRMED);
        order.setExportStatus(order.EXPORT_STATUS_READY);
    });

    if (!order.custom.kpIsVCN) {
        try {
            var autoCaptureEnabled = Site.getCurrent().getCustomPreferenceValue('kpAutoCapture');

            if (autoCaptureEnabled) {
                handleAutoCapture(order, klarnaPaymentsOrderID, localeObject);
            }
        } catch (e) {
            log.error('Order could not be placed: {0}', e.message + e.stack);

            var KlarnaAdditionalLogging = require('*/cartridge/scripts/util/klarnaAdditionalLogging');
            KlarnaAdditionalLogging.writeLog(order, order.custom.kpSessionId, 'processor.js:placeOrder()', 'Order could not be placed. Error:' + JSON.stringify(e));

        }
    }
}

/**
 * Handles the VCN settlement
 *
 * If the settlement retry has been enabled, we will retry to settle the order in case the first one failed
 *
 * @param {dw.order.Order} order SCC order object
 * @param {string} klarnaPaymentsOrderID Klarna Payments order id
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 *
 * @return {boolean} true if VCN settlement is created successfully, otherwise false
 */
function handleVCNSettlement(order, klarnaPaymentsOrderID, localeObject) {
    var vcnHelper = require('*/cartridge/scripts/VCN/klarnaPaymentsVCNSettlement');
    return vcnHelper.handleVCNSettlement(order, klarnaPaymentsOrderID, localeObject);
}

/**
 * Call Credit Card Authorization Hook (for VCN settlement)
 * @param {dw.order.order} order DW Order
 * @returns {processorResult} authorization result
 */
function callCreditCardAuthorizationHook(order) {
    var processorResult = null;
    var paymentInstrument = order.getPaymentInstruments(PAYMENT_METHOD)[0];
    var paymentProcessor = PaymentMgr
        .getPaymentMethod(paymentInstrument.paymentMethod)
        .paymentProcessor;
    var transactionID = paymentInstrument.getPaymentTransaction().getTransactionID();

    var hook = 'app.payment.processor.' + CREDIT_CARD_PROCESSOR_ID;
    if (!HookMgr.hasHook(hook)) {
        throw new Error('File of app.payment.processor.' + CREDIT_CARD_PROCESSOR_ID + ' hook is missing or the hook is not configured');
    }

    processorResult = HookMgr.callHook('app.payment.processor.' + CREDIT_CARD_PROCESSOR_ID, 'Authorize', transactionID, paymentInstrument, paymentProcessor);
    return processorResult;
}

/**
 * Fail DW order
 * @param {dw.order.order} order DW Order
 */
function failOrder(order) {
    Transaction.wrap(function () {
        OrderMgr.failOrder(order);
    });
}

/**
 * Handle the processing of a new Klarna payment transaction
 *
 * @param {dw.order.LineItemCtnr} basket - Current basket
 * @param {boolean} isFromCart - Is checkout started from cart
 * @returns {Object} Processor handling result
 */
function handle(basket) {
    var methodId = PAYMENT_METHOD;

    var amount = basket.totalGrossPrice;

    var paymentInstrument = null;

    Transaction.wrap(function () {
        paymentInstrument = basket.createPaymentInstrument(methodId, amount);
    });

    return {
        success: true,
        paymentInstrument: paymentInstrument
    };
}

/**
 * Attempt to authorize a VCN settlement for a DW order
 * @param {dw.order.order} order DW Order
 * @returns {processorResult} authorization result
 */
function attemptAuthorizeVCNSettlement(order) {
    var processorResult = callCreditCardAuthorizationHook(order);

    if (processorResult.error) {
        failOrder(order);
    }

    return processorResult;
}

/**
 * Handle KP order authorization in case VCN settlement is enabled
 * @param {dw.order.order} order DW order
 * @param {string} klarna_oms__kpOrderID KP order ID
 * @param {Object} localeObject locale info
 * @returns {boolean} true if successfully handled
 */
function handleVCNOrder(order, klarna_oms__kpOrderID, localeObject) {
    try {
        var isSettlementCreated = handleVCNSettlement(order, klarna_oms__kpOrderID, localeObject);

        if (!isSettlementCreated) {
            cancelOrder(order, localeObject);
            failOrder(order);
            return false;
        }
        attemptAuthorizeVCNSettlement(order);
    } catch (e) {
        cancelOrder(order, localeObject);
        failOrder(order);
        return false;
    }

    return true;
}

/**
 * @returns {Object} error auth result
 */
function generateErrorAuthResult() {
    return { error: true };
}

/**
 * @returns {Object} success auth result
 */
function generateSuccessAuthResult() {
    return { authorized: true };
}

/**
 *
 * @param {Object} authResult Authorization result
 * @returns {boolean} true, if the auth result is error
 */
function isErrorAuthResult(authResult) {
    return (!empty(authResult.error) && authResult.error);
}

/**
 *
 * @param {dw.order.order} order DW order
 * @param {dw.order.paymentInstrument} paymentInstrument DW payment instrument
 * @param {string} kpOrderId Klarna Order Id.
 */
function updateOrderWithKlarnaOrderInfo(order, paymentInstrument, kpOrderId) {
    var kpVCNEnabledPreferenceValue = KlarnaHelper.isVCNEnabled();
    var kpAutoCaptureEnabled = Site.getCurrent().getCustomPreferenceValue('kpAutoCapture');
    var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();
    var pInstr = paymentInstrument;
    var dwOrder = order;

    Transaction.wrap(function () {
        pInstr.paymentTransaction.transactionID = kpOrderId;
        pInstr.paymentTransaction.paymentProcessor = paymentProcessor;

        if (kpAutoCaptureEnabled && !kpVCNEnabledPreferenceValue) {
            pInstr.paymentTransaction.type = PaymentTransaction.TYPE_CAPTURE;
        } else {
            pInstr.paymentTransaction.type = PaymentTransaction.TYPE_AUTH;
        }

        dwOrder.custom.klarna_oms__kpOrderID = kpOrderId;
        dwOrder.custom.kpIsVCN = empty(kpVCNEnabledPreferenceValue) ? false : kpVCNEnabledPreferenceValue;
    });
}

/**
 *
 * @param {dw.order.order} order DW order
 * @param {dw.order.paymentInstrument} paymentInstrument DW payment instrument
 * @param {string} kpOrderId Klarna Order Id.
 */
function updateOrderAndCustomerInfo(order, paymentInstrument, customerToken) {
    var kpVCNEnabledPreferenceValue = KlarnaHelper.isVCNEnabled();
    var dwOrder = order;

    session.privacy.customer_token = customerToken;

    Transaction.wrap(function () {
        dwOrder.custom.kpIsVCN = empty(kpVCNEnabledPreferenceValue) ? false : kpVCNEnabledPreferenceValue;
    });
}

/**
 * Authorize order already accepted by Klarna.
 *
 * @param {dw.order.order} order DW Order
 * @param {string} klarna_oms__kpOrderID KP Order ID
 * @param {Object} localeObject locale info
 *
 * @return {AuthorizationResult} authorization result
 */
function authorizeAcceptedOrder(order, klarna_oms__kpOrderID, localeObject) {
    var autoCaptureEnabled = Site.getCurrent().getCustomPreferenceValue('kpAutoCapture');
    var kpVCNEnabledPreferenceValue = KlarnaHelper.isVCNEnabled();
    var authResult = {};

    if (!kpVCNEnabledPreferenceValue) {
        if (autoCaptureEnabled) {
            try {
                handleAutoCapture(order, klarna_oms__kpOrderID, localeObject);
            } catch (e) {
                authResult = generateErrorAuthResult();
            }
        }
    } else {
        try {
            var isSettlementCreated = handleVCNSettlement(order, klarna_oms__kpOrderID, localeObject);

            if (!isSettlementCreated) {
                authResult = generateErrorAuthResult();
                cancelOrder(order, localeObject);
            } else {
                authResult = callCreditCardAuthorizationHook(order);
            }
        } catch (e) {
            authResult = generateErrorAuthResult();
            cancelOrder(order, localeObject);
        }
    }

    if (isErrorAuthResult(authResult)) {
        return authResult;
    }

    return generateSuccessAuthResult();
}

/**
 * Handle Klarna Create Order API call response.
 *
 * @param {dw.order.order} order DW Order.
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument DW PaymentInstrument.
 * @param {Object} kpOrderInfo Response data from Klarna Create Order API call.
 * @returns {Object} Authorization result object.
 */
function handleKlarnaOrderCreated(order, paymentInstrument, kpOrderInfo) {
    var authorizationResult = {};
    var localeObject = klarnaSessionManager.getLocale();
    var kpFraudStatus = kpOrderInfo.fraud_status;
    var kpOrderId = kpOrderInfo.order_id;
    var redirectURL = kpOrderInfo.redirect_url;

    klarnaSessionManager.removeSession();

    Transaction.wrap(function () {
        var pInstr = paymentInstrument;
        pInstr.paymentTransaction.custom.kpFraudStatus = kpFraudStatus;
    });

    updateOrderWithKlarnaOrderInfo(order, paymentInstrument, kpOrderId);

    if (kpFraudStatus === KLARNA_FRAUD_STATUSES.REJECTED) {
        authorizationResult = generateErrorAuthResult();
    } else if (kpFraudStatus === KLARNA_FRAUD_STATUSES.PENDING) {
        authorizationResult = generateSuccessAuthResult();
    } else {
        authorizationResult = authorizeAcceptedOrder(order, kpOrderId, localeObject);
    }

    if (!authorizationResult.error) {
        session.privacy.KlarnaPaymentsAuthorizationToken = '';
        session.privacy.KPAuthInfo = null;

        if (redirectURL) { // store Redirect URL in session
            session.privacy.KlarnaPaymentsRedirectURL = redirectURL;
            // and in Order custom property
            var dwOrder = order;
            Transaction.wrap(function () {
                dwOrder.custom.kpRedirectURL = redirectURL;
            });
        }
    }

    return authorizationResult;
}

/**
 * Handle Klarna Create Customer Toekn API call response.
 *
 * @param {dw.order.order} order DW Order.
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument DW PaymentInstrument.
 * @param {Object} kpOrderInfo Response data from Klarna Create Order API call.
 * @returns {Object} Authorization result object.
 */
function handleKlarnaCustomerTokenCreated(order, paymentInstrument, kpOrderInfo) {
    var URLUtils = require('dw/web/URLUtils');
    var authorizationResult = {};
    var localeObject = klarnaSessionManager.getLocale();
    var customerToken = kpOrderInfo.token_id;

    klarnaSessionManager.removeSession();

    updateOrderAndCustomerInfo(order, paymentInstrument, customerToken);

    authorizationResult = generateSuccessAuthResult();

    if (!authorizationResult.error) {
        session.privacy.KlarnaPaymentsAuthorizationToken = '';
        session.privacy.KPAuthInfo = null;
        Transaction.wrap(function () {
            order.custom.kpRedirectURL = URLUtils.url('Order-Confirm').toString();
        });
    }

    return authorizationResult;
}

/**
 * Update Order Data
 *
 * @param {dw.order.LineItemCtnr} order - Order object
 * @param {string} orderNo - Order Number
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument - current payment instrument
 * @returns {Object} Processor authorizing result
 */
function authorize(order, orderNo, paymentInstrument, isRecurringOrder) {
    var klarnaAuthorizationToken = session.privacy.KlarnaPaymentsAuthorizationToken;
    var finalizeRequired = false;
    try {
        finalizeRequired = JSON.parse(session.privacy.KPAuthInfo).FinalizeRequired;
        if (finalizeRequired === 'true') {
            session.privacy.finalizeRequired = 'true';
        } else {
            session.privacy.finalizeRequired = null;
        }
    } catch (e) {
        log.error('Error parsing JSON from KPAuthInfo: ', e);
    }

    // Do not fail Klarna order until a callback
    if (finalizeRequired && (klarnaAuthorizationToken === 'undefined' || klarnaAuthorizationToken === null || empty(klarnaAuthorizationToken))) {
        return { authorized: true };
    }

    var localeObject = klarnaSessionManager.getLocale();
    var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');
    var subscriptionData = SubscriptionHelper.getSubscriptionData(order);
    var apiResponseData;
    if (subscriptionData && !isRecurringOrder) {
        var customerTokenResponseData = callKlarnaCreateCustomerTokenAPI(order, localeObject);
        if (!customerTokenResponseData) {
            return generateErrorAuthResult();
        }

        if (subscriptionData.subscriptionTrialPeriod) {
            return handleKlarnaCustomerTokenCreated(order, paymentInstrument, customerTokenResponseData);
        } else {
            session.privacy.customer_token = customerTokenResponseData.token_id;
        }
    }
    if (isRecurringOrder) {
        apiResponseData = callKlarnaCreateRecurringOrderAPI(order, localeObject);
    } else {
        apiResponseData = callKlarnaCreateOrderAPI(order, localeObject);
    }
    if (!apiResponseData) {
        return generateErrorAuthResult();
    }
    return handleKlarnaOrderCreated(order, paymentInstrument, apiResponseData);

}

/**
 * Save new fraud status into the the first Klarna Payment Transaction of an order
 *
 * @param {dw.order.order} order Order
 * @param {string} kpFraudStatus Klarna fraud status
 */
function saveFraudStatus(order, kpFraudStatus) {
    var paymentInstrument = order.getPaymentInstruments(PAYMENT_METHOD)[0];

    var paymentTransaction = paymentInstrument.paymentTransaction;

    Transaction.wrap(function () {
        paymentTransaction.custom.kpFraudStatus = kpFraudStatus;
    });
}

/**
 * Handle Klarna notification
 * @param {dw.order.order} order DW Order
 * @param {string} klarna_oms__kpOrderID KP Order ID
 * @param {string} kpEventType event type
 */
function notify(order, klarna_oms__kpOrderID, kpEventType) {
    var localeObject = klarnaSessionManager.getLocale();

    saveFraudStatus(order, kpEventType);

    if (kpEventType === NOTIFY_EVENT_TYPES.FRAUD_RISK_ACCEPTED) {
        if (order.custom.kpIsVCN) {
            handleVCNOrder(order, klarna_oms__kpOrderID, localeObject);
        }

        placeOrder(order, klarna_oms__kpOrderID, localeObject);
    } else {
        failOrder(order);
    }
}

/**
 * Place Order on Klarna Bank Transfer callback by Klarna sessionId and Authorization Token
 * @param {dw.order.order} order DW Order
 * @param {string} kpSessionId Klarna Session ID
 * @param {string} kpAuthorizationToken Klarna Authorization Token
 * @returns {Object} Place Order via a callback result
 */
function bankTransferPlaceOrder(order, kpSessionId, kpAuthorizationToken) {
    var paymentInstrument = order.getPaymentInstruments(PAYMENT_METHOD)[0];
    var localeObject = klarnaSessionManager.getLocale();
    var result = null;

    var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');
    var subscriptionData = SubscriptionHelper.getSubscriptionData(order);
    if (subscriptionData) {
        var customerTokenResponseData = callKlarnaCreateCustomerTokenAPI(order, localeObject, kpAuthorizationToken);
        if (!customerTokenResponseData) {
            return generateErrorAuthResult();
        }

        if (subscriptionData.subscriptionTrialPeriod) {
            result = handleKlarnaCustomerTokenCreated(order, paymentInstrument, customerTokenResponseData);
        } else {
            session.privacy.customer_token = customerTokenResponseData.token_id;
        }
    }

    if (result === null) {
        var createOrderHelper = require('*/cartridge/scripts/order/klarnaPaymentsCreateOrder');
        var klarnaCreateOrderResponse = createOrderHelper.createOrder(order, localeObject, kpAuthorizationToken);
        var apiResponseData = klarnaCreateOrderResponse.response;

        if (!apiResponseData) {
            return generateErrorAuthResult();
        }

        result = handleKlarnaOrderCreated(order, paymentInstrument, apiResponseData);
    }

    Transaction.wrap(function () {
        var placeOrderStatus = OrderMgr.placeOrder(order);
        if (placeOrderStatus === Status.ERROR) {
            OrderMgr.failOrder(order);
            log.error('Failed to place order.');
            throw new Error('Failed to place order.');
        }

        if (subscriptionData && customerTokenResponseData.token_id) {
            dw.system.Logger.error('updateCustomerSubscriptionData - ');
            SubscriptionHelper.updateCustomerSubscriptionData(order);
        }

        order.setConfirmationStatus(order.CONFIRMATION_STATUS_CONFIRMED);
        order.setExportStatus(order.EXPORT_STATUS_READY);
    });

    return result;
}

/**
 * Call Klarna Payments API to get an order
 * @param {string} klarnaPaymentsOrderID Klarna Payments Order ID
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 *
 * @return {Object} Klarna order
 */
function getKlarnaOrder(klarnaPaymentsOrderID) {
    var localeObject = klarnaSessionManager.getLocale();
    var klarnaPaymentsGetOrderHelper = require('*/cartridge/scripts/order/klarnaPaymentsGetOrder');
    return klarnaPaymentsGetOrderHelper.getKlarnaOrder(klarnaPaymentsOrderID, localeObject);
}

/**
 * Deletes the previous authorization
 * @param {string} authToken Authorization Token
 * @return {string} Service call result
 */
function cancelAuthorization(authToken) {
    var klarnaAuthorizationToken = authToken || session.privacy.KlarnaPaymentsAuthorizationToken;

    var localeObject = klarnaSessionManager.getLocale();
    var klarnaCancelAuthorizationHelper = require('*/cartridge/scripts/klarnaPaymentsCancelAuthorization');
    return klarnaCancelAuthorizationHelper.cancelAuthorization(klarnaAuthorizationToken, localeObject);
}

module.exports.handle = handle;
module.exports.authorize = authorize;
module.exports.notify = notify;
module.exports.cancelAuthorization = cancelAuthorization;
module.exports.getKlarnaOrder = getKlarnaOrder;
module.exports.bankTransferPlaceOrder = bankTransferPlaceOrder;

