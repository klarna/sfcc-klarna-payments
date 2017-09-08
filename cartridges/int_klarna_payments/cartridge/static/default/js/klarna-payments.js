(function() {
	var klarnaPaymentsUrls = window.KlarnaPaymentsUrls;
	var klarnaPaymentsObjects = window.KlarnaPaymentsObjects;

	//billing address form required fields
	var $firstName = document.querySelectorAll('input[name="dwfrm_billing_billingAddress_addressFields_firstName"]')[0];
	var $lastName = document.querySelectorAll('input[name="dwfrm_billing_billingAddress_addressFields_lastName"]')[0];
	var $address1 = document.querySelectorAll('input[name="dwfrm_billing_billingAddress_addressFields_address1"]')[0];
	var $city = document.querySelectorAll('input[name="dwfrm_billing_billingAddress_addressFields_city"]')[0];
	var $postal = document.querySelectorAll('input[name="dwfrm_billing_billingAddress_addressFields_postal"]')[0];
	var $country = document.querySelectorAll('select[name="dwfrm_billing_billingAddress_addressFields_country"]')[0];
	var $state = document.getElementsByName('dwfrm_billing_billingAddress_addressFields_states_state')[0];
	var $phone = document.querySelectorAll('input[name="dwfrm_billing_billingAddress_addressFields_phone"]')[0];
	var $emailAddress = document.querySelectorAll('input[name="dwfrm_billing_billingAddress_email_emailAddress"]')[0];
	var $billingAddressFormElements = document.querySelectorAll('input[name*=dwfrm_billing_billingAddress], select[name*=dwfrm_billing_billingAddress]');
	var $billingAddressForm = document.querySelectorAll('#dwfrm_billing > fieldset')[0];
	var $klarnaPI = document.getElementById('is-Klarna');
	var $continueBtn = document.getElementsByName('dwfrm_billing_save')[1];

	window.klarnaAsyncCallback = function() {
		Klarna.Credit.init({
			client_token: klarnaPaymentsObjects.clientToken
		})
		Klarna.Credit.load({
			container: "#klarna_payments_container"
		}, function(res) {
			console.debug(res);
		})

	};
	if (klarnaPaymentsObjects.preassesment) {
		$billingAddressForm.addEventListener("change", function() {
			var elements = $billingAddressFormElements;
			var formValid = true;
			for (var i = 0; i < elements.length; i++) {
				if (elements[i].getAttribute('aria-invalid') == 'true' || (elements[i].getAttribute('aria-required') == 'true' && elements[i].value.length == 0)) {
					formValid = false;
					break;
				}
			}
			if (formValid) {

				updateBillingAddress();
			}
		})

		$klarnaPI.addEventListener("click", function() {
			var elements = $billingAddressFormElements;
			var formValid = true;
			for (var i = 0; i < elements.length; i++) {
				if (elements[i].getAttribute('aria-invalid') == 'true' || (elements[i].getAttribute('aria-required') == 'true' && elements[i].value.length == 0)) {
					formValid = false;
					break;
				}
			}
			if (formValid) {
				$continueBtn.disabled = false;
				updateBillingAddress();
			}
		})

	}

	$continueBtn.addEventListener("click", function(event) {
		if (document.getElementById('klarna_payments_container').parentElement.className.indexOf('expanded') !== -1) {
			event.preventDefault(); //prevent form submission until authorize call is done
			$continueBtn.disabled = true;
			var hasShippingAddress = document.querySelectorAll('#shipping_address_firstName')[0] ? true : false;

			if (hasShippingAddress) {
				Klarna.Credit.authorize({
						"billing_address": {
							"given_name": $firstName.value,
							"family_name": $lastName.value,
							"email": $emailAddress.value,
							"title": "",
							"street_address": $address1.value,
							"street_address2": "",
							"postal_code": $postal.value,
							"city": $city.value,
							"region": $state.value,
							"phone": $phone.value,
							"country": $country.value.toUpperCase()
						},
						"shipping_address": {
							"given_name": document.querySelectorAll('#shipping_address_firstName')[0].value,
							"family_name": document.querySelectorAll('#shipping_address_lastName')[0].value,
							"title": "",
							"street_address": document.querySelectorAll('#shipping_address_address1')[0].value,
							"street_address2": "",
							"postal_code": document.querySelectorAll('#shipping_address_postalCode')[0].value,
							"city": document.querySelectorAll('#shipping_address_city')[0].value,
							"region": document.querySelectorAll('#shipping_address_stateCode')[0].value,
							"phone": document.querySelectorAll('#shipping_address_phone')[0].value,
							"country": document.querySelectorAll('#shipping_address_countryCode')[0].value,
							"email": $emailAddress.value
						}
					},
					function(res) {
						console.log(res);
						if (res.approved) {
							var xhr = new XMLHttpRequest();
							xhr.open("GET", klarnaPaymentsUrls.saveAuth, true);

							xhr.setRequestHeader("Content-type", "application/json; charset=utf-8");
							xhr.setRequestHeader("X-Auth", res.authorization_token);

							xhr.onreadystatechange = function() {
								if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
									//submit billing form when Klarna Payments authorization is successfully finished
									document.querySelectorAll('#dwfrm_billing')[0].submit();
								}
							};
							xhr.send();
						} else {
							$continueBtn.disabled = false;
						}
					})
			} else {
				Klarna.Credit.authorize({
						"billing_address": {
							"given_name": $firstName.value,
							"family_name": $lastName.value,
							"email": $emailAddress.value,
							"title": "",
							"street_address": $address1.value,
							"street_address2": "",
							"postal_code": $postal.value,
							"city": $city.value,
							"region": $state.value,
							"phone": $phone.value,
							"country": $country.value.toUpperCase()
						}
					},
					function(res) {
						console.log(res);
						if (res.approved) {
							var xhr = new XMLHttpRequest();
							xhr.open("GET", klarnaPaymentsUrls.saveAuth, true);

							xhr.setRequestHeader("Content-type", "application/json; charset=utf-8");
							xhr.setRequestHeader("X-Auth", res.authorization_token);

							xhr.onreadystatechange = function() {
								if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
									//submit billing form when Klarna Payments authorization is successfully finished
									document.querySelectorAll('#dwfrm_billing')[0].submit();
								}
							};
							xhr.send();
						} else {
							$continueBtn.disabled = false;
						}
					})
			}
		}
	})


	/**
	 * @function
	 * @description updates the billing address with the billing address form
	 */
	function updateBillingAddress() {
		var hasShippingAddress = document.querySelectorAll('#shipping_address_firstName')[0] ? true : false;
		if (hasShippingAddress) {
			Klarna.Credit.load({
					container: "#klarna_payments_container"
				}, {
					"billing_address": {
						"given_name": $firstName.value,
						"family_name": $lastName.value,
						"email": $emailAddress.value,
						"title": "",
						"street_address": $address1.value,
						"street_address2": "",
						"postal_code": $postal.value,
						"city": $city.value,
						"region": $state.value,
						"phone": $phone.value,
						"country": $country.value.toUpperCase()
					},
					"shipping_address": {
						"given_name": document.querySelectorAll('#shipping_address_firstName')[0].value,
						"family_name": document.querySelectorAll('#shipping_address_lastName')[0].value,
						"title": "",
						"street_address": document.querySelectorAll('#shipping_address_address1')[0].value,
						"street_address2": "",
						"postal_code": document.querySelectorAll('#shipping_address_postalCode')[0].value,
						"city": document.querySelectorAll('#shipping_address_city')[0].value,
						"region": document.querySelectorAll('#shipping_address_stateCode')[0].value,
						"phone": document.querySelectorAll('#shipping_address_phone')[0].value,
						"country": document.querySelectorAll('#shipping_address_countryCode')[0].value,
						"email": $emailAddress.value
					}
				},
				function(res) {
					console.log(res);
					if (!res.show_form) {
						$continueBtn.disabled = true;
					}
				})
		} else {
			Klarna.Credit.load({
					container: "#klarna_payments_container"
				}, {
					"billing_address": {
						"given_name": $firstName.value,
						"family_name": $lastName.value,
						"email": $emailAddress.value,
						"title": "",
						"street_address": $address1.value,
						"street_address2": "",
						"postal_code": $postal.value,
						"city": $city.value,
						"region": $state.value,
						"phone": $phone.value,
						"country": $country.value.toUpperCase()
					}
				},
				function(res) {
					if (!res.show_form) {
						$continueBtn.disabled = true;
					}
				})
		}

	}
}());