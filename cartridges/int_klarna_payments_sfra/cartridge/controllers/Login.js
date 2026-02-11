/* eslint-disable sitegenesis/no-global-require */
/* globals session, request */

'use strict';

/**
 * @namespace Login
 */
var server = require('server');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');
var signInHelper = require('*/cartridge/scripts/signin/klarnaSignIn');
var accountHelpers = require('*/cartridge/scripts/helpers/accountHelpers');
var klarnaOSM = require('*/cartridge/scripts/marketing/klarnaOSM');

var page = module.superModule; // inherits functionality
server.extend(page);

/**
 * Login-KlarnaSignIn : This endpoint invokes the Klarna Login
 * @name Login-KlarnaSignIn
 * @function
 * @memberof Login
 * @param {middleware} - server.middleware.https
 * @param {middleware} - consentTracking.consent
 * @param {category} - sensitive
 * @param {renders} - isml if there is an error
 * @param {serverfunction} - get
 */
server.post('KlarnaSignIn', server.middleware.https, consentTracking.consent, function (req, res, next) {
    if (!klarnaOSM.isKlarnaSignInEnabled()) {
        return next();
    }

    var Resource = require('dw/web/Resource');
    var addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');

    var klarnaSignInErrorMsg = Resource.msg('klarna.signin.loginerror', 'klarnaSignIn', null);
    var httpParameterMap = req.httpParameterMap;

    var klarnaResponse = httpParameterMap.data ? JSON.parse(httpParameterMap.data) : null;
    if (!klarnaResponse) {
        res.json({
            success: false,
            error: [klarnaSignInErrorMsg]
        });
        return next();
    }

    var customerData = klarnaResponse.customerProfile;
    var refreshToken = null;
    // check for SFCC customer not linked to Klarna
    var noKlarnaCustomerFound = signInHelper.checkCustomerExists(customerData.email);

    if (noKlarnaCustomerFound) {
        var mergeCustomersResult = signInHelper.mergeCustomerWithKlarna(customerData.email);// merge customers
        if (mergeCustomersResult.error) {
            res.json({
                success: false,
                error: [mergeCustomersResult.errorMessage || klarnaSignInErrorMsg]
            });
            return next();
        }
    }

    var createCustomerResult = signInHelper.getOrCreateCustomer(customerData, refreshToken);
    if (createCustomerResult.error) {
        res.json({
            success: false,
            error: [createCustomerResult.errorMessage || klarnaSignInErrorMsg]
        });
        return next();
    }
    var customerProfile = createCustomerResult.customer.customer;
    var customerAddress = signInHelper.mapKlarnaAddress(customerData);
    if (customerAddress) {
        session.privacy.kpCustomerAddress = JSON.stringify(customerAddress);
        if (!addressHelpers.checkIfAddressStored(customerAddress, customerProfile.addressBook.addresses)) {
            addressHelpers.saveExtAddress(customerAddress, customerProfile, addressHelpers.generateAddressName(customerAddress));
        }
    }

    res.json({
        success: true,
        isAccountLogin: httpParameterMap.oauthLoginTargetEndPoint.stringValue === '1',
        redirectUrl: accountHelpers.getLoginRedirectURL(httpParameterMap.oauthLoginTargetEndPoint.stringValue, req.session.privacyCache, true)
    });
    return next();
});

server.append('Show', consentTracking.consent, server.middleware.https, csrfProtection.generateToken, function (req, res, next) {
    if (!klarnaOSM.isKlarnaSignInEnabled()) {
        return next();
    }

    session.custom.siwk_locale = request.locale;
    var siwkError = request.httpParameterMap.siwkError.booleanValue;
    res.setViewData({
        siwkError: siwkError
    });
    return next();
});

module.exports = server.exports();
