/* globals empty */

/**
* Klarna Session Manager
*
* Used to manage Klarna Sessions opened per-locale at checkout.
*/

var BasketMgr = require('dw/order/BasketMgr');
var Logger = require('dw/system/Logger');
var log = Logger.getLogger('KlarnaPayments');
var Transaction = require('dw/system/Transaction');
var StringUtils = require('dw/util/StringUtils');
var KlarnaPaymentsApiContext = require('*/cartridge/scripts/common/klarnaPaymentsApiContext');
var KlarnaPayments = {
    HttpService: require('*/cartridge/scripts/common/klarnaPaymentsHttpService'),
    SessionRequestBuilder: require('*/cartridge/scripts/klarna_payments/requestBuilder/session')
};

/**
 * @constructor
 *
 * @param {dw.system.Session} userSession - User session.
 * @param {KlarnaLocale} klarnaLocaleMgr - KlarnaLocale instance.
 */
function KlarnaSessionManager(userSession, klarnaLocaleMgr) {
    this.userSession = userSession;
    this.klarnaLocaleMgr = klarnaLocaleMgr;
}

/**
 * Returns the KlarnaLocale instance passed when constructing this manager.
 *
 * @returns {KlarnaLocale} KlarnaLocale instance
 */
KlarnaSessionManager.prototype.getKlarnaLocaleMgr = function () {
    return this.klarnaLocaleMgr;
};

/**
 * Save authorization info (token and flags) in user session.
 *
 * This method saves authorization info passed from a successful payment
 * authorization call.
 *
 * @param {string} token - the authorization token received from a call to authorize.
 * @param {bool} finalizeRequired - boolean flag to indicate if the authorization requires finalization.
 */
KlarnaSessionManager.prototype.saveAuthorizationToken = function (token, finalizeRequired) {
    Transaction.wrap(function (authToken) {
        this.userSession.privacy.KlarnaPaymentsAuthorizationToken = authToken;
        this.userSession.privacy.KPAuthInfo = {
            FinalizeRequired: finalizeRequired
        };
    }.bind(this, token));
};

/**
 * Returns authorization info previously saved in user session.
 *
 * @returns {Object} authorization info.
 */
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

/**
 * Refresh an existing Klarna Session.
 *
 * The current session is updated by using the REST Klarna interface.
 * Then, another GET call is made to retrieve session information and
 * update DW user session.
 *
 * @returns {Object} Response from the GET call.
 */
KlarnaSessionManager.prototype.refreshSession = function () {
    var instance = this;

    var localeObject = this.getKlarnaLocaleMgr().getLocale();
    var klarnaPaymentsHttpService = {};
    var klarnaApiContext = new KlarnaPaymentsApiContext();
    var requestBody = {};
    var requestUrl = '';
    var response = {};
    var klarnaSessionID = this.userSession.privacy.KlarnaPaymentsSessionID;
    // eslint-disable-next-line no-trailing-spaces
    
    klarnaPaymentsHttpService = new KlarnaPayments.HttpService();
    requestBody = this.getSessionRequestBody(BasketMgr.getCurrentBasket(), localeObject);
    requestUrl = StringUtils.format(klarnaApiContext.getFlowApiUrls().get('updateSession'), klarnaSessionID);

    try {
        // Update session
        klarnaPaymentsHttpService.call(requestUrl, 'POST', localeObject.custom.credentialID, requestBody);
    } catch (e) {
        return this.createSession();
    }

	// Read updated session
    response = klarnaPaymentsHttpService.call(requestUrl, 'GET', localeObject.custom.credentialID);

    Transaction.wrap(function () {
        instance.userSession.privacy.KlarnaPaymentsClientToken = response.client_token;
        instance.userSession.privacy.KlarnaPaymentMethods = response.payment_method_categories ? response.payment_method_categories : null;
    });

    return response;
};

/**
 * Create a new Klarna session.
 *
 * Parts of the Klarna API call's response are saved into
 * the DW user session for later use.
 *
 * @returns {Object} Klarna API call response.
 */
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

KlarnaSessionManager.prototype.removeSession = function () {
    var instance = this;

    Transaction.wrap(function () {
        instance.userSession.privacy.KlarnaPaymentsSessionID = null;
    });
};

/**
 * Validates Klarna Session.
 *
 * @returns {bool} true, if the session is valid.
 */
KlarnaSessionManager.prototype.hasValidSession = function () {
    var localeObject = this.getKlarnaLocaleMgr().getLocale();
    var localesMatch = (localeObject.custom.klarnaLocale === this.userSession.privacy.KlarnaLocale);

    return (!empty(this.userSession.privacy.KlarnaPaymentsSessionID) && localesMatch);
};

/**
 * Create or Update Klarna session.
 *
 * @returns {Object} Last API call's response; on error - null
 */
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
