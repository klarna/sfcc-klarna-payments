'use strict';

/**
 * Script to process customer subscriptopns and create recurring orders or pay trial orders
 */

/* API Includes */
var Status = require('dw/system/Status');
var Logger = require('dw/system/Logger');
var Transaction = require('dw/system/Transaction');
var Calendar = require('dw/util/Calendar');
var currentSite = require('dw/system/Site').current;
var StringUtils = require('dw/util/StringUtils');

var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');

/**
 * Check if subscription is eligible for charge on current date
 * @param {Object} subscription subscription object
 * @returns {boolean} shouldCharge
 */
function shouldCharge(subscription) {
    var currentDate = new Calendar();
    var nextChargeDate = SubscriptionHelper.getNextChargeDateByDateStr(subscription.nextChargeDate);

    var nextRetryDate = subscription.nextRetryDate ? SubscriptionHelper.getNextChargeDateByDateStr(subscription.nextRetryDate) : null;

    var isRetryDate = (isRetryEnabled() && nextRetryDate) ? currentDate.isSameDayByTimestamp(new Calendar(nextRetryDate)) : false;

    var shouldCharge = currentDate.isSameDayByTimestamp(new Calendar(nextChargeDate)) || isRetryDate;
    return shouldCharge;
}

/**
 * Check if retry is configured and enabled
 * @returns {boolean} retryEnabled is retry enabled
 */
function isRetryEnabled() {
    var retryEnabled = currentSite.getCustomPreferenceValue('kpEnableRecurringOrderRetry');
    var retryNumber = currentSite.getCustomPreferenceValue('kpRecurringNumberOfRetry').value;
    var retryFrequency = currentSite.getCustomPreferenceValue('kpRecurringRetryFrequency').value;

    return retryEnabled && retryNumber && retryFrequency;
}

/**
 * Handle subscription retry process
 * @param {Object} subscription subscription reference
 * @param {Object} subToEdit subscription to edit
 * @param {Object} currentSite current site
 */
function handleSubscriptionRetry(subscription, subToEdit, currentSite) {
    var retryNumber = currentSite.getCustomPreferenceValue('kpRecurringNumberOfRetry').value;

    var subRetryCount = subscription.retryCount || 0;
    var newRetryCount = !empty(subscription.retryCount) ? (parseInt(subscription.retryCount) + 1) : 0;

    if (isRetryEnabled() && subRetryCount < retryNumber && newRetryCount < retryNumber) {
        var retryFrequency = currentSite.getCustomPreferenceValue('kpRecurringRetryFrequency').value;
        var nextRetryDate = SubscriptionHelper.calculateNextChargeDate(null, 'day', retryFrequency);
        subToEdit.nextRetryDate = StringUtils.formatCalendar(nextRetryDate, SubscriptionHelper.DATE_PATTERN);
        subToEdit.retryCount = newRetryCount;
    } else {
        var klarnaCreateCustomerTokenResponse = SubscriptionHelper.cancelSubscription(subscription.subscriptionId);
        if (klarnaCreateCustomerTokenResponse.response) {
            subToEdit.enabled = 'false';
            if (isRetryEnabled()) {
                subToEdit.retryCount = newRetryCount;
            }
            Logger.error('Subscription {0} cancelled.', subscription.subscriptionId);
        } else {
            Logger.error('Failed to cancel subscription {0}.', subscription.subscriptionId);
        }
    }
}

/**
 * Function called by job to clear sensitive Klarna payments details
 * @param {Object} parameters Job parameters
 * @return {dw.system.Status} execution status
 */
exports.execute = function (parameters) {
    var params = parameters;
    var Profile = require('dw/customer/Profile');
    var CustomerMgr = require('dw/customer/CustomerMgr');

    function callback(profile) {
        var subscriptions = [];
        var origSubscriptions = [];

        if (profile.custom.kpSubscriptions && JSON.parse(profile.custom.kpSubscriptions).length > 0) {
            origSubscriptions = JSON.parse(profile.custom.kpSubscriptions);

            subscriptions = origSubscriptions.filter(function (sub) {
                return sub.enabled.toString() === 'true' && shouldCharge(sub);
            });

            subscriptions.forEach(function (subscription) {
                try {
                    var orderNo = subscription.lastOrderID;
                    Logger.error('Processing order - {0}, subscription id {1}', orderNo, subscription.subscriptionId);

                    if (orderNo) {
                        var subToEdit = SubscriptionHelper.getSubscriptionById(origSubscriptions, subscription.subscriptionId);

                        var nextChargeDate = SubscriptionHelper.calculateNextChargeDate(null,
                            subscription.subscriptionPeriod, subscription.subscriptionFrequency);

                        if (subscription.isTrial === 'true') {
                            var result = SubscriptionHelper.payRecurringOrder(orderNo);
                            if (!result.error) {
                                subToEdit.isTrial = 'false';
                                subToEdit.lastOrderID = result.orderID;
                                subToEdit.nextChargeDate = StringUtils.formatCalendar(nextChargeDate, SubscriptionHelper.DATE_PATTERN);
                                subToEdit.subscriptionProductID = result.subscriptionProducts ? result.subscriptionProducts : subToEdit.subscriptionProductID;
                                //clear retry data if available
                                delete subToEdit.nextRetryDate;
                                delete subToEdit.retryCount;
                            } else {
                                handleSubscriptionRetry(subscription, subToEdit, currentSite);
                            }

                        } else {
                            var result = SubscriptionHelper.createRecurringOrder(orderNo);

                            if (!result.error) {
                                subToEdit.lastOrderID = result.orderID;
                                subToEdit.nextChargeDate = StringUtils.formatCalendar(nextChargeDate, SubscriptionHelper.DATE_PATTERN);
                                subToEdit.subscriptionProductID = result.subscriptionProducts;
                                //clear retry data if available
                                delete subToEdit.nextRetryDate;
                                delete subToEdit.retryCount;
                            } else {
                                handleSubscriptionRetry(subscription, subToEdit, currentSite);
                            }
                        }
                    }
                } catch (err) {
                    Logger.error('Error processing subscription - {0} - {1} - {2}', subscription.subscriptionId, err, err.stack);
                }
            });

            //update customer subscriptions
            Transaction.wrap(function () {
                profile.custom.kpSubscriptions = JSON.stringify(origSubscriptions);
            });
        }
    }

    CustomerMgr.processProfiles(callback, "");

    return new Status(Status.OK);
};