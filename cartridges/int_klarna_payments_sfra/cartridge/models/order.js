'use strict';

var base = module.superModule;

/**
 * Order class that represents the current order
 * @param {dw.order.LineItemCtnr} lineItemContainer - Current users's basket/order
 * @param {Object} options - The current order's line items
 * @constructor
 */
function OrderModel(lineItemContainer, options) {
    base.call(this, lineItemContainer, options);

    this.klarnaOrderId = '';
    this.klarnaSessionId = '';
    this.klarnaClientToken = '';
    this.kpAuthorizationToken = '';
    this.kpRedirectURL = '';

    if (lineItemContainer && 'klarna_oms__kpOrderID' in lineItemContainer.custom) {
        this.klarnaOrderId = lineItemContainer.custom.klarna_oms__kpOrderID;
    }

    if (lineItemContainer && 'kpSessionId' in lineItemContainer.custom) {
        this.klarnaSessionId = lineItemContainer.custom.kpSessionId;
    }

    if (lineItemContainer && 'kpClientToken' in lineItemContainer.custom) {
        this.klarnaClientToken = lineItemContainer.custom.kpClientToken;
    }

    if (lineItemContainer && 'kpAuthorizationToken' in lineItemContainer.custom) {
        this.kpAuthorizationToken = lineItemContainer.custom.kpAuthorizationToken;
    }

    if (lineItemContainer && 'kpRedirectURL' in lineItemContainer.custom) {
        this.kpRedirectURL = lineItemContainer.custom.kpRedirectURL;
    }

    if (lineItemContainer && 'kpCustomerToken' in lineItemContainer.custom) {
        this.subscriptionId = lineItemContainer.custom.kpCustomerToken;
    }

    if (lineItemContainer && 'kpIsExpressCheckout' in lineItemContainer.custom) {
        this.kpIsExpressCheckout = lineItemContainer.custom.kpIsExpressCheckout;
    }
}

OrderModel.prototype = Object.create(base.prototype);
module.exports = OrderModel;
