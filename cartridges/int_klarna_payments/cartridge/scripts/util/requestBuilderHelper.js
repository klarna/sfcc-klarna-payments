var klarnaHelper = require( '*/cartridge/scripts/util/klarnaHelper' );
var subscriptionHelperExtension = require( '*/cartridge/scripts/subscription/subscriptionHelperExtension' );
var isTaxationPolicyNet = klarnaHelper.isTaxationPolicyNet;
var discountTaxationMethod = klarnaHelper.getDiscountsTaxation();
var isOMSEnabled = klarnaHelper.isOMSEnabled();

/**
 * Builds order line items for Klarna session and payment requests
 *
 * @param {Array} items - SFCC product line items array
 * @param {Object} subscription - subscription object to handle basket subscription data if available
 * @param {Object} context - context of the request
 * @param {Object} thisObj  - Klarna request builder object
 *
 * @returns {Array} - line items
 */
function buildItems( items, subscription, context, thisObj ) {
    var unsortedLineItems = [];
    var hasLineItemSubscription = false;

    items.forEach( function( lineItem ) {
        var isGiftCertificate = lineItem.describe().getSystemAttributeDefinition( 'recipientEmail' ) && lineItem.recipientEmail;

        if ( isTaxationPolicyNet() || discountTaxationMethod === 'price' ) {
            if ( !isOMSEnabled && !isGiftCertificate ) {
                handlePriceAdjustments( lineItem, thisObj, context );
            }
        }

        // Build item based on whether it's a gift certificate
        var builtItem = isGiftCertificate ? thisObj.buildGCItem( lineItem ) : thisObj.buildItem( lineItem );

        // Handle subscription for the line item
        var subscriptionObj = subscriptionHelperExtension.handleSubscription( lineItem, subscription, hasLineItemSubscription );
        
        if ( subscriptionObj && subscriptionObj.subscription ) { 
            builtItem.subscription = subscriptionObj.subscription;
        }
        hasLineItemSubscription = subscriptionObj.hasLineItemSubscription;

        // Push each line item to unsorted line item list
        unsortedLineItems.push( builtItem );
    } );

    // Sort line items based on subscription interval, count, and product price
    return subscriptionHelperExtension.sortSubscriptionItems( unsortedLineItems, hasLineItemSubscription );
}

/**
 * Handles the price adjustments for line items
 *
 * @param {Object} lineItem - The line item to handle price adjustments for
 * @param {Object} thisObj - Klarna request builder object
 * @param {Object} context - Context of the request
 * @returns {void} - This function does not return a value
 */
function handlePriceAdjustments( lineItem, thisObj, context ) {
    // Add product-specific shipping price adjustments
    if ( lineItem.shippingLineItem && lineItem.shippingLineItem.priceAdjustments ) {
        thisObj.addPriceAdjustments( lineItem.shippingLineItem.priceAdjustments.toArray(), lineItem.productID, null, context );
    }

    // Add product-specific price adjustments
    if ( lineItem.priceAdjustments && lineItem.priceAdjustments.length > 0 ) {
        thisObj.addPriceAdjustments( lineItem.priceAdjustments.toArray(), lineItem.productID, lineItem.optionID, context );
    }
}

module.exports = {
    buildItems: buildItems
}