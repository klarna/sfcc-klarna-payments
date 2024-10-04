/* globals empty */

(function () {
    'use strict';

    var Builder = require('*/cartridge/scripts/payments/builder');

    var KlarnaPaymentsCustomerTokenModel = require('*/cartridge/scripts/payments/model/request/customerToken').KlarnaPaymentsCustomerTokenModel;

    var AddressRequestBuilder = require('*/cartridge/scripts/payments/requestBuilder/address');

    /**
     * KP Order Request Builder
     * @return {void}
     */
    function KlarnaPaymentsCustomerTokenRequestBuilder() {
        this.addressRequestBuilder = new AddressRequestBuilder();

        this.context = null;
        this.localeObject = null;
        this.params = null;
    }

    KlarnaPaymentsCustomerTokenRequestBuilder.prototype = new Builder();

    /**
     * Function to return address request builder
     *
     * @return {Object} Address request
     */
    KlarnaPaymentsCustomerTokenRequestBuilder.prototype.getAddressRequestBuilder = function () {
        return this.addressRequestBuilder;
    };

    KlarnaPaymentsCustomerTokenRequestBuilder.prototype.setParams = function (params) {
        this.validateParams(params);

        this.setLocaleObject(params.localeObject.custom);

        this.params = params;
    };

    KlarnaPaymentsCustomerTokenRequestBuilder.prototype.setLocaleObject = function (localeObject) {
        this.localeObject = localeObject;
    };

    KlarnaPaymentsCustomerTokenRequestBuilder.prototype.getLocaleObject = function () {
        return this.localeObject;
    };

    KlarnaPaymentsCustomerTokenRequestBuilder.prototype.init = function () {
        this.context = new KlarnaPaymentsCustomerTokenModel();

        return this;
    };

    KlarnaPaymentsCustomerTokenRequestBuilder.prototype.buildBilling = function (order) {
        var billingAddress = order.getBillingAddress();
        if (billingAddress === null) {
            return this;
        }

        this.context.billing_address = this.getAddressRequestBuilder().build(billingAddress);
        this.context.billing_address.email = order.customerEmail || '';

        return this;
    };

    KlarnaPaymentsCustomerTokenRequestBuilder.prototype.buildCustomer = function (order) {
        var customer = order.customer;
        if (customer === null || !customer.authenticated) {
            return this;
        }
        if (customer.profile.birthday) {
            try {
                var calendarDate = new dw.util.Calendar(customer.profile.birthday);
                this.context.customer.date_of_birth = dw.util.StringUtils.formatCalendar(calendarDate, 'yyyy-MM-dd');
            } catch (e) {
                dw.system.Logger.info('Unable to build customer birthdate.');
            }
        }
        if (customer.profile.gender.value) {
            this.context.customer.gender = customer.profile.gender;
        }
        if (customer.profile.title) {
            this.context.customer.title = customer.profile.title;
        }
        this.context.customer.type = 'person';

        return this;
    };

    KlarnaPaymentsCustomerTokenRequestBuilder.prototype.buildLocale = function (order) {
        var localeObject = this.getLocaleObject();
        var currency = order.getCurrencyCode();

        this.context.purchase_country = localeObject.country;
        this.context.purchase_currency = currency;
        this.context.locale = localeObject.klarnaLocale;

        return this;
    };

    KlarnaPaymentsCustomerTokenRequestBuilder.prototype.buildDescription = function (order) {
        this.context.description = 'Subscription for ' + order.orderNo;
        return this;
    };

    KlarnaPaymentsCustomerTokenRequestBuilder.prototype.isValidLocaleObjectParams = function (localeObject) {
        return (!empty(localeObject.custom.country) || !empty(localeObject.custom.klarnaLocale));
    };

    KlarnaPaymentsCustomerTokenRequestBuilder.prototype.isValidParams = function (params) {
        return (!empty(params.order) && !empty(params.localeObject) && this.isValidLocaleObjectParams(params.localeObject));
    };

    KlarnaPaymentsCustomerTokenRequestBuilder.prototype.validateParams = function (params) {
        if (empty(params) || !this.isValidParams(params)) {
            throw new Error('Error when generating KlarnaPaymentsCustomerTokenRequestBuilder. Not valid params.');
        }
    };

    KlarnaPaymentsCustomerTokenRequestBuilder.prototype.build = function () {
        var order = this.params.order;

        this.init()
            .buildLocale(order)
            .buildBilling(order)
            .buildCustomer(order)
            .buildDescription(order);

        return this.context;
    };

    module.exports = KlarnaPaymentsCustomerTokenRequestBuilder;
}());
