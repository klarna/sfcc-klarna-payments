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
    if (lineItemContainer && 'kpOrderID' in lineItemContainer.custom) {
        this.klarnaOrderId = lineItemContainer.custom.kpOrderID;
    }
}

OrderModel.prototype = Object.create(base.prototype);
module.exports = OrderModel;
