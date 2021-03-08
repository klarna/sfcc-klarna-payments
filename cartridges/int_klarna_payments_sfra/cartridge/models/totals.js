'use strict';

var base = module.superModule;

/**
 * Calculates the Klarna order total
 * @param {dw.order.lineItemContainer} lineItemContainer - The current user's line item container
 * @returns {number} The Klarna order total
 */
function getKlarnaTotal(lineItemContainer) {
    var totalGrossPrice = lineItemContainer.getTotalGrossPrice();
    var KlarnaOSM = require('*/cartridge/scripts/marketing/klarnaOSM');

    return KlarnaOSM.formatPurchaseAmount(totalGrossPrice);
}

/**
 * @constructor
 * @classdesc totals class that represents the order totals of the current line item container
 *
 * @param {dw.order.lineItemContainer} lineItemContainer - The current user's line item container
 */
function totals(lineItemContainer) {
    base.apply(this, Array.prototype.slice.call(arguments));

    if (lineItemContainer) {
        this.klarnaTotal = getKlarnaTotal(lineItemContainer);
    }
}

totals.prototype = Object.create(base.prototype);
module.exports = totals;
