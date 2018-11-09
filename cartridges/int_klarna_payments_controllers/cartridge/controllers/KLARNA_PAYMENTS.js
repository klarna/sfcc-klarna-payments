'use strict';

/**
 * Controller for all Klarna Payments related functions.
 *
 * @module controllers/KLARNA_PAYMENTS
 */

/* API Includes */
var PaymentMgr = require( 'dw/order/PaymentMgr' );
var Transaction = require( 'dw/system/Transaction' );
var Logger = require( 'dw/system/Logger' );
var CustomObjectMgr = require( 'dw/object/CustomObjectMgr' );
var BasketMgr = require( 'dw/order/BasketMgr' );
var OrderMgr = require( 'dw/order/OrderMgr' );
var StringUtils = require( 'dw/util/StringUtils' );
var Status = require( 'dw/system/Status' );
var PaymentInstrument = require( 'dw/order/PaymentInstrument' );
var Site = require( 'dw/system/Site' );
var Cypher = require( 'dw/crypto/Cipher' );

var COSummary = require( 'sitegenesis_storefront_controllers/cartridge/controllers/COSummary.js' );

/* Script Modules */
var log = Logger.getLogger( 'KLARNA_PAYMENTS.js' );
var SG_CONTROLLERS = require( 'int_klarna_payments/cartridge/scripts/util/KlarnaPaymentsConstants.js' ).SG_CONTROLLERS;
var SG_CORE = require( 'int_klarna_payments/cartridge/scripts/util/KlarnaPaymentsConstants.js' ).SG_CORE;
var guard = require( SG_CONTROLLERS + '/cartridge/scripts/guard' );
var Countries = require( SG_CORE + '/cartridge/scripts/util/Countries' );
var KlarnaPayments = {
	httpService 			: require( 'int_klarna_payments/cartridge/scripts/common/KlarnaPaymentsHttpService.ds' ),
	apiContext 				: require( 'int_klarna_payments/cartridge/scripts/common/KlarnaPaymentsApiContext' ),
	sessionRequestBuilder 	: require( 'int_klarna_payments/cartridge/scripts/session/KlarnaPaymentsSessionRequestBuilder' ), 
	orderRequestBuilder 	: require( 'int_klarna_payments/cartridge/scripts/order/KlarnaPaymentsOrderRequestBuilder' )
};
var Utils = require( SG_CORE + '/cartridge/scripts/checkout/Utils' );


/**
 * Creates a Klarna payment instrument for the given basket
 * @param {Object} args object containing Basket (dw.order.Basket), PaymentMethodID (string) properties
 * 
 * @return {Object} handleObject if handle is successfull { success: true }, otherwise { error: true }
 */
function handle( args )
{
	var basket = args.Basket;
	var paymentInstrs = [];
	var iter = {};
	var existingPI = {};
	var amount = 0;
	
	Transaction.wrap( function()
	{
		if( basket === null )	
		{
			return { error: true };
		}

		paymentInstrs = basket.getPaymentInstruments();
		iter = paymentInstrs.iterator();
		existingPI = null;

		// remove all PI except gift certificates
		while( iter.hasNext() )
		{
			existingPI = iter.next();
			if ( !PaymentInstrument.METHOD_GIFT_CERTIFICATE.equals( existingPI.paymentMethod ) ) 
			{
				args.Basket.removePaymentInstrument( existingPI );
			}		
		}	
		
		amount = Utils.calculateNonGiftCertificateAmount( basket );
		basket.createPaymentInstrument( "Klarna", amount );		
	} );

	return {
		success: true
	};
}

/**
 * Authorizes a payment using a KLARNA_PAYMENTS processor.
 * @param {Object} args object containing OrderNo (string), Order (dw.order.Order) and PaymentInstrument(dw.order.PaymentInstrument) properties
 * 
 * @return {Object} authObject if authorization is successfull { authorized: true }, otherwise { error: true }
 */
function authorize( args )
{
	var orderNo = args.OrderNo;
	var paymentInstrument = args.PaymentInstrument;
	var paymentProcessor = PaymentMgr.getPaymentMethod( paymentInstrument.getPaymentMethod() ).getPaymentProcessor();
	var localeObject = getLocale();
	
	var klarnaOrderCreated = _createOrder( args.Order, localeObject );
	
	Transaction.wrap( function()
	{
		paymentInstrument.paymentTransaction.custom.kpFraudStatus = session.privacy.KlarnaPaymentsFraudStatus;	
	} );

	if( !klarnaOrderCreated || session.privacy.KlarnaPaymentsFraudStatus === 'REJECTED' )
	{
		return { error: true };
	}
	if( session.privacy.KlarnaPaymentsFraudStatus === 'ACCEPTED' && !Site.getCurrent().getCustomPreferenceValue( 'kpVCNEnabled' ))
	{
		_acknowledgeOrder( session.privacy.KlarnaPaymentsOrderID, localeObject );
	}
	
	Transaction.wrap( function()
	{
		paymentInstrument.paymentTransaction.transactionID = session.privacy.KlarnaPaymentsOrderID;
		paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
		session.privacy.OrderNo = orderNo;
		args.Order.custom.kpOrderID = session.privacy.KlarnaPaymentsOrderID;	
		args.Order.custom.kpIsVCN = empty(Site.getCurrent().getCustomPreferenceValue( 'kpVCNEnabled' )) ? false : Site.getCurrent().getCustomPreferenceValue( 'kpVCNEnabled' );
	} );

	if (session.privacy.KlarnaPaymentsFraudStatus === 'PENDING')
	{
		return { authorized: true };
	}
	else
	{
		if (Site.getCurrent().getCustomPreferenceValue( 'kpVCNEnabled' ))
		{
			var isSettlementCreated = _createVCNSettlement(args.Order, session.privacy.KlarnaPaymentsOrderID, localeObject);
			if (isSettlementCreated) 
			{
				//Plug here your Credit Card Processor
				return require('SiteGenesis_controllers/cartridge/scripts/payment/processor/BASIC_CREDIT').Authorize({'OrderNo':args.Order.getOrderNo(),'PaymentInstrument': args.Order.getPaymentInstruments("Klarna")[0]});
			}
			else 
			{
				_cancelOrder(args.Order,localeObject);
				return { error: true };
			}
		}
	}
	
	return { authorized: true };
}

/**
 * Creates a Klarna order through Klarna API
 * @param {dw.order.Order} order SCC order object
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 * 
 * @return {Boolean} true if order has been successfully created, otherwise false
 */
function _createOrder( order, localeObject )
{
	var klarnaPaymentsHttpService = {};
	var klarnaApiContext = {};
	var requestBody = {};
	var requestUrl = '';
	var response = {};
	var klarnaAuthorizationToken = session.privacy.KlarnaPaymentsAuthorizationToken;
	
	try {
		klarnaPaymentsHttpService = new KlarnaPayments.httpService();
		klarnaApiContext = new KlarnaPayments.apiContext();
		requestBody = _getOrderRequestBody( order, localeObject );
		requestUrl = StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'createOrder' ), klarnaAuthorizationToken );
		
		response = klarnaPaymentsHttpService.call( requestUrl, 'POST', localeObject.custom.credentialID, requestBody );
		
		Transaction.wrap( function()
		{
			session.privacy.KlarnaPaymentsOrderID = response.order_id;
			session.privacy.KlarnaPaymentsRedirectURL = response.redirect_url;
			session.privacy.KlarnaPaymentsFraudStatus = response.fraud_status;
		} );
	} catch( e ) 
	{
		log.error( 'Error in creating Klarna Payments Order: {0}', e );
		return false;
	}  
	return true;
}

/**
 * Create VCN settlement
 * @param {dw.order.Order} order SCC order object
 * @param {string} klarnaPaymentsOrderID Klarna Payments order id
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 * 
 * @return {Boolean} true if VCN settlement is created successfully, otherwise false 
 */
function _createVCNSettlement( order, klarnaPaymentsOrderID, localeObject )
{
	var klarnaPaymentsHttpService = {};
	var klarnaApiContext = {};
	var requestBody = {};
	var requestUrl = '';
	var response = {};
	var VCNPrivateKey = Site.getCurrent().getCustomPreferenceValue( 'vcnPrivateKey' );
	var cypher = new Cypher();
	
	try {
		klarnaPaymentsHttpService = new KlarnaPayments.httpService();
        klarnaApiContext = new KlarnaPayments.apiContext();
        requestBody = {'order_id' : klarnaPaymentsOrderID};
        requestUrl = klarnaApiContext.getFlowApiUrls().get('vcnSettlement');
        
		response = klarnaPaymentsHttpService.call(requestUrl, 'POST', localeObject.custom.credentialID, requestBody);	
		if( empty(response.settlement_id) )
		{
			log.error( 'Error in creating Klarna Payments VCN Settlement: {0}', e );
			return false;		
		}
		//var panEncrypted = response.cards[0].pan;
		//var cscEncrypted = response.cards[0].csc;
		
		//mocking pan and csc
		var panEncrypted = 'U50dpsYfr29a+kZta2A9pYdAPYvp1GnUYEt7BwFF2vWcD+31EHhzUuKHNnns61NQ+pjayXjHMll1v3lNLDehhAVj5/OuJCmAgk20Wx1SI/RYLtK5wA9Iv7ZOnGdwXOseTTUcXCgY1fjpBWtpqlgsBgqobZhaX3Q0KaBk89qwT2o21/Yo5HKiafxnZSAQ0x2lG5GBkRjy/UC/9nfkeCNZATxADQG2L3FnHrqXq/F6CLUmsxPIawWO5wmpYToa4/4UhAuQS/L/3lmvXoBd68gNSQsWSs+gjrNxMejmR5HJvzuwUj+htLZxvGds+FRSFFABZfbU+z1b9HjbzdxdkD55jtVHoWA1diTiFODSguScertk0oCwAFz6AKFC4P7NedfDuko3QFew2ab3CFO76DYQYXDE18itNHAG/PgpkYttS7sS1n1EJMBGh+18BbOmOutyuuAq0z7j3tiUfLl0aXCMs76VeoawGBKQhIY2k6fUTlaRjolSAwcwZbZV7dZZq5TcwIVzhiIBOtz/v3y0AhnEUua5kOeM6r1ulPqdPv2vHRIPPDHwQ6051GB68QpVnIRnvR63UVOqogsXyBduO281MNbXWRlO7c1UbjI3UlJiM0AVsZgZ0uWQxhbF+Xu48dkjhcjvbA4oi79RRtw4UfDHyEOOSX2zaOf/D5KY1GUPwAw=';
		var cscEncrypted = 'P/jEMDJszBNpVdwNN/OCBHW+yuF3WcXGhX/vwVFjeGjp/YohO//6pHm9ggtY0m6inTzvfA849VZlJxeq8QVpo1p8dUUvC6L6CvmUEC8kUZBU77TkNChJCvzaGYr74pjsntu65A3nipraGCoCkAdYagtrJBZ0gl6jrv8jq2f+OfuH+YZoX0HMqvSh0v1+M+7sHLhxVDPs7Daqn8v6qyuZEajMYk4AZI4uKAu/X3TJTItC4hXa/epGIPDivyQ/EwDMK27P/I8rfw0bY6zxMw2+fYWlVjXbrUtl7Z/WiiUNC3cayrZtysAphD3RLt9re6dC6h1AzCIWBFZxHKCJB1MihDqgALOeLS6B4rxqljbb3bfWAkK6nkbnSEHwlvh628eNyIS9Ga/YWlriy4Z7kcCH7VuFcfKskGiDUE1qozeOmq58dMj6DRwsjgCshnWfd/HXcIdYuvEb0wn/mMygZa7MG2V7Sd2ROLtNpn6JhR0WScgJcwNWVN7sfhmElGy8bcmDYArusU0mDTUfamPmhVeRTbdiWE8xEqSqmIStUoPe1BvxHeKs+Gdw6iQKsxruwOJb+Tz5zzyfbsrVDp3wxsa3nb9nSJOZGTmi3ie7y02a/KuLGsypsIXZR2P1Jjofuh4mvT1nu4W2VJKNG9IuhxIAh8adCCxbZ0Cn70+8P3p42S4=';
		
		var panDecrypted = cypher.decrypt(panEncrypted, VCNPrivateKey, "RSA/ECB/PKCS1PADDING", null, 0);
		var cscDecrypted = cypher.decrypt(cscEncrypted, VCNPrivateKey, "RSA/ECB/PKCS1PADDING", null, 0);
		
		Transaction.wrap( function()
		{
			order.custom.kpVCNBrand = response.cards[0].brand;
			order.custom.kpVCNCSC = cscDecrypted;
			order.custom.kpVCNExpirationMonth = response.cards[0].expiration_month;
			order.custom.kpVCNExpirationYear = response.cards[0].expiration_year;
			order.custom.kpVCNHolder = response.cards[0].holder;
			order.custom.kpVCNPAN = panDecrypted;	
			order.custom.kpIsVCN = true;		
		} );
	} catch( e ) 
	{
		log.error( 'Error in creating Klarna Payments VCN Settlement: {0}', e );
		return false;
	}
	return true;
}

/**
 * Cancels a Klarna order through Klarna API
 * @param {dw.order.Order} order SCC order object
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 * 
 * @return {Boolean} true if order has been successfully cancelled, otherwise false
 */
function _cancelOrder( order, localeObject )
{
	var klarnaPaymentsHttpService = {};
	var klarnaApiContext = {};
	var requestUrl = '';
	
	try {
		klarnaPaymentsHttpService = new KlarnaPayments.httpService();
        klarnaApiContext = new KlarnaPayments.apiContext();
        requestUrl = StringUtils.format(klarnaApiContext.getFlowApiUrls().get('cancelOrder'), order.custom.kpOrderID);
        
		klarnaPaymentsHttpService.call(requestUrl, 'POST', localeObject.custom.credentialID, null);
	} catch( e ) 
	{
		log.error( 'Error in cancelling Klarna Payments Order: {0}', e );
		return false;
	}  
	return true;
}

/**
 * Gets Klarna Payments Locale object
 * 
 * @param {string} currentCountry current country locale
 * 
 * @return {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 */
function getLocale( currentCountry ) {
	var localeObject = {};
	var countryCode = '';
	if ( empty( currentCountry ) )
	{
		currentCountry = Countries.getCurrent( {CurrentRequest: request} ).countryCode;
	}   

	localeObject = CustomObjectMgr.getCustomObject( 'KlarnaCountries', currentCountry );
	
	return localeObject;
}

/**
 * Creates a Klarna payments session through Klarna API
 * 
 * @return {void}
 */
function createSession() {
	var localeObject = getLocale();
	var klarnaPaymentsHttpService = {};
	var klarnaApiContext = {};
	var requestBody = {};
	var requestUrl = '';
	var response = {};
	
	if( !empty( session.privacy.KlarnaPaymentsSessionID ) )
	{
		updateSession();
		var currentCookies = request.getHttpCookies();
		if (currentCookies.hasOwnProperty('selectedKlarnaPaymentCategory')) {
			session.privacy.SelectedKlarnaPaymentMethod = currentCookies['selectedKlarnaPaymentCategory'].value;
		}
	}
	else
	{
		try {
			klarnaPaymentsHttpService = new KlarnaPayments.httpService();
			klarnaApiContext = new KlarnaPayments.apiContext();
			requestBody = _getSessionRequestBody( BasketMgr.getCurrentBasket(), localeObject );
			requestUrl = klarnaApiContext.getFlowApiUrls().get( 'createSession' );

			response = klarnaPaymentsHttpService.call( requestUrl, 'POST', localeObject.custom.credentialID, requestBody );

			Transaction.wrap( function()
			{
				session.privacy.KlarnaPaymentsSessionID = response.session_id;
				session.privacy.KlarnaPaymentsClientToken = response.client_token;
				session.privacy.KlarnaPaymentMethods = response.payment_method_categories ? response.payment_method_categories : null;
				session.privacy.SelectedKlarnaPaymentMethod = null;
			} );
		} catch( e ) 
		{
			log.error( 'Error in creating Klarna Payments Session: {0}', e );
			Transaction.wrap( function()
			{
				session.privacy.KlarnaPaymentsSessionID = null;
				session.privacy.KlarnaPaymentsClientToken = null;
				session.privacy.KlarnaPaymentMethods = null;
				session.privacy.SelectedKlarnaPaymentMethod = null;
			} );
		}
	
	}   	
}

/**
 * Creates a Klarna payments session through Klarna API
 * @param {dw.order.Basket} 		basket			SCC Basket object
 * @param {dw.object.CustomObject} 	localeObject 	corresponding to the locale Custom Object from KlarnaCountries
 * 
 * @private
 * @return {Object} requestObject Klarna Payments request object
 */
function _getSessionRequestBody( basket, localeObject )
{
	var sessionRequestBuilder = new KlarnaPayments.sessionRequestBuilder();
	
	return sessionRequestBuilder.buildRequest( {
		basket: basket,
		localeObject: localeObject
	} ).get();
}

/**
 * Creates a Klarna payments order through Klarna API
 * @param {dw.order.Order} 			order 			SCC order object
 * @param {dw.object.CustomObject} 	localeObject 	corresponding to the locale Custom Object from KlarnaCountries
 * 
 * @private
 * @return {Object} requestObject Klarna Payments request object
 */
function _getOrderRequestBody( order, localeObject )
{
	var orderRequestBuilder = new KlarnaPayments.orderRequestBuilder();
	
	return orderRequestBuilder.buildRequest( {
		order: order,
		localeObject: localeObject
	} ).get();
}

/**
 * Updates a Klarna payments session through Klarna API
 * 
 * @return {void}
 */
function updateSession() {
	var localeObject = getLocale();
	var klarnaPaymentsHttpService = {};
	var klarnaApiContext = {};
	var requestBody = {};
	var requestUrl = '';
	var response = {};
	
	try {
		klarnaPaymentsHttpService = new KlarnaPayments.httpService();
		klarnaApiContext = new KlarnaPayments.apiContext();
		requestBody = _getSessionRequestBody( BasketMgr.getCurrentBasket(), localeObject );
		requestUrl = StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'updateSession' ), session.privacy.KlarnaPaymentsSessionID );

		// Update session
		klarnaPaymentsHttpService.call( requestUrl, 'POST', localeObject.custom.credentialID, requestBody );

		// Read updated session
		response = klarnaPaymentsHttpService.call( requestUrl, 'GET', localeObject.custom.credentialID );

		Transaction.wrap( function()
		{
			session.privacy.KlarnaPaymentsClientToken = response.client_token;
			session.privacy.KlarnaPaymentMethods = response.payment_method_categories ? response.payment_method_categories : null;
		} );

	} catch( e )
	{
		log.error( 'Error in updating Klarna Payments Session: {0}', e );
		Transaction.wrap( function()
		{
			session.privacy.KlarnaPaymentsSessionID = null;
			session.privacy.KlarnaPaymentsClientToken = null;
			session.privacy.KlarnaPaymentMethods = null;
			session.privacy.SelectedKlarnaPaymentMethod = null;
		} );
	}  
}

/**
 * Entry point for showing confirmation page after Klarna redirect
 * 
 * @return {Object} call call COSummary to show confirmation
 */
function confirmation() {
	var order = OrderMgr.getOrder( session.privacy.OrderNo );
	
	return COSummary.ShowConfirmation( order );
}

/**
 * Entry point for notifications on pending orders
 * 
 * @return {void}
 */
function notification()
{
	var klarnaPaymentsFraudDecisionObject = JSON.parse( request.httpParameterMap.requestBodyAsString );
	var klarnaPaymentsOrderID = klarnaPaymentsFraudDecisionObject.order_id;
	var klarnaPaymentsFraudDecision = klarnaPaymentsFraudDecisionObject.event_type;
	var currentCountry = request.httpParameterMap.klarna_country.value;
	var localeObject = getLocale( currentCountry );
	var order = OrderMgr.queryOrder( "custom.kpOrderID ={0}", klarnaPaymentsOrderID );

	if( empty( order ) )
	{
		return response.setStatus( 200 );
	}
	Transaction.wrap( function()
	{
		order.getPaymentInstruments("Klarna")[0].paymentTransaction.custom.kpFraudStatus = klarnaPaymentsFraudDecision;
	} );
	if( klarnaPaymentsFraudDecision === 'FRAUD_RISK_ACCEPTED' )
	{
		if (order.custom.kpIsVCN) 
		{
			var isSettlementCreated = _createVCNSettlement(order, klarnaPaymentsOrderID);
			if (isSettlementCreated) 
			{
				//Plug here your Credit Card Processor
				var authObj = require('SiteGenesis_controllers/cartridge/scripts/payment/processor/BASIC_CREDIT').Authorize({'OrderNo':order.getOrderNo(),'PaymentInstrument': order.getPaymentInstruments("Klarna")[0]});
				if(authObj.error) 
				{
					Transaction.wrap( function()
					{
						OrderMgr.failOrder( order );
					} );
					return response.setStatus( 200 );
				}
			}
			else 
			{
				_cancelOrder(order, localeObject);
				Transaction.wrap( function()
				{
					OrderMgr.failOrder( order );
				} );
				return response.setStatus( 200 );
			}
		}
		placeOrder( order, klarnaPaymentsOrderID, localeObject );
		
	} else
	{
		Transaction.wrap( function()
		{
			OrderMgr.failOrder( order );
		} );
	}	
	return response.setStatus( 200 );
}

/**
 * Place an order using OrderMgr. If order is placed successfully,
 * its status will be set as confirmed, and export status set to ready. Acknowledge order with Klarna Payments
 * 
 * @param {dw.order.Order} 			order 					SCC order object
 * @param {string} 					klarnaPaymentsOrderID 	Klarna Payments Order ID
 * @param {dw.object.CustomObject} 	localeObject 			Klarna Payments locale Object
 * 
 * @return {void}
 */
function placeOrder( order, klarnaPaymentsOrderID, localeObject )
{
	Transaction.wrap( function()
	{
		var placeOrderStatus = OrderMgr.placeOrder( order );
		if ( placeOrderStatus === Status.ERROR )
		{
			OrderMgr.failOrder( order );
			throw new Error( 'Failed to place order.' );
		}
		order.setConfirmationStatus( order.CONFIRMATION_STATUS_CONFIRMED );
		order.setExportStatus( order.EXPORT_STATUS_READY );
	} );
	
	_acknowledgeOrder( klarnaPaymentsOrderID, localeObject );
}

/**
 * Call Klarna Payments API to acknowledge the order
 * @param {string} 					klarnaPaymentsOrderID 	Klarna Payments Order ID
 * @param {dw.object.CustomObject} 	localeObject 			corresponding to the locale Custom Object from KlarnaCountries
 * 
 * @private
 * @return {void}
 */
function _acknowledgeOrder( klarnaPaymentsOrderID, localeObject )
{
	var klarnaHttpService = {};
	var klarnaApiContext = {};
	var klarnaOrderID = klarnaPaymentsOrderID; 
	var requestUrl = '';
	var response = {};

	try {
		klarnaHttpService = new KlarnaPayments.httpService();
		klarnaApiContext = new KlarnaPayments.apiContext();
		requestUrl = StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'acknowledgeOrder' ), klarnaOrderID );		
		
		response = klarnaHttpService.call( requestUrl, 'POST', localeObject.custom.credentialID );
	} catch( e )
	{
		log.error( 'Error in updating Klarna Payments Session: {0}', e );
	}
}

/**
 * Redirect the customer to the Klrana Payments redirect_url.
 * The reason for this redirect is to allow Klarna to recognize the customer's device in future interactions.
 * 
 * @return {void}
 */
function redirect()
{
	Transaction.wrap( function()
	{
		session.privacy.KlarnaPaymentsSessionID = null;
		session.privacy.KlarnaPaymentsClientToken = null;
		session.privacy.KlarnaPaymentMethods = null;
		session.privacy.SelectedKlarnaPaymentMethod = null;
	} );
	
	if( !empty( session.privacy.KlarnaPaymentsRedirectURL ) )
	{
		response.redirect( session.privacy.KlarnaPaymentsRedirectURL );
	}
}

/**
 * Place order with KlarnaPaymentsFraudStatus === 'PENDING'
 * set the export status to EXPORT_STATUS_NOTEXPORTED, set the confirmation status to NOTCONFIRMED, set the payment status to NOT PAID
 * @param {dw.order.Order} 			order 					SCC order object
 * 
 * @return {void}
 */
function pendingOrder( order )
{
	order.setExportStatus( order.EXPORT_STATUS_NOTEXPORTED );
	order.setConfirmationStatus( order.CONFIRMATION_STATUS_NOTCONFIRMED );
	order.setPaymentStatus( order.PAYMENT_STATUS_NOTPAID );
}

/**
 * Clear Klarna Payments session and token from current session
 * 
 * @return {void}
 */
function clearSession()
{
	Transaction.wrap( function()
	{
		session.privacy.KlarnaPaymentsSessionID = null;
		session.privacy.KlarnaPaymentsClientToken = null;
		session.privacy.KlarnaPaymentMethods = null;
		session.privacy.SelectedKlarnaPaymentMethod = null;
	} ); 
}

/**
 * Saves/Updates Klarna Payments authorization token in the current session
 * 
 * @return {void}
 */
function saveAuth()
{
	Transaction.wrap( function()
	{
		session.privacy.KlarnaPaymentsAuthorizationToken = request.httpHeaders['x-auth'];
	} ); 
	
	response.setStatus( 200 );
}
/*
 * Module exports
 */

/* Web exposed methods */

/** Creates a Klarna payments session through Klarna API */
exports.CreateSession = guard.ensure( ['https'], createSession );
/** Updates a Klarna payments session through Klarna API */
exports.UpdateSession = guard.ensure( ['get', 'https'], updateSession );
/** Entry point for showing confirmation page after Klarna redirect */
exports.Confirmation = guard.ensure( ['get', 'https'], confirmation );
/** Entry point for notifications on pending orders */
exports.Notification = guard.ensure( ['post', 'https'], notification );
/** Clear Klarna Payments session and token from current session */
exports.ClearSession = guard.ensure( ['get'], clearSession );
/** Saves/Updates Klarna Payments authorization token in the current session */
exports.SaveAuth = guard.ensure( ['get'], saveAuth );

/*
 * Local methods
 */
exports.Handle = handle;
exports.Authorize = authorize;
exports.GetLocale = getLocale;
exports.CreateSession = createSession;
exports.Redirect = redirect;
exports.PendingOrder = pendingOrder;