(function () {
    function getCookie(name) { //eslint-disable-line
        var value = "; " + document.cookie;
        var parts = value.split("; " + name + "=");
        if (parts.length === 2) {
            return parts.pop().split(";").shift();
        }
    }

    var klarnaPaymentsUrls = window.KlarnaPaymentsUrls;
    var klarnaPaymentsObjects = window.KlarnaPaymentsObjects;
    var $placeOrderBtn = document.getElementsByName('submit')[0];
    var $form = document.getElementsByClassName('submit-order')[0];
    var $summaryFooter = document.getElementsByClassName('order-summary-footer')[0];
    var $errorBlock = null;

    window.klarnaAsyncCallback = function () {
        Klarna.Payments.init({
            client_token: klarnaPaymentsObjects.clientToken
        });
    };

    var placeOrderBtnClickEventListener = function (event) {
        event.preventDefault();
        var paymentMethodCategoryId = getCookie("selectedKlarnaPaymentCategory");
        if (klarnaPaymentsObjects.kpIsExpressCheckout) {
            $.ajax({
                url: klarnaPaymentsUrls.generateExpressCheckoutPayload + '?populateAddress=true&isPDP=false',
                type: 'POST'
            }).done(function (payloadresult) {
                Klarna.Payments.finalize({
                    payment_method_category: paymentMethodCategoryId
                }, payloadresult.payload, function (res) {
                    var xhr = new XMLHttpRequest();
                    if (res.approved) {
                        xhr.open("GET", klarnaPaymentsUrls.saveAuth, true);

                        xhr.setRequestHeader("Content-type", "application/json; charset=utf-8");
                        xhr.setRequestHeader("X-Auth", res.authorization_token);

                        xhr.onreadystatechange = function () {
                            if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                                $placeOrderBtn.removeEventListener("click", placeOrderBtnClickEventListener);
                                $placeOrderBtn.click();
                            }
                        };
                        xhr.send();
                    }
                });
            });

        } else {

            Klarna.Payments.finalize({
                payment_method_category: paymentMethodCategoryId
            }, {}, function (res) {
                var xhr = new XMLHttpRequest();
                if (res.approved) {
                    if (!klarnaPaymentsObjects.kpBankTransferCallback) {
                        xhr.open("GET", klarnaPaymentsUrls.saveAuth, true);

                        xhr.setRequestHeader("Content-type", "application/json; charset=utf-8");
                        xhr.setRequestHeader("X-Auth", res.authorization_token);

                        xhr.onreadystatechange = function () {
                            if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                                $placeOrderBtn.removeEventListener("click", placeOrderBtnClickEventListener);
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
                        var interval = setInterval(function () {
                            if (numOfTries === 0) {
                                clearInterval(interval);
                                $errorBlock.style.display = 'block';
                                $($loader).hide();
                                return;
                            }
                            numOfTries--;
                            xhr.open("GET", klarnaPaymentsUrls.bankTransferAwaitCallback + '?session_id=' + klarnaPaymentsObjects.sessionID, true);
                            xhr.setRequestHeader("Content-type", "application/json; charset=utf-8");
                            xhr.setRequestHeader("X-Auth", res.authorization_token);
                            xhr.onreadystatechange = function () {
                                var response = xhr.response;
                                try {
                                    if (response) {
                                        var jsonResponse = JSON.parse(response);
                                        if (jsonResponse.redirectUrl && jsonResponse.redirectUrl !== currentUrl && jsonResponse.redirectUrl !== newUrl && jsonResponse.redirectUrl !== 'undefined') {
                                            clearInterval(interval);
                                            newUrl = jsonResponse.redirectUrl;
                                            location.href = jsonResponse.redirectUrl;
                                        }
                                    } else {
                                        return;
                                    }
                                } catch (e) {
                                    console.debug(e); // eslint-disable-line
                                }
                            };
                            xhr.send();
                        }, 2000);
                    }
                } else {
                    if (klarnaPaymentsObjects.kpBankTransferCallback) {
                        // If the payment isn't approved or popup is closed,
                        // then recreate Basket.
                        // In case of error, show error message
                        xhr.open("POST", klarnaPaymentsUrls.failOrder + '?session_id=' + klarnaPaymentsObjects.sessionID, true);
                        xhr.setRequestHeader("Content-type", "application/json; charset=utf-8");
                        xhr.onreadystatechange = function () {
                            if (xhr.readyState === XMLHttpRequest.DONE) {
                                var response = xhr.response;
                                try {
                                    var jsonResponse = JSON.parse(response);
                                    if (jsonResponse && !jsonResponse.success) {
                                        $errorBlock.style.display = 'block';
                                    }
                                } catch (e) {
                                    console.debug(e); // eslint-disable-line
                                }
                            }
                        };
                        xhr.send();
                    }
                }
            });
        }
    };

    $placeOrderBtn.addEventListener("click", placeOrderBtnClickEventListener);

    if (klarnaPaymentsObjects.kpBankTransferCallback) {
        var placeOrderForBTCallback = function () {
            $placeOrderBtn.removeEventListener("click", placeOrderForBTCallback);
            // Place Order
            if ($form) {
                var action = $form.action;
                var csrfToken = $form.csrf_token.value;

                var xhr = new XMLHttpRequest();
                var formData = new FormData();
                formData.append('csrf_token', csrfToken);

                xhr.open("POST", action, true);
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === XMLHttpRequest.DONE) {
                        console.log('Order has been created (BT callback is in progress)'); // eslint-disable-line
                    }
                };
                xhr.send(formData);
            } else {
                console.error('Form not found! Order cannot be created!'); // eslint-disable-line
            }
        }

        // Create Error Block
        var $errorMessageText = document.createElement('div');
        $errorMessageText.className = 'error-message-text';
        $errorMessageText.innerText = window.serverErrorMessage;
        $errorMessageText.style.background = '#ff3333';
        $errorMessageText.style.border = '1px solid black';
        $errorMessageText.style.padding = '1em';
        $errorMessageText.style.display = 'none';
        if ($summaryFooter) {
            $summaryFooter.appendChild($errorMessageText);
        } else {
            document.body.appendChild($errorMessageText);
        }
        $errorBlock = document.getElementsByClassName('error-message-text')[0];
        // Create Order if finalization is required
        $placeOrderBtn.addEventListener("click", placeOrderForBTCallback);
    }
}());