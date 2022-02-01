/**
* Script to create new Klarna Payments order through Klarna API
*
* @module cartridge/scripts/order/klarnaPaymentsCreateOrder
*
* @input Order : dw.order.Order The SFCC Order object
* @input LocaleObject : Object
* @input KlarnaAuthorizationToken : String
*
* @output order_id : String
* @output redirect_url : String
* @output fraud_status : String
*/

'use strict';


var KlarnaPayments = {
    httpService : require( '*/cartridge/scripts/common/klarnaPaymentsHttpService' ),
    apiContext : require( '*/cartridge/scripts/common/klarnaPaymentsApiContext' ),
    orderRequestBuilder : require( '*/cartridge/scripts/payments/requestBuilder/order' )
};

/**
 * Function that can be called by pipelines
 *
 * @param {Object} args Object parameters
 * @return {number} status
 */
function execute( args ) {
    var order = args.Order;
    var localeObject = args.LocaleObject;
    var klarnaAuthorizationToken = args.KlarnaAuthorizationToken;
    var result = createOrder( order, localeObject, klarnaAuthorizationToken );
    if ( !result.success ) {
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
function _getRequestBody( order, localeObject ) {
    var orderRequestBuilder = new KlarnaPayments.orderRequestBuilder();

    orderRequestBuilder.setParams( {
        order: order,
        localeObject: localeObject
    } );

    return orderRequestBuilder.build();
}

/**
 * Function to create Klarna Order
 * 
 * @param {dw.order.Order} order SFCC order object
 * @param {Object} localeObject locale object
 * @param {string} klarnaAuthorizationToken Authentication token to be used in Klarna API
 * @return {Object} status, order id, redirect url and fraud status
 */
function createOrder( order, localeObject, klarnaAuthorizationToken ) {
    var logger = dw.system.Logger.getLogger( 'klarnaPaymentsCreateOrder.js' );

    try {
        var klarnaPaymentsHttpService = new KlarnaPayments.httpService();
        var klarnaApiContext = new KlarnaPayments.apiContext();
        var requestBody = _getRequestBody( order, localeObject );
        var requestUrl = dw.util.StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'createOrder' ), klarnaAuthorizationToken );
        var serviceID = klarnaApiContext.getFlowApiIds().get( 'createOrder' );
        var response = klarnaPaymentsHttpService.call( serviceID, requestUrl, 'POST', localeObject.custom.credentialID, requestBody );
        return {
            success: true,
            order_id: response.order_id,
            redirect_url: response.redirect_url,
            fraud_status: response.fraud_status,
            response: response
        };

    } catch ( e ) {
        logger.error( 'Error in creating Klarna Payments Order: {0}', e.message + e.stack );
        return {
            success: false,
            response: null
        };
    }
}

module.exports = {
    createOrder: createOrder
};