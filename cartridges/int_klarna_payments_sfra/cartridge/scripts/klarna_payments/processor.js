/* globals empty, session, request */

'use strict';

var KlarnaPaymentsConstants = require('~/cartridge/scripts/util/KlarnaPaymentsConstants');

var PAYMENT_METHOD = KlarnaPaymentsConstants.PAYMENT_METHOD;
var CREDIT_CARD_PROCESSOR_ID = KlarnaPaymentsConstants.CREDIT_CARD_PROCESSOR_ID;
var NOTIFY_EVENT_TYPES = KlarnaPaymentsConstants.NOTIFY_EVENT_TYPES;
var KLARNA_FRAUD_STATUSES = KlarnaPaymentsConstants.FRAUD_STATUS;

var Transaction = require('dw/system/Transaction');
var PaymentMgr = require('dw/order/PaymentMgr');
var OrderMgr = require('dw/order/OrderMgr');
var Logger = require('dw/system/Logger');
var StringUtils = require('dw/util/StringUtils');
var Site = require('dw/system/Site');
var Cypher = require('dw/crypto/Cipher');
var Status = require('dw/system/Status');
var HookMgr = require('dw/system/HookMgr');
var log = Logger.getLogger('KLARNA_PAYMENTS.js');

var KlarnaPaymentsOrderRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/order');
var KlarnaPaymentsHttpService = require('~/cartridge/scripts/common/KlarnaPaymentsHttpService');
var KlarnaPaymentsApiContext = require('~/cartridge/scripts/common/KlarnaPaymentsApiContext');
var KlarnaLocaleMgr = require('~/cartridge/scripts/klarna_payments/locale');
var KlarnaSessionManager = require('~/cartridge/scripts/common/KlarnaSessionManager');

var klarnaLocaleMgr = new KlarnaLocaleMgr();
var klarnaSessionManager = new KlarnaSessionManager(session, klarnaLocaleMgr);

/**
 * Creates a Klarna payments order through Klarna API
 * @param {dw.order.Order} 			order 			SCC order object
 * @param {dw.object.CustomObject} 	localeObject 	corresponding to the locale Custom Object from KlarnaCountries
 *
 * @private
 * @return {Object} requestObject Klarna Payments request object
 */
function getOrderRequestBody(order, localeObject) {
    var orderRequestBuilder = new KlarnaPaymentsOrderRequestBuilder();
    orderRequestBuilder.setParams({
        order: order,
        localeObject: localeObject
    });

    return orderRequestBuilder.build();
}

/**
 * Calls Klarna Create Order API.
 *
 * @param {dw.order.Order} order SCC order object
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 *
 * @return {Object|null} Klarna Payments create order response data on success, null on failure.
 */
function callKlarnaCreateOrderAPI(order, localeObject) {
    var klarnaPaymentsHttpService = {};
    var klarnaApiContext = {};
    var requestBody = {};
    var requestUrl = '';
    var response = {};
    var klarnaAuthorizationToken = session.privacy.KlarnaPaymentsAuthorizationToken;

    try {
        klarnaPaymentsHttpService = new KlarnaPaymentsHttpService();
        klarnaApiContext = new KlarnaPaymentsApiContext();
        requestBody = getOrderRequestBody(order, localeObject);
        requestUrl = StringUtils.format(klarnaApiContext.getFlowApiUrls().get('createOrder'), klarnaAuthorizationToken);

        response = klarnaPaymentsHttpService.call(requestUrl, 'POST', localeObject.custom.credentialID, requestBody);

        return response;
    } catch (e) {
        log.error('Error in creating Klarna Payments Order: {0}', e.message + e.stack);
        return null;
    }
}

/**
 * Call Klarna Payments API to acknowledge the order
 * @param {string} 					klarnaPaymentsOrderID 	Klarna Payments Order ID
 * @param {dw.object.CustomObject} 	localeObject 			corresponding to the locale Custom Object from KlarnaCountries
 *
 * @private
 * @return {void}
 */
function acknowledgeOrder(klarnaPaymentsOrderID, localeObject) {
    var klarnaHttpService = {};
    var klarnaApiContext = {};
    var klarnaOrderID = klarnaPaymentsOrderID;
    var requestUrl = '';

    try {
        klarnaHttpService = new KlarnaPaymentsHttpService();
        klarnaApiContext = new KlarnaPaymentsApiContext();
        requestUrl = StringUtils.format(klarnaApiContext.getFlowApiUrls().get('acknowledgeOrder'), klarnaOrderID);

        klarnaHttpService.call(requestUrl, 'POST', localeObject.custom.credentialID);
    } catch (e) {
        log.error('Error in acknowlidging order: {0}', e);
    }
}

/**
 * Cancels a Klarna order through Klarna API
 * @param {dw.order.Order} order SCC order object
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 *
 * @return {boolean} true if order has been successfully cancelled, otherwise false
 */
function cancelOrder(order, localeObject) {
    var klarnaPaymentsHttpService = {};
    var klarnaApiContext = {};
    var requestUrl = '';

    try {
        klarnaPaymentsHttpService = new KlarnaPaymentsHttpService();
        klarnaApiContext = new KlarnaPaymentsApiContext();
        requestUrl = StringUtils.format(klarnaApiContext.getFlowApiUrls().get('cancelOrder'), order.custom.kpOrderID);

        klarnaPaymentsHttpService.call(requestUrl, 'POST', localeObject.custom.credentialID, null);
    } catch (e)	{
        log.error('Error in cancelling Klarna Payments Order: {0}', e);
        return false;
    }
    return true;
}

/**
 * Place an order using OrderMgr. If order is placed successfully,
 * its status will be set as confirmed, and export status set to ready. Acknowledge order with Klarna Payments
 *
 * @param {dw.order.Order} 			order 					SCC order object
 * @param {string} 					klarnaPaymentsOrderID 	Klarna Payments Order ID
 * @param {dw.object.CustomObject} 	localeObject 			Klarna Payments locale Object
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

    acknowledgeOrder(klarnaPaymentsOrderID, localeObject);
}

/**
 * Update existing DW order with information from Klarna VCN settlement
 * @param {dw.order.order} order DW Order to be updated
 * @param {Object} cardInfo VCN CC data from Klarna response
 */
function updateOrderWithVCNCardInfo(order, cardInfo) {
    var orderForUpdate = order;
    var VCNPrivateKey = Site.getCurrent().getCustomPreferenceValue('vcnPrivateKey');
    var cypher = new Cypher();

    var panEncrypted = cardInfo.pan;
    var cscEncrypted = cardInfo.csc;

    var panDecrypted = cypher.decrypt(panEncrypted, VCNPrivateKey, 'RSA/ECB/PKCS1PADDING', null, 0);
    var cscDecrypted = cypher.decrypt(cscEncrypted, VCNPrivateKey, 'RSA/ECB/PKCS1PADDING', null, 0);

    Transaction.begin();

    orderForUpdate.custom.kpVCNBrand = cardInfo.brand;
    orderForUpdate.custom.kpVCNCSC = cscDecrypted;
    orderForUpdate.custom.kpVCNExpirationMonth = cardInfo.expiration_month;
    orderForUpdate.custom.kpVCNExpirationYear = cardInfo.expiration_year;
    orderForUpdate.custom.kpVCNHolder = cardInfo.holder;
    orderForUpdate.custom.kpVCNPAN = panDecrypted;
    orderForUpdate.custom.kpIsVCN = true;

    Transaction.commit();
}

/**
 * Create VCN settlement
 * @param {dw.order.Order} order SCC order object
 * @param {string} klarnaPaymentsOrderID Klarna Payments order id
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 *
 * @return {boolean} true if VCN settlement is created successfully, otherwise false
 */
function createVCNSettlement(order, klarnaPaymentsOrderID, localeObject) {
    var klarnaPaymentsHttpService = {};
    var klarnaApiContext = {};
    var requestBody = {};
    var requestUrl = '';
    var response = {};

    try {
        klarnaPaymentsHttpService = new KlarnaPaymentsHttpService();
        klarnaApiContext = new KlarnaPaymentsApiContext();
        requestBody = { order_id: klarnaPaymentsOrderID };
        requestUrl = klarnaApiContext.getFlowApiUrls().get('vcnSettlement');

        response = klarnaPaymentsHttpService.call(requestUrl, 'POST', localeObject.custom.credentialID, requestBody);
        if (empty(response.settlement_id)) {
            throw new Error('Could not create a VCN settlement');
        }

        updateOrderWithVCNCardInfo(order, response.cards[0]);
    } catch (e) {
        log.error('Error in creating Klarna Payments VCN Settlement: {0}', e);
        return false;
    }

    return true;
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
 */
function attemptAuthorizeVCNSettlement(order) {
    var processorResult = callCreditCardAuthorizationHook(order);

    if (processorResult.error) {
        failOrder(order);
    }
}

/**
 * Handle KP order authorization in case VCN settlement is enabled
 * @param {dw.order.order} order DW order
 * @param {string} kpOrderID KP order ID
 * @param {Object} localeObject locale info
 */
function handleVCNOrder(order, kpOrderID, localeObject) {
    try {
        createVCNSettlement(order, kpOrderID, localeObject);

        attemptAuthorizeVCNSettlement(order);
    } catch (e) {
        cancelOrder(order, localeObject);
        failOrder(order);
    }
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
    var kpVCNEnabledPreferenceValue = Site.getCurrent().getCustomPreferenceValue('kpVCNEnabled');
    var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();
    var pInstr = paymentInstrument;
    var dwOrder = order;

    Transaction.wrap(function () {
        pInstr.paymentTransaction.transactionID = kpOrderId;
        pInstr.paymentTransaction.paymentProcessor = paymentProcessor;
        dwOrder.custom.kpOrderID = kpOrderId;
        dwOrder.custom.kpIsVCN = empty(kpVCNEnabledPreferenceValue) ? false : kpVCNEnabledPreferenceValue;
    });
}

/**
 * Authorize order already accepted by Klarna.
 *
 * @param {dw.order.order} order DW Order
 * @param {string} kpOrderID KP Order ID
 * @param {Object} localeObject locale info
 *
 * @return {AuthorizationResult} authorization result
 */
function authorizeAcceptedOrder(order, kpOrderID, localeObject) {
    var kpVCNEnabledPreferenceValue = Site.getCurrent().getCustomPreferenceValue('kpVCNEnabled');
    var authResult = {};

    if (!kpVCNEnabledPreferenceValue) {
        acknowledgeOrder(kpOrderID, localeObject);
    } else {
        try {
            createVCNSettlement(order, kpOrderID, localeObject);

            authResult = callCreditCardAuthorizationHook(order);
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
    var localeObject = klarnaLocaleMgr.getLocale();
    var kpFraudStatus = kpOrderInfo.fraud_status;
    var kpOrderId = kpOrderInfo.order_id;

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
function authorize(order, orderNo, paymentInstrument) {
    var localeObject = klarnaLocaleMgr.getLocale();
    var apiResponseData = callKlarnaCreateOrderAPI(order, localeObject);

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
 * @param {string} kpOrderID KP Order ID
 * @param {string} kpEventType event type
 */
function notify(order, kpOrderID, kpEventType) {
    var localeObject = klarnaLocaleMgr.getLocale();

    saveFraudStatus(order, kpEventType);

    if (kpEventType === NOTIFY_EVENT_TYPES.FRAUD_RISK_ACCEPTED) {
        if (order.custom.kpIsVCN) {
            handleVCNOrder(order, kpOrderID, localeObject);
        }

        placeOrder(order, kpOrderID, localeObject);
    } else {
        failOrder(order);
    }
}
module.exports.handle = handle;
module.exports.authorize = authorize;
module.exports.notify = notify;
