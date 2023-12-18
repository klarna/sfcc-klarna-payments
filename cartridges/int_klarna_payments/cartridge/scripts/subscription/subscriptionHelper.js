'use strict';

var DATE_PATTERN = 'yyyy-MM-dd';

/**
 * Build subscription data for checkout page
 * @param {Object} currentBasket current basket 
 * @returns {object} subscribtion data object
 */
function getSubscriptionData(currentBasket) {
    if (!currentBasket) {
        return null;
    }

    var productLineItems = currentBasket.productLineItems.toArray();
    var subscriptionLineitem = null;

    productLineItems.forEach(function (item) {
        if (item.custom.kpSubscription) {
            subscriptionLineitem = item;
        }
    });

    if (!subscriptionLineitem) {
        return null;
    }

    var product = subscriptionLineitem.product;

    var basketDef = currentBasket.describe();
    var kpSubscriptionPeriodValues = basketDef.getCustomAttributeDefinition('kpSubscriptionPeriod').values;
    var kpSubscriptionFrequencyValues = basketDef.getCustomAttributeDefinition('kpSubscriptionFrequency').values;

    var subscriptionData = {
        subscriptionPeriod: currentBasket.custom.kpSubscriptionPeriod,
        subscriptionFrequency: currentBasket.custom.kpSubscriptionFrequency,
        subscriptionTrialPeriod: product.custom.kpTrialDaysUsage,
        periodValues: kpSubscriptionPeriodValues,
        frequencyValues: kpSubscriptionFrequencyValues
    };
    return subscriptionData;

}

/**
 * Build subscription data for cart page dropdowns
 * @param {Object} currentBasket 
 * @returns {Object} subscription details
 */
function getSubscriptionDataCart(currentBasket) {
    if (!currentBasket) {
        return null;
    }

    var basketDef = currentBasket.describe();
    var kpSubscriptionPeriodValues = basketDef.getCustomAttributeDefinition('kpSubscriptionPeriod').values;
    var kpSubscriptionFrequencyValues = basketDef.getCustomAttributeDefinition('kpSubscriptionFrequency').values;

    var subscriptionData = {
        subscriptionPeriod: currentBasket.custom.kpSubscriptionPeriod,
        subscriptionFrequency: currentBasket.custom.kpSubscriptionFrequency,
        periodValues: kpSubscriptionPeriodValues,
        frequencyValues: kpSubscriptionFrequencyValues
    };
    return subscriptionData;

}

/**
 * Validate basket if there are subscription products
 * in it. All products should be either subscription
 * or standard, mixed basket is not allowed.
 * All subscription products should have the same
 * subscription frequency, period and trial days of usage.
 * 
 * @param {Object} currentBasket 
 * @returns {boolean} validation status
 */
function validateCartProducts(currentBasket) {
    if (!currentBasket) {
        return;
    }
    var Resource = require('dw/web/Resource');
    var productLineItems = currentBasket.productLineItems.toArray();

    if (productLineItems.length === 0) {
        return;
    }

    var subscriptionProductsCount = 0;
    var standardProductsCount = 0;
    var subscriptionTrialDays = productLineItems[0].product ? productLineItems[0].product.custom.kpTrialDaysUsage : null;
    var subscriptionDetailsMatch = true;

    var result = {
        error: false
    };

    productLineItems.forEach(function (item) {
        if (item.product === null || !item.product.online) {
            result.error = true;
            return;
        }

        var product = item.product;

        if (item.custom.kpSubscription) {
            subscriptionProductsCount++;
            if (subscriptionTrialDays !== product.custom.kpTrialDaysUsage) {
                subscriptionDetailsMatch = false;
            }
        } else {
            standardProductsCount++;
        }
    });

    if (subscriptionProductsCount > 0) {
        if (standardProductsCount > 0) {
            result.error = true;
            result.message = Resource.msg('klarna.subscription.mixed.cart.error', 'subscription', null);
        } else if (!subscriptionDetailsMatch) {
            result.error = true;
            result.message = Resource.msg('klarna.subscription.mixed.details.error', 'subscription', null);
        }
    }
    return result;
}

/**
 * Check if current basket has subscription products 
 * @param {Object} currentBasket currentBasket
 * @returns {boolean} basket subscription status
 */
function isSubscriptionBasket(currentBasket) {
    if (!currentBasket) {
        return false;
    }
    var productLineItems = currentBasket.productLineItems.toArray();

    var subscriptionLineitem = null;

    productLineItems.forEach(function (item) {
        if (item.custom.kpSubscription) {
            subscriptionLineitem = item;
        }
    });
    return subscriptionLineitem || false;
}

/**
 * Calculate next charge date
 * @param {Object} trialPeriod 
 * @param {Object} subscriptionPeriod 
 * @param {Object} subscriptionFrequency 
 * @returns {String} next charge date
 */
function calculateNextChargeDate(trialPeriod, subscriptionPeriod, subscriptionFrequency) {
    var Calendar = require('dw/util/Calendar');
    var Logger = require('dw/system/Logger');

    var nextDate = new Calendar();
    try {
        if (trialPeriod) {
            nextDate.add(Calendar.DAY_OF_YEAR, trialPeriod);
        } else {

            var calendarField = null;
            switch (subscriptionPeriod) {
                case 'day': calendarField = Calendar.DAY_OF_YEAR;
                    break;
                case 'week': calendarField = Calendar.WEEK_OF_YEAR;
                    break;
                case 'month': calendarField = Calendar.MONTH;
                    break;
                case 'year': calendarField = Calendar.YEAR;
                    break;
                default: Logger.error('Unknown subscription period value: ' + subscriptionPeriod);
            }

            if (calendarField) {
                nextDate.add(calendarField, subscriptionFrequency);
            }
        }
    } catch (err) {
        Logger.error('Error calculating next charging date: ' + err);
    }

    return nextDate;
}

/**
 * Get product ids from order line items
 * @param {Object} order 
 * @returns {String} comma separated list of priduct ids
 */
function getSubscriptionProducts(order) {
    var productIds = [];

    var productLineItems = order.productLineItems.toArray();
    productLineItems.forEach(function (item) {
        productIds.push(item.product.ID);
    });

    return productIds.join(',');
}

/**
 * Update subscription details in customer profile
 * @param {Object} order 
 */
function updateCustomerSubscriptionData(order) {
    var StringUtils = require('dw/util/StringUtils');
    var Transaction = require('dw/system/Transaction');

    var customerToken = session.privacy.customer_token;

    if (!order.customer) {
        return;
    }

    var customer = order.customer.profile;
    var subscriptionData = getSubscriptionData(order);
    if (!subscriptionData) {
        return;
    }

    var trialPeriod = subscriptionData.subscriptionTrialPeriod;
    var subscriptionPeriod = subscriptionData.subscriptionPeriod;
    var subscriptionFrequency = subscriptionData.subscriptionFrequency;

    var nextChargeDate = calculateNextChargeDate(trialPeriod, subscriptionPeriod, subscriptionFrequency);
    try {
        var kpSubscriptions = customer.custom.kpSubscriptions ? JSON.parse(customer.custom.kpSubscriptions) : [];
        var kpSubscription = {
            subscriptionId: customerToken,
            enabled: 'true',
            nextChargeDate: StringUtils.formatCalendar(nextChargeDate, DATE_PATTERN),
            subscriptionPeriod: subscriptionData.subscriptionPeriod,
            subscriptionFrequency: subscriptionData.subscriptionFrequency,
            subscriptionProductID: getSubscriptionProducts(order),
            lastOrderID: order.orderNo,
            isTrial: trialPeriod ? 'true' : 'false'
        };

        kpSubscriptions.push(kpSubscription);
        Transaction.wrap(function () {
            customer.custom.kpSubscriptions = JSON.stringify(kpSubscriptions);
            order.custom.kpCustomerToken = customerToken;
            session.privacy.customer_token = null;
        });
    } catch (err) {
        dw.system.Logger.error('Error updating customer data: ' + err);
    }
}

/**
 * Get subscription total from last order
 * @param {String} orderNo order no
 * @returns {Object} total price
 */
function getSubscriptionLastTotal(orderNo) {
    var OrderMgr = require('dw/order/OrderMgr');
    var order = OrderMgr.getOrder(orderNo);
    if (order) {
        return order.totalGrossPrice;
    } else {
        return null;
    }
}

/**
 * Build date object by given date string
 * @param {String} nextChargeDateStr next charge date in string format
 * @returns {Object} next charge date
 */
function getNextChargeDateByDateStr(nextChargeDateStr) {
    var Calendar = require('dw/util/Calendar');
    var calendar = new Calendar();
    calendar.parseByFormat(nextChargeDateStr, DATE_PATTERN);
    return calendar.getTime();
}

/**
 * Disable given customer subscription
 * @param {String} subscriptionId Id of subscription to disable
 * @returns Boolean 
 */
function disableCustomerSubscription(subscriptionId) {
    var Transaction = require('dw/system/Transaction');
    var profile = customer.profile;

    if (!profile || !profile.custom.kpSubscriptions) {
        return false;
    }

    var subscriptions = JSON.parse(profile.custom.kpSubscriptions);
    var subscription = null;

    subscriptions.forEach(function (item) {
        if (item.subscriptionId === subscriptionId) {
            subscription = item;
        }
    });

    if (!subscription) {
        return false;
    }
    subscription.enabled = 'false';

    Transaction.wrap(function () {
        profile.custom.kpSubscriptions = JSON.stringify(subscriptions);
    });
    return true;
}


function getCreateOrderToken(currentSite) {
    var Transaction = require('dw/system/Transaction');
    var kpCreateOrderToken = currentSite.getCustomPreferenceValue('kpCreateOrderToken');
    if (!kpCreateOrderToken) {
        var UUIDUtils = require('dw/util/UUIDUtils');
        kpCreateOrderToken = UUIDUtils.createUUID();
        Transaction.wrap(function () {
            currentSite.setCustomPreferenceValue('kpCreateOrderToken', kpCreateOrderToken);
        });
    }
    return kpCreateOrderToken;
}

function createRecurringOrder(orderNo) {
    var HttpClient = require('dw/net/HTTPClient');
    var URLUtils = require('dw/web/URLUtils');
    var URLAction = require('dw/web/URLAction');
    var Logger = require('dw/system/Logger');

    var httpClient = new HttpClient();

    var Site = require('dw/system/Site');
    var currentSite = Site.current;
    var kpCreateOrderToken = getCreateOrderToken(currentSite);

    var payload = { orderNo: orderNo, kpToken: kpCreateOrderToken };

    var urlAction = new URLAction("RecurringOrder-Create", currentSite.name);
    var endpoint = URLUtils.abs(urlAction).toString();

    httpClient.open('POST', endpoint);
    httpClient.send(JSON.stringify(payload));

    if (httpClient.statusCode == 200) {
        var result = JSON.parse(httpClient.text);
        if (!result.error) {
            Logger.info('[' + currentSite.ID + '] New order has been created - ' + result.orderID);
        } else {
            var message = result.errorMessage;
            Logger.error('[' + currentSite.ID + '] Error in creating order - ' + message);
        }
        return result;
    }
    else {
        // error handling
        var message = "An error occurred with status code " + httpClient.statusCode;
        Logger.error('[' + currentSite.ID + '] Error in creating order - ' + message);
        return {
            error: true,
            errorMessage: message
        };
    }
}

/**
 * Get Klarna Locale
 * @param {String} currentCountry 
 * @returns {Object} localeObject
 */
function getLocale(currentCountry) {
    var localeObject = {};
    var getKlarnaPaymentsLocale = require('*/cartridge/scripts/locale/klarnaPaymentsGetLocale');
    var localeObjectResult = getKlarnaPaymentsLocale.getLocaleObject(currentCountry);

    if (localeObjectResult.success) {
        localeObject = localeObjectResult.localeObject;
    }

    return localeObject;
}

/**
 * Call cancel subscription in Klarna
 * @param {string} subid subcription id
 * @returns {object} cancel subscription response
 */
function cancelSubscription(subid) {
    var localeObject = getLocale();

    var cancelCustomerTokenHelper = require('*/cartridge/scripts/order/klarnaPaymentsCancelCustomerToken');
    var klarnaCreateCustomerTokenResponse = cancelCustomerTokenHelper.cancelCustomerToken(localeObject, subid);
    return klarnaCreateCustomerTokenResponse;
}

/**
 * Get Subscription by Id
 * @param {Array} subscriptions array of customer subscriptions
 * @param {String} subId subscription id
 * @returns {Object} subscription
 */
function getSubscriptionById(subscriptions, subId) {
    var subscriptions = subscriptions.filter(function (sub) {
        return sub.subscriptionId === subId;
    });
    return subscriptions.length > 0 ? subscriptions[0] : null;
}

/**
 * Pay reurring order after trial period
 * @param {String} orderNo order no
 * @returns {Object} payment result
 */
function payRecurringOrder(orderNo) {
    var HttpClient = require('dw/net/HTTPClient');
    var URLUtils = require('dw/web/URLUtils');
    var URLAction = require('dw/web/URLAction');
    var Logger = require('dw/system/Logger');

    var httpClient = new HttpClient();

    var Site = require('dw/system/Site');
    var currentSite = Site.current;

    var kpCreateOrderToken = getCreateOrderToken(currentSite);

    var payload = { orderNo: orderNo, kpToken: kpCreateOrderToken };

    var urlAction = new URLAction("RecurringOrder-PayOrder", currentSite.name);
    var endpoint = URLUtils.abs(urlAction).toString();

    httpClient.open('POST', endpoint);
    httpClient.send(JSON.stringify(payload));

    if (httpClient.statusCode == 200) {
        var result = JSON.parse(httpClient.text);
        if (!result.error) {
            Logger.info('[' + currentSite.ID + '] Order has been paid - ' + result.orderID);
        } else {
            var message = result.errorMessage;
            Logger.error('[' + currentSite.ID + '] Error in payment - ' + message);
        }
        return result;
    }
    else {
        // error handling
        var message = "An error occurred with status code " + httpClient.statusCode;
        Logger.error('[' + currentSite.ID + '] Error in creating order - ' + message);
        return {
            error: true,
            errorMessage: message
        };
    }
}

/**
 * Update cart custom attributes for subscription details
 * @param {Object} currentBasket 
 * @returns 
 */
function updateCartSubscriptionDetails(currentBasket) {
    if (!currentBasket) {
        return;
    }
    var Transaction = require('dw/system/Transaction');
    if (isSubscriptionBasket(currentBasket)) {

        var basketDef = currentBasket.describe();
        var kpSubscriptionPeriodValues = basketDef.getCustomAttributeDefinition('kpSubscriptionPeriod').values;
        var kpSubscriptionFrequencyValues = basketDef.getCustomAttributeDefinition('kpSubscriptionFrequency').values;

        Transaction.wrap(function () {
            if (!currentBasket.custom.kpSubscriptionFrequency.value) {
                currentBasket.custom.kpSubscriptionFrequency = kpSubscriptionFrequencyValues[0].value;
            }
            if (!currentBasket.custom.kpSubscriptionPeriod.value) {
                currentBasket.custom.kpSubscriptionPeriod = kpSubscriptionPeriodValues[0].value;
            }
        });
    } else {
        Transaction.wrap(function () {
            currentBasket.custom.kpSubscriptionFrequency = null;
            currentBasket.custom.kpSubscriptionPeriod = null;
        });
    }
}

/**
 * Update basket subscription frequency or period
 * @param {String} attrName name of attribute to update
 * @param {Object} attrValue value to set
 * @returns {boolean} if the value is found in the predefined and set
 */
function updateSubscriptionAttribute(currentBasket, attrName, attrValue) {
    var Transaction = require('dw/system/Transaction');
    var basketDef = currentBasket.describe();
    var kpSubscriptionPeriodValues = basketDef.getCustomAttributeDefinition(attrName).values.toArray();
    var valueFound = false;

    if (!currentBasket || !attrName || !attrValue) {
        return false;
    }

    kpSubscriptionPeriodValues.forEach(function (attrDef) {
        if (attrDef.value.toString() === attrValue) {
            Transaction.wrap(function () {
                currentBasket.custom[attrName] = attrDef.value;
            });
            valueFound = true;
            return;
        }
    });

    return valueFound;
}

function loginOnBehalfOfCustomer(orderRef) {
    var currentSite = require('dw/system/Site').current;
    var Currency = require('dw/util/Currency');
    var AgentUserMgr = require('dw/customer/AgentUserMgr');
    var CustomerMgr = require('dw/customer/CustomerMgr');
    var userAgentName = currentSite.getCustomPreferenceValue('kpAgentUserName');
    var userAgentPassword = currentSite.getCustomPreferenceValue('kpAgentUserPassword');
    var stat = AgentUserMgr.loginAgentUser(userAgentName, userAgentPassword);

    var result = { error: false, message: null };

    if (stat.error) {
        return {
            error: true,
            message: 'User agent not able to login  - ' + stat.message
        };
    }
    var customer = orderRef.customerNo ? CustomerMgr.getCustomerByCustomerNumber(orderRef.customerNo) : null;

    if (!customer) {
        return {
            error: true,
            message: 'Customer not found'
        };
    }

    var status = AgentUserMgr.loginOnBehalfOfCustomer(customer);
    if (status.error) {
        return {
            error: true,
            message: 'User agent not able to login on behalf of customer - ' + stat.message
        };
    }

    request.setLocale(orderRef.customerLocaleID);

    var currency = Currency.getCurrency(orderRef.currencyCode);
    if (currency) {
        session.setCurrency(currency);
    }
    return result;
}

/**
 * Validate basket for creating of 
 * recurring subscription order
 * @param {Object} basket basket to validate
 */
function validateCart(basket) {
    var unAvailableCount = 0;
    var productLineItems = basket.productLineItems.toArray();

    productLineItems.forEach(function (item) {
        if (item.product === null || !item.product.online) {
            unAvailableCount++;
        } else {

            // if (!item.product.custom.kpIsSubscriptionProduct) {
            //     basket.removeProductLineItem(item);
            // }

            if (Object.hasOwnProperty.call(item.custom, 'fromStoreId')
                && item.custom.fromStoreId) {
                var store = StoreMgr.getStore(item.custom.fromStoreId);
                var storeInventory = ProductInventoryMgr.getInventoryList(store.custom.inventoryListId);

                if (!(storeInventory.getRecord(item.productID)
                    && storeInventory.getRecord(item.productID).ATS.value >= item.quantityValue)) {
                    unAvailableCount++;
                }
            } else {
                var availabilityLevels = item.product.availabilityModel
                    .getAvailabilityLevels(item.quantityValue);
                if (availabilityLevels.notAvailable.value !== 0) {
                    unAvailableCount++;
                }
            }
        }
    });

    return {
        allAvailable: unAvailableCount === 0,
        allNotAvailable: unAvailableCount === productLineItems.length
    };
}

function validateIncomingParams(payload, req) {
    var OrderMgr = require('dw/order/OrderMgr');
    var currentSite = require('dw/system/Site').current;
    var payload = payload ? JSON.parse(payload) : {};
    var orderNo = payload.orderNo;
    var kpToken = payload.kpToken;
    var kpCreateOrderToken = currentSite.getCustomPreferenceValue('kpCreateOrderToken');

    if (!kpToken || kpToken !== kpCreateOrderToken) {
        return {
            error: true,
            errorMessage: 'Invalid value of Create Order Token!'
        };
    }

    if (!orderNo) {
        return {
            error: true,
            errorMessage: 'Missing order no!'
        };

    }

    var orderRef = OrderMgr.getOrder(orderNo);
    if (!orderRef) {
        return {
            error: true,
            errorMessage: "Couldn't find order with order no - " + orderNo
        };

    }
    return {
        error: false,
        orderRef: orderRef
    };
}

module.exports = {
    getSubscriptionData: getSubscriptionData,
    validateCartProducts: validateCartProducts,
    isSubscriptionBasket: isSubscriptionBasket,
    updateCustomerSubscriptionData: updateCustomerSubscriptionData,
    getSubscriptionLastTotal: getSubscriptionLastTotal,
    disableCustomerSubscription: disableCustomerSubscription,
    getNextChargeDateByDateStr: getNextChargeDateByDateStr,
    createRecurringOrder: createRecurringOrder,
    calculateNextChargeDate: calculateNextChargeDate,
    cancelSubscription: cancelSubscription,
    DATE_PATTERN: DATE_PATTERN,
    getSubscriptionById: getSubscriptionById,
    payRecurringOrder: payRecurringOrder,
    getSubscriptionDataCart: getSubscriptionDataCart,
    updateCartSubscriptionDetails: updateCartSubscriptionDetails,
    updateSubscriptionAttribute: updateSubscriptionAttribute,
    getSubscriptionProducts: getSubscriptionProducts,
    loginOnBehalfOfCustomer: loginOnBehalfOfCustomer,
    validateCart: validateCart,
    validateIncomingParams: validateIncomingParams
};