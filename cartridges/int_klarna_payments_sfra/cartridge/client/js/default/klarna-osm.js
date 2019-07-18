$(function () {
    $('body').on('product:afterAttributeSelect', function (e, response) {
        if (response.data.product.price.sales) {
            document.getElementsByTagName('klarna-placement')[0].setAttribute('data-purchase_amount', Math.round(response.data.product.price.sales.value * 100));
            window.KlarnaOnsiteService.push({ eventName: 'refresh-placements' });
        }
    });
});
