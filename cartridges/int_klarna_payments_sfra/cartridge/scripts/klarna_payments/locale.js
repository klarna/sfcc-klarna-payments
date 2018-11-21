/* globals empty, request */

'use strict';

var Countries = require('~/cartridge/scripts/util/Countries');
var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var Locale = require('dw/util/Locale');

var KlarnaLocale = function () {};

KlarnaLocale.prototype.getRequestLocale = function () {
    var requestLocale = Locale.getLocale(request.locale);

    return requestLocale;
};

KlarnaLocale.prototype.getRequestLocaleCountryCode = function () {
    var requestLocale = this.getRequestLocale();
    var countryCode = Countries.getCurrent(requestLocale).countryCode;

    return countryCode;
};

/**
 * Gets KlarnaCountries Locale object by country code
 *
 * If you don't pass a country code, it is fetched from the Countries
 * by request locale id.
 *
 * @param {string} kcCountryCode country code (KlarnaCountries custom object)
 *
 * @return {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 */
KlarnaLocale.prototype.getLocale = function (kcCountryCode) {
    var localeObject = {};
    var countryCode = kcCountryCode;

    if (empty(countryCode)) {
        countryCode = this.getRequestLocaleCountryCode();
    }

    localeObject = CustomObjectMgr.getCustomObject('KlarnaCountries', countryCode);

    return localeObject;
};

module.exports = KlarnaLocale;
