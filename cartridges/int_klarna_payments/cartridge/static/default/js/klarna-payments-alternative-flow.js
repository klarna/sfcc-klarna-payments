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
                auto_finalize: false
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
                                Klarna.Payments.finalize( {
                                    payment_method_category: paymentMethodCategoryId
                                }, {}, function( res ) {
                                    if ( res.approved ) {
                                        var xhr = new XMLHttpRequest();
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
        } );
    }

    $placeOrderBtn.addEventListener( "click", placeOrderBtnClickEventListener );
}() );