'use strict';

function isSubscriptionOnly(apiProduct) {
    var isStandardProduct = !empty(apiProduct.custom.kpIsStandardProduct) ? apiProduct.custom.kpIsStandardProduct : true;
    var isSubscriptionProduct = !empty(apiProduct.custom.kpIsSubscriptionProduct) ? apiProduct.custom.kpIsSubscriptionProduct : false;
    return isSubscriptionProduct && !isStandardProduct;
}

module.exports = function (object, apiProduct, type) {
    Object.defineProperty(object, 'uuid', {
        enumerable: true,
        value: apiProduct.UUID
    });

    Object.defineProperty(object, 'id', {
        enumerable: true,
        value: apiProduct.ID
    });

    Object.defineProperty(object, 'productName', {
        enumerable: true,
        value: apiProduct.name
    });

    Object.defineProperty(object, 'productType', {
        enumerable: true,
        value: type
    });

    Object.defineProperty(object, 'brand', {
        enumerable: true,
        value: apiProduct.brand
    });

    Object.defineProperty(object, 'isSubscriptionOnly', {
        enumerable: true,
        value: isSubscriptionOnly(apiProduct)
    });
};