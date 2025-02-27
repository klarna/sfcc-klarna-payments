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
        var isSubscriptionProduct = li.subscriptionPeriod && li.subscriptionFrequency;
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

module.exports = {
    getPaymentIntent: getPaymentIntent,
    buildItemSubscriptionObj: buildItemSubscriptionObj,
    getLineItemSubscriptionData: getLineItemSubscriptionData
};