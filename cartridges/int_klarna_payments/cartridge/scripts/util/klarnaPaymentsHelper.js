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
		generateSessionRequestDetails : generateSessionRequestDetails,
	};

	/**
	 * To get the details of a request to create Klarna session call this method.
	 *
	 * @param  {dw.order.Basket} basket		The Basket
	 * 
	 * @return {CreateSessionRequest}       CreateSessionRequest Object.
	 */
	function generateSessionRequestDetails( basket )
	{
		let returnObject = {};
		let payload = new Object();
		
		returnObject.url 			= _getKlarnaPaymentsURL();
		
		payload.purchase_country 	= basket.getBillingAddress() ? basket.getBillingAddress().getCountryCode().toString().toUpperCase() : request.locale.split("_").pop().toUpperCase();
		payload.purchase_currency 	= basket.currencyCode;
		payload.locale 				= request.locale.replace('_', '-');
		payload.billing_address 	= _getKlarnaPaymentsBillingAddressObj( empty( basket.getBillingAddress() ) ? basket.getShipments().iterator().next().getShippingAddress() : basket.getBillingAddress() );
		payload.order_amount 		= basket.totalGrossPrice.available ? basket.totalGrossPrice.getValue() * 100 : basket.getAdjustedMerchandizeTotalPrice(true).add(LineItemCtnr.giftCertificateTotalPrice).getValue() * 100; //Amounts should be in minor units according to the ISO 4217 standard.
		payload.order_tax_amount 	= basket.totalTax.available ? basket.getTotalTax().getValue() * 100 : 0;
		payload.order_lines 		= _getKlarnaPaymentsOrderLinesObj( basket );		
		
		returnObject.payload = payload;
				
		/**
		 * @typedef {Object}  CreateSessionRequest
		 * @property {string} url Klarna Payments URL
		 * @property {string} payload request payload
		 */
		return returnObject;
	}
	
	/**
	 * Get the Klarna Payments URL corresponding to the current locale.
	 * Searches for the current locale in klarna_payments_countries custom object
	 * 
	 * @private
	 * @return {String} Klarna URL corresponding to the current locale.
	 */
	function _getKlarnaPaymentsURL()
	{
		let url;
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
				url = Site.getCurrent().getCustomPreferenceValue( 'KlarnaPaymentsEndpointProdUS' );
				break;
			case 'EUROPE' :
				url = Site.getCurrent().getCustomPreferenceValue( 'KlarnaPaymentsEndpointProdEurope' );
				break;
			default:
				log.warn( 'No URL for this region {0}', countryObject.custom.region );
			}		
		}
		else
		{
			switch( countryObject.custom.region )
			{
			case 'USA' :
				url = Site.getCurrent().getCustomPreferenceValue( 'KlarnaPaymentsEndpointTESTUS' );
				break;
			case 'EUROPE' :
				url = Site.getCurrent().getCustomPreferenceValue( 'KlarnaPaymentsEndpointTESTEurope' );
				break;
			default:
				log.warn( 'No URL for this region {0}', countryObject.custom.region );
			}		
		}
		log.debug( 'Set Klarna API URL to: {0}', url );
		
		return url;
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
			billingAddressObj.given_name 		= billingAddress.getFirstName();
			billingAddressObj.family_name 		= billingAddress.getLastName();
			billingAddressObj.title 			= !empty( billingAddress.getTitle() ) ? billingAddress.getTitle() : "";
			billingAddressObj.street_address 	= billingAddress.getAddress1();
			billingAddressObj.street_address2 	= !empty( billingAddress.getAddress2() ) ? billingAddress.getAddress2() : "";
			billingAddressObj.postal_code 		= billingAddress.getPostalCode();
			billingAddressObj.city 				= billingAddress.getCity();
			billingAddressObj.region 			= billingAddress.getStateCode();
			billingAddressObj.phone 			= billingAddress.getPhone();
			billingAddressObj.country 			= billingAddress.getCountryCode().toString();
		}
		catch( err )
		{
			throw new Error( 'Failed to construct Klarna Payments billing address object with exception: {0}', err.message );
		}
		log.debug ('Constructed Klarna payments billing address object as follows: {0}', JSON.stringify( billingAddressObj ) );
		
		/**
		 * @typedef  {Object} KlarnaPaymentsBillingAddressObj
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
			
			//add shipping information as a separate Klarna Payments Order Line Object
			if( basket.shippingTotalPrice.available )
			{
				orderLinesArrayObj.push( _getKlarnaPaymentsShippingOrderLineObj( basket ) );
			}
			
			//add tax information as a separate Klarna Payments Order Line Object
			if( basket.totalTax.available )
			{
				//orderLinesArrayObj.push( _getKlarnaPaymentsTaxOrderLineObj( basket ) );
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
			orderLineObj.name 			= productLineItem.getProductName();
			orderLineObj.quantity 		= productLineItem.getQuantity().getValue();
			orderLineObj.unit_price 	= productLineItem.getAdjustedGrossPrice().getValue() * 100;
			orderLineObj.total_amount 	= productLineItem.getAdjustedGrossPrice().getValue() * orderLineObj.quantity * 100;
			
			if( Site.getCurrent().getCustomPreferenceValue( 'sendProductAndImageURLs' ) )
			{
				orderLineObj.product_url= ( !empty( productLineItem.getProduct() ) && productLineItem.getProduct().getPageURL() !== null ) ? productLineItem.getProduct().getPageURL() : "";
				orderLineObj.image_url 	= !empty( productLineItem.getProduct() ) ? productLineItem.getProduct().getImage('small', 0).getImageURL({}).toString() : "";
			}			
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
	
	/**
	 * Get the Klarna Payments Order Line object from the Salesforce commerce cloud (SCC) shipping information
	 * @param  {dw.order.Basket} basket SCC basket
	 * 
	 * @private
	 * @return {KlarnaPaymentsOrderLineObj} orderLinesObj Klarna Payments Order Lines Object containing the shipping information.
	 */
	function _getKlarnaPaymentsShippingOrderLineObj( basket )
	{
		let orderLineObj = new Object();
		let shipment = basket.shipments.iterator().next();
		
		try
		{
			orderLineObj.type 			= "shipping_fee";
			orderLineObj.name 			= ( !empty( shipment ) && !empty( shipment.shippingMethod ) ) ? shipment.shippingMethod.displayName : "";
			orderLineObj.quantity 		= 1;
			orderLineObj.unit_price 	= basket.getShippingTotalGrossPrice().getValue() * 100;
			orderLineObj.total_amount 	= basket.getShippingTotalGrossPrice().getValue() * 100;
		}
		catch( err )
		{
			throw new Error( 'Failed to construct Klarna Payments order line object with SCC shipping information. Exception: {0}', err.message );
		}
		
		log.debug ('Constructed Klarna payments order line object containing SCC shipping infromation as follows: {0}', JSON.stringify( orderLineObj ) );

		return orderLineObj;	
	}
	
	/**
	 * Get the Klarna Payments Order Line object from the Salesforce commerce cloud (SCC) tax information
	 * @param  {dw.order.Basket} basket SCC basket
	 * 
	 * @private
	 * @return {KlarnaPaymentsOrderLineObj} orderLinesObj Klarna Payments Order Lines Object containing the shipping information.
	 */
	function _getKlarnaPaymentsTaxOrderLineObj( basket )
	{
		let orderLineObj = new Object();
		let shipment = basket.shipments.iterator().next();
		
		try
		{
			orderLineObj.type 			= "sales_tax";
			orderLineObj.name 			= "Sales Tax";
			orderLineObj.quantity 		= 1;
			orderLineObj.unit_price 	= basket.getTotalTax().getValue() * 100;
			orderLineObj.total_amount 	= basket.getTotalTax().getValue() * 100;
		}
		catch( err )
		{
			throw new Error( 'Failed to construct Klarna Payments order line object with SCC tax information. Exception: {0}', err.message );
		}
		
		log.debug ('Constructed Klarna payments order line object containing SCC tax infromation as follows: {0}', JSON.stringify( orderLineObj ) );

		return orderLineObj;	
	}
}