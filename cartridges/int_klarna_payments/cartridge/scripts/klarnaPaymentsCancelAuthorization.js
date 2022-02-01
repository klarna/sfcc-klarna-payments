/**
 * Script to delete the previous authorization
 *
 * @module cartridge/scripts/klarnaPaymentsCancelAuthorization
 * 
 * @input KlarnaPaymentsAuthorizationToken : String
 * @input LocaleObject : Object
 * @output Response : Object
 *
 */

var KlarnaPayments = {
    httpService: require( '*/cartridge/scripts/common/klarnaPaymentsHttpService' ),
    apiContext: require( '*/cartridge/scripts/common/klarnaPaymentsApiContext' )
};

/**
 * Function that can be called by pipelines
 *
 * @param {Object} args Object parameters
 * @return {number} status
 */
function execute( args )
{
    var cancelAuthorizationResponse = cancelAuthorization( args.KlarnaPaymentsAuthorizationToken, args.LocaleObject );
    args.Response = cancelAuthorizationResponse;
    if ( cancelAuthorizationResponse === null ) {
        return PIPELET_ERROR;
    }
    return PIPELET_NEXT;
}

/**
 * Function to delete Klarna Authorization
 *
 * @param {string} klarnaAuthorizationToken Klarna Authorization Token
 * @param {Object} localeObject Klarna locale object
 * @return {Object} response object
 */
function cancelAuthorization( klarnaAuthorizationToken, localeObject ) {
    if ( klarnaAuthorizationToken ) {
        var StringUtils = require( 'dw/util/StringUtils' );
        var klarnaPaymentsHttpService = new KlarnaPayments.httpService();
        var klarnaApiContext = new KlarnaPayments.apiContext();
        var requestUrl = StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'cancelAuthorization' ), klarnaAuthorizationToken );
        var serviceID = klarnaApiContext.getFlowApiIds().get( 'cancelAuthorization' );
        try {
            var response = klarnaPaymentsHttpService.call( serviceID, requestUrl, 'DELETE', localeObject.custom.credentialID );
            session.privacy.KlarnaPaymentsAuthorizationToken = null;
            session.privacy.KlarnaPaymentsFinalizeRequired = null;
            return response;
        } catch ( e ) {
            logger.error( 'Error in canceling Klarna Payments Authorization: {0}', e.message + e.stack );
        }
    }
    return null;
}

module.exports = {
    cancelAuthorization: cancelAuthorization
};