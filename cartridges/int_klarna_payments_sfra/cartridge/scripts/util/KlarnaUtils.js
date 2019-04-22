/* globals empty */

'use strict';

var Site = require('dw/system/Site');
var TaxMgr = require('dw/order/TaxMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var KlarnaPaymentsConstants = require('~/cartridge/scripts/util/KlarnaPaymentsConstants.js');

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
function isCountryInEU(country) {
    var isInEU = true;
    var EUCountries = 'BE, BG, CZ, DK, DE, EE, IE, EL, ES, FR, HR, IT, CY, LV, LT, LU, HU, MT, NL, AT, PL, PT, RO, SI, SK, FI, SE, UK, GB';

    if (EUCountries.indexOf(country) === -1) {
        isInEU = false;
    }

    return isInEU;
}

/**
 * Checks whether Preassessment preference is activated for a country.
 *
 * @param {string} country 2-letter country code.
 * @returns {bool} true, if preassessment is on for this country.
 */
function isEnabledPreassessmentForCountry(country) {
    var isPreassessment = false;

    if (!isCountryInEU(country)) {
        isPreassessment = true;
    }

    return isPreassessment;
}

/**
 * Converts null to empty string.
 *
 * @param {Object} obj of any kind.
 * @return {Object|empty string}
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
