/* globals empty, request */

'use strict';

var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var Locale = require('dw/util/Locale');

var KlarnaLocale = function () {};

KlarnaLocale.prototype.getRequestLocale = function () {
    var requestLocale = Locale.getLocale(request.locale);

    return requestLocale;
};

KlarnaLocale.prototype.getRequestLocaleCountryCode = function () {
    var requestLocale = this.getRequestLocale();
    return requestLocale.country;
};

KlarnaLocale.prototype.buildKlarnaCompatibleLocale = function () {
    var requestLocale = Locale.getLocale(request.locale);
    var resultLocale = requestLocale.language;

    if (requestLocale.country) {
        resultLocale = resultLocale + '-' + requestLocale.country;
    }

    return resultLocale.toLowerCase();
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
    } else {
        countryCode = 'default';
    }

    var customlocaleObject = CustomObjectMgr.getCustomObject('KlarnaCountries', countryCode);
    if (customlocaleObject) {
        localeObject.custom = {};
        Object.keys(customlocaleObject.custom).forEach(function (key) {
            localeObject.custom[key] = customlocaleObject.custom[key];
        });
        if (countryCode !== 'default') {
            localeObject.custom.klarnaLocale = this.buildKlarnaCompatibleLocale();
        }
    }

    return localeObject;
};

module.exports = KlarnaLocale;
