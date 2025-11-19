'use strict';

var klarnaPreferences = window.KPPreferences;
var klarnaPaymentsUrls = window.KlarnaPaymentsUrls;
var klarnaPaymentsResources = window.KPResources;
var klarnaPaymentsConstants = window.KPConstants;

/*
 * Build and display error message
 */
function generateErrorAuthMessage( message ) {
    setTimeout( function() {
        var msg = message ? message : klarnaPaymentsResources.kpExpressCheckoutAuthFailure;
        alert( msg ); // eslint-disable-line no-alert
    }, klarnaPaymentsConstants.KEC_EEROR_WAITTIME );
}

/**
 * Init Klarna Express Chekout button in Mini Carts
 * @returns {void}
 */
function initMiniCartButton() {
    var originalKEC = document.querySelector( '.mini-cart-content .kec-cart .klarna-express-mini-cart' );
    if ( originalKEC && originalKEC.shadowRoot ) {
        var originalButton = originalKEC.shadowRoot.querySelector( 'button' );
        if ( !originalButton ) {
            initKlarnaExpressButton( '#klarnaExpressCheckoutMiniCart', false );
        }
    } else {
        initKlarnaExpressButton( '#klarnaExpressCheckoutMiniCart', false );
    }
}

/**
 * Initialize Klarna Express Checkout button
 * @param {String} containerId id of the container element
 * @param {Boolean} isPDP flag for pdp call
 * @returns {void}
 */
function initKlarnaExpressButton( containerId, isPDP ) {
    window.Klarna.Payments.Buttons.init( {
        client_id: klarnaPreferences.kpExpressCheckoutClientKey
    } ).load( {
        container: containerId,
        theme: klarnaPreferences.kpExpressCheckoutTheme,
        shape: klarnaPreferences.kpExpressCheckoutShape,
        locale: klarnaPreferences.kpLocale,
        on_click: ( authorize ) => {
            // Here you should invoke authorize with the order payload.
            var formData = '';
            if ( isPDP ) {
                var isDisabled = $( '#add-to-cart' ).attr( 'disabled' );
                if ( isDisabled ) {
                    generateErrorAuthMessage( klarnaPaymentsResources.kpExpressSelectStyles );
                    return;
                }
                var $form = $( '#add-to-cart' ).closest( 'form' ),
                    $qty = $form.find( 'input[name="Quantity"]' );
                if ( $qty.length === 0 || isNaN( $qty.val() ) || parseInt( $qty.val(), 10 ) === 0 ) {
                    $qty.val( '1' );
                }
                formData = $form.serialize();
            }
            var url = klarnaPaymentsUrls.generateExpressCheckoutPayload + '?populateAddress=false&isPDP=' + isPDP;
            $.ajax( {
                url: url,
                type: 'POST',
                dataType: 'json',
                data: formData,
                success: function( data ) {
                    if ( data.status === 'OK' ) {
                        data.payload.merchant_urls = {
                            'authorization': klarnaPaymentsUrls.expressCheckoutAuthCallback
                        };
                        authorize(
                            { collect_shipping_address: true, auto_finalize: false },
                            data.payload,
                            ( result ) => {
                                if ( result.approved ) {
                                    $.ajax( {
                                        url: klarnaPaymentsUrls.handleExpressCheckoutAuth,
                                        type: 'post',
                                        dataType: 'json',
                                        contentType: 'application/json',
                                        data: JSON.stringify( result ),
                                        success: function( response ) {
                                            if ( response.redirectUrl ) {
                                                window.location.href = response.redirectUrl;
                                            }
                                        }
                                    } );
                                } else {
                                    if ( isPDP ) {
                                        $.ajax( {
                                            url: klarnaPaymentsUrls.handleAuthFailurePDP,
                                            type: 'get',
                                            dataType: 'json',
                                            contentType: 'application/json'
                                        } );
                                    }
                                    generateErrorAuthMessage();
                                }
                            } );
                    } else {
                        if ( data.status === 'ERROR' && data.redirectUrl ) {
                            window.location.href = data.redirectUrl;
                        }
                    }
                },
                error: function( err ) {
                    console.log( err ); // eslint-disable-line no-console
                }
            } );
        }
    },
    function load_callback( loadResult ) {
        // Here you can handle the result of loading the button
    } );
}

window.klarnaAsyncCallback = function() {
    var klarnaExpressCheckout = document.querySelector( '#klarnaExpressCheckout' );
    var klarnaExpressCheckoutMiniCart = document.querySelector( '#klarnaExpressCheckoutMiniCart' );
    var klarnaExpressCheckoutBottom = document.querySelector( '#klarnaExpressCheckoutBottom' );
    var klarnaExpressCheckoutPDP = document.querySelector( '#klarnaExpressCheckoutPDP' );

    if ( klarnaExpressCheckout ) {
        initKlarnaExpressButton( '#klarnaExpressCheckout', false );
    }

    if ( klarnaExpressCheckoutMiniCart ) {
        initMiniCartButton();
    }
    if ( klarnaExpressCheckoutBottom ) {
        initKlarnaExpressButton( '#klarnaExpressCheckoutBottom', false );
    }
    if ( klarnaExpressCheckoutPDP ) {
        initKlarnaExpressButton( '#klarnaExpressCheckoutPDP', true );
    }
};

/*eslint-disable wrap-iife */
var klarnaExpressCheckout = ( function() {

    function klarnaExpressCheckoutPDP() {
        var klarnaExpressCheckoutPDP = document.querySelector( '#klarnaExpressCheckoutPDP' ); // eslint-disable-line no-shadow
        if ( klarnaExpressCheckoutPDP ) {
            initKlarnaExpressButton( '#klarnaExpressCheckoutPDP', true );
        }
    }

    function klarnaExpressCheckoutMiniCart() {
        var klarnaExpressCheckoutMiniCart = document.querySelector( '#klarnaExpressCheckoutMiniCart' ); // eslint-disable-line no-shadow
        if ( klarnaExpressCheckoutMiniCart ) {
            initMiniCartButton();
        }
    }

    return {
        klarnaExpressCheckoutPDP: klarnaExpressCheckoutPDP,
        klarnaExpressCheckoutMiniCart: klarnaExpressCheckoutMiniCart
    };
} )();