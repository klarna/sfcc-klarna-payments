/* global $ */

'use strict';

$(function () {
    $('body').on('product:afterAttributeSelect', function (e, response) {
        if (response.data.product.price.sales) {
            var formattedAmount = response.data.product.price.sales.value * 100;
            var element = document.querySelector('[data-key="credit-promotion-auto-size"]');
            if (element) {
                element.dataset.amount = formattedAmount;
            }
        }
    });
    $('body').on('cart:update cart:updateCartTotals cart:shippingMethodSelected promotion:success', (e, response) => {
        if (!response) {
            return;
        }

        var klarnaTotal = null;
        if (response.totals && response.totals.klarnaTotal) {
            klarnaTotal = response.totals.klarnaTotal;
        } else if (response.cartModel && response.cartModel.totals && response.cartModel.totals.klarnaTotal) {
            klarnaTotal = response.cartModel.totals.klarnaTotal;
        } else if (response.basket && response.basket.totals && response.basket.totals.klarnaTotal) {
            klarnaTotal = response.basket.totals.klarnaTotal;
        }

        if (!klarnaTotal) {
            return;
        }
        var element = document.querySelector('[data-key="credit-promotion-badge"]');
        if (element) {
            element.dataset.amount = klarnaTotal;
        }
    });
});

/**
 * Initialize Klarna Onsite Messaging display
 * @param {Object} klarna - klarna sdk object
 * @param {string} osmLocation - location to mount OSM
 * @param {number} osmPayload - osm payload
 */
function initOSMDisplay(klarna, osmLocation, osmPayload) {
    klarna.Messaging.placement(osmPayload).mount(osmLocation);
}

document.body.addEventListener('init:KlarnaOSM', function (e) {
    var data = e.detail;
    var purchaseAmount = data.amount && Number(data.amount) ? Number(data.amount) : null;
    var osmLocation = '.' + data.osmLocation;
    var klarna = data.klarnaSDK;
    var osmPayload = {
        key: data.key,
        locale: data.locale,
        theme: data.theme
    };
    if (purchaseAmount) {
        osmPayload.amount = purchaseAmount;
    }
    initOSMDisplay(klarna, osmLocation, osmPayload);
});
