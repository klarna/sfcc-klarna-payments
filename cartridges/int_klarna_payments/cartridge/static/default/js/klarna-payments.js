( function() {
    var klarnaPaymentsUrls = window.KlarnaPaymentsUrls;
    var klarnaPaymentsObjects = window.KlarnaPaymentsObjects;
    var klarnaPaymentsConstants = window.KPConstants;
    var klarnaPaymentsPreferences = window.KPPreferences;

    //billing address form required fields
    var $firstName = document.querySelectorAll( 'input[name="dwfrm_billing_billingAddress_addressFields_firstName"]' )[0];
    var $lastName = document.querySelectorAll( 'input[name="dwfrm_billing_billingAddress_addressFields_lastName"]' )[0];
    var $address1 = document.querySelectorAll( 'input[name="dwfrm_billing_billingAddress_addressFields_address1"]' )[0];
    var $address2 = document.querySelectorAll( 'input[name="dwfrm_billing_billingAddress_addressFields_address2"]' )[0];
    var $city = document.querySelectorAll( 'input[name="dwfrm_billing_billingAddress_addressFields_city"]' )[0];
    var $postal = document.querySelectorAll( 'input[name="dwfrm_billing_billingAddress_addressFields_postal"]' )[0];
    var $country = document.querySelectorAll( 'select[name="dwfrm_billing_billingAddress_addressFields_country"]' )[0];
    var $state = document.getElementsByName( 'dwfrm_billing_billingAddress_addressFields_states_state' )[0];
    var $phone = document.querySelectorAll( 'input[name="dwfrm_billing_billingAddress_addressFields_phone"]' )[0];
    var $emailAddress = document.querySelectorAll( 'input[name="dwfrm_billing_billingAddress_email_emailAddress"]' )[0];
    var $billingAddressFormElements = document.querySelectorAll( 'input[name*=dwfrm_billing_billingAddress], select[name*=dwfrm_billing_billingAddress]' );
    var $billingAddressForm = document.querySelectorAll( '#dwfrm_billing > fieldset' )[0];
    var $klarnaPaymentCategories = document.querySelectorAll( '.klarna-payment-categories' );
    var $selectPaymentMethod = document.querySelectorAll( '.payment-method-options' )[0];
    var $paymentOptions = $selectPaymentMethod.querySelectorAll( 'input[name$="_selectedPaymentMethodID"]' );
    var $continueBtn = document.getElementsByName( 'dwfrm_billing_save' )[1];

    /**
     * Initialize Klarna checkout enhancements.
     *
     * This method is called as soon as the Klarna JS API client has been
     * properly initialized (this is done by the client itself).
     * @return {void}
     */
    window.klarnaAsyncCallback = function() {
        Klarna.Payments.init( {
            client_token: klarnaPaymentsObjects.clientToken
        } );

        var $selectedPaymentMethod = $selectPaymentMethod.querySelectorAll( ':checked' )[0];
        for ( var i = 0; i < $paymentOptions.length; ++i ) {
            var $paymentMethod = $paymentOptions[i];
            var isKlarnaCategory = isKlarnaPaymentCategory( $paymentMethod.id );

            // load options on page initial load or refresh
            if ( isKlarnaCategory ) {
                if ( $selectedPaymentMethod.id === $paymentMethod.id ) {
                    updateBillingAddress( $selectedPaymentMethod.id )
                } else {
                    var containerName = '#klarna_payments_' + $paymentMethod.id + '_container';
                    var paymentCategory = $paymentMethod.id;
                    loadPaymentData( containerName, paymentCategory )
                }
            }

            // attach click events on all options
            // eslint-disable-next-line no-loop-func
            $paymentMethod.addEventListener( 'click' , function( event ) {
                isKlarnaCategory = isKlarnaPaymentCategory( this.id );

                if ( isKlarnaCategory ) {
                    submitPaymentMethod( this, loadPaymentData( '#klarna_payments_' + this.id + '_container', this.id ) );
                } else {
                    submitPaymentMethod( this );
                }
            } );
        }
    };

    if ( klarnaPaymentsObjects.preassesment ) {
        $billingAddressForm.addEventListener( 'change' , function() {
            var elements = $billingAddressFormElements;
            var $selectedPaymentMethod = $selectPaymentMethod.querySelectorAll( ':checked' )[0];
            var formValid = true;
            for ( var i = 0; i < elements.length; i++ ) {
                if ( elements[i].getAttribute( 'aria-invalid' ) === 'true' || ( elements[i].getAttribute( 'aria-required' ) === 'true' && elements[i].value.length === 0 ) ) {
                    formValid = false;
                    break;
                }
            }

            if ( formValid && isKlarnaPaymentCategory( $selectedPaymentMethod.id ) ) {
                submitPaymentMethod( $selectedPaymentMethod.id , updateBillingAddress( $selectedPaymentMethod.id ) );
            } else {
                submitPaymentMethod( $selectedPaymentMethod.id );
            }
        } )
    }

    if ( klarnaPaymentsPreferences.kpUseAlternativePaymentFlow ) {
        $continueBtn.addEventListener( 'click' , function( event ) {
            var $selectedPaymentMethod = $selectPaymentMethod.querySelectorAll( ':checked' )[0];

            if ( isKlarnaPaymentCategory( $selectedPaymentMethod.id ) ) {
                event.preventDefault(); //prevent form submission until authorize call is done
                $continueBtn.disabled = true;
                // Update Klarna payment according to the current session data
                // before submitting the payment.
                var el = $( '.js-klarna-payment-item' )[0];
                submitPaymentMethod( el, function() {
                    document.cookie = 'selectedKlarnaPaymentCategory=' + $selectedPaymentMethod.id + '; SameSite=Strict; path=/';
                    $selectedPaymentMethod.value = 'Klarna';
                    document.querySelectorAll( '#dwfrm_billing' )[0].submit();
                } );
            }
        } );
        
    } else {
        $continueBtn.addEventListener( 'click' , function( event ) {
            var $selectedPaymentMethod = $selectPaymentMethod.querySelectorAll( ':checked' )[0];
    
            if ( isKlarnaPaymentCategory( $selectedPaymentMethod.id ) ) {
                event.preventDefault(); //prevent form submission until authorize call is done
                $continueBtn.disabled = true;
                // Update Klarna payment according to the current session data
                // before submitting the payment.
                var el = $( '.js-klarna-payment-item' )[0];
                submitPaymentMethod( el, function() {
                    loadPaymentData( '#klarna_payments_' + el.id + '_container', el.id );
    
                    var hasShippingAddress = document.querySelectorAll( '#shipping_address_firstName' )[0] ? true : false;
    
                    var klarnaRequestData = {
                        billing_address: obtainBillingAddressData()
                    };
    
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
                        payment_method_category: $selectedPaymentMethod.id,
                        auto_finalize: true
                    }, klarnaRequestData , function( res ) {
                        if ( res.approved ) {
                            var xhr = new XMLHttpRequest();
                            xhr.open( 'GET', klarnaPaymentsUrls.saveAuth, true );
    
                            xhr.setRequestHeader( 'Content-type', 'application/json; charset=utf-8' );
                            xhr.setRequestHeader( 'X-Auth', res.authorization_token );
                            xhr.setRequestHeader( 'Finalize-Required', res.finalize_required );
    
                            xhr.onreadystatechange = function() {
                                if ( xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200 ) {
                                    document.cookie = 'selectedKlarnaPaymentCategory=' + $selectedPaymentMethod.id + '; SameSite=Strict; path=/';
                                    $selectedPaymentMethod.value = 'Klarna';
    
                                    //submit billing form when Klarna Payments authorization is successfully finished
                                    document.querySelectorAll( '#dwfrm_billing' )[0].submit();
                                }
                            };
                            xhr.send();
                        } else if ( !res.show_form && klarnaPaymentsObjects.hideRejectedPayments === 'hide' ) {
                            hidePaymentCategory( $selectedPaymentMethod.id );
                            selectFirstPayment();
                        } else if ( !res.show_form && klarnaPaymentsObjects.hideRejectedPayments === 'greyout' ) {
                            greyoutPaymentCategory( $selectedPaymentMethod.id, true );
                            $continueBtn.disabled = true;
                        } else {
                            $continueBtn.disabled = false;
                        }
                        if ( !res || res.error ) {
                            writeAdditionalLog( res, 'klarna-payments.js:Klarna.Payments.authorize()', 'SG Storefront Ajax Request Error.' );
                        }
                    } );
                } );
            }
        } );
    }
    
    
    /**
     * @function
     * @description checks if the given payment method ID is Klarna payment category.
     * @param {string} paymentCategory the payment category ID
     * @returns {void}
     */
    function isKlarnaPaymentCategory( paymentCategory ) {
        for ( var i = 0; i < $klarnaPaymentCategories.length; ++i ) {
            var $klarnaPaymentCategory = $klarnaPaymentCategories[i];

            if ( paymentCategory === $klarnaPaymentCategory.id ) {
                return true;
            }
        }
        return false;
    }

    function getSelectedKlarnaPaymentTab( paymentCategory ) {
        //return $( '.klarna-payment-categories#' + paymentCategory).closest('.form-row' );
        return document.querySelectorAll( '.klarna-payment-categories#' + paymentCategory )[0].closest( '.form-row' );
    }

    function getSelectedKlarnaPaymentContainer( paymentCategory ) {
        //return $( '#klarna_payments_' + paymentCategory + '_container' );
        return document.querySelectorAll( '#klarna_payments_' + paymentCategory + '_container' )[0];
    }

    function hidePaymentCategory( paymentCategory ) {
        var $klarnaTab = getSelectedKlarnaPaymentTab( paymentCategory );
        var $klarnaContainer = getSelectedKlarnaPaymentContainer( paymentCategory );

        addClass( $klarnaTab, 'hide' );
        addClass( $klarnaContainer, 'hide' );
    }

    function greyoutPaymentCategory( klarnaPaymentMethod, flag ) {
        var $klarnaTab = getSelectedKlarnaPaymentTab( klarnaPaymentMethod );
        var $klarnaContainer = getSelectedKlarnaPaymentContainer( klarnaPaymentMethod );

        toggleClass( $klarnaTab, 'klarna-grayed-tab', flag );
        toggleClass( $klarnaContainer, 'klarna-grayed-content', flag );
    }

    function selectFirstPayment() {
        var $firstItem = $( '.payment-method-options .form-row:not(.hide) input[type="radio"]' ).first();
        $firstItem.trigger( 'click' );
    }

    function userHasEnteredShippingAddress() {
        var hasShippingAddress = document.querySelectorAll( '#shipping_address_firstName' )[0] ? true : false;
        return hasShippingAddress;
    }

    function useMultiShipping() {
        return $( '.klarna_payments_shipment_data' ).length > 1;
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
            email: $emailAddress.value
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

    function buildOtherAddressData( $addressBlock, billingAddress ) {
        var address = {
            shipping_method: klarnaPaymentsConstants.SHIPPING_METHOD_TYPE.STORE,
            shipping_type: klarnaPaymentsConstants.SHIPPING_TYPE.NORMAL,
            first_name: $addressBlock.querySelectorAll( '#shipping_address_firstName' )[0].value || '',
            last_name: $addressBlock.querySelectorAll( '#shipping_address_lastName' )[0].value || '',
            street_address: $addressBlock.querySelectorAll( '#shipping_address_address1' )[0].value || '',
            street_number: $addressBlock.querySelectorAll( '#shipping_address_address2' )[0].value || '',
            city: $addressBlock.querySelectorAll( '#shipping_address_city' )[0].value || '',
            postal_code: $addressBlock.querySelectorAll( '#shipping_address_postalCode' )[0].value || '',
            country: $addressBlock.querySelectorAll( '#shipping_address_countryCode' )[0].value || ''
        };

        if ( billingAddress ) {
            if ( billingAddress.given_name !== '' ) {
                address.first_name = billingAddress.given_name;
            }

            if ( billingAddress.family_name !== '' ) {
                address.last_name = billingAddress.family_name;
            }
        }

        return address;
    }

    function obtainBillingAddressData() {
        var address = {
            given_name: !!$firstName ? $firstName.value : '',
            family_name: !!$lastName ? $lastName.value : '',
            email: !!$emailAddress ? $emailAddress.value : '',
            title: '',
            street_address: !!$address1 ? $address1.value : '',
            street_address2: !!$address2 ? $address2.value : '',
            postal_code: !!$postal ? $postal.value : '',
            city: !!$city ? $city.value : '',
            region: !!$state ? $state.value : '',
            phone: !!$phone ? $phone.value : '',
            country: !!$country ? $country.value.toUpperCase() : ''
        };

        return address;
    }

    /**
     * @function
     * @description updates the billing address with the billing address form
     * @param {string} paymentCategory the payment category ID
     * @returns {void}
     */
    function updateBillingAddress( paymentCategory ) {
        var hasShippingAddress = document.querySelectorAll( '#shipping_address_firstName' )[0] ? true : false;
        var containerName = '#klarna_payments_' + paymentCategory + '_container';
        var $klarnaTab = getSelectedKlarnaPaymentTab( paymentCategory );

        if ( hasClass( $klarnaTab, 'klarna-grayed-tab' ) ) {
            return;
        }

        var klarnaRequestData = {
            billing_address: obtainBillingAddressData()
        };

        if ( hasShippingAddress ) {
            klarnaRequestData.shipping_address = obtainShippingAddressData( klarnaRequestData.billing_address );
        }

        loadPaymentData( containerName, paymentCategory, klarnaRequestData );
    }

    function loadPaymentData( containerName, paymentCategory, requestData ) {
        Klarna.Payments.load( {
            container: containerName,
            payment_method_category: paymentCategory
        }, requestData || {} , function( res ) {
            if ( !res.show_form ) {
                $continueBtn.disabled = true;
            }
            if ( !res || res.error ) {
                writeAdditionalLog( res, 'klarna-payments.js:Klarna.Payments.load()', 'SG Storefront Ajax Request Error.' );
            }
        } );
    }

    function submitPaymentMethod( $paymentMethod, callback ) {
        var isKlarnaCategory = isKlarnaPaymentCategory( $paymentMethod.id );
        var paymentMethod = $paymentMethod.value;
        var formData = 'dwfrm_billing_paymentMethods_selectedPaymentMethodID=';

        if ( isKlarnaCategory ) {
            var methodId = $( '.klarna-payment-form-row' ).data( 'method-id' );
            document.cookie = 'selectedKlarnaPaymentCategory=' + $paymentMethod.id + '; SameSite=Strict; path=/';
            formData += methodId;
        } else {
            formData += $paymentMethod.value;
        }

        var xhr = new XMLHttpRequest();
        xhr.open( 'POST', klarnaPaymentsUrls.selectPaymentMethod, false );
        xhr.setRequestHeader( 'Content-type', 'application/x-www-form-urlencoded' );

        xhr.onreadystatechange = function() {
            if ( xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200 ) {
                var response = xhr.response;

                try {
                    // only update if there's change to the totals
                    var jsonResponse = JSON.parse( response );
                    if ( jsonResponse && !jsonResponse.error && jsonResponse.updateSummary ) {
                        updateSummary();
                    }
                } catch ( e ) {
                    console.debug(e); // eslint-disable-line
                }

                // always execute the KP options loading
                if ( typeof callback === 'function' ) {
                    callback();
                }
            }
        };

        xhr.send( formData );
    }

    function updateSummary() {
        // load the updated summary area
        var $summary = document.getElementById( 'secondary' );

        var xhrSm = new XMLHttpRequest();
        xhrSm.open( 'GET', klarnaPaymentsUrls.summaryUpdate, false );
        xhrSm.setRequestHeader( 'Content-type', 'text/html' );

        xhrSm.onreadystatechange = function() {
            if ( xhrSm.readyState === XMLHttpRequest.DONE && xhrSm.status === 200 ) {
                $summary.innerHTML = xhrSm.responseText;
            }
        }

        xhrSm.send();
    }

    function hasClass( el, className ) {
        var re = new RegExp( '(^|\\s)' + className + '(\\s|$)' , 'g' );
        if ( el.className !== null && className !== '' ) {
            return re.test( el.className );
        }
        return false;
    }

    function addClass( el, className ) {
        var re = new RegExp( '(^|\\s)' + className + '(\\s|$)', 'g' );
        if ( el.className !== null ) {
            if ( re.test( el.className ) ) {
                return;
            }
            el.className = ( el.className + ' ' + className ).replace( /\s+/g, ' ' ).replace( /(^ | $)/g, '' );
        }
    }

    function removeClass( el, className ) {
        var re = new RegExp( '(^|\\s)' + className + '(\\s|$)', 'g' );
        el.className = el.className.replace( re, '$1' ).replace( /\s+/g, ' ' ).replace( /(^ | $)/g, '' );
    }

    function toggleClass( el, className ) {
        var re = new RegExp( '(^|\\s)' + className + '(\\s|$)', 'g' );
        if ( re.test( el.className ) ) {
            removeClass( el, className );
        }
        else {
            addClass( el, className );
        }
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
    
}() );