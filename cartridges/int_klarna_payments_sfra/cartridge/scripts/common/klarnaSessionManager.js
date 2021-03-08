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
    var localeObject = this.getLocale();
    var updateSessionHelper = require('*/cartridge/scripts/session/klarnaPaymentsUpdateSession');
    var updateSessionResponse = updateSessionHelper.updateSession(session.privacy.KlarnaPaymentsSessionID, BasketMgr.getCurrentBasket(), localeObject);
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
    var localeObject = this.getLocale();
    var createSessionHelper = require('*/cartridge/scripts/session/klarnaPaymentsCreateSession');
    var createSessionResponse = createSessionHelper.createSession(BasketMgr.currentBasket, localeObject);
    return createSessionResponse.response;
};

/**
 * Removes Klarna Session
 */
KlarnaSessionManager.prototype.removeSession = function () {
    Transaction.wrap(function () {
        session.privacy.KlarnaPaymentsSessionID = null;
    });
};

/**
 * Validates Klarna Session.
 *
 * @returns {bool} true, if the session is valid.
 */
KlarnaSessionManager.prototype.hasValidSession = function () {
    var localeObject = this.getLocale();
    var localesMatch = (localeObject.custom.klarnaLocale === session.privacy.KlarnaLocale);

    return (!empty(session.privacy.KlarnaPaymentsSessionID) && localesMatch);
};

/**
 * Create or Update Klarna session.
 *
 * @returns {Object} Last API call's response; on error - null
 */
KlarnaSessionManager.prototype.createOrUpdateSession = function () {
    try {
        if (this.hasValidSession()) {
            return this.refreshSession();
        }

        return this.createSession();
    } catch (e) {
        log.error('Error in handling Klarna Payments Session: {0}', e.message + e.stack);

        Transaction.wrap(function () {
            session.privacy.KlarnaPaymentsSessionID = null;
            session.privacy.KlarnaPaymentsClientToken = null;
            session.privacy.KlarnaPaymentMethods = null;
            session.privacy.SelectedKlarnaPaymentMethod = null;
        });

        return null;
    }
};

module.exports = KlarnaSessionManager;
