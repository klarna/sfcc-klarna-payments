( function() {
    function getCookie( name ) { //eslint-disable-line
        var value = "; " + document.cookie;
        var parts = value.split( "; " + name + "=" );
        if ( parts.length === 2 ) {
            return parts.pop().split( ";" ).shift();
        }
    }

    var klarnaPaymentsUrls = window.KlarnaPaymentsUrls;
    var klarnaPaymentsObjects = window.KlarnaPaymentsObjects;
    var klarnaPaymentsPreferences = window.KPPreferences;
    var $summaryFooter = document.getElementsByClassName( 'order-summary-footer' )[0];
    var $form = document.getElementsByClassName( 'submit-order' )[0];

    var $placeOrderBtn = document.getElementsByName( 'submit' )[0];

    window.klarnaAsyncCallback = function() {
        Klarna.Payments.init( {
            client_token: klarnaPaymentsObjects.clientToken
        } );
        var paymentMethodCategoryId = getCookie( "selectedKlarnaPaymentCategory" );

        if ( isKlarnaPaymentCategory( paymentMethodCategoryId ) ) {             
            loadPaymentData( '#klarna_payments_' + paymentMethodCategoryId + '_container', paymentMethodCategoryId );
        }
    };

    var placeOrderBtnClickEventListener = function( event ) {

        var paymentMethodCategoryId = getCookie( "selectedKlarnaPaymentCategory" );

        if ( isKlarnaPaymentCategory( paymentMethodCategoryId ) ) { 
            event.preventDefault();
            $placeOrderBtn.disabled = true;

            var klarnaRequestData = {
                billing_address: obtainBillingAddressData()
            };

            var hasShippingAddress = document.querySelectorAll( '#shipping_address_firstName' )[0] ? true : false;

            if ( hasShippingAddress ) {
                klarnaRequestData.shipping_address = obtainShippingAddressData( klarnaRequestData.billing_address );
            }

            if ( window.KPCustomerInfo && window.KPCustomerInfo.attachment ) {
                var kpAttachment = window.KPCustomerInfo.attachment;

                var kpAttachmentBody = JSON.parse( kpAttachment.body );
                var otherAddresses = getMultiShipOtherAddresses( klarnaRequestData.billing_address );

                kpAttachmentBody.other_delivery_address = otherAddresses;
                kpAttachment.body = JSON.stringify( kpAttachmentBody );

                klarnaRequestData.attachment = kpAttachment;
            }

            Klarna.Payments.authorize( {
                payment_method_category: paymentMethodCategoryId,
                auto_finalize: klarnaPaymentsObjects.kpBankTransferCallback ? false : true
            }, klarnaRequestData , function( res ) {
                if ( res.approved ) {
                    var xhr = new XMLHttpRequest();
                    xhr.open( 'GET', klarnaPaymentsUrls.saveAuth, true );

                    xhr.setRequestHeader( 'Content-type', 'application/json; charset=utf-8' );
                    xhr.setRequestHeader( 'X-Auth', res.authorization_token );
                    xhr.setRequestHeader( 'Finalize-Required', res.finalize_required );

                    xhr.onreadystatechange = function() {
                        if ( xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200 ) {
                            $placeOrderBtn.removeEventListener( "click", placeOrderBtnClickEventListener );

                             //DE banktransfer two-step confirmation
                             if (res.finalize_required) {
                                // Place Order
                                if ( $form && klarnaPaymentsObjects.kpBankTransferCallback) {
                                    var action = $form.action;
                                    var csrfToken = $form.csrf_token.value;

                                    xhr = new XMLHttpRequest();
                                    var formData = new FormData();
                                    formData.append( 'csrf_token', csrfToken );

                                    xhr.open( "POST", action, true );
                                    xhr.onreadystatechange = function() {
                                        if ( xhr.readyState === XMLHttpRequest.DONE ) {
                                            console.log( 'Order has been created (BT callback is in progress)' ); // eslint-disable-line
                                        }
                                    };
                                    xhr.send( formData );
                                } else {
                                    console.error( 'Form not found! Order cannot be created!' ); // eslint-disable-line
                                }
                                Klarna.Payments.finalize( {
                                    payment_method_category: paymentMethodCategoryId
                                }, {}, function( res ) {
                                    if ( res.approved ) {
                                        if ( !klarnaPaymentsObjects.kpBankTransferCallback ) {
                                            xhr = new XMLHttpRequest();
                                            xhr.open( "GET", klarnaPaymentsUrls.saveAuth, true );
                            
                                            xhr.setRequestHeader( "Content-type", "application/json; charset=utf-8" );
                                            xhr.setRequestHeader( "X-Auth", res.authorization_token );
                            
                                            xhr.onreadystatechange = function() {
                                                if ( xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200 ) {
                                                    $placeOrderBtn.disabled = false;
                                                    $placeOrderBtn.click();
                                                }
                                            };
                                            xhr.send();
                                        } else {                                        
                                            // Await for a redirect for 20 seconds
                                            var $loader = document.createElement('div');
                                            $loader.className = 'loader';
                                            $loader.innerHTML = '<div class="loader-indicator"></div><div class="loader-bg"></div>';
                                            document.body.append($loader);
                                            
                                            var numOfTries = 11;
                                            var currentUrl = location.href;
                                            var newUrl = '';
                                            var interval = setInterval( function() {
                                                if ( numOfTries === 0 ) {
                                                    clearInterval( interval );
                                                    $errorBlock.style.display = 'block';
                                                    $($loader).hide();
                                                    return;
                                                }
                                                numOfTries--;
                                                xhr.open( "GET", klarnaPaymentsUrls.bankTransferAwaitCallback + '?session_id=' + klarnaPaymentsObjects.sessionID, true );
                                                xhr.setRequestHeader( "Content-type", "application/json; charset=utf-8" );
                                                xhr.setRequestHeader( "X-Auth", res.authorization_token );
                                                xhr.onreadystatechange = function() {
                                                    var response = xhr.response;
                                                    try {
                                                        if (response) {
                                                            var jsonResponse = JSON.parse( response );
                                                            if ( jsonResponse.redirectUrl && jsonResponse.redirectUrl !== currentUrl && jsonResponse.redirectUrl !== newUrl && jsonResponse.redirectUrl !== 'undefined' ) {
                                                                clearInterval( interval );
                                                                newUrl = jsonResponse.redirectUrl;
                                                                location.href = jsonResponse.redirectUrl;
                                                            }
                                                        } else {
                                                            return;
                                                        }
                                                    } catch ( e ) {
                                                        console.debug(e); // eslint-disable-line
                                                    }
                                                };
                                                xhr.send();
                                            }, 2000 );
                                        }
                                    } else {
                                        if ( klarnaPaymentsObjects.kpBankTransferCallback ) {
                                            // If the payment isn't approved or popup is closed,
                                            // then recreate Basket.
                                            // In case of error, show error message
                                            xhr.open( "POST", klarnaPaymentsUrls.failOrder + '?session_id=' + klarnaPaymentsObjects.sessionID, true );
                                            xhr.setRequestHeader( "Content-type", "application/json; charset=utf-8" );
                                            xhr.onreadystatechange = function() {
                                                if ( xhr.readyState === XMLHttpRequest.DONE ) {
                                                    var response = xhr.response;
                                                    try {
                                                        var jsonResponse = JSON.parse( response );
                                                        if ( jsonResponse && !jsonResponse.success ) {
                                                            $errorBlock.style.display = 'block';
                                                        }
                                                    } catch ( e ) {
                                                        console.debug(e); // eslint-disable-line
                                                    }
                                                }
                                            };
                                            xhr.send();
                                        }
                                    }
                                } );
                            } else {
                                $placeOrderBtn.disabled = false;
                                $placeOrderBtn.click();
                            }
                        }
                    };
                    xhr.send();
                } else {
                    $placeOrderBtn.disabled = false;
                }
                if ( !res || res.error ) {
                    writeAdditionalLog( res, 'klarna-payments-alternative-flow.js:Klarna.Payments.load()', 'SG Storefront Ajax Request Error.' );
                }
            } );
        } else {
            //for other payment methods
            $placeOrderBtn.removeEventListener( "click", placeOrderBtnClickEventListener );
            $placeOrderBtn.click();
        }
    };

    /**
     * @function
     * @description checks if the given payment method ID is Klarna payment category.
     * @param {string} paymentCategory the payment category ID
     * @returns {void}
     */
    function isKlarnaPaymentCategory( paymentCategory ) {
        var $klarnaPaymentCategories = JSON.parse( document.getElementById( 'klarna-payment-categories' ).value );

        for ( var i = 0; i < $klarnaPaymentCategories.length; ++i ) {
            var $klarnaPaymentCategory = $klarnaPaymentCategories[i];

            if ( paymentCategory === $klarnaPaymentCategory.identifier ) {
                return true;
            }
        }
        return false;
    }

    function obtainShippingAddressData( billingAddress ) {
        var address = {
            given_name: document.querySelectorAll( '#shipping_address_firstName' )[0].value,
            family_name: document.querySelectorAll( '#shipping_address_lastName' )[0].value,
            title: '',
            street_address: document.querySelectorAll( '#shipping_address_address1' )[0].value,
            street_address2: document.querySelectorAll( '#shipping_address_address2' )[0].value,
            postal_code: document.querySelectorAll( '#shipping_address_postalCode' )[0].value,
            city: document.querySelectorAll( '#shipping_address_city' )[0].value,
            region: document.querySelectorAll( '#shipping_address_stateCode' )[0].value,
            phone: document.querySelectorAll( '#shipping_address_phone' )[0].value,
            country: document.querySelectorAll( '#shipping_address_countryCode' )[0].value,
            email: billingAddress.email
        };

        // check if first shipment is store one and if so - update first & lastName
        var $defaultShipment = document.querySelectorAll( '.klarna_payments_shipment_data' )[0];
        var shipmentType = $defaultShipment.getAttribute( 'data-shipment-type' );

        if ( shipmentType === 'instore' && billingAddress ) {
            if ( billingAddress.given_name !== '' ) {
                address.given_name = billingAddress.given_name;
            }

            if ( billingAddress.family_name !== '' ) {
                address.family_name = billingAddress.family_name;
            }
        }

        return address;
    }

    function obtainBillingAddressData() {
        var address = {
            given_name: document.querySelectorAll( '#billing_address_firstName' )[0].value,
            family_name: document.querySelectorAll( '#billing_address_lastName' )[0].value,
            email: document.querySelectorAll( '#billing_address_email' )[0].value,
            title: '',
            street_address: document.querySelectorAll( '#billing_address_address1' )[0].value,
            street_address2: document.querySelectorAll( '#billing_address_address2' )[0].value,
            postal_code: document.querySelectorAll( '#billing_address_postalCode' )[0].value,
            city: document.querySelectorAll( '#billing_address_city' )[0].value,
            region: document.querySelectorAll( '#billing_address_stateCode' )[0].value,
            phone: document.querySelectorAll( '#billing_address_phone' )[0].value,
            country: document.querySelectorAll( '#billing_address_countryCode' )[0].value.toUpperCase()
        };

        return address;
    }

    function getMultiShipOtherAddresses( billingAddress ) {
        var addressesArr = [];
        var $multiShippingAddresses = document.querySelectorAll( '.klarna_payments_shipment_data' );

        for ( var i = 0; i < $multiShippingAddresses.length; i++ ) {
            var $shippingAddress = $multiShippingAddresses[i];
            var shipmentType = $shippingAddress.getAttribute( 'data-shipment-type' );

            if ( shipmentType === 'instore' ) {
                var address = buildOtherAddressData( $shippingAddress, billingAddress );
                addressesArr.push( address );
            }
        }

        return addressesArr;
    }

    function loadPaymentData( containerName, paymentCategory, requestData ) {
        Klarna.Payments.load( {
            container: containerName,
            payment_method_category: paymentCategory
        }, requestData || {} , function( res ) {
            if ( !res.show_form ) {
                $placeOrderBtn.disabled = true;
            }
            if ( !res || res.error ) {
                writeAdditionalLog( res, 'klarna-payments-alternative-flow.js:Klarna.Payments.load()', 'SG Storefront Ajax Request Error.' );
            }
        } );
    }

    function writeAdditionalLog ( res, action, msg ) {
        if ( klarnaPaymentsPreferences.kpAdditionalLogging ) {
            $.ajax({
                url: klarnaPaymentsUrls.writeLog,
                method: 'POST',
                data: {
                    responseFromKlarna: JSON.stringify(res),
                    actionName: action,
                    message: msg
                }
            })
        }    
    };

    $placeOrderBtn.addEventListener( "click", placeOrderBtnClickEventListener );
    
    if ( klarnaPaymentsObjects.kpBankTransferCallback ) {
        // Create Error Block
        var $errorMessageText = document.createElement( 'div' );
        $errorMessageText.className = 'error-message-text';
        $errorMessageText.innerText = window.serverErrorMessage;
        $errorMessageText.style.background = '#ff3333';
        $errorMessageText.style.border = '1px solid black';
        $errorMessageText.style.padding = '1em';
        $errorMessageText.style.display = 'none';
        if ( $summaryFooter ) {
            $summaryFooter.appendChild( $errorMessageText );
        } else {
            document.body.appendChild( $errorMessageText );
        }
        $errorBlock = document.getElementsByClassName( 'error-message-text' )[0];
        // Create Order if finalization is required
        //$placeOrderBtn.addEventListener( "click", placeOrderForBTCallback );
    }
}() );