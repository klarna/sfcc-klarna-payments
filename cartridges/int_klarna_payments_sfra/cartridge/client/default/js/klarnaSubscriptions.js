/* global $ */

/**
 * appends params to a url
 * @param {string} url - Original url
 * @param {Object} params - Parameters to append
 * @returns {string} result url with appended parameters
 */
function appendToUrl(url, params) {
    var newUrl = url;
    newUrl += (newUrl.indexOf('?') !== -1 ? '&' : '?') + Object.keys(params).map(function (key) {
        return key + '=' + encodeURIComponent(params[key]);
    }).join('&');

    return newUrl;
}

/**
 * Create an alert to display the error message
 * @param {Object} message - Error message to display
 */
function createErrorNotification(message) {
    var errorHtml = '<div class="alert alert-danger alert-dismissible valid-cart-error ' +
        'fade show" role="alert">' +
        '<button type="button" class="close" data-dismiss="alert" aria-label="Close">' +
        '<span aria-hidden="true">&times;</span>' +
        '</button>' + message + '</div>';

    $('.error-messaging').append(errorHtml);
}

/**
 * Checks whether the basket is valid. if invalid displays error message and disables
 * checkout button
 * @param {Object} data - AJAX response from the server
 */
function validateBasket(data) {
    if (data.valid.error) {
        if (data.valid.message) {
            var errorHtml = '<div class="alert alert-danger alert-dismissible valid-cart-error ' +
                'fade show" role="alert">' +
                '<button type="button" class="close" data-dismiss="alert" aria-label="Close">' +
                '<span aria-hidden="true">&times;</span>' +
                '</button>' + data.valid.message + '</div>';

            $('.cart-error').append(errorHtml);
        } else {
            $('.cart').empty().append('<div class="row"> ' +
                '<div class="col-12 text-center"> ' +
                '<h1>' + data.resources.emptyCartMsg + '</h1> ' +
                '</div> ' +
                '</div>'
            );
            $('.number-of-items').empty().append(data.resources.numberOfItems);
            $('.minicart-quantity').empty().append(data.numItems);
            $('.minicart-link').attr({
                'aria-label': data.resources.minicartCountOfItems,
                title: data.resources.minicartCountOfItems
            });
            $('.minicart .popover').empty();
            $('.minicart .popover').removeClass('show');
        }

        $('.checkout-btn').addClass('disabled');
    } else {
        $('.checkout-btn').removeClass('disabled');
        $('.cart-error').empty();
    }
}

/**
 * replace content of modal
 * @param {string} actionUrl - url to be used to remove product
 * @param {string} productID - pid
 * @param {string} productName - product name
 * @param {string} uuid - uuid
 */
function confirmCancellation(actionUrl, subid) {
    var $deleteConfirmBtn = $('.cancel-subscription-confirmation-btn');

    $deleteConfirmBtn.data('action', actionUrl);
    $deleteConfirmBtn.data('subid', subid);
}

function generateCancellationMessage(messageType, message) {
    if ($('.cancel-subscription-messages').length === 0) {
        $('body').append(
            '<div class="cancel-subscription-messages add-to-cart-messages"></div>'
        );
    }

    $('.cancel-subscription-messages').append(
        '<div class="alert ' + messageType + ' cancel-subscription-alert add-to-basket-alert text-center" role="alert">'
        + message
        + '</div>'
    );

    setTimeout(function () {
        $('.cancel-subscription-alert').remove();
    }, 3000);
}

$(function () {
    $('body').on('change', '.kp-subscription', function () {
        var isSubscribed = $(this).is(":checked");
        var productID = $(this).data('pid');
        var url = $(this).data('action');
        var uuid = $(this).data('uuid');

        var urlParams = {
            pid: productID,
            subscription: isSubscribed,
            uuid: uuid
        };
        url = appendToUrl(url, urlParams);

        $(this).parents('.card').spinner().start();

        $('body').trigger('cart:beforeUpdate');

        $.ajax({
            url: url,
            type: 'get',
            context: this,
            dataType: 'json',
            success: function (data) {
                $('.checkout-btn').removeClass('disabled');
                $('.cart-error').empty();
                validateBasket(data.basket);
                if (data.isSubscriptionBasket) {
                    $('.subscription-data').show();
                } else {
                    $('.subscription-data').hide();
                }
                $.spinner().stop();
            },
            error: function (err) {
                if (err.responseJSON.redirectUrl) {
                    window.location.href = err.responseJSON.redirectUrl;
                } else {
                    createErrorNotification(err.responseJSON.errorMessage);
                    $.spinner().stop();
                }
            }
        });
    });

    $('body').on('change', '.subscription-period, .subscription-frequency', function () {
        var selectedValue = $('option:selected', this).val();
        var url = $(this).data('url');
        var subscriptionField = $(this).data('field');

        var urlParams = {
            selectedValue: selectedValue,
            subscriptionField: subscriptionField
        };
        url = appendToUrl(url, urlParams);

        $('.cart-page').spinner().start();

        $.ajax({
            url: url,
            type: 'get',
            context: this,
            dataType: 'json',
            success: function (data) {
                if (data.error) {
                    console.error(data.errorMessage);
                }
                $.spinner().stop();
            },
            error: function (err) {
                if (err.responseJSON.redirectUrl) {
                    window.location.href = err.responseJSON.redirectUrl;
                } else {
                    if (err.responseJSON.errorMessage) {
                        createErrorNotification(err.responseJSON.errorMessage);
                    }
                    $.spinner().stop();
                }
            }
        });
    });

    $('body').on('click', '.cancel-subscription', function (e) {
        e.preventDefault();

        var actionUrl = $(this).data('action');
        var subid = $(this).data('subid');
        confirmCancellation(actionUrl, subid);
    });

    $('body').on('click', '.cancel-subscription-confirmation-btn', function (e) {
        e.preventDefault();

        var url = $(this).data('action');
        var subid = $(this).data('subid');
        var urlParams = {
            subid: subid
        };

        url = appendToUrl(url, urlParams);

        $('body > .modal-backdrop').remove();

        $.spinner().start();

        $.ajax({
            url: url,
            type: 'get',
            dataType: 'json',
            success: function (data) {
                var messageType = data.error ? 'alert-danger' : 'alert-success';
                var message = data.message;
                if (!data.error) {
                    var cancelBtn = $('[data-subid = ' + subid + ']');
                    cancelBtn.prop('disabled', true);
                    cancelBtn.closest('.card').find('.subscription-status').text(data.statusMsg);
                    cancelBtn.closest('.card').find('.subscription-status').addClass('subscription-error');
                }

                generateCancellationMessage(messageType, message);

                $.spinner().stop();
            },
            error: function (err) {
                if (err.responseJSON.redirectUrl) {
                    window.location.href = err.responseJSON.redirectUrl;
                } else {
                    createErrorNotification(err.responseJSON.errorMessage);
                    $.spinner().stop();
                }
            }
        });
    });

    $('body').on('cart:update', function (e, data) {
        if (data && (data.hasOwnProperty('basket') || data.hasOwnProperty('valid'))) {
            var cartObj = data.hasOwnProperty('basket') ? data.basket : data;
            if (cartObj.isSubscriptionBasket) {
                $('.subscription-data').show();
            } else {
                $('.subscription-data').hide();
            }
            $('.checkout-btn').removeClass('disabled');
            $('.cart-error').empty();
            validateBasket(cartObj);
        }
    });
});
