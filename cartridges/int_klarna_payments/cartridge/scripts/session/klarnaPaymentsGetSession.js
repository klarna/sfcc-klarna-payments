/**
* Script to get Klarna Sessions
*
* @module cartridge/scripts/session/klarnaPaymentsGetSession
*
* @input KlarnaPaymentsSessionID : String
* @input Basket : dw.order.Basket
* @input LocaleObject : Object
*/

// import packages
var KlarnaPayments = {
    httpService : require( '*/cartridge/scripts/common/klarnaPaymentsHttpService' ),
    apiContext : require( '*/cartridge/scripts/common/klarnaPaymentsApiContext' )
};
var KlarnaHelper = require( '*/cartridge/scripts/util/klarnaHelper' );

/**
 * Function to call the Klarna API to get current session
 * 
 * @param {string} klarnaSessionID Klarna session ID
 * @param {dw.order.Basket} basket cart object
 * @param {Object} localeObject Klarna locale object
 * @return {Object} success status, response
 */
 function getSession( klarnaSessionID, basket, localeObject ) {
    var Transaction = require( 'dw/system/Transaction' );
    var response = null;
    var klarnaPaymentsHttpService = new KlarnaPayments.httpService();
    try {
        // Read current session
        var klarnaApiContext = new KlarnaPayments.apiContext();
        requestUrl = dw.util.StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'getSession' ), klarnaSessionID );
        var serviceID = klarnaApiContext.getFlowApiIds().get( 'getSession' );
        response = klarnaPaymentsHttpService.call( serviceID, requestUrl, 'GET', localeObject.custom.credentialID, null, klarnaSessionID );
    } catch ( e ) {
        dw.system.Logger.error( 'Error in getting Klarna Payments Session: {0}', e.message + e.stack );
        KlarnaHelper.clearSessionRef(basket);
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
    getSession: getSession
}