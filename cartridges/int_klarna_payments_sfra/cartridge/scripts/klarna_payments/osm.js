/* globals empty, request */

'use strict';

var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var Locale = require('dw/util/Locale');

/**
 * Klarna On-Site Messaging Component
 */
var KlarnaOSM = {
    countryCode: '',
    setCountryCode: function (countryCode) {
        this.countryCode = countryCode;
    },
    getCountryCode: function () {
        if (!this.countryCode) {
            var requestLocale = Locale.getLocale(request.locale);
            var currentCountryCode = requestLocale.country;

            this.countryCode = currentCountryCode;
        }

        return this.countryCode;
    },
    isEnabled: function () {
        return (this.isEnabledCartPage() || this.isEnabledPDPPage());
    },
    isEnabledCartPage: function () {
        var countryCode = this.getCountryCode();
        var localeObject = CustomObjectMgr.getCustomObject('KlarnaCountries', countryCode);
        var value = localeObject.custom.osmCartEnabled;

        return value;
    },
    getCartPagePlacementTagId: function () {
        var countryCode = this.getCountryCode();
        var localeObject = CustomObjectMgr.getCustomObject('KlarnaCountries', countryCode);
        var value = localeObject.custom.osmCartTagId;

        return value;
    },
    isEnabledPDPPage: function () {
        var countryCode = this.getCountryCode();
        var localeObject = CustomObjectMgr.getCustomObject('KlarnaCountries', countryCode);
        var value = localeObject.custom.osmPDPEnabled;

        return value;
    },
    getPDPPagePlacementTagId: function () {
        var countryCode = this.getCountryCode();
        var localeObject = CustomObjectMgr.getCustomObject('KlarnaCountries', countryCode);
        var value = localeObject.custom.osmPDPTagId;

        return value;
    },
    getLibraryPrefix: function () {
        var countryCode = this.getCountryCode();

        if (countryCode === 'US') {
            return 'us';
        }

        return 'eu';
    },
    getUCI: function () {
        var countryCode = this.getCountryCode();
        var localeObject = CustomObjectMgr.getCustomObject('KlarnaCountries', countryCode);
        var uci = localeObject.custom.osmUCI;

        return uci;
    },
    getScriptURL: function () {
        var currentCountryCode = this.getCountryCode();
        var uci = this.getUCI();
        var currentPrefix = this.getLibraryPrefix();

        var url = 'https://' + currentPrefix + '-library.klarnaservices.com/merchant.js?uci=' + uci + '&country=' + currentCountryCode;

        return url;
    },
    formatPurchaseAmount: function (price) {
        var formattedAmount = Math.round(price.value * 100);

        return formattedAmount;
    }
};

module.exports = KlarnaOSM;
