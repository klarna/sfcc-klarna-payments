'use strict';

var Site = require('dw/system/Site');
var Locale = require('dw/util/Locale');

/**
 * Klarna On-Site Messaging Component
 */
var KlarnaOSM = {
    getUCI: function () {
        var value = Site.getCurrent().getCustomPreferenceValue('osmUCI');

        return value;
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
    getScriptURL: function () {
        var requestLocale = Locale.getLocale(request.locale);
        var countryCode = requestLocale.country;
        var domain = 'us-library.klarnaservices.com';
        var uci = this.getUCI();

        var url = 'https://' + domain + '/merchant.js?uci=' + uci + '&country=' + countryCode;

        return url;
    },
    formatPurchaseAmount: function (price) {
        var formattedAmount = Math.round(price.value * 100);

        return formattedAmount;
    }
};

module.exports = KlarnaOSM;