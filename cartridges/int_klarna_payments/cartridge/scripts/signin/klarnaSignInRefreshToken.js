/**
* Script to cancel Klarna Payments customer token through Klarna API
*
* @module cartridge/scripts/signin/klarnaSignInRefreshToken
*
* @input customer : Object Customer
* @input LocaleObject : Object
*
*/
'use strict';
var KlarnaPayments = {
    httpService: require('*/cartridge/scripts/common/klarnaSignInHttpService'),
    apiContext: require('*/cartridge/scripts/common/klarnaPaymentsApiContext')
};

var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');

/**
 * Function to generate a request body
 *
 * @param {Object} localeObject locale object
 * @returns {Object} request object
 */
function _getRequestBody(localeObject, refreshToken) {
    var Encoding = require('dw/crypto/Encoding');
    var newKlarnaClientKey = KlarnaHelper.getKlarnaClientId();

    var clientId = newKlarnaClientKey ? newKlarnaClientKey : localeObject.custom.signInClientId;
    var requestBody = 'grant_type=refresh_token' +
        '&client_id=' + Encoding.toURI(clientId) +
        '&refresh_token=' + Encoding.toURI(refreshToken);
    return requestBody;
}
/**
 * Function to cancel Klarna Customer Token
 * 
 * @param {Object} localeObject locale object
 * @param {string} refreshToken Refresh token to be refreshed
 * @return {Object} status and fraud status
 */
function refreshSignInToken(localeObject, refreshToken) {
    var logger = dw.system.Logger.getLogger('klarnaSignInRefreshToken.js');
    var region = KlarnaHelper.getRegionCode() || localeObject.custom.region;
    try {
        var klarnaSignInHttpService = new KlarnaPayments.httpService();
        var klarnaApiContext = new KlarnaPayments.apiContext();
        var requestBody = _getRequestBody(localeObject, refreshToken);
        var requestUrl = dw.util.StringUtils.format(klarnaApiContext.getFlowApiUrls().get('refreshSignInToken'), region);
        var serviceID = klarnaApiContext.getFlowApiIds().get('refreshSignInToken');
        var response = klarnaSignInHttpService.call(serviceID, requestUrl, 'POST', 'klarna.signin.credentials', requestBody, 'application/x-www-form-urlencoded');
        return {
            success: true,
            response: response
        };
    } catch (e) {
        logger.error('Error in refreshing customer refresh token: {0}', e.message + e.stack);
        return {
            success: false,
            response: null
        };
    }
}
function getKlarnaJWKS(localeObject) {
    var logger = dw.system.Logger.getLogger('klarnaSignInRefreshToken.js');
    var region = KlarnaHelper.getRegionCode() || localeObject.custom.region;
    try {
        var klarnaSignInHttpService = new KlarnaPayments.httpService();
        var klarnaApiContext = new KlarnaPayments.apiContext();
        var requestUrl = dw.util.StringUtils.format(klarnaApiContext.getFlowApiUrls().get('getKlarnaJWKS'), region);
        var serviceID = klarnaApiContext.getFlowApiIds().get('getKlarnaJWKS');
        var response = klarnaSignInHttpService.call(serviceID, requestUrl, 'GET', 'klarna.signin.credentials', null, null);
        return {
            success: true,
            response: response
        };
    } catch (e) {
        logger.error('Error in refreshing customer refresh token: {0}', e.message + e.stack);
        return {
            success: false,
            response: null
        };
    }
}
module.exports = {
    refreshSignInToken: refreshSignInToken,
    getKlarnaJWKS: getKlarnaJWKS
};