var klarnaHelper = require( '*/cartridge/scripts/util/klarnaHelper' );
var subscriptionHelperExtension = require( '*/cartridge/scripts/subscription/subscriptionHelperExtension' );
var isTaxationPolicyNet = klarnaHelper.isTaxationPolicyNet;
var discountTaxationMethod = klarnaHelper.getDiscountsTaxation();
var isOMSEnabled = klarnaHelper.isOMSEnabled();
var Transaction = require( 'dw/system/Transaction' );
var signInHelper = require( '*/cartridge/scripts/signin/klarnaSignIn' );
var CustomerMgr = require( 'dw/customer/CustomerMgr' );
var KlarnaOSM = require( '*/cartridge/scripts/marketing/klarnaOSM' );

/**
 * Builds customer object with Klarna SIWK access token to be used in the Klarna session request for customers using SIWK
 *
 * @param {dw.order.Basket} basket cart object
 * @param {Object} requestBody - The session request body to be updated with customer information
 *
 * @return {Object} updated session request body with customer object
 */
function buildCustomerForSIWKUsers( basket, requestBody ) {
    if ( KlarnaOSM.isKlarnaSignInEnabled() ) {
        Transaction.wrap( function() {
            // update request body with klarna_access_token for customers using SIWK
            var customerProfile = CustomerMgr.getExternallyAuthenticatedCustomerProfile( 'Klarna', basket.customer && basket.customer.profile && basket.customer.profile.email );
            if( customerProfile && customerProfile.custom.kpRefreshToken && session.privacy.KlarnaSignedInCustomer ) {
                var tokenResponse = signInHelper.refreshCustomerSignInToken( customerProfile.custom.kpRefreshToken );
                var accessToken = tokenResponse && tokenResponse.access_token ? tokenResponse.access_token : '';
                customerProfile.custom.kpRefreshToken = tokenResponse && tokenResponse.refresh_token;
                session.privacy.klarnaSignInAccessToken = accessToken;
                customerProfile.custom.klarnaSignInAccessToken = accessToken;
                requestBody.customer = { klarna_access_token: accessToken };
            }
        } );
    }
    return requestBody;
}

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
    buildCustomerForSIWKUsers: buildCustomerForSIWKUsers,
    buildItems: buildItems
}