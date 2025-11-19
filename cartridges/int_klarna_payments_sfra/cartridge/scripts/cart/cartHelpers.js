'use strict';

var superMdl = module.superModule;


var productHelper = require('*/cartridge/scripts/helpers/productHelpers');
var ProductMgr = require('dw/catalog/ProductMgr');
var Resource = require('dw/web/Resource');

/**
 * Sets the Klarna subscription flag on a product line item if the product is a subscription product.
 *
 * @param {dw.order.ProductLineItem} productLineItem - The product line item to update.
 * @param {dw.catalog.Product} product - The product object containing subscription-related custom attributes.
 */
function setSubscriptionValue(productLineItem, product) {
    var isSubscriptionProduct = product.custom.kpIsSubscriptionProduct;
    var isStandardProduct = !empty(product.custom.kpIsStandardProduct) ? product.custom.kpIsStandardProduct : true; // eslint-disable-line no-undef
    if (isSubscriptionProduct && !isStandardProduct) {
        productLineItem.custom.kpSubscription = true; // eslint-disable-line no-param-reassign
    }
}

/**
 * Adds a product line item to the current basket with optional child products and options.
 * Also sets Klarna subscription flags where applicable.
 *
 * @param {dw.order.Basket} currentBasket - The current basket to which the product will be added.
 * @param {dw.catalog.Product} product - The product to add as a line item.
 * @param {number} quantity - The quantity of the product to add.
 * @param {dw.catalog.Product[]} childProducts - The list of child products (if the main product is a bundle).
 * @param {dw.catalog.ProductOptionModel} optionModel - The product option model, if applicable.
 * @param {dw.order.Shipment} defaultShipment - The shipment to which the product line item will be assigned.
 * @returns {dw.order.ProductLineItem} The created product line item.
 */
function addLineItem(currentBasket, product, quantity, childProducts, optionModel, defaultShipment) {
    var productLineItem = currentBasket.createProductLineItem(
        product,
        optionModel,
        defaultShipment
    );

    if (product.bundle && childProducts.length) {
        superMdl.updateBundleProducts(productLineItem, childProducts);
    }

    productLineItem.setQuantityValue(quantity);

    setSubscriptionValue(productLineItem, product);

    return productLineItem;
}

/**
 * Adds a product to the cart. If the product is already in the cart it increases the quantity of
 * that product.
 * @param {dw.order.Basket} currentBasket - Current users's basket
 * @param {string} productId - the productId of the product being added to the cart
 * @param {number} quantity - the number of products to the cart
 * @param {string[]} childProducts - the products' sub-products
 * @param {SelectedOption[]} options - product options
 *  @return {Object} returns an error object
 */
superMdl.addProductToCart = function (currentBasket, productId, quantity, childProducts, options) {
    var availableToSell;
    var defaultShipment = currentBasket.defaultShipment;
    var perpetual;
    var product = ProductMgr.getProduct(productId);
    var productInCart;
    var productLineItems = currentBasket.productLineItems;
    var productQuantityInCart;
    var quantityToSet;
    var optionModel = productHelper.getCurrentOptionModel(product.optionModel, options);
    var result = {
        error: false,
        message: Resource.msg('text.alert.addedtobasket', 'product', null)
    };

    var totalQtyRequested = 0;
    var canBeAdded = false;

    if (product.bundle) {
        canBeAdded = superMdl.checkBundledProductCanBeAdded(childProducts, productLineItems, quantity);
    } else {
        totalQtyRequested = quantity + superMdl.getQtyAlreadyInCart(productId, productLineItems);
        perpetual = product.availabilityModel.inventoryRecord.perpetual;
        canBeAdded = (perpetual
                || totalQtyRequested <= product.availabilityModel.inventoryRecord.ATS.value);
    }

    if (!canBeAdded) {
        result.error = true;
        result.message = Resource.msgf(
            'error.alert.selected.quantity.cannot.be.added.for',
            'product',
            null,
            product.availabilityModel.inventoryRecord.ATS.value,
            product.name
        );
        return result;
    }

    productInCart = superMdl.getExistingProductLineItemInCart(product, productId, productLineItems, childProducts, options);

    if (productInCart) {
        productQuantityInCart = productInCart.quantity.value;
        quantityToSet = quantity ? quantity + productQuantityInCart : productQuantityInCart + 1;
        availableToSell = productInCart.product.availabilityModel.inventoryRecord.ATS.value;

        if (availableToSell >= quantityToSet || perpetual) {
            productInCart.setQuantityValue(quantityToSet);
            result.uuid = productInCart.UUID;
        } else {
            result.error = true;
            result.message = availableToSell === productQuantityInCart
                ? Resource.msg('error.alert.max.quantity.in.cart', 'product', null)
                : Resource.msg('error.alert.selected.quantity.cannot.be.added', 'product', null);
        }
    } else {
        var productLineItem;
        productLineItem = addLineItem(
            currentBasket,
            product,
            quantity,
            childProducts,
            optionModel,
            defaultShipment
        );

        result.uuid = productLineItem.UUID;
    }

    return result;
};

module.exports = superMdl;
