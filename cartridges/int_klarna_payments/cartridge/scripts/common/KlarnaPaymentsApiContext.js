'use strict';

let HashMap = require('dw/util/HashMap');

let KlarnaPaymentsApiContext = function () {};

KlarnaPaymentsApiContext.prototype.getFlowApiUrls = function() {

    if (this._flowApiUrls == null) {
        this._flowApiUrls = new HashMap();

        this._flowApiUrls.put('createSession', 'credit/v1/sessions');
        this._flowApiUrls.put('updateSession', 'credit/v1/sessions/{0}');    
        this._flowApiUrls.put('createOrder', '/credit/v1/authorizations/{0}/order');
    }

    return this._flowApiUrls;
};

module.exports = KlarnaPaymentsApiContext;
