/**
* Script to update Klarna Sessions
*
* @module cartridge/scripts/session/klarnaPaymentsUpdateSession
*
* @input KlarnaPaymentsSessionID : String
* @input Basket : dw.order.Basket
* @input LocaleObject : Object
*/

// import packages
var KlarnaPayments = {
    httpService : require( '*/cartridge/scripts/common/klarnaPaymentsHttpService' ),
    apiContext : require( '*/cartridge/scripts/common/klarnaPaymentsApiContext' ),
    sessionRequestBuilder : require( '*/cartridge/scripts/payments/requestBuilder/session' )
};

/**
 * Function that can be called by pipelines
 *
 * @param {Object} args Object parameters
 * @return {number} status
 */
function execute( args ) {
    var updateSessionResponse = updateSession( args.KlarnaPaymentsSessionID, args.Basket, args.LocaleObject );
    if ( !updateSessionResponse.success ) {
        return PIPELET_ERROR
    }
    return PIPELET_NEXT;
}

/**
 * Function to create session request body
 *
 * @param {dw.order.Basket} basket cart object
 * @param {Object} localeObject Klarna locale object
 * @return {Object} session request body
 */
function _getRequestBody( basket, localeObject ) {
    var sessionRequestBuilder = new KlarnaPayments.sessionRequestBuilder();

    sessionRequestBuilder.setParams( {
        basket: basket,
        localeObject: localeObject
    } );

    return sessionRequestBuilder.build();
}

/**
 * Function to call the Klarna API to update session
 * 
 * @param {string} klarnaSessionID Klarna session ID
 * @param {dw.order.Basket} basket cart object
 * @param {Object} localeObject Klarna locale object
 * @return {Object} success status, response
 */
function updateSession( klarnaSessionID, basket, localeObject ) {
    var Transaction = require( 'dw/system/Transaction' );
    var response = null;
    var klarnaPaymentsHttpService = new KlarnaPayments.httpService();

    try {
        var klarnaApiContext = new KlarnaPayments.apiContext();
        var requestBody = _getRequestBody( basket, localeObject );
        requestUrl = dw.util.StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'updateSession' ), klarnaSessionID );

        // Update session
        klarnaPaymentsHttpService.call( requestUrl, 'POST', localeObject.custom.credentialID, requestBody );
    } catch ( e ) {
        return require( '*/cartridge/scripts/session/klarnaPaymentsCreateSession' ).createSession( basket, localeObject );
    }

    try {
        // Read updated session
        response = klarnaPaymentsHttpService.call( requestUrl, 'GET', localeObject.custom.credentialID );
        var klarnaPaymentMethods = response.payment_method_categories ? JSON.stringify( response.payment_method_categories ) : null;

        Transaction.wrap( function() {
            session.privacy.KlarnaPaymentsClientToken = response.client_token;
            session.privacy.KlarnaPaymentMethods = klarnaPaymentMethods;
        } );
    } catch ( e ) {
        dw.system.Logger.error( 'Error in updating Klarna Payments Session: {0}', e.message + e.stack );
        Transaction.wrap( function() {
            session.privacy.KlarnaPaymentsSessionID = null;
            session.privacy.KlarnaPaymentsClientToken = null;
            session.privacy.KlarnaPaymentMethods = null;
            session.privacy.SelectedKlarnaPaymentMethod = null;
        } );
        return {
            success: false,
            response: null
        };
    }
    return {
        success: true,
        response: response
    };
}

module.exports = {
    updateSession: updateSession
}