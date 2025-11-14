/* globals empty */

( function() {
    'use strict';

    var Builder = require( '*/cartridge/scripts/payments/builder' );

    var KlarnaPaymentsCancelCustomerTokenModel = require( '*/cartridge/scripts/payments/model/request/cancelCustomerToken' ).KlarnaPaymentsCancelCustomerTokenModel;

    function KlarnaPaymentsCustomerTokenRequestBuilder() {
        this.context = null;
        this.localeObject = null;
        this.params = null;
    }

    KlarnaPaymentsCustomerTokenRequestBuilder.prototype = new Builder();

    KlarnaPaymentsCustomerTokenRequestBuilder.prototype.init = function() {
        this.context = new KlarnaPaymentsCancelCustomerTokenModel();
        return this;
    };

    KlarnaPaymentsCustomerTokenRequestBuilder.prototype.build = function() {
        this.init();
        return this.context;
    };

    module.exports = KlarnaPaymentsCustomerTokenRequestBuilder;
}() );
