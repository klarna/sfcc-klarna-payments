'use strict';

/**
 * Copy billing address from order to basket
 * @param {Object} basket new basket
 * @param {Object} order order reference
 * @returns {void}
 */
function copyBilling( basket, order ) {
    // Copying billing address
    if ( order.billingAddress ) {
        var orderBillingAddress = order.billingAddress;
        var basketBillingAddress = basket.createBillingAddress();
        basketBillingAddress.setFirstName( orderBillingAddress.firstName );
        basketBillingAddress.setLastName( orderBillingAddress.lastName );
        basketBillingAddress.setAddress1( orderBillingAddress.address1 );
        basketBillingAddress.setAddress2( orderBillingAddress.address2 );
        basketBillingAddress.setCity( orderBillingAddress.city );
        basketBillingAddress.setPostalCode( orderBillingAddress.postalCode );
        basketBillingAddress.setStateCode( orderBillingAddress.stateCode );
        basketBillingAddress.setCountryCode( orderBillingAddress.countryCode );
        basketBillingAddress.setPhone( orderBillingAddress.phone );
    }
}

/**
 * Copy shipping details from order to basket
 * @param {Object} basket new basket
 * @param {Object} order order reference
 * @returns {void}
 */
function copyShippingDetails( basket, order ) {
    var UUIDUtils = require( 'dw/util/UUIDUtils' );
    var orderShipments = order.shipments;
    for ( var j = 0; j < orderShipments.length; j++ ) {
        var orderShipment = orderShipments[j];

        if ( orderShipment.shippingAddress ) {
            var orderShippingAddress = orderShipment.shippingAddress;

            var uuid = UUIDUtils.createUUID();
            var basketShipment = basket.defaultShipment ? basket.defaultShipment : basket.createShipment( uuid );
            basketShipment.setShippingMethod( orderShipment.shippingMethod );

            var basketShippingAddress = basketShipment.createShippingAddress();
            basketShippingAddress.setFirstName( orderShippingAddress.firstName );
            basketShippingAddress.setLastName( orderShippingAddress.lastName );
            basketShippingAddress.setAddress1( orderShippingAddress.address1 );
            basketShippingAddress.setAddress2( orderShippingAddress.address2 );
            basketShippingAddress.setCity( orderShippingAddress.city );
            basketShippingAddress.setPostalCode( orderShippingAddress.postalCode );
            basketShippingAddress.setStateCode( orderShippingAddress.stateCode );
            basketShippingAddress.setCountryCode( orderShippingAddress.countryCode );
            basketShippingAddress.setPhone( orderShippingAddress.phone );
        }
    }
}

/**
 * Copy payment instrument from order to basket
 * @param {Object} basket new basket
 * @param {Object} order order reference
 * @returns {void}
 */
function copyPaymentInstrument( basket, order ) {
    var orderPaymentInstruments = order.paymentInstruments;
    for ( var k = 0; k < orderPaymentInstruments.length; k++ ) {
        var orderPaymentInstrument = orderPaymentInstruments[k];
        var paymentMethod = orderPaymentInstrument.paymentMethod;
        var paymentTransaction = orderPaymentInstrument.paymentTransaction;
        var amount = paymentTransaction.amount;
        var basketPaymentInstrument = basket.createPaymentInstrument( paymentMethod, amount );
        basketPaymentInstrument.custom.klarnaPaymentCategoryID = orderPaymentInstrument.custom.klarnaPaymentCategoryID;
        basketPaymentInstrument.custom.klarnaPaymentCategoryName = orderPaymentInstrument.custom.klarnaPaymentCategoryName;
    }
}

/**
 * Copy general information from order to basket
 * @param {Object} basket new basket
 * @param {Object} order order reference
 * @returns {void}
 */
function copyGeneralData( basket, order ) {
    basket.custom.kpSubscriptionFrequency = order.custom.kpSubscriptionFrequency;
    basket.custom.kpSubscriptionPeriod = order.custom.kpSubscriptionPeriod;
    basket.setCustomerEmail( order.customerEmail );
}

/**
 * Copy products and line items from order to basket
 * @param {Object} basket new basket
 * @param {Object} order order reference
 * @returns {void}
 */
function copyProductsAndLineItems( basket, order ) {
    var cartHelper = require( '*/cartridge/scripts/cart/cartHelpers' );
    var orderProductLineItems = order.productLineItems;
    for ( var i = 0; i < orderProductLineItems.length; i++ ) {
        var orderLineItem = orderProductLineItems[i];
        var product = orderLineItem.product;
        var quantity = orderLineItem.quantityValue;

        var result = cartHelper.addProductToCart(
            basket,
            product.ID,
            quantity,
            null,
            []
        );
        if ( !result.error ) {
            var basketProductLineItem = basket.getProductLineItems( product.ID )[0];
            basketProductLineItem.custom.kpSubscription = true;
        }
    }
}

/**
 * Copy products and line items from order to basket
 * @param {Object} basket new basket
 * @param {Object} order order reference
 * @returns {void}
 */
function copyProductsAndLineItemsSG( basket, order ) {
    var orderProductLineItems = order.productLineItems;
    for ( var i = 0; i < orderProductLineItems.length; i++ ) {
        var orderLineItem = orderProductLineItems[i];
        var product = orderLineItem.product;
        var quantity = orderLineItem.quantityValue;
        var shipment = basket.defaultShipment;

        if ( product === null || !product.online ) {
            continue;
        }

        var basketProductLineItem = null;
        //check product availability
        if ( Object.hasOwnProperty.call( orderLineItem.custom, 'fromStoreId' )
            && orderLineItem.custom.fromStoreId ) {
            var store = StoreMgr.getStore( orderLineItem.custom.fromStoreId );
            var storeInventory = ProductInventoryMgr.getInventoryList( store.custom.inventoryListId );

            if ( ( storeInventory.getRecord( orderLineItem.productID )
                && storeInventory.getRecord( orderLineItem.productID ).ATS.value >= orderLineItem.quantityValue ) ) {
                basketProductLineItem = basket.createProductLineItem( product, null, shipment );
            }
        } else {
            var availabilityLevels = orderLineItem.product.availabilityModel
                .getAvailabilityLevels( orderLineItem.quantityValue );
            if ( availabilityLevels.notAvailable.value === 0 ) {
                basketProductLineItem = basket.createProductLineItem( product, null, shipment );
            }
        }


        if ( basketProductLineItem ) {
            basketProductLineItem.custom.kpSubscription = true;
        }
    }
}

/**
 * Create basket and copy data from the order
 * @param {Object} order order reference
 * @param {Object} req current request
 * @returns {Object} basket created basket
 */
function copyOrderToBasket( order, req ) {
    var BasketMgr = require( 'dw/order/BasketMgr' );
    var Transaction = require( 'dw/system/Transaction' );
    var COHelpers = require( '*/cartridge/scripts/checkout/checkoutHelpers' );

    var basket = BasketMgr.getCurrentOrNewBasket();
    BasketMgr.deleteBasket( basket );
    basket = BasketMgr.getCurrentOrNewBasket();

    Transaction.wrap( function() {

        // Copying products and line items
        copyProductsAndLineItems( basket, order );

        // Copying billing address
        copyBilling( basket, order );

        // Copying shipping address
        copyShippingDetails( basket, order );

        // Copying payment instruments
        copyPaymentInstrument( basket, order );

        copyGeneralData( basket, order );

        COHelpers.ensureNoEmptyShipments( req );
        COHelpers.recalculateBasket( basket );
    } );

    return basket;
}

/**
 * Create basket and copy data from the order
 * @param {Object} order order reference
 * @param {Object} req current request
 * @returns {Object} basket created basket
 */
function copyOrderToBasketSG( order, req ) {
    var BasketMgr = require( 'dw/order/BasketMgr' );
    var Transaction = require( 'dw/system/Transaction' );
    var app = require( '*/cartridge/scripts/app' );
    var Cart = app.getModel( 'Cart' );

    var basket = BasketMgr.getCurrentOrNewBasket();
    BasketMgr.deleteBasket( basket );
    basket = BasketMgr.getCurrentOrNewBasket();

    Transaction.wrap( function() {

        // Copying products and line items
        copyProductsAndLineItemsSG( basket, order );

        // Copying billing address

        // Copying billing address
        copyBilling( basket, order );

        // Copying shipping address
        copyShippingDetails( basket, order );

        // Copying payment instruments
        copyPaymentInstrument( basket, order );

        copyGeneralData( basket, order );

        var cart = Cart.get( basket );
        cart.calculate();

    } );

    return basket;
}



module.exports = {
    copyOrderToBasket: copyOrderToBasket,
    copyOrderToBasketSG: copyOrderToBasketSG
}