
'use strict';

$(function () {
    $('body').on('product:afterAttributeSelect', function (e, response) {
        if (response.data.product.isSubscriptionOnly) {
            $('#klarnaExpressCheckoutPDP').hide();
        } else {
            $('#klarnaExpressCheckoutPDP').show();
        }
        if (!response.data.product.readyToOrder || !response.data.product.available) {
            $('#klarnaExpressCheckoutPDP').attr('disabled', 'disabled');
        } else {
            $('#klarnaExpressCheckoutPDP').removeAttr('disabled');
        }
    });

    if ($('#klarnaExpressCheckoutPDP').data('subscriptiononly')) {
        $('#klarnaExpressCheckoutPDP').hide();
    }
});