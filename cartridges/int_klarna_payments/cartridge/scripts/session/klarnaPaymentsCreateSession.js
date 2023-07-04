/**
* Script to create new Klarna Sessions
*
* @module cartridge/scripts/session/klarnaPaymentsCreateSession
*
* @input Basket : dw.order.Basket The basket
* @input LocaleObject : Object
*/

'use strict';

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
    var createSessionResponse = createSession( args.Basket, args.LocaleObject );
    if ( !createSessionResponse.success ) {
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
 * Function to call Klarna API to create session
 *
 * @param {dw.order.Basket} basket  cart object
 * @param {Object} localeObject Klarna locale object
 * @return {Object} success status and response
 */
function createSession( basket, localeObject ) {
    var Transaction = require( 'dw/system/Transaction' );
    var response = null;

    try {
        var klarnaPaymentsHttpService = new KlarnaPayments.httpService();
        var klarnaApiContext = new KlarnaPayments.apiContext();
        var requestBody = _getRequestBody( basket, localeObject );
        var requestUrl = klarnaApiContext.getFlowApiUrls().get( 'createSession' );
        var serviceID = klarnaApiContext.getFlowApiIds().get( 'createSession' );

        response = klarnaPaymentsHttpService.call( serviceID, requestUrl, 'POST', localeObject.custom.credentialID, requestBody );
        var klarnaPaymentMethods = response.payment_method_categories ? JSON.stringify( response.payment_method_categories ) : null;
        Transaction.wrap( function() {
            session.privacy.KlarnaLocale = localeObject.custom.klarnaLocale;
            session.privacy.KlarnaPaymentMethods = klarnaPaymentMethods;
            session.privacy.SelectedKlarnaPaymentMethod = null;

            basket.custom.kpSessionId = response.session_id;
            basket.custom.kpClientToken = response.client_token;
        } );
    } catch ( e ) {
        dw.system.Logger.error( 'Error in creating Klarna Payments Session: {0}', e.message + e.stack );
        KlarnaAdditionalLogging.writeLog( basket, response.session_id, 'klarnaPaymentsCreateSession.createSession()', 'Error in creating Klarna Payments session. Error:'+ JSON.stringify( e ) );

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
    createSession: createSession
};