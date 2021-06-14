/* globals $, Klarna */

window.klarnaExpressButtonAsyncCallback = function () {
    $(function () {
        Klarna.ExpressButton.on('user-authenticated', function (callbackData) {
            var $klarnaForm = $('.klarna-express-form');
            if ($klarnaForm.length > 0 && callbackData && callbackData.address) {
                // clear previous values
                $klarnaForm.find('.klarna-express-input').val('');

                $klarnaForm.find('[name$="_email"]').val(callbackData.email);
                $klarnaForm.find('[name$="_phone"]').val(callbackData.phone);
                $klarnaForm.find('[name$="_firstName"]').val(callbackData.first_name);
                $klarnaForm.find('[name$="_lastName"]').val(callbackData.last_name);

                $klarnaForm.find('[name$="_address1"]').val(callbackData.address.street_address);
                $klarnaForm.find('[name$="_address2"]').val(callbackData.address.street_address2 || '');
                $klarnaForm.find('[name$="_city"]').val(callbackData.address.city);
                $klarnaForm.find('[name$="_stateCode"]').val(callbackData.address.region);
                $klarnaForm.find('[name$="_postalCode"]').val(callbackData.address.postal_code);
                $klarnaForm.find('[name$="_countryCode"]').val(callbackData.address.country);

                $klarnaForm.submit();
            }
        });
    });
};
