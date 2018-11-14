'use strict';

var server = require('server');

var processor = require( '~/cartridge/scripts/klarna_payments/processor' );
var KlarnaSessionManager = require( '~/cartridge/scripts/common/KlarnaSessionManager' );
var KlarnaPaymentsHttpService = require('~/cartridge/scripts/common/KlarnaPaymentsHttpService.ds');
var URLUtils = require('dw/web/URLUtils');
var Logger = require( 'dw/system/Logger' );
var log = Logger.getLogger( 'KlarnaPayments' );
var ServiceRegistry = require('dw/svc/ServiceRegistry');
var OrderMgr = require( 'dw/order/OrderMgr' );

server.post(
	'Notification',
	function (req, res, next) {
		var klarnaPaymentsFraudDecisionObject = JSON.parse( request.httpParameterMap.requestBodyAsString );
		var kpOrderID = klarnaPaymentsFraudDecisionObject.order_id;
		var kpEventType = klarnaPaymentsFraudDecisionObject.event_type;
		var currentCountry = request.httpParameterMap.klarna_country.value;
		var order = OrderMgr.queryOrder( "custom.kpOrderID = {0}", kpOrderID );

		if ( !order ) {
			res.setStatusCode( 200 );
		}

		try {
			processor.notify( order, kpOrderID, kpEventType, currentCountry);

			res.setStatusCode( 200 );
		} catch (e) {
			log.error(e);
		}
	}
);

server.get(
	"TestNotification",
	function (req, res, next) {
		var notificationUrl = URLUtils.https('KLARNA_PAYMENTS-Notification', 'klarna_country', "en_US").toString();
		var requestBody = {
			"order_id": "d2a1a1a1-5879-61ba-8372-8ee7e1bf263d",
			"event_type": "FRAUD_RISK_REJECTED"
		};

		try {
			var service = ServiceRegistry.get("klarna.http.defaultendpoint");
			service.setCredentialID("klarna.http.uscredentials");
			service.URL = notificationUrl;
			service.addHeader('Content-Type', 'application/json');
			service.addHeader('Accept', 'application/json');
			service.setRequestMethod("POST");

			result = service.call(requestBody);
		} catch (e) {
			log.error(e);
		}
	}
);

server.get(
	'SaveAuth',
	function (req, res, next) {
		var token = req.httpHeaders['x-auth'];
		var userSession = request.session;
		var locale = request.locale;

		var klarnaSessionManager = new KlarnaSessionManager(userSession, locale);	
		klarnaSessionManager.saveAuthorizationToken(token);

		res.setStatusCode( 200 );
	}
);

module.exports = server.exports();