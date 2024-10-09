'use strict';

var klarnaPreferences = window.KPPreferences;
var klarnaPaymentsUrls = window.KlarnaPaymentsUrls;
var klarnaPaymentsResources = window.KPResources;
var klarnaPaymentsConstants = window.KPConstants;

var base = require('base/product/base');

/**
 * build and display error message overlay
 * @param {string} message 
 */
function generateErrorAuthMessage(message) {
    setTimeout(function () {

        var msg = message ? message : klarnaPaymentsResources.kpExpressCheckoutAuthFailure;
        if ($('.ec-payment-failure').length === 0) {
            $('body').append(
                '<div class="ec-payment-failure add-to-cart-messages"></div>'
            );
        }

        if ($('.ec-payment-failure-alert').length === 0) {
            $('.ec-payment-failure').append(
                '<div class="alert ' + 'alert-danger' + ' ec-payment-failure-alert add-to-basket-alert text-center" role="alert">'
                + msg + '</div>'
            );
        }

        setTimeout(function () {
            $('.ec-payment-failure-alert').remove();
        }, klarnaPaymentsConstants.ERROR_MSG_ALERT_TIMEOUT);

    }, klarnaPaymentsConstants.KEC_EEROR_WAITTIME);
}

/**
 * get add to cart product data
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
                    options: getOptions($(this))
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
 * @param {Object} container div container element
 * @param {Boolean} isPDP flag for pdp call
 * @param {String} containerId id of the container element
 */
function initKlarnaExpressButton(containerId, isPDP) {
    window.Klarna.Payments.Buttons.init({
        client_id: klarnaPreferences.kpExpressCheckoutClientKey
    }).load({
        container: containerId,
        theme: klarnaPreferences.kpExpressCheckoutTheme,
        shape: klarnaPreferences.kpExpressCheckoutShape,
        locale: klarnaPreferences.kpLocale,
        on_click: (authorize) => {
            // Here you should invoke authorize with the order payload.
            var form = {};
            if (isPDP) {
                form = getAddToCartData(containerId);
                var isDisabled = $('#klarnaExpressCheckoutPDP').attr('disabled');
                if (isDisabled) {
                    generateErrorAuthMessage(klarnaPaymentsResources.kpExpressSelectStyles);
                    return;
                }
            }
            var url = klarnaPaymentsUrls.generateExpressCheckoutPayload + '?populateAddress=false&isPDP=' + isPDP;
            $.ajax({
                url: url,
                type: 'POST',
                data: form,
                dataType: 'json',
                success: function (data) {
                    if (data.success) {
                        data.payload.merchant_urls = {
                            'authorization': klarnaPaymentsUrls.expressCheckoutAuthCallback
                        };
                        authorize(
                            { collect_shipping_address: true, auto_finalize: false },
                            data.payload,
                            (result) => {
                                // The result, if successful contains the authorization_token
                                if (result.approved) {
                                    $.ajax({
                                        url: klarnaPaymentsUrls.handleExpressCheckoutAuth,
                                        type: 'post',
                                        dataType: 'json',
                                        contentType: 'application/json',
                                        data: JSON.stringify(result),
                                        success: function (data) {
                                            if (data.redirectUrl) {
                                                window.location.href = data.redirectUrl;
                                            }
                                        }
                                    });
                                } else {
                                    //revert original basket
                                    if (isPDP) {
                                        $.ajax({
                                            url: klarnaPaymentsUrls.handleAuthFailurePDP,
                                            type: 'get',
                                            dataType: 'json',
                                            contentType: 'application/json'
                                        });
                                    }

                                    generateErrorAuthMessage();
                                }
                            },
                        );
                    } else {
                        if (!data.success && data.redirectUrl) {
                            window.location.href = data.redirectUrl;
                        }
                    }
                },
                error: function (err) {
                    console.log(err);
                }
            });
        },
    },
        function load_callback(loadResult) {
            // Here you can handle the result of loading the button
        },
    );
}


window.klarnaAsyncCallback = function () {
    var klarnaExpressCheckoutCart = document.querySelectorAll('.kec-container-cart');
    var klarnaExpressCheckoutMC = document.querySelector('#klarnaExpressCheckoutMC');
    var klarnaExpressCheckoutPDP = document.querySelector('#klarnaExpressCheckoutPDP');

    if (klarnaExpressCheckoutCart.length > 0) {
        klarnaExpressCheckoutCart.forEach(function (element, index) {
            initKlarnaExpressButton('#' + element.dataset.contId, false);
        });
    }
    if (klarnaExpressCheckoutMC) {
        initKlarnaExpressButton('#klarnaExpressCheckoutMC', false);
    }
    if (klarnaExpressCheckoutPDP) {
        initKlarnaExpressButton('#klarnaExpressCheckoutPDP', true);
    }
};
