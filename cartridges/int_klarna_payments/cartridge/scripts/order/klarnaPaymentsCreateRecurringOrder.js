/**
* Script to create new Klarna Payments order through Klarna API
*
* @module cartridge/scripts/order/klarnaPaymentsCreateRecurringOrder
*
* @input Order : dw.order.Order The SFCC Order object
* @input LocaleObject : Object
*
* @output order_id : String
* @output redirect_url : String
* @output fraud_status : String
*/

'use strict';

var constants = require( '*/cartridge/scripts/util/constants' );
var Resource = require( 'dw/web/Resource' );
var Site = require( 'dw/system/Site' );
var klarnaPaymentsCaptureOrderHelper = require( '*/cartridge/scripts/order/klarnaPaymentsCaptureOrder' );

var KlarnaPayments = {
    httpService: require('*/cartridge/scripts/common/klarnaPaymentsHttpService'),
    apiContext: require('*/cartridge/scripts/common/klarnaPaymentsApiContext'),
    orderRequestBuilder: require('*/cartridge/scripts/payments/requestBuilder/order')
};

/**
 * Function that can be called by pipelines
 *
 * @param {Object} args Object parameters
 * @return {number} status
 */
function execute(args) {
    var order = args.Order;
    var localeObject = args.LocaleObject;
    var klarnaCustomerToken = args.klarnaCustomerToken;
    var result = createOrder(order, localeObject, klarnaCustomerToken);
    if (!result.success) {
        return PIPELET_ERROR;
    }
    args.order_id = result.order_id;
    args.redirect_url = result.redirect_url;
    args.fraud_status = result.fraud_status;

    return PIPELET_NEXT;
}

/**
 * Function to generate a request body
 *
 * @param {dw.order.Order} order SFCC Order object
 * @param {Object} localeObject locale object
 * @returns {Object} request object
 */
function _getRequestBody(order, localeObject) {
    var orderRequestBuilder = new KlarnaPayments.orderRequestBuilder();

    orderRequestBuilder.setParams({
        order: order,
        localeObject: localeObject,
        recurringOrder: true
    });

    return orderRequestBuilder.build();
}

/**
 * Function to create Klarna Recurring Order
 * 
 * @param {dw.order.Order} order SFCC order object
 * @param {Object} localeObject locale object
 * @param {string} klarnaCustomerToken Customer token to be used in Klarna API
 * @return {Object} status, order id, redirect url and fraud status
 */
function createOrder(order, localeObject, klarnaCustomerToken) {
    var logger = dw.system.Logger.getLogger('klarnaPaymentsCreateOrder.js');
    var KlarnaAdditionalLogging = require('*/cartridge/scripts/util/klarnaAdditionalLogging');

    try {
        var klarnaPaymentsHttpService = new KlarnaPayments.httpService();
        var klarnaApiContext = new KlarnaPayments.apiContext();
        var requestBody = _getRequestBody(order, localeObject);
        var requestUrl = dw.util.StringUtils.format(klarnaApiContext.getFlowApiUrls().get('createRecurringOrder'), klarnaCustomerToken);
        var serviceID = klarnaApiContext.getFlowApiIds().get('createRecurringOrder');
        var response = klarnaPaymentsHttpService.call(serviceID, requestUrl, 'POST', localeObject.custom.credentialID, requestBody);

        return {
            success: true,
            order_id: response.order_id,
            redirect_url: response.redirect_url,
            fraud_status: response.fraud_status,
            response: response
        };

    } catch (e) {
        logger.error('Error in creating Klarna Recurring Payments Order: {0}', e.message + e.stack);

        KlarnaAdditionalLogging.writeLog(order, order.custom.kpSessionId, 'klarnaPaymentsCreateOrder.createRecurringOrder()', 'Error in creating Klarna Recurring Payments Order. Error:' + JSON.stringify(e));

        return {
            success: false,
            response: null
        };
    }
}

/**
 * Parses a JSON string and returns JSON object if the input is valid; otherwise, returns null
 *
 * @param {string} text - The JSON string to be parsed.
 * @returns {Object|null} The parsed JSON object, or null if the JSON is invalid.
 */
function parseJson( text ) {
    try {
        return JSON.parse( text );
    } catch ( error ) {
        return null;
    }
}

/**
 * Function to create Klarna Recurring Order for lineitem subscriptions
 * 
 * @param {Object} payload SFCC JSON payload object
 * @param {Object} localeObject locale object
 * @param {string} klarnaCustomerToken Customer token to be used in Klarna API
 * @return {Object} status, order id, redirect url and fraud status
 */
function createOrderForSubscriptions( payload, localeObject, klarnaCustomerToken ) {
    var subscriptionLogger = dw.system.Logger.getLogger( 'klarnaPaymentsCreateRecurringOrder.js' );
    try {
        var klarnaPaymentsHttpService = new KlarnaPayments.httpService();
        var klarnaApiContext = new KlarnaPayments.apiContext();
        if ( !klarnaCustomerToken ) {
            throw new Error( Resource.msg( 'invalid.subscription.token.msg','subscription',null ) );
        }

        var requestBody = parseJson( payload );
        if( !requestBody ) {
            throw new Error( Resource.msg( 'invalid.payload.msg','subscription',null ) )
        }

        var requestUrl = dw.util.StringUtils.format( klarnaApiContext.getFlowApiUrls().get( constants.SERVICES.CREATE_RECURRING_ORDER ), klarnaCustomerToken );
        var serviceID = klarnaApiContext.getFlowApiIds().get( constants.SERVICES.CREATE_RECURRING_ORDER );
        var response = klarnaPaymentsHttpService.call( serviceID, requestUrl, constants.SERVICES.METHOD, localeObject.custom.credentialID, requestBody );
        var autoCaptureEnabled = Site.getCurrent().getCustomPreferenceValue( 'kpAutoCapture' );
        
        if ( autoCaptureEnabled && response && response.order_id ) {
            // Capture order in Klarna
            var captureData = {
                amount: requestBody.order_amount
            };
            klarnaPaymentsCaptureOrderHelper.createCapture( response.order_id, localeObject, captureData );
        }

        return {
            success: true,
            order_id: response.order_id,
            redirect_url: response.redirect_url,
            fraud_status: response.fraud_status,
            response: response
        };
    } catch ( e ) {
        var errorMsg = parseJson( e.message );
        subscriptionLogger.error( Resource.msgf( 'api.response.error', 'subscription', null, e.message ) );
       
        return {
            error: true,
            response: null,
            errorMessage: errorMsg ? errorMsg.error_code : e.message
        };
    }
}

module.exports = {
    createOrder: createOrder,
    createOrderForSubscriptions: createOrderForSubscriptions
};