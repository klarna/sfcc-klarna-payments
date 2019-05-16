/* globals empty, request */

'use strict';

var Site = require('dw/system/Site');
var CustomObjectMgr = require( 'dw/object/CustomObjectMgr' );
var Locale = require('dw/util/Locale');

/**
 * Klarna On-Site Messaging Component
 */
var KlarnaOSM = {
    isEnabled: function () {
        return (this.isEnabledCartPage() || this.isEnabledPDPPage());
    },
    isEnabledCartPage: function () {
        var value = Site.getCurrent().getCustomPreferenceValue('osmCartEnabled');

        return value;
    },
    getCartPagePlacementTagId: function () {
        var value = Site.getCurrent().getCustomPreferenceValue('osmCartTagId');

        return value;
    },
    isEnabledPDPPage: function () {
        var value = Site.getCurrent().getCustomPreferenceValue('osmPDPEnabled');

        return value;
    },
    getPDPPagePlacementTagId: function () {
        var value = Site.getCurrent().getCustomPreferenceValue('osmPDPTagId');

        return value;
    },
    getLibraryPrefix: function (countryCode) {
        if (countryCode === 'US') {
            return 'us';
        } else {
            return 'eu';
        }
    },
    getCountryCode: function () {
        var requestLocale = Locale.getLocale(request.locale);
        var currentCountryCode = requestLocale.country;

        return currentCountryCode;
    },
    getUCI: function (countryCode) {
        var localeObject = CustomObjectMgr.getCustomObject('KlarnaCountries', countryCode);
        var uci = localeObject.custom.osmUCI;

        return uci;
    },
    getScriptURL: function () {
        var currentCountryCode = this.getCountryCode();
        var uci = this.getUCI(currentCountryCode);
        var currentPrefix = this.getLibraryPrefix(currentCountryCode);

        var url = 'https://' + currentPrefix + '-library.klarnaservices.com/merchant.js?uci=' + uci + '&country=' + currentCountryCode;

        return url;
    },
    formatPurchaseAmount: function (price) {
        var formattedAmount = Math.round(price.value * 100);

        return formattedAmount;
    }
};

module.exports = KlarnaOSM;