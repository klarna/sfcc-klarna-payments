/* globals $, Klarna */

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
    prefix: 'klarna'
};

/**
 * Return a cookie value by name.
 * 
 * Utility function.
 * 
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
 * @params {Object} - configuration settings.
 */
KlarnaCheckout.init = function (config) {
    this.klarnaPaymentsUrls = config.urls;
    this.klarnaPaymentsObjects = config.objects;

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
 * @params {string} newStage - ID of new stage.
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
            console.log(e);
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

    this.initKlarnaEmail();

    this.initKlarnaSubmitPaymentButton();

    if (this.klarnaPaymentsObjects.preassesment) {
        this.handlePaymentNeedsPreassesment();
    }

    defer.resolve();
};

KlarnaCheckout.initPlaceOrderStage = function (defer) {
    Klarna.Payments.init({
        client_token: this.klarnaPaymentsObjects.clientToken
    });

    this.initKlarnaPlaceOrderButton();

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
    var instance = this;
    var $paymentOptionsTabs = $('.payment-options a[data-toggle="tab"]');

    $paymentOptionsTabs.on('shown.bs.tab', function (e) {
        var $clickedTabLink = $(e.target);

        if ($clickedTabLink.parent('li').hasClass('klarna-payment-item')) {
            instance.getKlarnaEmailContainer().removeClass('hide');
        } else {
            instance.getKlarnaEmailContainer().addClass('hide');
        }

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
    var $klarnaPaymentCategories = this.getKlarnaPaymentOptionTabs();

    $klarnaPaymentCategories.each(function (index, el) {
        var $klarnaPaymentCategory = $(el);
        var klarnaPaymentCategoryId = this.getKlarnaPaymentMethod($klarnaPaymentCategory.attr('data-method-id'));

        $klarnaPaymentCategory.on('click', function () {
            this.loadPaymentData(klarnaPaymentCategoryId);
        }.bind(this));
    }.bind(this));
};

KlarnaCheckout.getKlarnaPaymentMethod = function (methodId) {
    var klarnaMethodId = methodId.replace(this.prefix + '_', '');

    return klarnaMethodId;
};

KlarnaCheckout.handleFinalizeRequired = function () {
    var $placeOrderBtn = $('.place-order');
    var $klarnaPlaceOrderBtn = this.getKlarnaPlaceOrderBtn();
    var selectedPaymentMethod = this.getCookie('selectedKlarnaPaymentCategory');

    Klarna.Payments.finalize({
        payment_method_category: selectedPaymentMethod
    }, {}, function (res) {
        if (res.approved) {
            $.ajax({
                headers: {
                    'X-Auth': res.authorization_token
                },
                url: this.klarnaPaymentsUrls.saveAuth
            }).done(function () {
                // call the click event on the original checkout button
                // to trigger checkout stage processing
                $placeOrderBtn.click();
            });
        } else if (res.show_form) {
            $klarnaPlaceOrderBtn.prop('disabled', false);
        }
    }.bind(this));
};

KlarnaCheckout.handleLoadAuthResponse = function (res) {
    var $placeOrderBtn = $('.place-order');
    var finalizeRequired = res.FinalizeRequired;

    if (finalizeRequired === 'true') {
        this.handleFinalizeRequired();
    } else {
        $placeOrderBtn.click();
    }
};

KlarnaCheckout.initKlarnaPlaceOrderButton = function () {
    var $placeOrderBtn = $('.place-order');
    var $klarnaPlaceOrderBtn = $placeOrderBtn.clone().insertAfter($placeOrderBtn);
    $klarnaPlaceOrderBtn.removeClass('place-order').addClass('klarna-place-order');

    $placeOrderBtn.hide();

    $klarnaPlaceOrderBtn.click(function (event) {
        event.stopPropagation();

        $klarnaPlaceOrderBtn.prop('disabled', true);

        $.ajax({
            url: this.klarnaPaymentsUrls.loadAuth
        }).done(this.handleLoadAuthResponse.bind(this));
    }.bind(this));
};

KlarnaCheckout.getKlarnaPlaceOrderBtn = function () {
    return $('.klarna-place-order');
};

KlarnaCheckout.getKlarnaSubmitPaymentBtn = function () {
    return $('.klarna-submit-payment');
};

/**
 * Initialize additional email input field.
 * 
 * Klarna expects an email as part of billing address data which the 
 * default SFRA checkout does not have. This method adds validation 
 * handling.
 */
KlarnaCheckout.initKlarnaEmail = function () {
    var $emailField = this.getKlarnaEmail();

    $emailField.on('keypress input', function () {
        if (this.isKlarnaEmailValid()) {
            this.markKlarnaEmailValid();
        } else {
            this.markKlarnaEmailInvalid();
        }
    }.bind(this));
};

KlarnaCheckout.getKlarnaEmail = function () {
    var $emailField = $('.payment-form .klarna_email');

    return $emailField;
};

/**
 * Checks Klarna email input for valid email.
 * 
 * @returns {bool} true, if user entered a valid email.
 */
KlarnaCheckout.isKlarnaEmailValid = function () {
    var $emailField = this.getKlarnaEmail();
    var regExpPattern = $emailField.attr('pattern');
    var maxlength = parseInt($emailField.attr('maxlength'), 10);
    var email = $emailField.val();
    var regExp = new RegExp(regExpPattern);

    if (email.length > maxlength) {
        return false;
    }

    if (!regExp.test(email)) {
        return false;
    }

    return true;
};

KlarnaCheckout.getKlarnaEmailContainer = function () {
    var $emailField = this.getKlarnaEmail();

    return $emailField.parent('.form-group');
};

KlarnaCheckout.markKlarnaEmailInvalid = function () {
    var $emailField = this.getKlarnaEmail();

    $emailField.next('.invalid-feedback').html('This field is required').show();
};

KlarnaCheckout.markKlarnaEmailValid = function () {
    var $emailField = this.getKlarnaEmail();

    $emailField.next('.invalid-feedback').hide();
};

/**
 * Create and configure a Klarna submit payment button.
 * 
 * The default submit payment button will be hidden and the user is going to click 
 * on a duplicate Klarna submit payment button, which makes a Klarna authorize call.
 *
 */
KlarnaCheckout.initKlarnaSubmitPaymentButton = function () {
    var $submitPaymentBtn = $('.submit-payment');

    var $klarnaSubmitPaymentBtn = $submitPaymentBtn.clone().insertAfter($submitPaymentBtn);
    $klarnaSubmitPaymentBtn.removeClass('submit-payment').addClass('klarna-submit-payment');

    $submitPaymentBtn.hide();

    $klarnaSubmitPaymentBtn.on('click', function (event) {
        var selectedPaymentMethod = this.getSelectedPaymentMethod();
        var klarnaRequestData = {
            billing_address: this.obtainBillingAddressData()
        };

        if (this.isKlarnaPaymentCategory(selectedPaymentMethod)) {
            event.preventDefault(); // prevent form submission until authorize call is done

            if (!this.isKlarnaEmailValid()) {
                this.markKlarnaEmailInvalid();

                $([document.documentElement, document.body]).animate({
                    scrollTop: this.getKlarnaEmail().offset().top
                }, 500);

                event.stopPropagation();
                return;
            }

            $klarnaSubmitPaymentBtn.prop('disabled', true);

            if (this.userHasEnteredShippingAddress()) {
                klarnaRequestData.shipping_address = this.obtainShippingAddressData();
            }

            Klarna.Payments.authorize({
                payment_method_category: this.getKlarnaPaymentMethod(selectedPaymentMethod),
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
                        document.cookie = 'selectedKlarnaPaymentCategory=' + selectedPaymentMethod + '; path=/';

                        $klarnaSubmitPaymentBtn.prop('disabled', true);

						// call the click event on the original checkout button
						// to trigger checkout stage processing
                        $submitPaymentBtn.click();
                    });
                } else if (res.show_form) {
                    $klarnaSubmitPaymentBtn.prop('disabled', false);
                }
            }.bind(this));
        }
    }.bind(this));
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
        var selectedPaymentMethod = this.getSelectedPaymentMethod();

        var formValid = true;

        $billingAddressFormElements.each(function (index, el) {
            var $el = $(el);

            if ($el.attr('aria-invalid') === 'true' || ($el.attr('aria-required') === 'true' && $el.value.length === 0)) {
                formValid = false;
                return;
            }
        });

        if (formValid && this.isKlarnaPaymentCategory(selectedPaymentMethod)) {
            this.loadPaymentData(selectedPaymentMethod);
        }
    }.bind(this));
};

/**
 * Update payment summary with Klarna payment instrument information.
 * 
 * @param {Object} DW order info.
 */
KlarnaCheckout.updatePaymentSummary = function (order) {
    var selectedPaymentInstruments = order.billing.payment.selectedPaymentInstruments;
    var firstPaymentInstrument = selectedPaymentInstruments[0];
    var $paymentSummary = $('.payment-details');
    var htmlToAppend = '';

    if (firstPaymentInstrument.paymentMethod === 'KLARNA_PAYMENTS') {
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

    if ($billingAddressFieldset.is(':visible')) {
        address.given_name = $billingAddressFieldset.find('.billingFirstName').val();
        address.family_name = $billingAddressFieldset.find('.billingLastName').val();
        address.street_address = $billingAddressFieldset.find('.billingAddressOne').val();
        address.street_address2 = $billingAddressFieldset.find('.billingAddressTwo').val();
        address.city = $billingAddressFieldset.find('.billingAddressCity').val();
        address.region = $billingAddressFieldset.find('.billingState').val();
        address.postal_code = $billingAddressFieldset.find('.billingZipCode').val();
        address.country = $billingAddressFieldset.find('.billingCountry').val();
        address.phone = $billingAddressFieldset.find('.billingPhoneNumber').val();
        address.email = this.getKlarnaEmail().val();
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
        address.phone = $selectedOption.attr('data-phone');
        address.email = this.getKlarnaEmail().val();
    }

    return address;
};

/**
 * Obtain shipping address information on submit payment stage.
 * 
 * Shipping address information is taken from the shipping address 
 * block.
 * 
 * @returns {Object} - Klarna shipping address.
 */
KlarnaCheckout.obtainShippingAddressData = function () {
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

    address.given_name = $shippingAddressBlock.find('.shippingFirstName').val();
    address.family_name = $shippingAddressBlock.find('.shippingLastName').val();
    address.street_address = $shippingAddressBlock.find('.shippingAddressOne').val();
    address.street_address2 = $shippingAddressBlock.find('.shippingAddressTwo').val();
    address.city = $shippingAddressBlock.find('.shippingAddressCity').val();
    address.region = $shippingAddressBlock.find('.shippingState').val();
    address.postal_code = $shippingAddressBlock.find('.shippingZipCode').val();
    address.country = $shippingAddressBlock.find('.shippingCountry').val();
    address.phone = $shippingAddressBlock.find('.shippingPhoneNumber').val();
    address.email = this.getKlarnaEmail().val();

    return address;
};

KlarnaCheckout.getFormSelectedPaymentMethod = function () {
    var methodId = $('.payment-information').attr('data-payment-method-id');

    return methodId;
};

KlarnaCheckout.getFormSelectedPaymentCategory = function () {
    var categoryId = $('.payment-information').attr('data-payment-category-id');

    return categoryId;
};

KlarnaCheckout.setFormSelectedPaymentCategory = function (categoryId) {
    $('.payment-information').attr('data-payment-category-id', categoryId);
};

KlarnaCheckout.getSelectPaymentMethodElement = function () {
    var $selectPaymentMethodInner = $('.payment-options .nav-link.active');

    var $selectPaymentMethod = $selectPaymentMethodInner.parent();

    return $selectPaymentMethod;
};

KlarnaCheckout.getSelectedPaymentMethod = function () {
    var methodId = this.getSelectPaymentMethodElement().attr('data-method-id');

    var klarnaMethodId = methodId.replace(this.prefix + '_', '');

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

/**
 * Execute a Klarna API call to Load payment data for a specified Klarna payment category.
 * 
 * Note: Klarna JS client automatically refreshes the contents of the passed container.
 * 
 * @param {string} paymentCategory Klarna payment category.
 */
KlarnaCheckout.loadPaymentData = function (paymentCategory) {
    var klarnaPaymentMethod = this.getKlarnaPaymentMethod(paymentCategory);

    var containerName = '#klarna_payments_' + klarnaPaymentMethod + '_container';

    var updateData = {
        billing_address: this.obtainBillingAddressData()
    };

    if (this.userHasEnteredShippingAddress()) {
        updateData.shipping_address = this.obtainShippingAddressData();
    }

    Klarna.Payments.load({
        container: containerName,
        payment_method_category: klarnaPaymentMethod
    }, updateData, function (res) {
        var $klarnaSubmitPaymentBtn = this.getKlarnaSubmitPaymentBtn();
        $klarnaSubmitPaymentBtn.prop('disabled', !res.show_form);
    }.bind(this));
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
            objects: window.KlarnaPaymentsObjects
        });
    });
};
