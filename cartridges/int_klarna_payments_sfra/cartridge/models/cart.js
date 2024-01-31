'use strict';

var base = module.superModule;

/**
 * @constructor
 * @classdesc CartModel class that represents the current basket
 *
 * @param {dw.order.Basket} basket - Current users's basket
 * @param {dw.campaign.DiscountPlan} discountPlan - set of applicable discounts
 */
function CartModel(basket) {
    base.call(this, basket);

    var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');

    if (basket) {
        this.hasSubscriptionOnlyProduct = SubscriptionHelper.hasSubscriptionOnly();
        this.isSubscriptionBasket = SubscriptionHelper.isSubscriptionBasket(basket);
    }

}

CartModel.prototype = Object.create(base.prototype);
module.exports = CartModel;