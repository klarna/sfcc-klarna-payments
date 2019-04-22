var SG_CORE = require( 'int_klarna_payments/cartridge/scripts/util/KlarnaPaymentsConstants.js' ).SG_CORE;

/**
 * Calculate order total value for a basket.
 * 
 * @param {dw.order.Basket} basket the basket to calculate the order total value.
 * @return {dw.value.Money} total order value.
 */
exports.calculateOrderTotalValue = function (basket) {
    // calculate the amount to be charged for the
    // non-gift certificate payment instrument
    var Utils = require( SG_CORE + '/cartridge/scripts/checkout/Utils' );

    var orderTotalValue = null;

    if (basket.totalGrossPrice.available) {
        orderTotalValue = Utils.calculateNonGiftCertificateAmount(basket);
    } else {
        orderTotalValue = basket.getAdjustedMerchandizeTotalPrice(true).add(basket.giftCertificateTotalPrice);
    }

    return orderTotalValue;
};