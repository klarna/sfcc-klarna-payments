'use strict';

var baseProductLineItemModel = module.superModule;

/**
 * Decorate product with product line item information
 * @param {Object} product - Product Model to be decorated
 * @param {dw.catalog.Product} apiProduct - Product information returned by the script API
 * @param {Object} options - Options passed in from the factory
 * @property {dw.catalog.ProductVarationModel} options.variationModel - Variation model returned by the API
 * @property {Object} options.lineItemOptions - Options provided on the query string
 * @property {dw.catalog.ProductOptionModel} options.currentOptionModel - Options model returned by the API
 * @property {dw.util.Collection} options.promotions - Active promotions for a given product
 * @property {number} options.quantity - Current selected quantity
 * @property {Object} options.variables - Variables passed in on the query string
 *
 * @returns {Object} - Decorated product model
 */
module.exports = function productLineItem(product, apiProduct, options) {
    baseProductLineItemModel.call(this, product, apiProduct, options);

    product.kpSubscription = options.lineItem.custom.kpSubscription; // eslint-disable-line no-param-reassign

    product.showSubscription = apiProduct.custom.kpIsSubscriptionProduct; // eslint-disable-line no-param-reassign
    var isStandardProduct = !empty(apiProduct.custom.kpIsStandardProduct) ? apiProduct.custom.kpIsStandardProduct : true; // eslint-disable-line no-undef
    product.disableSubscribe = apiProduct.custom.kpIsSubscriptionProduct && !isStandardProduct; // eslint-disable-line no-param-reassign
    product.kpTrialDaysUsage = apiProduct.custom.kpTrialDaysUsage; // eslint-disable-line no-param-reassign
    return product;
};
