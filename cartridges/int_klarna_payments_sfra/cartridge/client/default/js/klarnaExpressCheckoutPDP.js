
'use strict';

$(function () {
    //handle express checkout button on variation change
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

    //handle express checkout button on pdp load, hide it for subscription only products
    if ($('#klarnaExpressCheckoutPDP').data('subscriptiononly')) {
        $('#klarnaExpressCheckoutPDP').hide();
    }
});