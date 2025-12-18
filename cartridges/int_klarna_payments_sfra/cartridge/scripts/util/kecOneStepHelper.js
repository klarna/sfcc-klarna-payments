/* globals empty, session */

'use strict';

/**
 * KEC (Klarna Express Checkout) One-Step Helper
 * Contains all business logic for Klarna Express Checkout single-step mode
 */

/**
 * Validates shipping address and returns appropriate rejection reason if invalid
 * @param {Object} shippingAddress - Klarna shipping address object
 * @param {dw.order.Basket} basket - Current basket
 * @returns {Object} { isValid: boolean, rejectionReason: string|null }
 */
function validateShippingAddress(shippingAddress, basket) {
    var Transaction = require('dw/system/Transaction');
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');
    var Logger = require('dw/system/Logger');
    var log = Logger.getLogger('KlarnaPayments');
    var Site = require('dw/system/Site');

    // Validate required address fields
    if (!shippingAddress.country) {
        log.error('Missing country in shipping address');
        return { isValid: false, rejectionReason: 'COUNTRY_NOT_SUPPORTED' };
    }

    if (!shippingAddress.postalCode) {
        log.error('Missing postal code in shipping address');
        return { isValid: false, rejectionReason: 'POSTAL_CODE_NOT_SUPPORTED' };
    }

    if (!shippingAddress.city) {
        log.error('Missing city in shipping address');
        return { isValid: false, rejectionReason: 'CITY_NOT_SUPPORTED' };
    }

    // Map Klarna address to SFCC format
    var mappedAddress = KlarnaHelper.mapKlarnaExpressAddress(shippingAddress);

    if (!mappedAddress) {
        log.error('Failed to map Klarna address to SFCC format');
        return { isValid: false, rejectionReason: 'ADDRESS_NOT_SUPPORTED' };
    }

    // Check if address has applicable shipping methods
    var tempShipment = basket.defaultShipment;
    if (!tempShipment) {
        return { isValid: false, rejectionReason: 'ADDRESS_NOT_SUPPORTED' };
    }

    // Update the address temporarily to check shipping availability
    Transaction.wrap(function () {
        COHelpers.copyCustomerAddressToShipment(mappedAddress, tempShipment);
    });

    // Check if there are any applicable shipping methods for this address
    var applicableShippingMethods = KlarnaHelper.filterApplicableShippingMethods(
        tempShipment,
        tempShipment.shippingAddress
    );

    if (applicableShippingMethods && applicableShippingMethods.length > 0) {
        return { isValid: true, rejectionReason: null };
    }

    // Check if it's a country issue by looking at site countries configuration
    var Locale = require('dw/util/Locale');
    var allowedLocales = Site.current.getAllowedLocales();
    var countryAllowed = false;

    for (var i = 0; i < allowedLocales.length; i += 1) {
        var locale = Locale.getLocale(allowedLocales[i]);
        if (locale.country === shippingAddress.country) {
            countryAllowed = true;
            break;
        }
    }

    if (!countryAllowed) {
        return { isValid: false, rejectionReason: 'COUNTRY_NOT_SUPPORTED' };
    }

    if (shippingAddress.region && !tempShipment.shippingAddress.stateCode) {
        return { isValid: false, rejectionReason: 'REGION_NOT_SUPPORTED' };
    }

    return { isValid: false, rejectionReason: 'ADDRESS_NOT_SUPPORTED' };
}

/**
 * Validates if shipping option is still applicable
 * @param {string} shippingOptionReference - Shipping method ID
 * @param {dw.order.Basket} basket - Current basket
 * @returns {boolean} true if valid, false otherwise
 */
function validateShippingOption(shippingOptionReference, basket) {
    var collections = require('*/cartridge/scripts/util/collections');
    var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');

    if (!basket.defaultShipment || !basket.defaultShipment.shippingAddress) {
        return false;
    }

    var applicableShippingMethods = KlarnaHelper.filterApplicableShippingMethods(
        basket.defaultShipment,
        basket.defaultShipment.shippingAddress
    );

    var isValid = collections.find(applicableShippingMethods, function (method) {
        return method.ID === shippingOptionReference;
    });

    return !!isValid;
}

/**
 * Builds shipping options array for Klarna Express Checkout
 * @param {dw.order.Basket} basket - Current basket
 * @returns {Array} Array of shipping options
 */
function buildShippingOptions(basket) {
    var ShippingMgr = require('dw/order/ShippingMgr');
    var collections = require('*/cartridge/scripts/util/collections');
    var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');
    var shippingOptions = [];

    if (!basket || !basket.defaultShipment || !basket.defaultShipment.shippingAddress) {
        return shippingOptions;
    }

    var applicableShippingMethods = KlarnaHelper.filterApplicableShippingMethods(
        basket.defaultShipment,
        basket.defaultShipment.shippingAddress
    );
    var shipment = basket.defaultShipment;

    collections.forEach(applicableShippingMethods, function (shippingMethodModel) {
        // Get the actual shipping method object from ShippingMgr to access cost
        var shippingMethod = ShippingMgr.getShipmentShippingModel(shipment)
            .getApplicableShippingMethods()
            .toArray()
            .find(function (method) {
                return method.ID === shippingMethodModel.ID;
            });

        var shippingCostAmount = 0;
        if (shippingMethod) {
            var shippingCost = ShippingMgr.getShipmentShippingModel(shipment)
                .getShippingCost(shippingMethod);
            if (shippingCost && shippingCost.amount) {
                shippingCostAmount = Math.round(shippingCost.amount.value * 100);
            }
        }

        shippingOptions.push({
            shippingOptionReference: shippingMethodModel.ID,
            amount: shippingCostAmount,
            displayName: shippingMethodModel.displayName,
            description: shippingMethodModel.description || shippingMethodModel.displayName
        });
    });

    return shippingOptions;
}

/**
 * Convert any amount to minor units safely
 * @param {number} amount - amount in major units
 * @return {number} amount in minor units
 */
function toMinorUnits(amount) {
    return Math.round(parseFloat(amount.toFixed(2)) * 100);
}

/**
 * Builds line items array for Klarna Express Checkout
 * @param {dw.order.Basket} basket - Current basket
 * @returns {Object} { lineItems: Array, totalAmount: number }
 */
function buildLineItems(basket) {
    var collections = require('*/cartridge/scripts/util/collections');
    var isOMSEnabled = require('*/cartridge/scripts/util/klarnaHelper').isOMSEnabled();
    var isTaxationPolicyNet = require('*/cartridge/scripts/util/klarnaHelper').isTaxationPolicyNet;
    var discountTaxationMethod = require( '*/cartridge/scripts/util/klarnaHelper' ).getDiscountsTaxation();
    var lineItems = [];
    var productTotalAmount = 0;

    if (!basket) {
        return { lineItems: lineItems, totalAmount: 0 };
    }

    // Get product line items from basket
    var productLineItems = basket.getAllProductLineItems();
    collections.forEach(productLineItems, function (pli) {
        var itemProratedPrice = pli.proratedPrice.available ? toMinorUnits(pli.proratedPrice.value) : 0;
        var itemPrice = toMinorUnits(pli.grossPrice.available && !isTaxationPolicyNet() ? pli.grossPrice.value : pli.netPrice.value);
        var itemTax = isTaxationPolicyNet() ? 0 : toMinorUnits(pli.tax.value);
        var lineItemAmount = isOMSEnabled || (!isTaxationPolicyNet() && discountTaxationMethod === 'adjustment') ? itemProratedPrice : itemPrice;

        lineItems.push({
            name: pli.productName,
            quantity: pli.quantityValue,
            totalAmount: lineItemAmount,
            totalTaxAmount: itemTax
        });

        productTotalAmount += lineItemAmount;
    });

    var shippingLineItemAmount = 0;
    var shipments;
    if (basket.shipments && !basket.shipments.empty) {
        shipments = basket.shipments;
    } else if (basket.defaultShipment) {
        shipments = [basket.defaultShipment];
    } else {
        shipments = [];
    }

    collections.forEach(shipments, function (shipment) {
        // Add shipment as a line item if it has shipping cost
        var shipmentName = shipment.shippingMethod ? shipment.shippingMethod.displayName : 'Shipping';

        var shipmentTotalAmount = isTaxationPolicyNet()
            ? toMinorUnits(shipment.adjustedShippingTotalNetPrice.value)
            : toMinorUnits(shipment.adjustedShippingTotalGrossPrice.available ? shipment.adjustedShippingTotalGrossPrice.value : shipment.adjustedShippingTotalNetPrice.value);
        var shipmentTotalTaxAmount = isTaxationPolicyNet() ? 0 : toMinorUnits(shipment.shippingTotalTax.value);

        lineItems.push({
            name: shipmentName,
            quantity: 1,
            totalAmount: shipmentTotalAmount,
            totalTaxAmount: shipmentTotalTaxAmount
        });

        shippingLineItemAmount += shipmentTotalAmount;
    });

    var totalAmount = productTotalAmount + shippingLineItemAmount;

    // Add sales tax as a separate line item for NET taxation sites
    if (isTaxationPolicyNet() && basket.totalTax.available && basket.totalTax.value > 0) {
        var salesTaxAmount = toMinorUnits(basket.totalTax.value);
        lineItems.push({
            name: 'Sales Tax',
            quantity: 1,
            totalAmount: salesTaxAmount,
            totalTaxAmount: 0
        });
        totalAmount += salesTaxAmount;
    }

    return { lineItems: lineItems, totalAmount: totalAmount };
}

/**
 * Updates shipping address on basket shipments
 * @param {dw.order.Basket} basket - Current basket
 * @param {Object} mappedAddress - Mapped address object
 * @returns {string|null} Selected shipping method ID or null
 */
function updateBasketShippingAddress(basket, mappedAddress) {
    var ShippingHelper = require('*/cartridge/scripts/checkout/shippingHelpers');
    var ShippingMgr = require('dw/order/ShippingMgr');
    var Transaction = require('dw/system/Transaction');
    var collections = require('*/cartridge/scripts/util/collections');
    var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var selectedShippingOption = null;

    var shipments = basket.shipments;
    collections.forEach(shipments, function (shipment) {
        if (empty(shipment.custom.fromStoreId) && mappedAddress) {
            var currentMethodID = shipment.shippingMethod ? shipment.shippingMethod.ID : null;
            COHelpers.copyCustomerAddressToShipment(mappedAddress, shipment);

            var applicableShippingMethods = KlarnaHelper.filterApplicableShippingMethods(shipment, shipment.shippingAddress);
            var shippingMethod = null;

            if (currentMethodID) {
                shippingMethod = collections.find(applicableShippingMethods, function (method) {
                    return method.ID === currentMethodID;
                });
            }

            if (!shippingMethod) {
                var defaultMethod = ShippingMgr.getDefaultShippingMethod();
                if (defaultMethod) {
                    shippingMethod = collections.find(applicableShippingMethods, function (method) {
                        return method.ID === defaultMethod.ID;
                    });
                }
            }

            if (!shippingMethod) {
                shippingMethod = collections.first(applicableShippingMethods);
            }

            if (shippingMethod) {
                Transaction.wrap(function () {
                    ShippingHelper.selectShippingMethod(shipment, shippingMethod.ID);
                });
            }
        }
    });

    // Get the selected shipping option reference from first shipment, fallback to default shipment
    var firstShipment = basket.shipments && !basket.shipments.empty ? basket.shipments[0] : null;

    if (firstShipment && firstShipment.shippingMethod) {
        selectedShippingOption = firstShipment.shippingMethod.ID;
    } else if (basket.defaultShipment && basket.defaultShipment.shippingMethod) {
        selectedShippingOption = basket.defaultShipment.shippingMethod.ID;
    }

    return selectedShippingOption;
}

/**
 * Builds the complete updated request for Klarna Express Checkout
 * @param {dw.order.Basket} basket - Current basket
 * @param {string} selectedShippingOption - Selected shipping method ID
 * @param {boolean} includeShippingOptions - Whether to include shipping options in response
 * @returns {Object} Updated request object for Klarna
 */
function buildKlarnaUpdatedRequest(basket, selectedShippingOption, includeShippingOptions) {
    // Build shipping options array
    var shippingOptions = buildShippingOptions(basket);

    // Build line items and calculate total
    var lineItemsData = buildLineItems(basket);

    // Build the updated request object
    var updatedRequest = {
        amount: lineItemsData.totalAmount,
        lineItems: lineItemsData.lineItems
    };

    // Include shipping options if requested (for address change)
    if (includeShippingOptions) {
        updatedRequest.selectedShippingOptionReference = selectedShippingOption;
        updatedRequest.shippingOptions = shippingOptions;
    }

    return updatedRequest;
}

/**
 * Queries and retrieves webhook notification by payment request ID
 * @param {string} paymentRequestId - The payment request ID
 * @returns {Object|null} Webhook notification entry or null
 */
function getWebhookNotification(paymentRequestId) {
    var CustomObjectMgr = require('dw/object/CustomObjectMgr');
    var Logger = require('dw/system/Logger');
    var log = Logger.getLogger('KlarnaPayments');

    if (!paymentRequestId) {
        log.warn('No paymentRequestId provided');
        return null;
    }

    var queryString = 'custom.paymentRequestId = {0}';
    var result = CustomObjectMgr.queryCustomObjects('KlarnaWebhookNotification', queryString, 'creationDate desc', paymentRequestId);

    if (result && result.hasNext()) {
        return result.next();
    }

    return null;
}

/**
 * Extracts customer data from webhook notification payload
 * @param {Object} notificationLog - Parsed notification log object
 * @returns {Object|null} Customer data or null
 */
function extractCustomerDataFromWebhook(notificationLog) {
    if (!notificationLog || !notificationLog.payload) {
        return null;
    }

    var payload = notificationLog.payload;
    var customerData = {
        email: '',
        phone: '',
        shippingAddress: {},
        billingAddress: {},
        paymentToken: payload.payment_token,
        paymentRequestId: payload.payment_request_id
    };

    // Extract shipping information
    if (payload.shipping && payload.shipping.recipient) {
        customerData.email = payload.shipping.recipient.email;
        customerData.phone = payload.shipping.recipient.phone;
    }

    if (payload.shipping && payload.shipping.address) {
        var shippingAddr = payload.shipping.address;
        customerData.shippingAddress = {
            given_name: payload.shipping.recipient ? payload.shipping.recipient.given_name : '',
            family_name: payload.shipping.recipient ? payload.shipping.recipient.family_name : '',
            street_address: shippingAddr.street_address,
            street_address2: shippingAddr.street_address2 || '',
            city: shippingAddr.city,
            postal_code: shippingAddr.postal_code,
            region: shippingAddr.region,
            country: shippingAddr.country
        };
    }

    // Extract billing information from klarna_customer
    if (payload.klarna_customer && payload.klarna_customer.customer_profile) {
        var profile = payload.klarna_customer.customer_profile;
        if (!customerData.email) {
            customerData.email = profile.email;
        }
        if (!customerData.phone) {
            customerData.phone = profile.phone;
        }

        if (profile.address) {
            customerData.billingAddress = {
                given_name: profile.given_name || (payload.shipping && payload.shipping.recipient ? payload.shipping.recipient.given_name : ''),
                family_name: profile.family_name || (payload.shipping && payload.shipping.recipient ? payload.shipping.recipient.family_name : ''),
                street_address: profile.address.street_address,
                street_address2: profile.address.street_address2 || '',
                city: profile.address.city,
                postal_code: profile.address.postal_code,
                region: profile.address.region,
                country: profile.address.country
            };
        }
    }

    // If no billing address, use shipping address
    if (Object.keys(customerData.billingAddress).length === 0 && Object.keys(customerData.shippingAddress).length > 0) {
        customerData.billingAddress = customerData.shippingAddress;
    }

    return customerData;
}

/**
 * Updates webhook notification status
 * @param {dw.object.CustomObject} entry - Webhook notification custom object
 * @param {string} status - New status
 */
function updateWebhookStatus(entry, status) {
    var Transaction = require('dw/system/Transaction');

    Transaction.wrap(function () {
        entry.custom.notificationStatus = status;
    });
}

/**
 * Updates basket with customer information from webhook
 * @param {dw.order.Basket} basket - Current basket
 * @param {Object} customerData - Customer data from webhook
 */
function updateBasketWithCustomerData(basket, customerData) {
    var Transaction = require('dw/system/Transaction');
    var collections = require('*/cartridge/scripts/util/collections');

    Transaction.wrap(function () {
        // Set customer email
        if (customerData.email && basket) {
            basket.setCustomerEmail(customerData.email);
        }

        // Set shipping address for all shipments
        if (customerData.shippingAddress && Object.keys(customerData.shippingAddress).length > 0 && basket) {
            var klarnaShipping = customerData.shippingAddress;
            var shipments = basket.shipments;

            collections.forEach(shipments, function (shipment) {
                // Skip store pickup shipments
                if (empty(shipment.custom.fromStoreId)) {
                    var shippingAddress = shipment.shippingAddress;
                    if (!shippingAddress) {
                        shippingAddress = shipment.createShippingAddress();
                    }

                    shippingAddress.setFirstName(klarnaShipping.given_name || '');
                    shippingAddress.setLastName(klarnaShipping.family_name || '');
                    shippingAddress.setAddress1(klarnaShipping.street_address || '');
                    shippingAddress.setAddress2(klarnaShipping.street_address2 || '');
                    shippingAddress.setCity(klarnaShipping.city || '');
                    shippingAddress.setPostalCode(klarnaShipping.postal_code || '');
                    shippingAddress.setStateCode(klarnaShipping.region || '');
                    shippingAddress.setCountryCode(klarnaShipping.country || '');

                    if (customerData.phone) {
                        shippingAddress.setPhone(customerData.phone);
                    }
                }
            });
        }

        // Set billing address
        if (customerData.billingAddress && Object.keys(customerData.billingAddress).length > 0) {
            var billingAddress = basket.billingAddress;
            if (!billingAddress) {
                billingAddress = basket.createBillingAddress();
            }

            var klarnaBilling = customerData.billingAddress;
            billingAddress.setFirstName(klarnaBilling.given_name || '');
            billingAddress.setLastName(klarnaBilling.family_name || '');
            billingAddress.setAddress1(klarnaBilling.street_address || '');
            billingAddress.setAddress2(klarnaBilling.street_address2 || '');
            billingAddress.setCity(klarnaBilling.city || '');
            billingAddress.setPostalCode(klarnaBilling.postal_code || '');
            billingAddress.setStateCode(klarnaBilling.region || '');
            billingAddress.setCountryCode(klarnaBilling.country || '');

            if (customerData.phone) {
                billingAddress.setPhone(customerData.phone);
            }
        }
    });
}

/**
 * Processes complete order creation and placement from webhook data (one-step checkout)
 *
 * @param {dw.order.Basket} basket - Current basket
 * @param {Object} customerData - Customer data from webhook
 * @returns {Object} { success: boolean, order: dw.order.Order|null, error: string|null, fraudPending: boolean }
 */
function processOrderFromWebhook(basket, customerData) {
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
    var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
    var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');
    var Logger = require('dw/system/Logger');
    var log = Logger.getLogger('KlarnaPayments');
    var Transaction = require('dw/system/Transaction');
    var OrderMgr = require('dw/order/OrderMgr');
    var currentBasket = basket;
    var order = null;

    try {
        var validationResult = validationHelpers.validateProducts(currentBasket);
        if (validationResult.error) {
            log.error('Product validation failed: ' + JSON.stringify(validationResult));
            return { success: false, order: null, error: 'VALIDATION_FAILED: Invalid products in basket' };
        }
        updateBasketWithCustomerData(currentBasket, customerData);

        Transaction.wrap(function () {
            basketCalculationHelpers.calculateTotals(currentBasket);
        });

        // Remove any existing Klarna payment instruments before creating a new one
        var collections = require('*/cartridge/scripts/util/collections');
        var PAYMENT_METHOD = KlarnaHelper.getPaymentMethod();
        Transaction.wrap(function () {
            var paymentInstruments = currentBasket.getPaymentInstruments(PAYMENT_METHOD);
            collections.forEach(paymentInstruments, function (item) {
                currentBasket.removePaymentInstrument(item);
            });
        });

        // Call Handle hook to create payment instrument on basket
        var PaymentMgr = require('dw/order/PaymentMgr');
        var HookMgr = require('dw/system/HookMgr');
        var processor = PaymentMgr.getPaymentMethod(PAYMENT_METHOD).getPaymentProcessor();

        var handleResult;
        if (HookMgr.hasHook('app.payment.processor.' + processor.ID.toLowerCase())) {
            handleResult = HookMgr.callHook(
                'app.payment.processor.' + processor.ID.toLowerCase(),
                'Handle',
                currentBasket
            );
        } else {
            handleResult = HookMgr.callHook('app.payment.processor.default', 'Handle');
        }

        if (!handleResult || !handleResult.success) {
            log.error('Failed to handle payment instrument creation');
            return { success: false, order: null, error: 'PAYMENT_HANDLE_FAILED: Failed to create payment instrument' };
        }
        log.info('Payment instrument created successfully on basket');


        order = COHelpers.createOrder(currentBasket);
        if (!order) {
            log.error('Failed to create order from basket');
            return { success: false, order: null, error: 'ORDER_CREATION_FAILED: Failed to create order from basket' };
        }

        log.info('Order created successfully - Order No: ' + order.orderNo);

        // Store payment token in session for authorization hook to use
        var paymentToken = customerData.paymentToken; // Take payment token from customer data
        if (!paymentToken) {
            log.error('Payment token not found in webhook data');
            Transaction.wrap(function () {
                OrderMgr.failOrder(order, true);
            });
            return { success: false, order: null, error: 'TOKEN_EXPIRED: Payment token not found or expired' };
        }

        // Store token in session so the authorization hook can access it
        session.privacy.KlarnaPaymentsAuthorizationToken = paymentToken;

        // Set KPAuthInfo - finalize is not required for webhook flow (already authorized)
        session.privacy.KPAuthInfo = JSON.stringify({
            FinalizeRequired: false
        });

        // Call the app.payment.processor.klarna_payments Authorize hook
        var paymentResult = COHelpers.handlePayments(order, order.orderNo);

        if (paymentResult.error) {
            log.error('Payment authorization failed for order: ' + order.orderNo);
            return { success: false, order: null, error: 'PAYMENT_AUTH_FAILED: Payment authorization failed' };
        }

        log.info('Payment authorized successfully - Order No: ' + order.orderNo);

        // Clear auth session variables after successful authorization
        session.privacy.KlarnaPaymentsAuthorizationToken = '';
        session.privacy.KPAuthInfo = null;

        var placeOrderResult = COHelpers.placeOrder(order);

        if (placeOrderResult.error) {
            log.error('Failed to place order: ' + order.orderNo);
            return { success: false, order: null, error: 'PLACE_ORDER_FAILED: Failed to place order' };
        }

        log.info('Order placed successfully - Order No: ' + order.orderNo);
        return {
            success: true,
            order: order,
            error: null
        };
    } catch (e) {
        log.error('Exception in processOrderFromWebhook: ' + e.message);
        if (order) {
            try {
                Transaction.wrap(function () {
                    OrderMgr.failOrder(order, true);
                });
                log.info('Order failed due to exception - Order No: ' + order.orderNo);
            } catch (failError) {
                log.error('Failed to fail order: ' + failError.message);
            }
        }

        return {
            success: false,
            order: null,
            error: 'ORDER_PROCESS_FAILED: ' + e.message
        };
    }
}

module.exports = {
    validateShippingAddress: validateShippingAddress,
    validateShippingOption: validateShippingOption,
    buildShippingOptions: buildShippingOptions,
    buildLineItems: buildLineItems,
    updateBasketShippingAddress: updateBasketShippingAddress,
    buildKlarnaUpdatedRequest: buildKlarnaUpdatedRequest,
    getWebhookNotification: getWebhookNotification,
    extractCustomerDataFromWebhook: extractCustomerDataFromWebhook,
    updateWebhookStatus: updateWebhookStatus,
    updateBasketWithCustomerData: updateBasketWithCustomerData,
    processOrderFromWebhook: processOrderFromWebhook
};
