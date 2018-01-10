var FRAUD_STATUS = {
	ACCEPTED : 'ACCEPTED',
	REJECTED : 'REJECTED',
	PENDING : 'PENDING',
	ACCEPTED_AFTER_REVIEW : 'ACCEPTED_AFTER_REVIEW',
	REJECTED_AFTER_REVIEW : 'REJECTED_AFTER_REVIEW'
}

var PAYMENT_METHOD = 'KLARNA_CHECKOUT';

var ORDER_LINE_TYPE = 	{
	DISCOUNT : 'discount',
	SHIPPING_FEE : 'shipping_fee',
	SALES_TAX : 'sales_tax',
	PHYSICAL : 'physical',
	SURCHARGE : 'surcharge',
	GIFT_CERTIFICATE : 'gift_card',
	GIFT_CERTIFICATE_PI : 'store_credit'
}

var CONTENT_TYPE = 'application/vnd.klarna.internal.emd-v2+json';

//Site Genesis Cartridge Names
var SG_CORE = 'app_storefront_core';
var SG_PIPELINES = 'app_storefront_pipelines';
var SG_CONTROLLERS = 'app_storefront_controllers';

module.exports.FRAUD_STATUS = FRAUD_STATUS;
module.exports.PAYMENT_METHOD = PAYMENT_METHOD;
module.exports.ORDER_LINE_TYPE = ORDER_LINE_TYPE;
module.exports.CONTENT_TYPE = CONTENT_TYPE;
module.exports.SG_CORE = SG_CORE;
module.exports.SG_PIPELINES = SG_PIPELINES;
module.exports.SG_CONTROLLERS = SG_CONTROLLERS;