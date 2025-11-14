/* globals $ */

'use strict';

var base = require('base/product/base');

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
            var paymentRequestId = { paymentRequestId: responseJson.paymentRequestId };
            return paymentRequestId; // eslint-disable-line
        }
    }).mount(containerId);

    klarna.Payment.on('complete', (paymentRequest) => {
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
        generateErrorAuthMessage(error);
        return false;
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
