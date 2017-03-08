'use strict';

module.exports = klarnaPaymentsHelper;

/**
 * klarnaPaymentsHelper - Library for common Klarna Payments functionality.
 *
 * @returns {Object} object helper for Klarna Payments
 */
function klarnaPaymentsHelper()
{	
	// import packages
	let CustomObjectMgr = require( 'dw/object/CustomObjectMgr' );
	let Logger = require( 'dw/system/Logger' );
	let Site = require( 'dw/system/Site' );
	let System = require( 'dw/system/System' );
	
	//script include
	let log = Logger.getLogger( 'klarnaPaymentsHelper.js' );
	
	return {
		generateCreateSessionRequestDetails : generateCreateSessionRequestDetails,
	};

	/**
	 * To get the details of a request to create Klarna session call this method.
	 *
	 * @param  {dw.order.Basket} basket		The Basket
	 * 
	 * @return {CreateSessionRequest}       CreateSessionRequest Object.
	 */
	function generateCreateSessionRequestDetails( basket )
	{
		let returnObject = {};
		let payload = new Object();
		
		returnObject.endpoint = _getKlarnaPaymentsEndpoint();
		payload.purchase_country = basket.getBillingAddress() ? basket.getBillingAddress().getCountryCode() : request.locale.split("_").pop();
		payload.purchase_currency = basket.currencyCode;
		payload.locale = request.locale.replace('_', '-');
		payload.billing_address = _getKlarnaPaymentsBillingAddressObj( empty( basket.getBillingAddress() ) ? basket.getShipments().iterator().next().getShippingAddress() : basket.getBillingAddress() );
		payload.order_amount = basket.getTotalGrossPrice().getValue() * 100; //Amounts should be in minor units according to the ISO 4217 standard.
		payload.order_tax_amount = basket.getTotalTax().getValue() * 100;
		payload.order_lines = _getKlarnaPaymentsOrderLinesObj( basket );		
		
		returnObject.payload = payload;
				
		/**
		 * @typedef {Object}  CreateSessionRequest
		 * @property {string} endpoint Klarna Payments endpoint
		 * @property {string} payload request payload
		 */
		return returnObject;
	}
	
	/**
	 * Get the Klarna Payments Endoint corresponding to the current locale.
	 * Searches for the current locale in klarna_payments_countries custom object
	 * 
	 * @private
	 * @return {String}       Klarna Endpoint corresponding to the current locale.
	 */
	function _getKlarnaPaymentsEndpoint()
	{
		let endpoint;
		let countryCode = request.locale.split("_").pop();
		let countryObject = CustomObjectMgr.queryCustomObject( "klarna_payments_countries",	"custom.country = {1}", true, countryCode); 
		
		if( !countryObject )
		{
			log.error("Klarna - could not find Klarna custom object for country [{0}]", countryCode);
			throw new Error("Klarna - could not find Klarna custom object for country [" + countryCode + "]");
		}		
		else if( countryObject.custom.enabled === false )
		{
			log.error( "Klarna - country [{0}] is not enabled.", countryCode );
			throw new Error("Klarna - country [" + countryCode + "] is not enabled.");
		}
		
		if ( System.getInstanceType() === System.PRODUCTION_SYSTEM )
		{
			switch( countryObject.custom.region )
			{
			case 'USA' :
				endpoint = Site.getCurrent().getCustomPreferenceValue( 'KlarnaPaymentsEndpointProdUS' );
				break;
			case 'EUROPE' :
				endpoint = Site.getCurrent().getCustomPreferenceValue( 'KlarnaPaymentsEndpointProdEurope' );
				break;
			default:
				log.warn( 'No endpoint for this region {0}', countryObject.custom.region );
			}		
		}
		else
		{
			switch( countryObject.custom.region )
			{
			case 'USA' :
				endpoint = Site.getCurrent().getCustomPreferenceValue( 'KlarnaPaymentsEndpointTESTUS' );
				break;
			case 'EUROPE' :
				endpoint = Site.getCurrent().getCustomPreferenceValue( 'KlarnaPaymentsEndpointTESTEurope' );
				break;
			default:
				log.warn( 'No endpoint for this region {0}', countryObject.custom.region );
			}		
		}
		log.debug( 'Set Klarna API endpoint to: {0}', endpoint );
		
		return endpoint;
	}
	
	
	/**
	 * Get the Klarna Payments Billing Address object from the basket billing address.
	 * @param  {dw.order.OrderAddress} billingAddress		The basket billing address
	 * 
	 * @private
	 * @return {KlarnaPaymentsBillingAddressObj} billingAddressObj Klarna Payments Billing Address.
	 */
	function _getKlarnaPaymentsBillingAddressObj( billingAddress )
	{
		let billingAddressObj = new Object();
		
		// verify that we have a billing address
		if( billingAddress === null )	
		{			
			log.error( 'No Billing address' );
			throw new Error( 'No billing address' );
		}
		try
		{
			billingAddressObj.given_name = billingAddress.getFirstName();
			billingAddressObj.family_name = billingAddress.getLastName();
			billingAddressObj.title = !empty( billingAddress.getTitle() ) ? billingAddress.getTitle() : "";
			billingAddressObj.street_address = billingAddress.getAddress1();
			billingAddressObj.street_address2 = !empty( billingAddress.getAddress2() ) ? billingAddress.getAddress2() : "";
			billingAddressObj.postal_code = billingAddress.getPostalCode();
			billingAddressObj.city = billingAddress.getCity();
			billingAddressObj.region = billingAddress.getStateCode();
			billingAddressObj.phone = billingAddress.getPhone();
			billingAddressObj.country = billingAddress.getCountryCode().toString();
		}
		catch( err )
		{
			throw new Error( 'Failed to construct Klarna Payments billing address object with exception: {0}', err.message );
		}
		log.debug ('Constructed Klarna payments billing address object as follows: {0}', JSON.stringify( billingAddressObj ) );
		
		/**
		 * @typedef {Object}  KlarnaPaymentsBillingAddressObj
		 * @property {string} given_name Given name
		 * @property {string} family_name Family name.
		 * @property {string} title Title.
		 * @property {string} street_address Street address, first line.
		 * @property {string} street_address2 Street address, second line.
		 * @property {string} postal_code Postal/post code.
		 * @property {string} city City.
		 * @property {string} region State or Region.
		 * @property {string} phone Phone number.
		 * @property {string} country ISO 3166 alpha-2. Country.
		 */
		return billingAddressObj;		
	}	
	
	/**
	 * Get the Klarna Payments Order Lines object from the basket
	 * @param  {dw.order.basket} basket The basket
	 * 
	 * @private
	 * @return {[KlarnaPaymentsOrderLineObj]} orderLinesArrayObj Array of Klarna Payments Order Line Objects.
	 */
	function _getKlarnaPaymentsOrderLinesObj( basket )
	{
		let orderLinesArrayObj = new Array();
		let productLineItems = [];
		
		try 
		{
			productLineItems = basket.getAllProductLineItems();
			
			for each( var item in productLineItems )
			{
				let orderLinesObj = _getKlarnaPaymentsOrderLineObj( item );
							
				orderLinesArrayObj.push( orderLinesObj );
			}
		}
		catch( err )
		{
			throw new Error( 'Failed to construct Klarna Payments array of order line objects with exception: {0}', err.message );
		}
		
		log.debug ('Constructed Klarna payments order lines object as follows: {0}', JSON.stringify( orderLinesArrayObj ) );
		
		return orderLinesArrayObj;	
	}
	
	/**
	 * Get the Klarna Payments Order Line object from the Salesforce commerce cloud (SCC) product line item
	 * @param  {dw.order.ProductLineItem} productLineItem SCC product line item
	 * 
	 * @private
	 * @return {KlarnaPaymentsOrderLineObj} orderLinesObj Klarna Payments Order Lines Object.
	 */
	function _getKlarnaPaymentsOrderLineObj( productLineItem )
	{
		let orderLineObj = new Object();
		
		try
		{
			orderLineObj.name = productLineItem.getProductName();
			orderLineObj.quantity = productLineItem.getQuantity().getValue();
			orderLineObj.unit_price = productLineItem.getAdjustedGrossPrice().getValue() * 100;
			orderLineObj.total_amount = productLineItem.getAdjustedGrossPrice().getValue() * orderLineObj.quantity * 100;
			
			orderLineObj.product_url = ( !empty( productLineItem.getProduct()) && productLineItem.getProduct().getPageURL() !== null ) ? productLineItem.getProduct().getPageURL() : "";
			orderLineObj.image_url = !empty( productLineItem.getProduct() ) ? productLineItem.getProduct().getImage('small', 0).getImageURL({}).toString() : "";
		}
		catch( err )
		{
			throw new Error( 'Failed to construct Klarna Payments order line object with exception: {0}', err.message );
		}
		
		log.debug ('Constructed Klarna payments order line object as follows: {0}', JSON.stringify( orderLineObj ) );
		
		/**
		 * @typedef {Object}  KlarnaPaymentsOrderLineObj
		 * @property {string} name Descriptive item name.
		 * @property {integer} quantity Non-negative. The item quantity.
		 * @property {integer} unit_price Minor units. Includes tax, excludes discount. (max value: 100000000).
		 * @property {integer} total_amount Includes tax and discount. Must match (quantity unit_price) - total_discount_amount within ±quantity. (max value: 100000000)
		 * @property {string} product_url URL to an image that can be later embedded in communications between Klarna and the customer. (max 1024 characters).
		 * @property {string} image_url URL to an image that can be later embedded in communications between Klarna and the customer. (max 1024 characters).
		 */
		return orderLineObj;	
	}
}