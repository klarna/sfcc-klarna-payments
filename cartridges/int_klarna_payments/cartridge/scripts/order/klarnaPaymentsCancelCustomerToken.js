/**
* Script to cancel Klarna Payments customer token through Klarna API
*
* @module cartridge/scripts/order/klarnaPaymentsCancelCustomerToken
*
* @input customer_token : String Customer token to be cancelled
* @input LocaleObject : Object
*
*/

'use strict';


var KlarnaPayments = {
    httpService: require( '*/cartridge/scripts/common/klarnaPaymentsHttpService' ),
    apiContext: require( '*/cartridge/scripts/common/klarnaPaymentsApiContext' ),
    cancelCustomerTokenRequestBuilder: require( '*/cartridge/scripts/payments/requestBuilder/cancelCustomerToken' )
};

/**
 * Function that can be called by pipelines
 *
 * @param {Object} args Object parameters
 * @return {number} status
 */
function execute( args ) {
    var localeObject = args.LocaleObject;
    var customerToken = args.customerToken;
    var result = cancelCustomerToken( localeObject, customerToken );
    if ( !result.success ) {
        return PIPELET_ERROR;
    }

    return PIPELET_NEXT;
}

/**
 * Function to generate a request body
 *
 * @param {Object} localeObject locale object
 * @returns {Object} request object
 */
function _getRequestBody( localeObject ) {
    var customerTokenRequestBuilder = new KlarnaPayments.cancelCustomerTokenRequestBuilder();
    return customerTokenRequestBuilder.build();
}

/**
 * Function to cancel Klarna Customer Token
 * 
 * @param {Object} localeObject locale object
 * @param {string} customerToken Customer token to be cancelled
 * @return {Object} status and fraud status
 */
function cancelCustomerToken( localeObject, customerToken ) {
    var logger = dw.system.Logger.getLogger( 'klarnaPaymentsCancelCustomerToken.js' );
    var KlarnaAdditionalLogging = require( '*/cartridge/scripts/util/klarnaAdditionalLogging' );

    try {
        var klarnaPaymentsHttpService = new KlarnaPayments.httpService();
        var klarnaApiContext = new KlarnaPayments.apiContext();
        var requestBody = _getRequestBody( localeObject );
        var requestUrl = dw.util.StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'cancelCustomerToken' ), customerToken );
        var serviceID = klarnaApiContext.getFlowApiIds().get( 'cancelCustomerToken' );
        var response = klarnaPaymentsHttpService.call( serviceID, requestUrl, 'PATCH', localeObject.custom.credentialID, requestBody, customerToken );

        return {
            success: true,
            response: response
        };

    } catch ( e ) {
        logger.error( 'Error in cancelling Klarna Payments Customer Token: {0}', e.message + e.stack );

        return {
            success: false,
            response: null
        };
    }
}

module.exports = {
    cancelCustomerToken: cancelCustomerToken
};