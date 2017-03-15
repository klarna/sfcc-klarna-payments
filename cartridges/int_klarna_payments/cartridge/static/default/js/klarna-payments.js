(function ()
{
	var klarnaPaymentsUrls = window.KlarnaPaymentsUrls;
	var klarnaPaymentsObjects = window.KlarnaPaymentsObjects;
	
	//billing address form required fields
	var $firstName 			= document.querySelectorAll('input[name="dwfrm_billing_billingAddress_addressFields_firstName"]')[0];
	var $lastName 			= document.querySelectorAll('input[name="dwfrm_billing_billingAddress_addressFields_lastName"]')[0];
	var $address1 			= document.querySelectorAll('input[name="dwfrm_billing_billingAddress_addressFields_address1"]')[0];
	var $city 				= document.querySelectorAll('input[name="dwfrm_billing_billingAddress_addressFields_city"]')[0];
	var $postal 			= document.querySelectorAll('input[name="dwfrm_billing_billingAddress_addressFields_postal"]')[0];
	var $country 			= document.querySelectorAll('select[name="dwfrm_billing_billingAddress_addressFields_country"]')[0];
	var $state 				= document.querySelectorAll('select[name="dwfrm_billing_billingAddress_addressFields_states_state"]')[0];
	var $phone 				= document.querySelectorAll('input[name="dwfrm_billing_billingAddress_addressFields_phone"]')[0];
	var $emailAddress 		= document.querySelectorAll('input[name="dwfrm_billing_billingAddress_email_emailAddress"]')[0];
	var $billingAddressForm = document.querySelectorAll('#dwfrm_billing > fieldset')[0];	
	var $authorizationToken	= document.querySelectorAll('input[name="klarna_payments_authorization_token"]')[0];
	var $klarnaPI			= document.getElementById('is-Klarna');
	
	
	window.klarnaAsyncCallback = function ()
	{
		Klarna.Credit.init(
		{
			client_token: klarnaPaymentsObjects.clientToken
		})
		Klarna.Credit.load(
		{
			container: "#klarna_payments_container"
		}, function (res)
		{
			console.debug(res);
		})

	};
	$billingAddressForm.addEventListener( "click", function () {
		var elements = $billingAddressForm.elements;
		var formValid = true;
		for (i=0; i<elements.length; i++)
		{
			if( elements[i].getAttribute('aria-invalid')=='true' || (elements[i].getAttribute('aria-required')=='true' && elements[i].value.length == 0 ) )
			{
				formValid = false;
				break;
			}
		}
		if(formValid)
		{
			updateBillingAddress();			
		}		
	})
	$klarnaPI.addEventListener( "click", function () {
		var elements = $billingAddressForm.elements;
		var formValid = true;
		for (i=0; i<elements.length; i++)
		{
			if( elements[i].getAttribute('aria-invalid')=='true' || (elements[i].getAttribute('aria-required')=='true' && elements[i].value.length == 0 ) )
			{
				formValid = false;
				break;
			}
		}
		if(formValid)
		{
			updateBillingAddress();			
		}		
	})
	
	/**
	 * @function
	 * @description updates the billing address with the billing address form
	 */
	function updateBillingAddress()
	{
		Klarna.Credit.load(
		{
			container: "#klarna_payments_container"				
		},
		{
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
			"country": $country.value
			}
		}, 
		function(res)
		{
			authorize();
		})
	}
	
	/**
	 * @function
	 * @description authorize the order at Klarna
	 */
	function authorize()
	{
		Klarna.Credit.authorize({}, 
		function(res)
		{
			$authorizationToken.value = res.authorization_token;
		})
	}
	
}());