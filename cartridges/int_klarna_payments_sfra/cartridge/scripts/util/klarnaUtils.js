/* globals empty */

'use strict';

var TaxMgr = require('dw/order/TaxMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var KlarnaPaymentsConstants = require('*/cartridge/scripts/util/klarnaPaymentsConstants.js');

/**
 * Return Klarna Payment Method name.
 *
 * @returns {string} Klarna Payment Method name.
 */
function getKlarnaPaymentMethodName() {
    var paymentMethodId = KlarnaPaymentsConstants.PAYMENT_METHOD;

    var paymentMethod = PaymentMgr.getPaymentMethod(paymentMethodId);

    return paymentMethod.getName();
}

/**
 * Checks whether a country code maps to a Country in Europe.
 *
 * @param {string} country two-letter country code.
 * @returns {bool} true, if country is in Europe.
 */
function isPreAssementApplicable(country) {
    var isInList = true;
    var countriesList = 'BE, BG, CZ, DK, DE, EE, IE, EL, ES, FR, HR, IT, CY, LV, LT, LU, HU, MT, NL, AT, PL, PT, RO, SI, SK, FI, SE, UK, GB, US, CH, NO, CA, AU, NZ';

    if (countriesList.indexOf(country) > -1) {
        isInList = false;
    }

    return isInList;
}

/**
 * Checks whether Preassessment preference is activated for a country.
 *
 * @param {string} country 2-letter country code.
 * @returns {bool} true, if preassessment is on for this country.
 */
function isEnabledPreassessmentForCountry(country) {
    var isPreassessment = false;

    if (isPreAssementApplicable(country)) {
        isPreassessment = true;
    }

    return isPreassessment;
}

/**
 * Converts null to empty string.
 *
 * @param {Object} obj of any kind.
 * @return {string} the result
 */
function strval(obj) {
    if (obj === null) {
        return '';
    }

    return obj;
}

/**
 * Checks if site's taxation policy is Net.
 *
 * @returns {bool} true, if policy is Net, false if Gross.
 */
function isTaxationPolicyNet() {
    return (TaxMgr.getTaxationPolicy() === TaxMgr.TAX_POLICY_NET);
}

module.exports.isEnabledPreassessmentForCountry = isEnabledPreassessmentForCountry;
module.exports.isTaxationPolicyNet = isTaxationPolicyNet;
module.exports.getKlarnaPaymentMethodName = getKlarnaPaymentMethodName;
module.exports.strval = strval;
module.exports.empty = empty;
