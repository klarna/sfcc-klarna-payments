/* globals empty, request */

'use strict';

var Site = require('dw/system/Site');
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
    getCountryCode: function () {
        var requestLocale = Locale.getLocale(request.locale);
        return requestLocale.country;
    },
    getLibraryPrefix: function (countryCode) {
        if (countryCode === 'US') {
            return 'us';
        } else {
            return 'eu';
        }
    },
    getScriptURL: function () {
        var value = Site.getCurrent().getCustomPreferenceValue('osmUCI');

        var currentCountryCode = this.getCountryCode();
        var currentPrefix = this.getLibraryPrefix(currentCountryCode);

        var url = 'https://' + currentPrefix + '-library.klarnaservices.com/merchant.js?uci=' + value + '&country=' + currentCountryCode;

        return url;
    },
    formatPurchaseAmount: function (price) {
        var formattedAmount = Math.round(price.value * 100);

        return formattedAmount;
    }
};

module.exports = KlarnaOSM;