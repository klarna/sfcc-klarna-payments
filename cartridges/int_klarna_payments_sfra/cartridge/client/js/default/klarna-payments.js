/* globals $, Klarna */

var KlarnaCheckout = {
    initStages: {},
    stageDefer: null,
    currentStage: null,
    klarnaPaymentsUrls: null,
    klarnaPaymentsObjects: null,
    prefix: 'klarna'
};

KlarnaCheckout.getCookie = function (name) {
    var value = '; ' + document.cookie;
    var parts = value.split('; ' + name + '=');
    if (parts.length === 2) {
        return parts.pop().split(';').shift();
    }
    return '';
};

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
    var promise = null;

    switch (stage) {
        case 'shipping':
            promise = this.initShippingStage();
            break;
        case 'payment':
            promise = this.initPaymentStage();
            break;
        case 'placeOrder':
            promise = this.initPlaceOrderStage();
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

KlarnaCheckout.initShippingStage = function () {
    var defer = $.Deferred(); // eslint-disable-line

    defer.resolve();

    return defer;
};

KlarnaCheckout.initPaymentStage = function () {
    var defer = $.Deferred(); // eslint-disable-line

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

    return defer;
};

KlarnaCheckout.initPlaceOrderStage = function () {
    var defer = $.Deferred(); // eslint-disable-line

    Klarna.Payments.init({
        client_token: this.klarnaPaymentsObjects.clientToken
    });

    this.initKlarnaPlaceOrderButton();

    defer.resolve();

    return defer;
};

KlarnaCheckout.handleUpdateCheckoutView = function (data) {
    var order = data.order;

    if (!order.billing.payment || !order.billing.payment.selectedPaymentInstruments
		|| !order.billing.payment.selectedPaymentInstruments.length > 0) {
        return;
    }

    this.updatePaymentSummary(order, data.options);
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

KlarnaCheckout.getKlarnaPaymentOptionTabs = function () {
    return $('.klarna-payment-item');
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

KlarnaCheckout.refreshPlaceOrderStage = function () {
    var $klarnaPlaceOrderBtn = $('.klarna-place-order');
    $klarnaPlaceOrderBtn.show();
    $klarnaPlaceOrderBtn.prop('disabled', false);
};

KlarnaCheckout.createPaymentOptionTab = function (klarnaPaymentCategory) {
    var html =
        '<li class="nav-item klarna-payment-item" data-method-id="klarna_' + klarnaPaymentCategory.identifier + '">' +
            '<a class="nav-link klarna-payments-' + klarnaPaymentCategory.identifier + '-tab" data-toggle="tab" href="#klarna_payments_' + klarnaPaymentCategory.identifier + '" role="tab">' +
                '<img class="credit-card-option"' +
                    'src="' + klarnaPaymentCategory.asset_urls.standard + '"' +
                    'height="32"' +
                    'alt="' + klarnaPaymentCategory.name + '"' +
                    'title="' + klarnaPaymentCategory.name + '"' +
                '/>' +
            '</a>' +
        '</li>';

    return $(html);
};

KlarnaCheckout.createPaymentOptionTabContent = function (klarnaPaymentCategory) {
    var html =
        '<div class="tab-pane klarna_payments-content klarna_payments_' + klarnaPaymentCategory.identifier + '-content" id="klarna_payments_' + klarnaPaymentCategory.identifier + '" role="tabpanel">' +
            '<input type="hidden" class="form-control" name="isKlarna" value="true" disabled="disabled" />' +
            '<input type="hidden" class="form-control" name="' + this.klarnaPaymentsObjects.paymentMethodHtmlName + '" value="KLARNA_PAYMENTS" disabled="disabled" />' +
            '<input type="hidden" class="form-control" name="' + this.klarnaPaymentsObjects.paymentCategoryHtmlName + '" value="' + klarnaPaymentCategory.identifier + '" disabled="disabled" />' +
            '<div id="klarna_payments_' + klarnaPaymentCategory.identifier + '_container" style="text-align: center;"></div>' +
        '</div>';

    return $(html);
};

KlarnaCheckout.initPaymentOptionsTabs = function () {
    var _this = this;
    var $paymentOptionsTabs = $('.payment-options a[data-toggle="tab"]');

    $paymentOptionsTabs.on('shown.bs.tab', function (e) {
        var $clickedTabLink = $(e.target);

        if ($clickedTabLink.parent('li').hasClass('klarna-payment-item')) {
            _this.getKlarnaEmailContainer().removeClass('hide');
        } else {
            _this.getKlarnaEmailContainer().addClass('hide');
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

KlarnaCheckout.getKlarnaPaymentMethod = function (methodId) {
    var klarnaMethodId = methodId.replace(this.prefix + '_', '');

    return klarnaMethodId;
};

KlarnaCheckout.handleFinalizeRequired = function () {
    var $placeOrderBtn = $('.place-order');
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

KlarnaCheckout.getKlarnaSubmitPaymentBtn = function () {
    return $('.klarna-submit-payment');
};

KlarnaCheckout.isKlarnaEmailValid = function () {
    var $emailField = this.getKlarnaEmail();
    var regExpPattern = $emailField.attr('pattern');
    var maxlength = parseInt($emailField.attr('maxlength'));
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

KlarnaCheckout.markKlarnaEmailInvalid = function () {
    var $emailField = this.getKlarnaEmail();

    $emailField.next('.invalid-feedback').html('This field is required').show();
};

KlarnaCheckout.markKlarnaEmailValid = function () {
    var $emailField = this.getKlarnaEmail();

    $emailField.next('.invalid-feedback').hide();
};

KlarnaCheckout.getKlarnaEmail = function () {
    var $emailField = $('.payment-form .klarna_email');

    return $emailField;
};

KlarnaCheckout.getKlarnaEmailContainer = function () {
    var $emailField = this.getKlarnaEmail();

    return $emailField.parent('.form-group');
};

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
    var $addressSelectorElement = $paymentForm.find('.addressSelector');
    var $selectedOption = $addressSelectorElement.find(':selected');

    if ($selectedOption.val() === 'new') {
        var $billingAddressForm = $('.billing-address');

        address.given_name = $billingAddressForm.find('.billingFirstName').val();
        address.family_name = $billingAddressForm.find('.billingLastName').val();
        address.street_address = $billingAddressForm.find('.billingAddressOne').val();
        address.street_address2 = $billingAddressForm.find('.billingAddressTwo').val();
        address.city = $billingAddressForm.find('.billingAddressCity').val();
        address.region = $billingAddressForm.find('.billingState').val();
        address.postal_code = $billingAddressForm.find('.billingZipCode').val();
        address.country = $billingAddressForm.find('.billingCountry').val();
        address.phone = $billingAddressForm.find('.billingPhoneNumber').val();
        address.email = this.getKlarnaEmail().val();
    } else {
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

KlarnaCheckout.userHasEnteredShippingAddress = function () {
    var $shipmentUUIDElement = $('.single-shipping .shipping-form').find('.shipmentUUID');

    return ($shipmentUUIDElement.value !== '');
};

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
