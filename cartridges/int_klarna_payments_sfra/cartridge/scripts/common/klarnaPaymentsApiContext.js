'use strict';

var HashMap = require('dw/util/HashMap');

/**
 * @constructor
 * @classdesc Klarna Payments Api Context, container for Klarna API URLs.
 */
var KlarnaPaymentsApiContext = function () {
    this.flowApiUrls = null;
};

/**
 * Return Klarna API URLs.
 *
 * @returns {HashMap} Klarna API URLs.
 */
KlarnaPaymentsApiContext.prototype.getFlowApiUrls = function () {
    if (this.flowApiUrls === null) {
        this.flowApiUrls = new HashMap();

        this.flowApiUrls.put('createSession', 'payments/v1/sessions');
        this.flowApiUrls.put('updateSession', 'payments/v1/sessions/{0}');
        this.flowApiUrls.put('getOrder', '/ordermanagement/v1/orders/{0}');
        this.flowApiUrls.put('createOrder', 'payments/v1/authorizations/{0}/order');
        this.flowApiUrls.put('cancelOrder', '/ordermanagement/v1/orders/{0}/cancel');
        this.flowApiUrls.put('getCompletedOrder', '/ordermanagement/v1/orders/{0}');
        this.flowApiUrls.put('acknowledgeOrder', 'ordermanagement/v1/orders/{0}/acknowledge');
        this.flowApiUrls.put('createCapture', '/ordermanagement/v1/orders/{0}/captures');
        this.flowApiUrls.put('vcnSettlement', 'merchantcard/v3/settlements');
    }

    return this.flowApiUrls;
};

module.exports = KlarnaPaymentsApiContext;
