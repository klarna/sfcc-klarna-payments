/* globals empty */

/**
* KlarnaSessionManager.js
*
* Used to handle Klarna Session
*
* @input Basket : dw.order.Basket The basket
* @input LocaleObject : dw.object.CustomObject
*/

var BasketMgr = require('dw/order/BasketMgr');
var Logger = require('dw/system/Logger');
var log = Logger.getLogger('KlarnaPayments');
var Transaction = require('dw/system/Transaction');
var StringUtils = require('dw/util/StringUtils');
var KlarnaPaymentsApiContext = require('~/cartridge/scripts/common/KlarnaPaymentsApiContext');
var KlarnaPayments = {
    HttpService: require('~/cartridge/scripts/common/KlarnaPaymentsHttpService'),
    SessionRequestBuilder: require('~/cartridge/scripts/klarna_payments/requestBuilder/session')
};

function KlarnaSessionManager(userSession, klarnaLocaleMgr) {
    this.userSession = userSession;
    this.klarnaLocaleMgr = klarnaLocaleMgr;
}

KlarnaSessionManager.prototype.getKlarnaLocaleMgr = function () {
    return this.klarnaLocaleMgr;
};

KlarnaSessionManager.prototype.saveAuthorizationToken = function (token, finalizeRequired) {
    Transaction.wrap(function (authToken) {
        this.userSession.privacy.KlarnaPaymentsAuthorizationToken = authToken;
        this.userSession.privacy.KPAuthInfo = {
            FinalizeRequired: finalizeRequired
        };
    }.bind(this, token));
};

KlarnaSessionManager.prototype.loadAuthorizationInfo = function () {
    var authInfo = {};
    var kpAuthInfo = this.userSession.privacy.KPAuthInfo;

    if (!empty(kpAuthInfo)) {
        authInfo = kpAuthInfo;
    }

    return authInfo;
};

/**
 * Creates a Klarna payments session through Klarna API
 * @param {dw.order.Basket} 		basket			SCC Basket object
 * @param {dw.object.CustomObject} 	localeObject 	corresponding to the locale Custom Object from KlarnaCountries
 *
 * @private
 * @return {Object} requestObject Klarna Payments request object
 */
KlarnaSessionManager.prototype.getSessionRequestBody = function (basket, localeObject) {
    var sessionRequestBuilder = new KlarnaPayments.SessionRequestBuilder();

    sessionRequestBuilder.setParams({
        basket: basket,
        localeObject: localeObject
    });

    return sessionRequestBuilder.build();
};

KlarnaSessionManager.prototype.refreshSession = function () {
    var instance = this;

    var localeObject = this.getKlarnaLocaleMgr().getLocale();
    var klarnaPaymentsHttpService = {};
    var klarnaApiContext = new KlarnaPaymentsApiContext();
    var requestBody = {};
    var requestUrl = '';
    var response = {};

    klarnaPaymentsHttpService = new KlarnaPayments.HttpService();
    requestBody = this.getSessionRequestBody(BasketMgr.getCurrentBasket(), localeObject);
    requestUrl = StringUtils.format(klarnaApiContext.getFlowApiUrls().get('updateSession'), this.userSession.privacy.KlarnaPaymentsSessionID);

	// Update session
    klarnaPaymentsHttpService.call(requestUrl, 'POST', localeObject.custom.credentialID, requestBody);

	// Read updated session
    response = klarnaPaymentsHttpService.call(requestUrl, 'GET', localeObject.custom.credentialID);

    Transaction.wrap(function () {
        instance.userSession.privacy.KlarnaPaymentsClientToken = response.client_token;
        instance.userSession.privacy.KlarnaPaymentMethods = response.payment_method_categories ? response.payment_method_categories : null;
    });

    return response;
};

KlarnaSessionManager.prototype.createSession = function () {
    var instance = this;

    var localeObject = this.getKlarnaLocaleMgr().getLocale();
    var klarnaPaymentsHttpService = {};
    var klarnaApiContext = new KlarnaPaymentsApiContext();
    var requestBody = {};
    var requestUrl = '';
    var response = {};

    klarnaPaymentsHttpService = new KlarnaPayments.HttpService();
    requestBody = this.getSessionRequestBody(BasketMgr.getCurrentBasket(), localeObject);
    requestUrl = klarnaApiContext.getFlowApiUrls().get('createSession');

    response = klarnaPaymentsHttpService.call(requestUrl, 'POST', localeObject.custom.credentialID, requestBody);

    Transaction.wrap(function () {
        instance.userSession.privacy.KlarnaLocale = localeObject.custom.klarnaLocale;
        instance.userSession.privacy.KlarnaPaymentsSessionID = response.session_id;
        instance.userSession.privacy.KlarnaPaymentsClientToken = response.client_token;
        instance.userSession.privacy.KlarnaPaymentMethods = response.payment_method_categories ? response.payment_method_categories : null;
        instance.userSession.privacy.SelectedKlarnaPaymentMethod = null;
    });

    return response;
};

KlarnaSessionManager.prototype.hasValidSession = function () {
    var localeObject = this.getKlarnaLocaleMgr().getLocale();
    var localesMatch = (localeObject.custom.klarnaLocale === this.userSession.privacy.KlarnaLocale);

    return (!empty(this.userSession.privacy.KlarnaPaymentsSessionID) && localesMatch);
};

KlarnaSessionManager.prototype.createOrUpdateSession = function () {
    var instance = this;

    try {
        if (instance.hasValidSession()) {
            return this.refreshSession();
        }

        return this.createSession();
    } catch (e) {
        log.error('Error in handling Klarna Payments Session: {0}', e.message + e.stack);

        Transaction.wrap(function () {
            instance.userSession.privacy.KlarnaPaymentsSessionID = null;
            instance.userSession.privacy.KlarnaPaymentsClientToken = null;
            instance.userSession.privacy.KlarnaPaymentMethods = null;
            instance.userSession.privacy.SelectedKlarnaPaymentMethod = null;
        });

        return null;
    }
};

module.exports = KlarnaSessionManager;
