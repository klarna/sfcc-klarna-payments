/* globals $, Klarna */

var summaryHelpers = require('base/checkout/summary');
var scrollAnimate = require('base/components/scrollAnimate');

/**
 * Checkout enhancements for Klarna support.
 *
 * @classdesc Klarna Checkout
 */
var KlarnaCheckout = {
    initStages: {},
    stageDefer: null,
    currentStage: null,
    klarnaPaymentsUrls: null,
    klarnaPaymentsObjects: null,
    klarnaPaymentsConstants: null,
    prefix: 'klarna'
};

/**
 * Return a cookie value by name.
 *
 * Utility function.
 *
 * @param {string} name - cookie name.
 * @returns {string} cookie value.
 */
KlarnaCheckout.getCookie = function (name) {
    var value = '; ' + document.cookie;
    var parts = value.split('; ' + name + '=');
    if (parts.length === 2) {
        return parts.pop().split(';').shift();
    }
    return '';
};

/**
 * Initialize Klarna checkout.
 *
 * SFRA checkout is made up of several stages: shipping,
 * payment, place order.
 *
 * Klarna Checkout enhances the usual SFRA checkout, by
 * adding an interval function to check for and handle
 * stage changes (progressing further or going back through the stages).
 *
 * @param {Object} config - configuration settings.
 */
KlarnaCheckout.init = function (config) {
    this.klarnaPaymentsUrls = config.urls;
    this.klarnaPaymentsObjects = config.objects;
    this.klarnaPaymentsConstants = config.constants;
    this.klarnaPaymentsPreferences = config.preferences;

    setInterval(function () {
        var currentStage = $('.data-checkout-stage').attr('data-checkout-stage');

        if (this.currentStage !== currentStage) {
            this.handleStageChanged(currentStage);

            this.currentStage = currentStage;
        }
    }.bind(this), 100);
};

/**
 * Handle checkout stage changed.
 *
 * Usually, the user progresses further through the stages
 * by filling out valid information. The first time a stage
 * is loaded, Klarna Checkout initializes the stage by adding
 * stage-specific enhancements. If a stage is already initialized,
 * the stage is only refreshed.
 *
 * @param {string} newStage - ID of new stage.
 */
KlarnaCheckout.handleStageChanged = function (newStage) {
    var promise = null;

    if (typeof this.initStages[newStage] === 'undefined' || !this.initStages[newStage]) {
        try {
            promise = this.initStage(newStage);

            promise.done(function () {
                this.refreshStage(newStage);
            }.bind(this));
        } catch (e) {
            console.debug(e); // eslint-disable-line
        }

        this.initStages[newStage] = true;
    } else {
        this.refreshStage(newStage);
    }
};

KlarnaCheckout.initStage = function (stage) {
    var promise = $.Deferred(); // eslint-disable-line

    switch (stage) {
        case 'shipping':
            this.initShippingStage(promise);
            break;
        case 'payment':
            this.initPaymentStage(promise);
            break;
        case 'placeOrder':
            this.initPlaceOrderStage(promise);
            break;
        default:
            break;
    }

    return promise;
};

KlarnaCheckout.refreshStage = function (stage) {
    $('.klarna-submit-payment').hide();
    $('.klarna-place-order').hide();

    switch (stage) {
        case 'shipping':
            this.refreshShippingStage();
            break;
        case 'payment':
            this.refreshPaymentStage();
            break;
        case 'placeOrder':
            this.refreshPlaceOrderStage();
            break;
        default:
            break;
    }
};

KlarnaCheckout.initShippingStage = function (defer) {
    defer.resolve();
};

KlarnaCheckout.initPaymentStage = function (defer) {
    Klarna.Payments.init({
        client_token: this.klarnaPaymentsObjects.clientToken
    });

    this.initPaymentOptionsTabs();

    this.initKlarnaSubmitPaymentButton(defer);

    if (this.klarnaPaymentsObjects.preassesment) {
        this.handlePaymentNeedsPreassesment();
    }

    setTimeout(function () {
        var expressCategory = this.getExpressCategory();
        if (expressCategory) {
            var $expressMethod = $('#klarna_payments_' + expressCategory + '_nav a[data-toggle="tab"]');
            $expressMethod.click();
        }
    }.bind(this), 100);

    defer.resolve();
};

KlarnaCheckout.initPlaceOrderStage = function (defer) {
    Klarna.Payments.init({
        client_token: this.klarnaPaymentsObjects.clientToken
    });

    this.initKlarnaPlaceOrderButton(defer);

    defer.resolve();
};


KlarnaCheckout.refreshShippingStage = function () {
    // code executed everytime when shipping stage is loaded
};

KlarnaCheckout.refreshPaymentStage = function () {
    var $klarnaSubmitPaymentBtn = $('.klarna-submit-payment');

    $('.submit-payment').hide();

    $klarnaSubmitPaymentBtn.show();
    $klarnaSubmitPaymentBtn.prop('disabled', false);

    this.refreshKlarnaPaymentOptions();
};

KlarnaCheckout.refreshPlaceOrderStage = function () {
    var $klarnaPlaceOrderBtn = $('.klarna-place-order');
    $klarnaPlaceOrderBtn.show();
    $klarnaPlaceOrderBtn.prop('disabled', false);
};

KlarnaCheckout.refreshKlarnaPaymentOptions = function () {
    var $klarnaPaymentCategories = this.getKlarnaPaymentOptionTabs();
    var $selectedPaymentOptionEl = $('.payment-information .nav-link.active').closest('li');
    var selectedPaymentOptionId = this.getKlarnaPaymentMethod($selectedPaymentOptionEl.attr('data-method-id'));

    $klarnaPaymentCategories.each(function (index, el) {
        var $el = $(el);
        var klarnaPaymentCategoryId = this.getKlarnaPaymentMethod($el.attr('data-method-id'));
        this.displayPaymentCategory(klarnaPaymentCategoryId, true);
        this.greyoutPaymentCategory(klarnaPaymentCategoryId, false);

        if (klarnaPaymentCategoryId === selectedPaymentOptionId) {
            $el.click();
        }
    }.bind(this));
};

/**
 * Handle payment submission by updating the payment summary specifically for Klarna payments.
 *
 * When the user submits a Klarna payment, an AJAX call is issued
 * by the SFRA code to save the new payment and then the place order
 * stage's payment summary is refreshed with payment instruments information.
 *
 * @param {Object} data - payment data.
 */
KlarnaCheckout.handleUpdateCheckoutView = function (data) {
    var order = data.order;

    if (!order.billing.payment || !order.billing.payment.selectedPaymentInstruments
        || !order.billing.payment.selectedPaymentInstruments.length > 0) {
        return;
    }

    this.updatePaymentSummary(order, data.options);
};

KlarnaCheckout.getKlarnaPaymentOptionTabs = function () {
    return $('.klarna-payment-item');
};

KlarnaCheckout.getPaymentOptionTabs = function () {
    return $('.payment-options .nav-item');
};

/**
 * Initialize payment options tabs.
 *
 * The method handles all payment options tabs, even non-Klarna ones.
 * Information from hidden tabs is not going to be submitted as only shown tab's
 * inputs are enabled.
 *
 * Additional Klarna email is shown if a Klarna payment option is selected.
 */
KlarnaCheckout.initPaymentOptionsTabs = function () {
    var $paymentOptionsTabs = $('.payment-options a[data-toggle="tab"]');

    $paymentOptionsTabs.on('shown.bs.tab', function (e) {
        $paymentOptionsTabs.each(function () {
            var $tabLink = $(this);
            var tabId = $tabLink.attr('href');
            var $tabContent = $(tabId);

            if (this === e.target) {
                $tabContent.find('input, textarea, select').removeAttr('disabled', 'disabled');
            } else {
                $tabContent.find('input, textarea, select').attr('disabled', 'disabled');
            }
        });
    });

    this.bindListenersToPaymentCategories();
};

/**
 * Configure event listeners for clicking on Klarna payment option tabs.
 *
 * Each event listener will trigger a Klarna API call to load payment data
 * based on current billing and shipping address information.
 */
KlarnaCheckout.bindListenersToPaymentCategories = function () {
    var $paymentCategories = this.getPaymentOptionTabs();

    $paymentCategories.each(function (index, el) {
        var $paymentCategory = $(el);
        var paymentMethodId = this.getKlarnaPaymentMethod($paymentCategory.attr('data-method-id'));
        var isKlarnaMethod = this.isKlarnaPaymentCategory(paymentMethodId);

        $paymentCategory.on('click', function () {
            var $tabContent = $($paymentCategory.find('.nav-link').attr('href'));

            $tabContent.find('input, textarea, select').removeAttr('disabled', 'disabled');

            if (isKlarnaMethod) {
                this.submitPaymentMethod($tabContent, this.loadPaymentData(paymentMethodId));
            } else {
                this.submitPaymentMethod($tabContent);
            }
        }.bind(this));
    }.bind(this));
};

KlarnaCheckout.getKlarnaPaymentMethod = function (methodId) {
    var klarnaMethodId = methodId.replace(this.prefix + '_', '');

    return klarnaMethodId;
};

KlarnaCheckout.displayPlaceOrderError = function (data) {
    if (data.errorMessage) {
        $('.error-message').show();
        $('.error-message-text').text(data.errorMessage);
        scrollAnimate($('.error-message'));
    }
};

KlarnaCheckout.handleFinalizeRequired = function (defer, sessionPayload) {
    var $errorBlock = $('p.error-message-text');
    var $placeOrderBtn = $('.place-order');
    var $klarnaPlaceOrderBtn = this.getKlarnaPlaceOrderBtn();
    var selectedPaymentMethod = this.getCookie('selectedKlarnaPaymentCategory');
    var paymentCategory = this.klarnaPaymentsObjects.kpIsExpressCheckout ? {} : { payment_method_category: selectedPaymentMethod };

    var payload = this.klarnaPaymentsObjects.kpIsExpressCheckout ? sessionPayload : {};

    Klarna.Payments.finalize(paymentCategory, payload, function (res) {
        if (res.approved) {
            if (this.klarnaPaymentsObjects.kpIsExpressCheckout) {
                // If no callback is set, the order is placed immediately.
                $.ajax({
                    headers: {
                        'X-Auth': res.authorization_token
                    },
                    url: this.klarnaPaymentsUrls.saveAuth
                }).done(function () {
                    // call the click event on the original checkout button
                    // to trigger checkout stage processing
                    $('body').trigger('checkout:disableButton', '.next-step-button button');
                    $.ajax({
                        url: $placeOrderBtn.data('action'),
                        method: 'POST',
                        success: function (data) {
                            // enable the placeOrder button here
                            $('body').trigger('checkout:enableButton', '.next-step-button button');
                            if (data.error) {
                                if (data.cartError) {
                                    window.location.href = data.redirectUrl;
                                    defer.reject();
                                } else {
                                    // go to appropriate stage and display error message
                                    defer.reject(data);
                                    this.displayPlaceOrderError(data);
                                }
                            } else {
                                var continueUrl = data.continueUrl;
                                var urlParams = {
                                    ID: data.orderID,
                                    token: data.orderToken
                                };

                                continueUrl += (continueUrl.indexOf('?') !== -1 ? '&' : '?') +
                                    Object.keys(urlParams).map(function (key) {
                                        return key + '=' + encodeURIComponent(urlParams[key]);
                                    }).join('&');


                                window.location.href = continueUrl;
                                defer.resolve(data);
                            }
                        }.bind(this),
                        error: function () {
                            // enable the placeOrder button here
                            $('body').trigger('checkout:enableButton', $('.next-step-button button'));
                        }
                    });
                }.bind(this));
            } else {
                // disable the placeOrder button here
                $('body').trigger('checkout:disableButton', '.next-step-button button');
                $('body').spinner().start();
                setTimeout(function () {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }, 500);
                // Await for a redirect for 20 seconds
                var numOfTries = 11;
                var currentUrl = window.location.href;
                var newUrl = '';
                var interval = setInterval(function () {
                    if (numOfTries === 0) {
                        clearInterval(interval);
                        $errorBlock.text(window.serverErrorMessage);
                        $errorBlock.parent().show();
                        $('body').spinner().stop();
                        return;
                    }
                    numOfTries--;
                    $.ajax({
                        url: this.klarnaPaymentsUrls.bankTransferAwaitCallback + '?session_id=' + window.KlarnaPaymentsObjects.sessionID
                    }).done(function (response) {
                        if (!response.isSubscriptionOrder && response.redirectUrl && response.redirectUrl !== currentUrl && response.redirectUrl !== newUrl) {
                            clearInterval(interval);
                            newUrl = response.redirectUrl;
                            window.location.href = newUrl;
                        } else if (response.isSubscriptionOrder) {
                            var continueUrl = response.redirectUrl;
                            var urlParams = {
                                ID: response.orderID,
                                token: response.orderToken
                            };

                            continueUrl += (continueUrl.indexOf('?') !== -1 ? '&' : '?') +
                                Object.keys(urlParams).map(function (key) {
                                    return key + '=' + encodeURIComponent(urlParams[key]);
                                }).join('&');
                            window.location.href = continueUrl;
                        }

                    });
                }.bind(this), 2000);
            }
        } else {
            if (!this.klarnaPaymentsObjects.kpIsExpressCheckout) {
                // If the payment isn't approved or popup is closed,
                $.ajax({
                    // then recreate Basket
                    type: 'POST',
                    url: this.klarnaPaymentsUrls.failOrder + '?session_id=' + window.KlarnaPaymentsObjects.sessionID
                }).done(function (result) {
                    if (!result.success) {
                        // In case of error, show error message
                        $klarnaPlaceOrderBtn.prop('disabled', true);
                        $errorBlock.text(window.serverErrorMessage);
                        $errorBlock.parent().show();
                    }
                });
            }
            $klarnaPlaceOrderBtn.prop('disabled', false);
        }
    }.bind(this));
};

KlarnaCheckout.handleLoadAuthResponse = function (res, defer, sessionPayload) {
    var $placeOrderBtn = $('.place-order');
    var finalizeRequired = res.FinalizeRequired;
    if (finalizeRequired === 'true') {
        // Create Order if finalization is required
        if (!this.klarnaPaymentsObjects.kpIsExpressCheckout) {
            $placeOrderBtn.click();
        }
        this.handleFinalizeRequired(defer, sessionPayload);

    } else {
        $('body').trigger('checkout:disableButton', '.next-step-button button');
        $.ajax({
            url: $placeOrderBtn.data('action'),
            method: 'POST',
            success: function (data) {
                // enable the placeOrder button here
                $('body').trigger('checkout:enableButton', '.next-step-button button');
                if (data.error) {
                    if (data.cartError) {
                        window.location.href = data.redirectUrl;
                        defer.reject();
                    } else {
                        // go to appropriate stage and display error message
                        defer.reject(data);
                        this.displayPlaceOrderError(data);
                    }
                } else {
                    var continueUrl = data.continueUrl;
                    var urlParams = {
                        ID: data.orderID,
                        token: data.orderToken
                    };

                    continueUrl += (continueUrl.indexOf('?') !== -1 ? '&' : '?') +
                        Object.keys(urlParams).map(function (key) {
                            return key + '=' + encodeURIComponent(urlParams[key]);
                        }).join('&');
                    window.location.href = continueUrl;
                    defer.resolve(data);
                }
            }.bind(this),
            error: function () {
                // enable the placeOrder button here
                $('body').trigger('checkout:enableButton', $('.next-step-button button'));
            }
        });
    }
};

KlarnaCheckout.initKlarnaButtonEvent = function (klarnaButton, defer) {
    var $submitPaymentBtn = $('.submit-payment');

    klarnaButton.on('click', function (event) {
        // Update Klarna payment according to the current session data
        // before submitting the payment.
        var selectedPayMethod = this.getSelectedPaymentMethod();
        var isKlarnaMethod = this.isKlarnaPaymentCategory(selectedPayMethod);
        if (isKlarnaMethod) {
            event.preventDefault();
            event.stopPropagation();
        }
        var $paymentCategory = $('.js-klarna-payment-item');
        var $tabContent = $($paymentCategory.find('.nav-link').attr('href'));
        var paymentMethodId = this.getKlarnaPaymentMethod($paymentCategory.attr('data-method-id'));
        this.submitPaymentMethod($tabContent, function () {
            this.loadPaymentData(paymentMethodId);

            var selectedPaymentMethod = this.getSelectedPaymentMethod();
            var klarnaRequestData = {
                billing_address: this.obtainBillingAddressData()
            };

            if (this.isKlarnaPaymentCategory(selectedPaymentMethod)) {
                var klarnaPaymentMethod = this.getKlarnaPaymentMethod(selectedPaymentMethod);
                event.preventDefault(); // prevent form submission until authorize call is done
                klarnaButton.prop('disabled', true);

                if (this.userHasEnteredShippingAddress()) {
                    klarnaRequestData.shipping_address = this.obtainShippingAddressData(klarnaRequestData.billing_address);
                }

                if (window.KPCustomerInfo && window.KPCustomerInfo.attachment) {
                    this.useMultiShipping();
                    var kpAttachment = window.KPCustomerInfo.attachment;

                    var kpAttachmentBody = JSON.parse(kpAttachment.body);
                    var otherAddresses = this.getMultiShipOtherAddresses(klarnaRequestData.billing_address);

                    kpAttachmentBody.other_delivery_address = otherAddresses;
                    kpAttachment.body = JSON.stringify(kpAttachmentBody);

                    klarnaRequestData.attachment = kpAttachment;
                }
                Klarna.Payments.authorize({
                    payment_method_category: klarnaPaymentMethod,
                    auto_finalize: false
                }, klarnaRequestData, function (res) {
                    if (res.approved) {
                        $.ajax({
                            headers: {
                                'X-Auth': res.authorization_token,
                                'Finalize-Required': res.finalize_required
                            },
                            url: this.klarnaPaymentsUrls.saveAuth
                        }).done(function () {
                            document.cookie = 'selectedKlarnaPaymentCategory=' + selectedPaymentMethod + '; SameSite=Strict; path=/';

                            klarnaButton.prop('disabled', true);

                            if (this.klarnaPaymentsPreferences.kpUseAlternativePaymentFlow) {
                                $.ajax({
                                    url: this.klarnaPaymentsUrls.loadAuth
                                }).done(function (result) {
                                    this.handleLoadAuthResponse(result, defer);
                                }.bind(this));
                            } else {
                                // call the click event on the original checkout button
                                // to trigger checkout stage processing
                                $submitPaymentBtn.click();
                            }
                        }.bind(this));
                    } else if (res.show_form) {
                        klarnaButton.prop('disabled', false);
                    }
                    if (!res || res.error) {
                        this.writeAdditionalLog(res, 'Klarna.Payments.authorize()', 'SFRA Storefront Ajax Request Error.');
                    }
                }.bind(this));
            }
        }.bind(this));
    }.bind(this));
};

KlarnaCheckout.initKlarnaPlaceOrderButton = function (defer) {
    var $placeOrderBtn = $('.place-order');
    var $klarnaPlaceOrderBtn = $placeOrderBtn.clone().insertAfter($placeOrderBtn);
    $klarnaPlaceOrderBtn.removeClass('place-order').addClass('klarna-place-order');

    $placeOrderBtn.hide();
    if (this.klarnaPaymentsPreferences.kpUseAlternativePaymentFlow && !this.klarnaPaymentsObjects.kpIsExpressCheckout) {
        KlarnaCheckout.initKlarnaButtonEvent($klarnaPlaceOrderBtn, defer);
    } else {
        $klarnaPlaceOrderBtn.click(function (event) {
            event.stopPropagation();

            $klarnaPlaceOrderBtn.prop('disabled', true);

            $.ajax({
                url: this.klarnaPaymentsUrls.loadAuth
            }).done(function (result) {
                if (this.klarnaPaymentsObjects.kpIsExpressCheckout) {
                    $.ajax({
                        url: this.klarnaPaymentsUrls.generateExpressCheckoutPayload + '?populateAddress=true&isPDP=false',
                        data: {},
                        type: 'POST'
                    }).done(function (payloadresult) {
                        this.handleLoadAuthResponse(result, defer, payloadresult.payload);
                    }.bind(this));
                } else {
                    this.handleLoadAuthResponse(result, defer);
                }
            }.bind(this));
        }.bind(this));
    }
};

KlarnaCheckout.getKlarnaPlaceOrderBtn = function () {
    return $('.klarna-place-order');
};

KlarnaCheckout.getKlarnaSubmitPaymentBtn = function () {
    return $('.klarna-submit-payment');
};

/**
 * Create and configure a Klarna submit payment button.
 *
 * The default submit payment button will be hidden and the user is going to click
 * on a duplicate Klarna submit payment button, which makes a Klarna authorize call.
 *
 */
KlarnaCheckout.initKlarnaSubmitPaymentButton = function (defer) {
    var $submitPaymentBtn = $('.submit-payment');

    var $klarnaSubmitPaymentBtn = $submitPaymentBtn.clone().insertAfter($submitPaymentBtn);
    $klarnaSubmitPaymentBtn.removeClass('submit-payment').addClass('klarna-submit-payment');

    $submitPaymentBtn.hide();

    if (this.klarnaPaymentsPreferences.kpUseAlternativePaymentFlow || this.klarnaPaymentsObjects.kpIsExpressCheckout) {
        $klarnaSubmitPaymentBtn.on('click', function () {
            $submitPaymentBtn.click();
        });
    } else {
        KlarnaCheckout.initKlarnaButtonEvent($klarnaSubmitPaymentBtn, defer);
    }
};

/**
 * Handle preassessment on submit payment stage.
 *
 * Preassesment sends information on-the-fly for each billing address
 * change. If a Klarna payment category is selected, a Klarna API call
 * is executed to load payment data.
 */
KlarnaCheckout.handlePaymentNeedsPreassesment = function () {
    var $billingAddressForm = $('#dwfrm_billing');
    var $billingAddressElementsFields = $billingAddressForm.find('.billing-address');
    var $billingAddressFormElements = $billingAddressElementsFields.find('input, select');

    $billingAddressForm.on('change', function () {
        var tabContentId = $('.payment-options .nav-link.active').attr('href');
        var $tabContent = $(tabContentId);
        var selectedPaymentMethod = this.getSelectedPaymentMethod();

        var formValid = true;

        $billingAddressFormElements.each(function (index, el) {
            var $el = $(el);

            if ($el.attr('aria-invalid') === 'true' || ($el.attr('aria-required') === 'true' && $el.val().length === 0)) {
                formValid = false;
                return;
            }
        });

        if (formValid && this.isKlarnaPaymentCategory(selectedPaymentMethod)) {
            this.submitPaymentMethod($tabContent, this.loadPaymentData(selectedPaymentMethod));
        } else {
            this.submitPaymentMethod($tabContent);
        }
    }.bind(this));
};

/**
 * Update payment summary with Klarna payment instrument information.
 *
 * @param {Object} order DW order info.
 */
KlarnaCheckout.updatePaymentSummary = function (order) {
    var selectedPaymentInstruments = order.billing.payment.selectedPaymentInstruments;
    var firstPaymentInstrument = selectedPaymentInstruments[0];
    var $paymentSummary = $('.payment-details');
    var htmlToAppend = '';
    var KLARNA_PAYMENT_DEFAULT = this.klarnaPaymentsConstants.KLARNA_PAYMENT_DEFAULT;

    if (firstPaymentInstrument && firstPaymentInstrument.paymentMethod.indexOf(KLARNA_PAYMENT_DEFAULT) >= 0) {
        htmlToAppend += '<div class="payment">';
        htmlToAppend += '<div class="method-name">' + firstPaymentInstrument.name + '</div>';
        htmlToAppend += '<div class="category-name">' + firstPaymentInstrument.categoryName + '</div>';
        if (typeof firstPaymentInstrument.amountFormatted !== 'undefined') {
            htmlToAppend += '<div class="amount">' + firstPaymentInstrument.amountFormatted + '</span>';
        }
        htmlToAppend += '</div>';
    } else {
        htmlToAppend += '<span>' + order.resources.cardType + ' '
            + firstPaymentInstrument.type
            + '</span><div>'
            + firstPaymentInstrument.maskedCreditCardNumber
            + '</div><div><span>'
            + order.resources.cardEnding + ' '
            + firstPaymentInstrument.expirationMonth
            + '/' + firstPaymentInstrument.expirationYear
            + '</span></div>';
    }

    $paymentSummary.empty().append(htmlToAppend);
};

/**
 * Obtain billing address information on submit payment stage.
 *
 * This method handles the cases of adding/updating a billing address,
 * as well as using an existing one from the billing address drop-down.
 *
 * @returns {Object} - Klarna billing address.
 */
KlarnaCheckout.obtainBillingAddressData = function () {
    var address = {
        given_name: '',
        family_name: '',
        street_address: '',
        street_address2: '',
        city: '',
        postal_code: '',
        country: '',
        region: '',
        phone: '',
        email: ''
    };

    var $paymentForm = $('.payment-form');
    var $billingAddressFieldset = $('.billing-address');
    var $contactInfoBlock = $('.contact-info-block');
    var $customerInformationBlock = $('.customer-information-block');
    var emailFromOrderSummary = $('.order-summary-email').text();

    if ($billingAddressFieldset.is(':visible')) {
        address.given_name = $billingAddressFieldset.find('.billingFirstName').val();
        address.family_name = $billingAddressFieldset.find('.billingLastName').val();
        address.street_address = $billingAddressFieldset.find('.billingAddressOne').val();
        address.street_address2 = $billingAddressFieldset.find('.billingAddressTwo').val();
        address.city = $billingAddressFieldset.find('.billingAddressCity').val();
        address.region = $billingAddressFieldset.find('.billingState').val();
        address.postal_code = $billingAddressFieldset.find('.billingZipCode').val();
        address.country = $billingAddressFieldset.find('.billingCountry').val();
        address.phone = $contactInfoBlock.find('.phone').val();
    } else {
        var $addressSelectorElement = $paymentForm.find('.addressSelector');
        var $selectedOption = $addressSelectorElement.find(':selected');

        address.given_name = $selectedOption.attr('data-first-name');
        address.family_name = $selectedOption.attr('data-last-name');
        address.street_address = $selectedOption.attr('data-address1');
        address.street_address2 = $selectedOption.attr('data-address2');
        address.city = $selectedOption.attr('data-city');
        address.region = $selectedOption.attr('data-state-code');
        address.postal_code = $selectedOption.attr('data-postal-code');
        address.country = $selectedOption.attr('data-country-code');
        address.phone = $contactInfoBlock.find('.phone').val();
    }

    if (emailFromOrderSummary.length) {
        address.email = emailFromOrderSummary;
    } else {
        address.email = $contactInfoBlock.find('.email').length ? $contactInfoBlock.find('.email').val() : $customerInformationBlock.find('.email').val();
    }

    return address;
};

/**
 * Obtain shipping address information on submit payment stage.
 *
 * Shipping address information is taken from the shipping address
 * block. In case of multi-shipping we will return the first home address if
 * possible or the pickup one.
 *
 * @param {Object} billingAddress The order billing address
 * @returns {Object} - Klarna shipping address.
 */
KlarnaCheckout.obtainShippingAddressData = function (billingAddress) {
    var address = {
        given_name: '',
        family_name: '',
        street_address: '',
        street_address2: '',
        city: '',
        postal_code: '',
        country: '',
        region: '',
        phone: '',
        email: ''
    };

    var $shippingAddressBlock = $('.single-shipping .shipping-address-block');
    var $contactInfoBlock = $('.contact-info-block');
    var $customerInformationBlock = $('.customer-information-block');
    var useMultiShip = this.useMultiShipping();
    var emailFromOrderSummary = $('.order-summary-email').text();

    if (!useMultiShip) {
        // If we have only one shipping - it can still be store pickup. In which case
        // we should retirieve the names from billing form
        var $shippingForm = $('.multi-shipping .shipping-form');
        var $selctedShippingMethod = $('input[name$="_shippingAddress_shippingMethodID"]:checked', $shippingForm);
        // eslint-disable-next-line eqeqeq
        var isStorePickup = ($selctedShippingMethod.length === 1) ? $selctedShippingMethod.attr('data-pickup') == 'true' : false;

        address = this.buildShippingAddressData($shippingAddressBlock, isStorePickup ? billingAddress : null);
    } else {
        address = this.getMultiShipDefaultAddress(billingAddress);
    }

    if (emailFromOrderSummary.length) {
        address.email = emailFromOrderSummary;
    } else {
        address.email = $contactInfoBlock.find('.email').length ? $contactInfoBlock.find('.email').val() : $customerInformationBlock.find('.email').val();
    }

    return address;
};

/**
 * Builds the shipping address object.
 *
 * Shipping address information is taken from the shipping address block. If the
 * billing object is passed, then the billing first & last name will be used.
 *
 * @param {Object} $addressBlock The HTML element that contains the address details
 * @param {Object} billingAddress The order billing address
 * @returns {Object} - Klarna shipping address.
 */
KlarnaCheckout.buildShippingAddressData = function ($addressBlock, billingAddress) {
    var address = {
        given_name: $addressBlock.find('.shippingFirstName').val(),
        family_name: $addressBlock.find('.shippingLastName').val(),
        street_address: $addressBlock.find('.shippingAddressOne').val(),
        street_address2: $addressBlock.find('.shippingAddressTwo').val(),
        city: $addressBlock.find('.shippingAddressCity').val(),
        postal_code: $addressBlock.find('.shippingZipCode').val(),
        region: $addressBlock.find('.shippingState').val(),
        country: $addressBlock.find('.shippingCountry').val(),
        phone: $addressBlock.find('.shippingPhoneNumber').val()
    };

    if (billingAddress) {
        if (billingAddress.given_name !== '') {
            address.given_name = billingAddress.given_name;
        }

        if (billingAddress.family_name !== '') {
            address.family_name = billingAddress.family_name;
        }
    }

    return address;
};

/**
 * Builds the additional store pickup address object
 *
 * Shipping address information is taken from the shipping address block. If the
 * billing object is passed, then the billing first & last name will be used.
 *
 * @param {Object} $addressBlock The HTML element that contains the address details
 * @param {Object} billingAddress The order billing address
 * @returns {Object} - Klarna pickup shipping address.
 */
KlarnaCheckout.buildOtherAddressData = function ($addressBlock, billingAddress) {
    var address = {
        shipping_method: this.klarnaPaymentsConstants.SHIPPING_METHOD_TYPE.STORE,
        shipping_type: this.klarnaPaymentsConstants.SHIPPING_TYPE.NORMAL,
        first_name: $addressBlock.find('.shippingFirstName').val(),
        last_name: $addressBlock.find('.shippingLastName').val(),
        street_address: $addressBlock.find('.shippingAddressOne').val(),
        street_number: $addressBlock.find('.shippingAddressTwo').val(),
        city: $addressBlock.find('.shippingAddressCity').val(),
        postal_code: $addressBlock.find('.shippingZipCode').val(),
        country: $addressBlock.find('.shippingCountry').val()
    };

    if (billingAddress) {
        if (billingAddress.given_name !== '') {
            address.first_name = billingAddress.given_name;
        }

        if (billingAddress.family_name !== '') {
            address.last_name = billingAddress.family_name;
        }
    }

    return address;
};

/**
 * Retrieves the multi-shipping default address
 *
 * If we have more that one home delivery address or only pickup ones, we
 * should return the first address in the list.
 *
 * @param {Object} billingAddress The order billing address
 * @returns {Object} - Klarna default shipping address.
 */
KlarnaCheckout.getMultiShipDefaultAddress = function (billingAddress) {
    var $multishippingForms = $('.multi-shipping .shipping-form');
    var $multishippingAddressBlock = $('.multi-shipping .shipping-address-block');
    var address = this.buildShippingAddressData($multishippingAddressBlock.first(), billingAddress);

    // eslint-disable-next-line consistent-return
    $multishippingForms.each(function (i, form) {
        var $form = $(form);
        var $selctedShippingMethod = $('input[name$="_shippingAddress_shippingMethodID"]:checked', $form);

        if ($selctedShippingMethod.length === 1) {
            var isStorePickup = $selctedShippingMethod.attr('data-pickup') === 'true';

            if (!isStorePickup) {
                address = this.buildShippingAddressData($('.shipping-address-block', $form));
                return false;
            }
        }
    }.bind(this));

    return address;
};

/**
 * Returns the multi-shipping additional pickup addresses
 *
 * The array is populated only if we have more than one store pickup. Otherwise,
 * it will be returned empty.
 *
 * @param {Object} billingAddress The order billing address
 * @returns {Array} - Klarna pickup shipping addresses list.
 */
KlarnaCheckout.getMultiShipOtherAddresses = function (billingAddress) {
    var addressesArr = [];
    var useMultiShip = this.useMultiShipping();
    var $multishippingForms = $(useMultiShip ? '.multi-shipping .shipping-form' : '.single-shipping .shipping-form');

    if ($multishippingForms.length > 0) {
        $multishippingForms.each(function (i, form) {
            var $form = $(form);
            var $selctedShippingMethod = $('input[name$="_shippingAddress_shippingMethodID"]:checked', $form);

            if ($selctedShippingMethod.length === 1) {
                var isStorePickup = $selctedShippingMethod.attr('data-pickup') === 'true';

                if (isStorePickup) {
                    var address = this.buildOtherAddressData($('.shipping-address-block', $form), billingAddress);
                    addressesArr.push(address);
                }
            }
        }.bind(this));
    }

    return addressesArr;
};

KlarnaCheckout.getSelectPaymentMethodElement = function () {
    var $selectPaymentMethodInner = $('.payment-options .nav-link.active');

    var $selectPaymentMethod = $selectPaymentMethodInner.parent();

    return $selectPaymentMethod;
};

KlarnaCheckout.getSelectedPaymentMethod = function (methodId) {
    var paymentMethodId = methodId || this.getSelectPaymentMethodElement().attr('data-method-id');

    var klarnaMethodId = paymentMethodId.replace(this.prefix + '_', '');

    return klarnaMethodId;
};

/**
 * Confirms if a payment category is a Klarna payment category.
 *
 * @param {string} paymentCategory Klarna payment category ID.
 * @returns {bool} true, if the payment category is a Klarna payment category.
 */
KlarnaCheckout.isKlarnaPaymentCategory = function (paymentCategory) {
    var flag = false;
    var $klarnaPaymentCategories = this.getKlarnaPaymentOptionTabs();

    $klarnaPaymentCategories.each(function (i, cat) {
        var $category = $(cat);

        var klarnaPaymentCategoryId = this.getKlarnaPaymentMethod($category.attr('data-method-id'));

        if (paymentCategory === klarnaPaymentCategoryId) {
            flag = true;
        }
    }.bind(this));

    return flag;
};

/**
 * Checks if user has entered shipping address.
 *
 * @returns {bool} If shipping address has been selected.
 */
KlarnaCheckout.userHasEnteredShippingAddress = function () {
    var $shipmentUUIDElement = $('.single-shipping .shipping-form').find('.shipmentUUID');

    return ($shipmentUUIDElement.value !== '');
};

KlarnaCheckout.useMultiShipping = function () {
    var $multiShipCheck = $('#multiShipCheck');
    var useMultiShip = $multiShipCheck.length > 0 ? $multiShipCheck.is(':checked') : false;

    return useMultiShip;
};

/**
 * Execute a Klarna API call to Load payment data for a specified Klarna payment category.
 *
 * Note: Klarna JS client automatically refreshes the contents of the passed container.
 *
 * @param {string} paymentCategory Klarna payment category.
 */
KlarnaCheckout.loadPaymentData = function (paymentCategory) {
    var klarnaPaymentMethod = this.getKlarnaPaymentMethod(paymentCategory);
    var $klarnaTab = this.getSelectedKlarnaPaymentTab(paymentCategory);

    if ($klarnaTab.hasClass('klarna-grayed-tab')) {
        return;
    }

    var containerName = '#klarna_payments_' + klarnaPaymentMethod + '_container';

    var updateData = {
        billing_address: this.obtainBillingAddressData()
    };

    if (this.userHasEnteredShippingAddress()) {
        updateData.shipping_address = this.obtainShippingAddressData(updateData.billing_address);
    }

    Klarna.Payments.load({
        container: containerName,
        payment_method_category: klarnaPaymentMethod
    }, updateData, function (res) {
        var $klarnaSubmitPaymentBtn = this.getKlarnaSubmitPaymentBtn();
        var disableCheckoutBtn = !res.show_form;
        if (res.error && res.error.invalid_fields && res.error.invalid_fields.length) {
            disableCheckoutBtn = true;
        } else if (!res.error) {
            disableCheckoutBtn = false;
        }
        $klarnaSubmitPaymentBtn.prop('disabled', disableCheckoutBtn);

        if (!res || res.error) {
            this.writeAdditionalLog(res, 'Klarna.Payments.load()', 'SFRA Storefront Ajax Request Error.');
        }
    }.bind(this));
};

KlarnaCheckout.getSelectedKlarnaPaymentTab = function (klarnaPaymentMethod) {
    return $('#klarna_payments_' + klarnaPaymentMethod + '_nav');
};

KlarnaCheckout.getSelectedKlarnaPaymentContainer = function (klarnaPaymentMethod) {
    return $('.klarna_payments-content.klarna_payments_' + klarnaPaymentMethod);
};

/**
 * Hide payment option in case of hard reject
 *
 * @param {string} klarnaPaymentMethod Klarna payment method.
 */
KlarnaCheckout.hidePaymentCategory = function (klarnaPaymentMethod) {
    var $klarnaTab = this.getSelectedKlarnaPaymentTab(klarnaPaymentMethod);
    var $klarnaContainer = this.getSelectedKlarnaPaymentContainer(klarnaPaymentMethod);

    $klarnaTab.removeClass('active').addClass('d-none');
    $klarnaContainer.removeClass('active').addClass('d-none');
};

KlarnaCheckout.displayPaymentCategory = function (klarnaPaymentMethod, flag) {
    var $klarnaTab = this.getSelectedKlarnaPaymentTab(klarnaPaymentMethod);
    var $klarnaContainer = this.getSelectedKlarnaPaymentContainer(klarnaPaymentMethod);

    $klarnaTab.toggleClass('d-none', !flag);
    $klarnaContainer.toggleClass('d-none', !flag);
};

KlarnaCheckout.greyoutPaymentCategory = function (klarnaPaymentMethod, flag) {
    var $klarnaTab = this.getSelectedKlarnaPaymentTab(klarnaPaymentMethod);
    var $klarnaContainer = this.getSelectedKlarnaPaymentContainer(klarnaPaymentMethod);

    $klarnaTab.toggleClass('klarna-grayed-tab', flag);
    $klarnaContainer.toggleClass('klarna-grayed-content', flag);
};

KlarnaCheckout.submitPaymentMethod = function ($tabContent, callback) {
    var $paymentInfoFields = $tabContent.find('.payment-form-fields :input');
    var paymentFormData = $paymentInfoFields.serialize();

    $.ajax({
        url: this.klarnaPaymentsUrls.selectPaymentMethod,
        method: 'POST',
        data: paymentFormData
    }).done(function (data) {
        Klarna.Payments.init({
            client_token: this.klarnaPaymentsObjects.clientToken
        });
        if (data.cartError && data.redirectUrl) {
            window.location.href = data.redirectUrl;
        }
        if (!data.error && data.updateSummary) {
            summaryHelpers.updateTotals(data.order.totals);
            summaryHelpers.updateOrderProductSummaryInformation(data.order, data.options);
            this.updatePaymentSummary(data.order, data.options);
        }
        var selectedPaymentMethod = this.getSelectedPaymentMethod();
        var isKlarnaMethod = this.isKlarnaPaymentCategory(selectedPaymentMethod);
        if (!isKlarnaMethod) {
            var $klarnaSubmitPaymentBtn = this.getKlarnaSubmitPaymentBtn();
            $klarnaSubmitPaymentBtn.prop('disabled', false);
        }
        // always execute the KP options loading
        if (typeof callback === 'function') callback();
    }.bind(this));
};

KlarnaCheckout.getExpressCategory = function () {
    var expressCategory = $('#klarna-express-category').val();
    return expressCategory;
};

KlarnaCheckout.writeAdditionalLog = function (res, action, msg) {
    if (this.klarnaPaymentsPreferences.kpAdditionalLogging) {
        $.ajax({
            url: this.klarnaPaymentsUrls.writeLog,
            method: 'POST',
            data: {
                response: res,
                actionName: action,
                message: msg
            }
        })
    }
};

/**
 * Initialize Klarna checkout enhancements.
 *
 * This method is called as soon as the Klarna JS API client has been
 * properly initialized (this is done by the client itself).
 */
window.klarnaAsyncCallback = function () {
    $(function () {
        $('body').on('checkout:updateCheckoutView', function (e, data) {
            KlarnaCheckout.handleUpdateCheckoutView(data);
        });

        KlarnaCheckout.init({
            urls: window.KlarnaPaymentsUrls,
            objects: window.KlarnaPaymentsObjects,
            constants: window.KPConstants,
            preferences: window.KPPreferences
        });
    });
};

/**
 * In case of error fields in the inoput form,
 * the form is displayed for correction
 * @param {object} $form checkout form to check for errors
 */
function checkFormErrors($form) {
    var numOfTries = KlarnaCheckout.klarnaPaymentsConstants.FORM_VALIDATION_NUM_RETRIES;
    var interval = setInterval(function () {
        if (numOfTries === 0) {
            clearInterval(interval);
            return;
        }
        numOfTries--;
        var errors = $form.find('.form-control.is-invalid');
        if (errors.length) {
            $('.btn-show-details').trigger('click');
            clearInterval(interval);
        }
    }, KlarnaCheckout.klarnaPaymentsConstants.KEC_EEROR_WAITTIME);
}

/**
 * display billing or shipping form in case of error
 */
$('body').on('checkout:enableButton', function (e, button) {
    $(button).each(function () {
        var button = $(this);
        if (button.is(":visible")) {
            if (button.hasClass('submit-shipping')) {
                checkFormErrors($('.single-shipping'));
            } else if (button.hasClass('submit-payment') || button.hasClass('klarna-submit-payment')) {
                checkFormErrors($('.payment-form'));
            }
        }
    });
});
