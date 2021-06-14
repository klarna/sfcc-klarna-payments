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

    if (lineItemContainer && 'kpOrderID' in lineItemContainer.custom) {
        this.klarnaOrderId = lineItemContainer.custom.kpOrderID;
    }

    if (lineItemContainer && 'kpSessionId' in lineItemContainer.custom) {
        this.klarnaSessionId = lineItemContainer.custom.kpSessionId;
    }

    if (lineItemContainer && 'kpClientToken' in lineItemContainer.custom) {
        this.klarnaClientToken = lineItemContainer.custom.kpClientToken;
    }
}

OrderModel.prototype = Object.create(base.prototype);
module.exports = OrderModel;
