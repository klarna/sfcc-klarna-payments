/* globals $ */

'use strict';

var base = require('base/product/base');
var keepPolling = true;
var pollStartTime = null;
var MAX_POLL_DURATION = 300000; // 5 minutes in milliseconds


/**
 * build and display error message overlay
 * @param {string} message  message
 */
function generateErrorAuthMessage(message) {
    setTimeout(function () {
        var msg = message || window.KPResources.kpExpressCheckoutAuthFailure;
        if ($('.ec-payment-failure').length === 0) {
            $('body').append(
                '<div class="ec-payment-failure add-to-cart-messages"></div>'
            );
        }

        if ($('.ec-payment-failure-alert').length === 0) {
            $('.ec-payment-failure').append(
                '<div class="alert alert-danger ec-payment-failure-alert add-to-basket-alert text-center" role="alert" aria-live="assertive" aria-atomic="true"></div>'
            ).find('.alert').text(msg);
        }

        setTimeout(function () {
            $('.ec-payment-failure-alert').remove();
        }, window.KPConstants.ERROR_MSG_ALERT_TIMEOUT);
    }, window.KPConstants.KEC_EEROR_WAITTIME);
}

/**
 * get add to cart product data
 * @param {string} containerId id of the container element
 * @returns {Object} form data
 */
function getAddToCartData(containerId) {
    var form = {
        pid: base.getPidValue(),
        quantity: base.getQuantitySelected($(containerId))
    };

    var pidsObj;
    var setPids;

    if ($('.set-items').length && $(this).hasClass('add-to-cart-global')) {
        setPids = [];

        $('.product-detail').each(function () {
            if (!$(this).hasClass('product-set-detail')) {
                setPids.push({
                    pid: $(this).find('.product-id').text(),
                    qty: $(this).find('.quantity-select').val(),
                    options: getOptions($(this)) // eslint-disable-line
                });
            }
        });
        pidsObj = JSON.stringify(setPids);
    }
    form.pidsObj = pidsObj;
    return form;
}

/**
 * Start polling for webhook notification availability
 * Polls the server to check if webhook custom object has been created
 * @param {string} paymentRequestId - The payment request ID to check webhook status for
 */
function longPoll(paymentRequestId) {
    if (!keepPolling) return;

    // Initialize start time on first poll
    if (pollStartTime === null) {
        pollStartTime = Date.now();
    }

    // Check if polling has exceeded maximum duration
    var elapsedTime = Date.now() - pollStartTime;
    if (elapsedTime > MAX_POLL_DURATION) {
        keepPolling = false;
        pollStartTime = null;
        generateErrorAuthMessage(window.KPResources.kpExpressCheckoutAuthFailure);
        return;
    }

    var url = window.KlarnaPaymentsUrls.checkWebhookStatus;
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            paymentRequestId: paymentRequestId
        })
    }).then(function (res) {
        if (!res.ok) {
            keepPolling = false;
            generateErrorAuthMessage(window.KPResources.kpExpressCheckoutAuthFailure);
            return null;
        }
        return res.json();
    }).then(function (data) {
        if (!data) return;

        if (data && Boolean(data.success) && data.customerData) {
            keepPolling = false;
            pollStartTime = null;

            // Create order from webhook data
            fetch(window.KlarnaPaymentsUrls.createOrderFromWebhook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    customerData: data.customerData
                })
            })
                .then(function (orderRes) { return orderRes.json(); })
                .then(function (orderData) {
                    if (orderData && orderData.success && orderData.continueUrl) {
                        // Redirect to order confirmation page
                        window.location.href = orderData.continueUrl;
                    } else {
                        generateErrorAuthMessage(window.KPResources.kpExpressCheckoutAuthFailure);
                    }
                })
                .catch(function () {
                    generateErrorAuthMessage(window.KPResources.kpExpressCheckoutAuthFailure);
                });
        } else if (data.error && data.errorType === 'NOT_READY') {
            if (keepPolling) {
                setTimeout(function () { longPoll(paymentRequestId); }, 2000);
            }
        } else if (data.error) {
            keepPolling = false;
            pollStartTime = null;
            generateErrorAuthMessage(window.KPResources.kpExpressCheckoutAuthFailure);
        } else if (keepPolling) {
            setTimeout(function () { longPoll(paymentRequestId); }, 2000);
        }
    }).catch(function () {
        keepPolling = false;
        pollStartTime = null;
        generateErrorAuthMessage(window.KPResources.kpExpressCheckoutAuthFailure);
    });
}

/**
 * Initialize Klarna Express Checkout button
 * @param {Object} containerId div container element
 * @param {boolean} isPDP flag for pdp call
 * @param {Object} klarna klarna sdk object
 */
function initKlarnaExpressButton(containerId, isPDP, klarna) {
    if (!klarna) {
        return;
    }

    klarna.Payment.button({
        theme: window.KPPreferences.kpExpressCheckoutTheme,
        shape: window.KPPreferences.kpExpressCheckoutShape,
        locale: window.KPPreferences.kpLocale,
        intents: ['PAY'],
        initiationMode: 'DEVICE_BEST',
        initiate: async () => {
            var form = {};
            if (isPDP) {
                form = getAddToCartData(containerId);
                var isDisabled = $('#klarnaExpressCheckoutPDP').attr('disabled');
                if (isDisabled) {
                    keepPolling = false;
                    generateErrorAuthMessage(window.KPResources.kpExpressSelectStyles);
                    return;
                }
            }
            form.kecSingleStep = true;
            var url = window.KlarnaPaymentsUrls.singleStepCheckout;
            url += (url.indexOf('?') !== -1 ? '&' : '?') + 'populateAddress=false&isPDP=' + isPDP;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(form)
            });
            const responseJson = await response.json();

            if (!responseJson || !responseJson.paymentRequestId) {
                keepPolling = false;
                generateErrorAuthMessage(window.KPResources.kpExpressCheckoutAuthFailure);
                return;
            }

            // Only start polling if not PSP integrated and single step mode is enabled
            if (!window.KPPreferences.isKlarnaIntegratedViaPSP && window.KPPreferences.kecSingleStepMode) {
                keepPolling = true;
                pollStartTime = null;
                longPoll(responseJson.paymentRequestId);
            }

            var paymentRequestId = { paymentRequestId: responseJson.paymentRequestId };
            return paymentRequestId; // eslint-disable-line
        }
    }).mount(containerId);

    // Only register shipping address change handler if not PSP integrated and single step mode is enabled
    if (!window.KPPreferences.isKlarnaIntegratedViaPSP && window.KPPreferences.kecSingleStepMode) {
        klarna.Payment.on('shippingaddresschange', async (paymentRequest, shippingAddress) => {
            try {
                var url = window.KlarnaPaymentsUrls.shippingAddressChange;
                var response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        shippingAddress: shippingAddress,
                        paymentRequestId: paymentRequest.paymentRequestId
                    })
                });

                if (!response.ok) {
                    return { rejection_reason: klarna.Payment.ShippingRejectionReason.ADDRESS_NOT_SUPPORTED };
                }

                var responseJson = await response.json();

                if (responseJson.success && responseJson.updatedRequest) {
                    console.log(responseJson.updatedRequest);
                    return responseJson.updatedRequest;
                }

                // Handle rejection from server - map to Klarna SDK enum
                if (!responseJson.success && responseJson.rejectionReason) {
                    var rejectionMap = {
                        COUNTRY_NOT_SUPPORTED: klarna.Payment.ShippingRejectionReason.COUNTRY_NOT_SUPPORTED,
                        POSTAL_CODE_NOT_SUPPORTED: klarna.Payment.ShippingRejectionReason.POSTAL_CODE_NOT_SUPPORTED,
                        CITY_NOT_SUPPORTED: klarna.Payment.ShippingRejectionReason.CITY_NOT_SUPPORTED,
                        REGION_NOT_SUPPORTED: klarna.Payment.ShippingRejectionReason.REGION_NOT_SUPPORTED,
                        ADDRESS_NOT_SUPPORTED: klarna.Payment.ShippingRejectionReason.ADDRESS_NOT_SUPPORTED
                    };
                    var mappedRejection = rejectionMap[responseJson.rejectionReason];
                    return { rejection_reason: mappedRejection || klarna.Payment.ShippingRejectionReason.ADDRESS_NOT_SUPPORTED };
                }

                // Default rejection
                return { rejection_reason: klarna.Payment.ShippingRejectionReason.ADDRESS_NOT_SUPPORTED };
            } catch (error) {
                return { rejection_reason: klarna.Payment.ShippingRejectionReason.ADDRESS_NOT_SUPPORTED };
            }
        });

        klarna.Payment.on('shippingoptionselect', async (paymentRequest, shippingOption) => {
            try {
                var url = window.KlarnaPaymentsUrls.shippingOptionSelect;
                var response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        shippingOption: shippingOption,
                        paymentRequestId: paymentRequest.paymentRequestId
                    })
                });

                if (!response.ok) {
                    return { rejection_reason: 'INVALID_OPTION' };
                }

                var responseJson = await response.json();

                if (responseJson.success && responseJson.updatedRequest) {
                    console.log(responseJson.updatedRequest);
                    return responseJson.updatedRequest;
                }

                return { rejection_reason: 'INVALID_OPTION' };
            } catch (error) {
                return { rejection_reason: 'INVALID_OPTION' };
            }
        });
    }

    klarna.Payment.on('complete', async (paymentRequest) => {
        if (paymentRequest && paymentRequest.stateContext && paymentRequest.stateContext.interoperabilityToken) {
            // Save the interoperability token and notify PSPs so they can use the token
            fetch(window.KlarnaPaymentsUrls.saveInteroperabilityToken, {
                method: 'POST',
                body: new URLSearchParams({ interoperabilityToken: paymentRequest.stateContext.interoperabilityToken })
            });
        }
        // Return a boolean to skip redirection.
        return false;
    });

    klarna.Payment.on('error', (error, paymentRequest) => { // eslint-disable-line
        keepPolling = false;
        generateErrorAuthMessage(error);
        return false;
    });

    klarna.Payment.on('abort', (paymentRequest) => { // eslint-disable-line
        keepPolling = false;
    });
}

document.body.addEventListener('init:KECSingleStep', function (e) {
    var data = e.detail;
    var klarna = data.klarnaSDK;

    var klarnaExpressCheckoutCart = document.querySelectorAll('.kec-container-cart');
    var klarnaExpressCheckoutMC = document.querySelector('#klarnaExpressCheckoutMC');
    var klarnaExpressCheckoutPDP = document.querySelector('#klarnaExpressCheckoutPDP');

    if (data.kecPageName === 'cart' && klarnaExpressCheckoutCart.length > 0) {
        klarnaExpressCheckoutCart.forEach(function (element, index) { // eslint-disable-line
            initKlarnaExpressButton('#' + element.dataset.contId, false, klarna);
        });
    }
    if (data.kecPageName === 'minicart' && klarnaExpressCheckoutMC) {
        initKlarnaExpressButton('#klarnaExpressCheckoutMC', false, klarna);
    }
    if (data.kecPageName === 'pdp' && klarnaExpressCheckoutPDP) {
        initKlarnaExpressButton('#klarnaExpressCheckoutPDP', true, klarna);
    }
});
