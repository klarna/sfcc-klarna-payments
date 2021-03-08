/* globals empty */

(function () {
    'use strict';

    var URLUtils = require('dw/web/URLUtils');

    var base = module.superModule;

    base.prototype.buildMerchantInformation = function (order) {
        var country = this.getLocaleObject().country;

        var KLARNA_PAYMENT_URLS = require('*/cartridge/scripts/util/klarnaPaymentsConstants').KLARNA_PAYMENT_URLS;

        this.context.merchant_urls.confirmation = URLUtils.https(KLARNA_PAYMENT_URLS.CONFIRMATION, 'ID', order.orderNo, 'token', order.orderToken).toString();
        this.context.merchant_urls.notification = URLUtils.https(KLARNA_PAYMENT_URLS.NOTIFICATION, 'klarna_country', country).toString();

        return this;
    };

    module.exports = base;
}());
