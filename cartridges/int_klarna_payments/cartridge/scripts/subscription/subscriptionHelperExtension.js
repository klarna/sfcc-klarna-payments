'use strict';

var Logger = require( 'dw/system/Logger' );

/**
 * Get the payment intent to be set in the payment request
 * This function can be extended for customization based on the merchant's requirements
 * Use the intent "buy" if the basket contains only standard products and no subscription products
 * Use the intent "tokenize" if the basket contains only subscription products with a trial period
 * Use the intent "buy_and_default_tokenize" if the basket contains at least one 
 * subscription product without a trial period or if it contains both standard and subscription products
 * @param {Object} subscriptionData basket subscription data object
 * @returns {string} intent
 */
function getPaymentIntent( subscriptionData ) {
    var intent = 'buy';
    if ( subscriptionData ) {
        if ( subscriptionData.subscriptionTrialPeriod ) {
            intent = 'tokenize';
        } else {
            intent = 'buy_and_default_tokenize';
        }
    }
    return intent;
}

/**
 * Build subscription object for checkout page for each line item
 * This function can be extended for customization based on the merchant's requirements
 * @param {Object} li product line item
 * @returns {Object} subscriptionObj
 */
function buildItemSubscriptionObj( li ) {
    var subscriptionObj = null;
    try {
        var isSubscriptionProduct = li.custom.kpSubscriptionDemo && li.kpSubscriptionFrequencyDemo;
        if ( !isSubscriptionProduct ) {
            // return null if the product is not a subscription product
            return subscriptionObj;
        }
    
        subscriptionObj = {
            name: li.productName, // product name
            interval: li.subscriptionPeriod, // product subscription period in uppercase (DAY, WEEK, MONTH, YEAR etc)
            interval_count: li.subscriptionFrequency // product subscription frequency (1, 2 etc)
        };
    } catch ( e ) {
        Logger.error( 'Error building subscription object: ' + e.message + e.stack );
    }
    return subscriptionObj;
}

/**
 * Retrieves line item subscription data from the basket
 * This function can be extended for customization based on merchant's requirements
 * @param {Object} currentBasket current basket
 * @returns {object} subscribtion data object
 */
function getLineItemSubscriptionData( currentBasket ) {
    if ( !currentBasket ) {
        return null;
    }

    var subscriptionItems = [];
    var hasTrialSubscriptionOnly = false;

    /* 
    // Start: Add your custom logic to handle line item subscription data

    var productLineItems = currentBasket.productLineItems.toArray();
    for ( var li of productLineItems ) {
        var subscriptionObj = this.buildItemSubscriptionObj( li );
        if ( subscriptionObj ) {
            subscriptionItems.push( subscriptionObj );
            if ( !li.custom.kpTrialDaysUsage ) {
                hasTrialSubscriptionOnly = false;
                break;
            } else {
                hasTrialSubscriptionOnly = true;
            }
        }
    }

    // End: Add your custom logic to handle line item subscription data
    */

    var subscriptionData = {
        subscriptions: subscriptionItems, // subscription items array
        hasTrialSubscriptionOnly: hasTrialSubscriptionOnly // flag indicating if only trial subscription products are available
    };

    return subscriptionData;
}

/**
 * Calculate the total subscription duration in days by multiplying the subscription interval (e.g., monthly, yearly)
 * by the frequency (number of occurrences) to determine the overall number of days.
 * @param {Object} item product line item
 * @returns {number} subscription duration in days
 */
function getSubscriptionIntervalCount( item ) {
    var SUBSCRIPTION_INTERVALS_IN_DAYS = require( '*/cartridge/scripts/util/constants' ).SUBSCRIPTION_INTERVALS_IN_DAYS;
    var interval = item.subscription ? SUBSCRIPTION_INTERVALS_IN_DAYS[item.subscription.interval] : 0;
    var frequency = item.subscription ? parseInt( item.subscription.interval_count, 10 ) : 0;

    return interval * frequency;
}

/**
 * Sort subscription items based on subscription frequency (in days) and price
 * The function first sorts items by their subscription duration (interval count in days), and if the durations are the same,
 * it then sorts by price (total_amount), ensuring that items with higher prices come first.
 * @param {Object} items unsorted product line items
 * @param {boolean} hasLineItemSubscription flag indicating if the basket contains subscription lineitems
 * @returns {Object} sorted product line items
 */
function sortSubscriptionItems( items, hasLineItemSubscription ) {
    try {
        if ( !hasLineItemSubscription ) {
            return items;
        }

        var List = require( 'dw/util/ArrayList' );
    
        // Convert lineItems to a List to sort based on subscription frequency
        var lineItemsList = new List( items );
        
        // Sort the line items based on subscription frequency and price
        lineItemsList.sort( function( firstItem, secondItem ) {
            var firstItemIntervalCount = getSubscriptionIntervalCount( firstItem );
            var secondItemIntervalCount = getSubscriptionIntervalCount( secondItem );

            // Sort by interval count in descending order
            if ( firstItemIntervalCount !== secondItemIntervalCount ) {
                return secondItemIntervalCount - firstItemIntervalCount;
            }

            // If intervals are the same, sort by price (total_amount) in descending order
            return secondItem.total_amount - firstItem.total_amount;
        } );
    
        // return sorted line items
        return lineItemsList.toArray();
    } catch ( e ) {
        // Return original line items if sorting fails
        Logger.error( 'Error sorting subscription items: ' + e.message + e.stack );
        return items;
    }
}

/**
 * Build new subscription object for each line item if basket subscription does not exist, otherwise return existing basket subscription
 * @param {Object} li - The line item object
 * @param {Object} subscription - The existing basket subscription object if available, or null if a new subscription needs to be created
 * @param {boolean} hasLineItemSubscription - true if line item subscriptions are available, otherwise false
 * @returns {Object} An object containing:
 *   - `subscription`: The subscription object, basket subscription if available or a line item subscription
 *   - `hasLineItemSubscription`: A boolean flag indicating whether a subscription-based product exists in the line items
 */
function handleSubscription( li, subscription, hasLineItemSubscription ) {
    var liSubscription = null;
    if ( subscription ) {
        // Return the basket subscription if it exists
        subscription.name = li.productName;
        liSubscription = subscription;
    } else {
        /*
        // Start: Add your custom logic to handle line item subscription data
        // Create line item subscription object if basket subscription does not exist
        // liSubscription = this.buildItemSubscriptionObj( li );
        // hasLineItemSubscription = liSubscription ? true : hasLineItemSubscription; // eslint-disable-line no-param-reassign
        // End: Add your custom logic to handle line item subscription data
        */
    }

    return { 
        subscription: liSubscription,
        hasLineItemSubscription: hasLineItemSubscription
    };
}

module.exports = {
    getPaymentIntent: getPaymentIntent,
    buildItemSubscriptionObj: buildItemSubscriptionObj,
    getLineItemSubscriptionData: getLineItemSubscriptionData,
    getSubscriptionIntervalCount: getSubscriptionIntervalCount,
    sortSubscriptionItems: sortSubscriptionItems,
    handleSubscription: handleSubscription
};
