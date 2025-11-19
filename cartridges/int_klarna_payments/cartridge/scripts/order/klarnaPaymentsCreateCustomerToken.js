/**
* Script to create new Klarna Payments order through Klarna API
*
* @module cartridge/scripts/order/klarnaPaymentsCreateCustomerToken
*
* @input Order : dw.order.Order The SFCC Order object
* @input LocaleObject : Object
* @input KlarnaAuthorizationToken : String
*
* @output order_id : String
* @output customer_token : String
*/

'use strict';


var KlarnaPayments = {
    httpService: require( '*/cartridge/scripts/common/klarnaPaymentsHttpService' ),
    apiContext: require( '*/cartridge/scripts/common/klarnaPaymentsApiContext' ),
    customerTokenRequestBuilder: require( '*/cartridge/scripts/payments/requestBuilder/customerToken' )
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
    var result = createCustomerToken( order, localeObject, klarnaAuthorizationToken );
    if ( !result.success ) {
        return PIPELET_ERROR;
    }
    args.order_id = result.order_id;
    args.customer_token = result.token_id;

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
    var customerTokenRequestBuilder = new KlarnaPayments.customerTokenRequestBuilder();

    customerTokenRequestBuilder.setParams( {
        order: order,
        localeObject: localeObject
    } );

    return customerTokenRequestBuilder.build();
}

/**
 * Function to create Klarna Order
 * @param {dw.order.Order} order SFCC order object
 * @param {Object} localeObject locale object
 * @param {string} klarnaAuthorizationToken Authentication token to be used in Klarna API
 * @return {Object} status, order id, redirect url and fraud status
 */
function createCustomerToken( order, localeObject, klarnaAuthorizationToken ) {
    var logger = dw.system.Logger.getLogger( 'klarnaPaymentsCreateCustomerToken.js' );
    var KlarnaAdditionalLogging = require( '*/cartridge/scripts/util/klarnaAdditionalLogging' );

    try {
        var klarnaPaymentsHttpService = new KlarnaPayments.httpService();
        var klarnaApiContext = new KlarnaPayments.apiContext();
        var requestBody = _getRequestBody( order, localeObject );
        var requestUrl = dw.util.StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'createCustomerToken' ), klarnaAuthorizationToken );
        var serviceID = klarnaApiContext.getFlowApiIds().get( 'createCustomerToken' );
        var response = klarnaPaymentsHttpService.call( serviceID, requestUrl, 'POST', localeObject.custom.credentialID, requestBody );

        return {
            success: true,
            order_id: response.order_id,
            customer_token: response.token_id,
            response: response
        };

    } catch ( e ) {
        logger.error( 'Error in creating Klarna Payments Customer Token: {0}', e.message + e.stack );

        KlarnaAdditionalLogging.writeLog( order, order.custom.kpSessionId, 'klarnaPaymentsCreateCustomerToken.createCustomerToken()', 'Error in creating Klarna Payments Order. Error:' + JSON.stringify( e ) );

        return {
            success: false,
            response: null
        };
    }
}

module.exports = {
    createCustomerToken: createCustomerToken
};