/* globals empty, session, request */

'use strict';

var KlarnaPaymentsConstants = require('~/cartridge/scripts/util/KlarnaPaymentsConstants.js');

var PAYMENT_METHOD = KlarnaPaymentsConstants.PAYMENT_METHOD;
var CREDIT_CARD_PROCESSOR_ID = KlarnaPaymentsConstants.CREDIT_CARD_PROCESSOR_ID;
var NOTIFY_EVENT_TYPES = KlarnaPaymentsConstants.NOTIFY_EVENT_TYPES;

var Transaction = require('dw/system/Transaction');
var PaymentMgr = require('dw/order/PaymentMgr');
var OrderMgr = require('dw/order/OrderMgr');
var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var Countries = require('~/cartridge/scripts/util/Countries');
var Logger = require('dw/system/Logger');
var StringUtils = require('dw/util/StringUtils');
var Site = require('dw/system/Site');
var Cypher = require('dw/crypto/Cipher');
var Status = require('dw/system/Status');
var HookMgr = require('dw/system/HookMgr');

var log = Logger.getLogger('KLARNA_PAYMENTS.js');

var KlarnaPaymentsOrderRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/order');
var KlarnaPaymentsHttpService = require('~/cartridge/scripts/common/KlarnaPaymentsHttpService.ds');
var KlarnaPaymentsApiContext = require('~/cartridge/scripts/common/KlarnaPaymentsApiContext');

var collections = require('*/cartridge/scripts/util/collections');

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
 * Creates a Klarna order through Klarna API
 * @param {dw.order.Order} order SCC order object
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 *
 * @return {boolean} true if order has been successfully created, otherwise false
 */
function createKlarnaOrder(order, localeObject) {
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

        Transaction.wrap(function () {
            session.privacy.KlarnaPaymentsSessionID = null; // dettach klarna session handler id from user session
            session.privacy.KlarnaPaymentsOrderID = response.order_id;
            session.privacy.KlarnaPaymentsRedirectURL = response.redirect_url;
            session.privacy.KlarnaPaymentsFraudStatus = response.fraud_status;
        });
    } catch (e) {
        log.error('Error in creating Klarna Payments Order: {0}', e.message + e.stack);
        return false;
    }

    return true;
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
 * Gets Klarna Payments Locale object
 *
 * @param {string} currentCountry current country locale
 *
 * @return {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 */
function getLocale(currentCountry) {
    var localeObject = {};
    var currCountry = currentCountry;

    if (empty(currentCountry)) {
        currCountry = Countries.getCurrent({ CurrentRequest: request }).countryCode;
    }

    localeObject = CustomObjectMgr.getCustomObject('KlarnaCountries', currCountry);

    return localeObject;
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

    //	var panEncrypted = cardInfo.pan;
    //	var cscEncrypted = cardInfo.csc;

    // mocking pan and csc
    var panEncrypted = 'U50dpsYfr29a+kZta2A9pYdAPYvp1GnUYEt7BwFF2vWcD+31EHhzUuKHNnns61NQ+pjayXjHMll1v3lNLDehhAVj5/OuJCmAgk20Wx1SI/RYLtK5wA9Iv7ZOnGdwXOseTTUcXCgY1fjpBWtpqlgsBgqobZhaX3Q0KaBk89qwT2o21/Yo5HKiafxnZSAQ0x2lG5GBkRjy/UC/9nfkeCNZATxADQG2L3FnHrqXq/F6CLUmsxPIawWO5wmpYToa4/4UhAuQS/L/3lmvXoBd68gNSQsWSs+gjrNxMejmR5HJvzuwUj+htLZxvGds+FRSFFABZfbU+z1b9HjbzdxdkD55jtVHoWA1diTiFODSguScertk0oCwAFz6AKFC4P7NedfDuko3QFew2ab3CFO76DYQYXDE18itNHAG/PgpkYttS7sS1n1EJMBGh+18BbOmOutyuuAq0z7j3tiUfLl0aXCMs76VeoawGBKQhIY2k6fUTlaRjolSAwcwZbZV7dZZq5TcwIVzhiIBOtz/v3y0AhnEUua5kOeM6r1ulPqdPv2vHRIPPDHwQ6051GB68QpVnIRnvR63UVOqogsXyBduO281MNbXWRlO7c1UbjI3UlJiM0AVsZgZ0uWQxhbF+Xu48dkjhcjvbA4oi79RRtw4UfDHyEOOSX2zaOf/D5KY1GUPwAw=';
    var cscEncrypted = 'P/jEMDJszBNpVdwNN/OCBHW+yuF3WcXGhX/vwVFjeGjp/YohO//6pHm9ggtY0m6inTzvfA849VZlJxeq8QVpo1p8dUUvC6L6CvmUEC8kUZBU77TkNChJCvzaGYr74pjsntu65A3nipraGCoCkAdYagtrJBZ0gl6jrv8jq2f+OfuH+YZoX0HMqvSh0v1+M+7sHLhxVDPs7Daqn8v6qyuZEajMYk4AZI4uKAu/X3TJTItC4hXa/epGIPDivyQ/EwDMK27P/I8rfw0bY6zxMw2+fYWlVjXbrUtl7Z/WiiUNC3cayrZtysAphD3RLt9re6dC6h1AzCIWBFZxHKCJB1MihDqgALOeLS6B4rxqljbb3bfWAkK6nkbnSEHwlvh628eNyIS9Ga/YWlriy4Z7kcCH7VuFcfKskGiDUE1qozeOmq58dMj6DRwsjgCshnWfd/HXcIdYuvEb0wn/mMygZa7MG2V7Sd2ROLtNpn6JhR0WScgJcwNWVN7sfhmElGy8bcmDYArusU0mDTUfamPmhVeRTbdiWE8xEqSqmIStUoPe1BvxHeKs+Gdw6iQKsxruwOJb+Tz5zzyfbsrVDp3wxsa3nb9nSJOZGTmi3ie7y02a/KuLGsypsIXZR2P1Jjofuh4mvT1nu4W2VJKNG9IuhxIAh8adCCxbZ0Cn70+8P3p42S4=';

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

    var hook = 'app.payment.processor.' + CREDIT_CARD_PROCESSOR_ID;
    if (!HookMgr.hasHook(hook)) {
        throw new Error('File of app.payment.processor.' + CREDIT_CARD_PROCESSOR_ID + ' hook is missing or the hook is not configured');
    }

    processorResult = HookMgr.callHook('app.payment.processor.' + CREDIT_CARD_PROCESSOR_ID, 'Authorize', order.getOrderNo(), paymentInstrument, paymentProcessor);
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
    var methodName = PAYMENT_METHOD;

    var amount = basket.totalGrossPrice;

    var paymentInstrument = null;

    Transaction.wrap(function () {
        var paymentInstruments = basket.getPaymentInstruments(methodName);

        collections.forEach(paymentInstruments, function (item) {
            basket.removePaymentInstrument(item);
        });

        paymentInstrument = basket.createPaymentInstrument(methodName, amount);
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
 */
function updateOrderWithKlarnaOrderInfo(order, paymentInstrument) {
    var kpVCNEnabledPreferenceValue = Site.getCurrent().getCustomPreferenceValue('kpVCNEnabled');
    var paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();
    var pInstr = paymentInstrument;
    var dwOrder = order;

    Transaction.begin();

    pInstr.paymentTransaction.transactionID = session.privacy.KlarnaPaymentsOrderID;
    pInstr.paymentTransaction.paymentProcessor = paymentProcessor;
    session.privacy.OrderNo = order.getOrderNo();
    dwOrder.custom.kpOrderID = session.privacy.KlarnaPaymentsOrderID;
    dwOrder.custom.kpIsVCN = empty(kpVCNEnabledPreferenceValue) ? false : kpVCNEnabledPreferenceValue;

    Transaction.commit();
}

/**
 *
 * @param {dw.order.order} order DW Order
 * @param {string} orderNo DW Order No
 * @param {string} kpOrderID KP Order ID
 * @param {Object} localeObject locale info
 * @param {dw.order.paymentInstrument} paymentInstrument klarna payment instrument
 *
 * @return {AuthorizationResult} authorization result
 */
function authorizeAcceptedOrder(order, orderNo, kpOrderID, localeObject, paymentInstrument) {
    var kpVCNEnabledPreferenceValue = Site.getCurrent().getCustomPreferenceValue('kpVCNEnabled');
    var authResult = {};

    if (session.privacy.KlarnaPaymentsFraudStatus === 'ACCEPTED' && !kpVCNEnabledPreferenceValue) {
        acknowledgeOrder(session.privacy.KlarnaPaymentsOrderID, localeObject);
    }

    updateOrderWithKlarnaOrderInfo(order, paymentInstrument);

    if (session.privacy.KlarnaPaymentsFraudStatus !== 'PENDING' && kpVCNEnabledPreferenceValue) {
        try {
            createVCNSettlement(order, session.privacy.KlarnaPaymentsOrderID, localeObject);

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
 * Update Order Data
 *
 * @param {dw.order.LineItemCtnr} order - Order object
 * @param {string} orderNo - Order Number
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument - current payment instrument
 * @returns {Object} Processor authorizing result
 */
function authorize(order, orderNo, paymentInstrument) {
    var authorizationResult = {};
    var localeObject = getLocale();

    var klarnaOrderCreated = createKlarnaOrder(order, localeObject);

    Transaction.wrap(function () {
        var pInstr = paymentInstrument;

        pInstr.paymentTransaction.custom.kpFraudStatus = session.privacy.KlarnaPaymentsFraudStatus;
    });

    if (!klarnaOrderCreated || session.privacy.KlarnaPaymentsFraudStatus === 'REJECTED') {
        authorizationResult = generateErrorAuthResult();
    } else {
        authorizationResult = authorizeAcceptedOrder(order, orderNo, session.privacy.KlarnaPaymentsOrderID, localeObject, paymentInstrument);
    }

    return authorizationResult;
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
    var localeObject = getLocale();

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
