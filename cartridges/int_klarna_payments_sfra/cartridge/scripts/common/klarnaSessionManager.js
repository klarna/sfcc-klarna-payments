/* globals empty, session */

/**
* Klarna Session Manager
*
* Used to manage Klarna Sessions opened per-locale at checkout.
*/

var BasketMgr = require('dw/order/BasketMgr');
var Logger = require('dw/system/Logger');
var log = Logger.getLogger('KlarnaPayments');
var Transaction = require('dw/system/Transaction');
var Site = require('dw/system/Site');
var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');
var KlarnaAdditionalLogging = require( '*/cartridge/scripts/util/klarnaAdditionalLogging' );

/**
 * @constructor
 *
 * @param {dw.system.Session} userSession - User session.
 * @param {KlarnaLocale} klarnaLocaleMgr - KlarnaLocale instance.
 */
function KlarnaSessionManager() {}

/**
 * Returns the KlarnaLocale instance passed when constructing this manager.
 *
 * @param {string} currentCountry current country locale
 *
 * @return {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 */
KlarnaSessionManager.prototype.getLocale = function (currentCountry) {
    var localeObject = {};
    var getKlarnaPaymentsLocale = require('*/cartridge/scripts/locale/klarnaPaymentsGetLocale');
    var localeObjectResult = getKlarnaPaymentsLocale.getLocaleObject(currentCountry);

    if (localeObjectResult.success) {
        localeObject = localeObjectResult.localeObject;
    }

    return localeObject;
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
        session.privacy.KlarnaPaymentsAuthorizationToken = authToken;
        session.privacy.KPAuthInfo = JSON.stringify({
            FinalizeRequired: finalizeRequired
        });
    }.bind(this, token));
};

/**
 * Returns authorization info previously saved in user session.
 *
 * @returns {Object} authorization info.
 */
KlarnaSessionManager.prototype.loadAuthorizationInfo = function () {
    var authInfo = {};
    var kpAuthInfo = JSON.parse(session.privacy.KPAuthInfo);

    if (!empty(kpAuthInfo)) {
        authInfo = kpAuthInfo;
    }

    return authInfo;
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
    var basket = BasketMgr.getCurrentBasket();
    if (empty(basket)) {
        return null;
    }

    var localeObject = this.getLocale();
    var updateSessionHelper = require('*/cartridge/scripts/session/klarnaPaymentsUpdateSession');
    var updateSessionResponse = updateSessionHelper.updateSession(basket.custom.kpSessionId, basket, localeObject);

    return updateSessionResponse.response;
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
    var basket = BasketMgr.getCurrentBasket();
    if (empty(basket)) {
        return null;
    }

    var localeObject = this.getLocale();
    var createSessionHelper = require('*/cartridge/scripts/session/klarnaPaymentsCreateSession');
    var createSessionResponse = createSessionHelper.createSession(basket, localeObject);

    return createSessionResponse.response;
};

/**
 * Removes Klarna Session
 */
KlarnaSessionManager.prototype.removeSession = function () {
    var basket = BasketMgr.getCurrentBasket();

    Transaction.wrap(function () {
        if (!empty(basket)) {
            basket.custom.kpSessionId = null;
        }
    });
};

/**
 * Get Klarna Session
 */
KlarnaSessionManager.prototype.getSession = function (basket, localeObject) {
    var getSessionHelper = require('*/cartridge/scripts/session/klarnaPaymentsGetSession');
    var kpSessionId = basket.custom.kpSessionId;
    if (empty(kpSessionId)) {
        return true;
    }
    var getSessionResponse = getSessionHelper.getSession(kpSessionId, basket, localeObject);
    if (Site.getCurrent().getCustomPreferenceValue('kpCreateNewSessionWhenExpires') && !getSessionResponse.success) {
        log.error('Klarna Session Update Or Klarna Session expiration: {0}', kpSessionId);
        return true;
    } else if (!getSessionResponse.success) {
        log.error('Klarna Session Update Or Klarna Session expiration: {0}', kpSessionId);
        return false;
    }
    return true;
};

/**
 * Validates Klarna Session.
 *
 * @returns {boolean} true, if the session is valid.
 */
KlarnaSessionManager.prototype.hasValidSession = function () {
    var basket = BasketMgr.getCurrentBasket();
    var localeObject = this.getLocale();
    if (empty(basket)) {
        return false;
    }
    this.getSession(basket, localeObject);
    var localesMatch = (localeObject.custom.klarnaLocale === session.privacy.KlarnaLocale);
    return (!empty(basket.custom.kpSessionId) && localesMatch);
};

/**
 * Create or Update Klarna session.
 *
 * @returns {Object} Last API call's response; on error - null
 */
KlarnaSessionManager.prototype.createOrUpdateSession = function () {
    var basket = BasketMgr.getCurrentBasket();
    var localeObject = this.getLocale();
    if (empty(basket)) {
        return null;
    }

    try {
        if (this.hasValidSession(basket)) {
            return this.refreshSession(basket);
        }
        if (this.getSession(basket, localeObject)) {
            return this.createSession(basket);
        }
    } catch (e) {
        log.error('Error in handling Klarna Payments Session: {0}', e.message + e.stack);
        KlarnaAdditionalLogging.writeLog(basket, basket.custom.kpSessionId, 'klarnaSessionManager.js:KlarnaSessionManager.prototype.createOrUpdateSession()', 'Error in handling Klarna Payments Session. Error:' + JSON.stringify(e));

        KlarnaHelper.clearSessionRef(basket);
        return null;
    }
};

module.exports = KlarnaSessionManager;
