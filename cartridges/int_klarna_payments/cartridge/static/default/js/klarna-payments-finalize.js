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
    var $placeOrderBtn = document.getElementsByName( 'submit' )[0];

    window.klarnaAsyncCallback = function() {
        Klarna.Payments.init( {
            client_token: klarnaPaymentsObjects.clientToken
        } );
    };

    var placeOrderBtnClickEventListener = function( event ) {
        event.preventDefault();

        var paymentMethodCategoryId = getCookie( "selectedKlarnaPaymentCategory" );

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
                        $placeOrderBtn.removeEventListener( "click", placeOrderBtnClickEventListener );
                        $placeOrderBtn.click();
                    }
                };
                xhr.send();
            }
        } );
    };

    $placeOrderBtn.addEventListener( "click", placeOrderBtnClickEventListener );
}() );