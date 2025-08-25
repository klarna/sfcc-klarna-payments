/* global $ */

$(function () {
    $('body').on('product:afterAttributeSelect', function (e, response) {
        if (typeof window.Klarna !== 'undefined' && window.Klarna.OnsiteMessaging && response.data.product.price.sales) {
            let klarnaPlacementPDP = document.querySelector('.kosm-pdp').getElementsByTagName('klarna-placement')[0];
            klarnaPlacementPDP.setAttribute('data-purchase-amount', (response.data.product.price.sales.value * 100));
            window.Klarna.OnsiteMessaging.refresh();
        }
    });
});
