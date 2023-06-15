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
var KlarnaHelper = require( '*/cartridge/scripts/util/klarnaHelper' );
var KlarnaAdditionalLogging = require( '*/cartridge/scripts/util/klarnaAdditionalLogging' );

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
    var Site = require( 'dw/system/Site' );
    var response = null;
    var klarnaPaymentsHttpService = new KlarnaPayments.httpService();

    try {
        var klarnaApiContext = new KlarnaPayments.apiContext();
        var requestBody = _getRequestBody( basket, localeObject );
        requestUrl = dw.util.StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'updateSession' ), klarnaSessionID );
        var serviceID = klarnaApiContext.getFlowApiIds().get( 'updateSession' );
        // Update session
        klarnaPaymentsHttpService.call( serviceID, requestUrl, 'POST', localeObject.custom.credentialID, requestBody, klarnaSessionID );
    } catch ( e ) {
        var errorMsg = e.message;
        var errorMsgObj = JSON.parse( errorMsg );
        KlarnaAdditionalLogging.writeLog(basket, basket.custom.kpSessionId, 'klarnaPaymentsUpdateSession.updateSession()', 'Error Updating Klarna session. Error:' + JSON.stringify( e ) );

        if ( Site.getCurrent().getCustomPreferenceValue( 'kpCreateNewSessionWhenExpires' ) || errorMsgObj.error === 404 || errorMsgObj.error_code === 'INVALID_OPERATION' ) {
            return require( '*/cartridge/scripts/session/klarnaPaymentsCreateSession' ).createSession( basket, localeObject );
        }
    }

    try {
        // Read updated session
        response = klarnaPaymentsHttpService.call( serviceID, requestUrl, 'GET', localeObject.custom.credentialID, null, klarnaSessionID );
        var klarnaPaymentMethods = response.payment_method_categories ? JSON.stringify( response.payment_method_categories ) : null;

        Transaction.wrap( function() {
            session.privacy.KlarnaPaymentMethods = klarnaPaymentMethods;

            basket.custom.kpClientToken = response.client_token;
        } );
    } catch ( e ) {
        dw.system.Logger.error( 'Error in updating Klarna Payments Session: {0}', e.message + e.stack );
        KlarnaAdditionalLogging.writeLog(basket, basket.custom.kpSessionId, 'klarnaPaymentsUpdateSession.updateSession()', 'Error reading updated Klarna session. Error:' + JSON.stringify( e ) );

        KlarnaHelper.clearSessionRef( basket );
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