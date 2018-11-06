'use strict';

var Transaction = require('dw/system/Transaction');
var PaymentMgr = require( 'dw/order/PaymentMgr' );
var CustomObjectMgr = require( 'dw/object/CustomObjectMgr' );
var Countries = require( '~/cartridge/scripts/util/Countries' );
var Logger = require( 'dw/system/Logger' );
var StringUtils = require( 'dw/util/StringUtils' );
var Site = require( 'dw/system/Site' );

var log = Logger.getLogger( 'KLARNA_PAYMENTS.js' );

var KlarnaPayments = {
	httpService 			: require( '~/cartridge/scripts/common/KlarnaPaymentsHttpService.ds' ),
	apiContext 				: require( '~/cartridge/scripts/common/KlarnaPaymentsApiContext' ),
	sessionRequestBuilder 	: require( '~/cartridge/scripts/session/KlarnaPaymentsSessionRequestBuilder' ), 
	orderRequestBuilder 	: require( '~/cartridge/scripts/order/KlarnaPaymentsOrderRequestBuilder' )
};

var collections = require('*/cartridge/scripts/util/collections');

/**
 * Calculates the amount to be payed by a non-gift certificate payment instrument based
 * on the given basket. The method subtracts the amount of all redeemed gift certificates
 * from the order total and returns this value.
 *
 * @param {Object} lineItemCtnr - LineIteam Container (Basket or Order)
 * @returns {dw.value.Money} non gift certificate amount
 */
function calculateNonGiftCertificateAmount(lineItemCtnr) {
    var giftCertTotal = new dw.value.Money(0.0, lineItemCtnr.currencyCode);
    var gcPaymentInstrs = lineItemCtnr.getGiftCertificatePaymentInstruments();
    var iter = gcPaymentInstrs.iterator();
    var orderPI = null;

    while (iter.hasNext()) {
        orderPI = iter.next();
        giftCertTotal = giftCertTotal.add(orderPI.getPaymentTransaction().getAmount());
    }

    var orderTotal = lineItemCtnr.totalGrossPrice;
    var amountOpen = orderTotal.subtract(giftCertTotal);
    return amountOpen;
}

function createPaymentInstrument(basket, paymentType) {
    var paymentInstr = null;

    if (basket == null) {
        return null;
    }

    var iter = basket.getPaymentInstruments(paymentType).iterator();
    Transaction.wrap(function () {
        while (iter.hasNext()) {
            var existingPI = iter.next();
            basket.removePaymentInstrument(existingPI);
        }
    });

    var amount = calculateNonGiftCertificateAmount(basket);

    Transaction.wrap(function () {
        paymentInstr = basket.createPaymentInstrument(paymentType, amount);
    });

    return paymentInstr;
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

		Transaction.wrap( function() {
			session.privacy.KlarnaPaymentsOrderID = response.order_id;
			session.privacy.KlarnaPaymentsRedirectURL = response.redirect_url;
			session.privacy.KlarnaPaymentsFraudStatus = response.fraud_status;
		} );
	} catch( e ) {
		log.error( 'Error in creating Klarna Payments Order: {0}', e );
		return false;
    }

	return true;
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

	if ( empty( currentCountry ) ) {
		currentCountry = Countries.getCurrent( {CurrentRequest: request} ).countryCode;
	}

	localeObject = CustomObjectMgr.getCustomObject( 'KlarnaCountries', currentCountry );

	return localeObject;
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
 * Processor Handle
 *
 * @param {dw.order.LineItemCtnr} basket - Current basket
 * @param {boolean} isFromCart - Is checkout started from cart
 * @returns {Object} Processor handling result
 */
function handle(basket, isFromCart) {
    var methodName = "KLARNA_PAYMENTS";

    var amount = calculateNonGiftCertificateAmount(basket);

    var paymentInstrument = null;

    Transaction.wrap(function () {
        var paymentInstruments = basket.getPaymentInstruments(methodName);

        collections.forEach(paymentInstruments, function (item) {
            basket.removePaymentInstrument(item);
		});

        paymentInstrument = basket.createPaymentInstrument(methodName, amount);
    });

    return {
        success: true,
        paymentInstrument: paymentInstrument
    };
}

/**
 * Update Order Data
 *
 * @param {dw.order.LineItemCtnr} order - Order object
 * @param {string} orderNo - Order Number
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument - current payment instrument
 * @returns {Object} Processor authorizing result
 */
function authorize(order, orderNo, paymentInstrument) {
    if (empty(paymentInstrument) || empty(order)) {
        return { error: true };
    }

	var paymentProcessor = PaymentMgr.getPaymentMethod( paymentInstrument.getPaymentMethod() ).getPaymentProcessor();
    var localeObject = getLocale();

    if (paymentInstrument.getPaymentTransaction().getAmount().getValue() === 0) {
        Transaction.wrap(function () {
            order.removePaymentInstrument(paymentInstrument);
        });
        return { authorized: true };
    }

	var klarnaOrderCreated = _createOrder( order, localeObject );

	Transaction.wrap( function() {
		paymentInstrument.paymentTransaction.custom.kpFraudStatus = session.privacy.KlarnaPaymentsFraudStatus;	
	} );

	if( !klarnaOrderCreated || session.privacy.KlarnaPaymentsFraudStatus === 'REJECTED' ) {
		return { error: true };
    }

	if( session.privacy.KlarnaPaymentsFraudStatus === 'ACCEPTED' && !Site.getCurrent().getCustomPreferenceValue( 'kpVCNEnabled' )) {
		_acknowledgeOrder( session.privacy.KlarnaPaymentsOrderID, localeObject );
	}

	Transaction.wrap( function() {
		paymentInstrument.paymentTransaction.transactionID = session.privacy.KlarnaPaymentsOrderID;
		paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
		session.privacy.OrderNo = orderNo;
		order.custom.kpOrderID = session.privacy.KlarnaPaymentsOrderID;	
	    order.custom.kpIsVCN = empty(Site.getCurrent().getCustomPreferenceValue( 'kpVCNEnabled' )) ? false : Site.getCurrent().getCustomPreferenceValue( 'kpVCNEnabled' );
	} );

	if (session.privacy.KlarnaPaymentsFraudStatus === 'PENDING') {
		return { authorized: true };
	} else {
		if (Site.getCurrent().getCustomPreferenceValue( 'kpVCNEnabled' )) {
			var isSettlementCreated = _createVCNSettlement(order, session.privacy.KlarnaPaymentsOrderID, localeObject);
			if (isSettlementCreated) 
			{
				//Plug here your Credit Card Processor
				//return require('~/cartridge/scripts/payment/processor/BASIC_CREDIT').Authorize({'OrderNo': order.getOrderNo(),'PaymentInstrument': order.getPaymentInstruments("Klarna")[0]});
			}
			else 
			{
				_cancelOrder(order,localeObject);
				return { error: true };
			}
		}
	}

	return { authorized: true };
}

exports.handle = handle;
exports.authorize = authorize;
