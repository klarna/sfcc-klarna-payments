( function()
{
	'use strict';

	var ShippingMgr = require( 'dw/order/ShippingMgr' );
	var Transaction = require( 'dw/system/Transaction' );
	var URLUtils = require( 'dw/web/URLUtils' );
	var Site = require( 'dw/system/Site' );
	var Logger = require( 'dw/system/Logger' );
	var TaxMgr = require( 'dw/order/TaxMgr' );
	var HookMgr = require( 'dw/system/HookMgr' );
	var ArrayList = require( 'dw/util/ArrayList' );

	var Builder = require( '../util/Builder' );
	var ORDER_LINE_TYPE = require( '../util/KlarnaPaymentsConstants.js' ).ORDER_LINE_TYPE;
	var CONTENT_TYPE = require( '../util/KlarnaPaymentsConstants.js' ).CONTENT_TYPE;
	var KlarnaPaymentsOrderModel = require( './KlarnaPaymentsOrderModel' ).KlarnaPaymentsOrderModel;
	var LineItem = require( './KlarnaPaymentsOrderModel' ).LineItem;
	var log = Logger.getLogger( 'KlarnaPaymentsOrderRequestBuilder.js' );

	function KlarnaPaymentsOrderRequestBuilder()
	{
		this.context = null;
	}

	KlarnaPaymentsOrderRequestBuilder.prototype = new Builder();
	KlarnaPaymentsOrderRequestBuilder.prototype.get = function()
	{
		return this.context;
	};

	KlarnaPaymentsSessionRequestBuilder.prototype._buildRequest = function( params ) {
		var order = params.order;
		var localeObject = params.localeObject.custom;

		var requestBodyObject = this.init()
			.setMerchantReference( order )
			.buildLocale( order, localeObject )
			.buildBilling( order )
			.buildShipping( order )
			.buildOrderLines( order, localeObject )
			.buildTotalAmount( order, localeObject )
			.buildTotalTax( order, localeObject )
			.buildAdditionalCustomerInfo( order )
			.buildOptions()
			.buildMerchantInformation( order, localeObject );

		return requestBodyObject;
	}

	/*
	    Build request here
	*/
	KlarnaPaymentsOrderRequestBuilder.prototype.buildRequest = function( params )
	{
		validateParams( params );

		return this._buildRequest( params );
	};

	KlarnaPaymentsOrderRequestBuilder.prototype.init = function()
	{
		this.context = new KlarnaPaymentsOrderModel();

		return this;
	};

	KlarnaPaymentsOrderRequestBuilder.prototype.setMerchantReference = function( order )
	{
		this.context.merchant_reference1 = order.orderNo;
		this.context.merchant_reference2 = "";

		if ( Site.getCurrent().getCustomPreferenceValue( 'merchant_reference2_mapping' ) )
		{
			try
			{
				this.context.merchant_reference2 = order[Site.getCurrent().getCustomPreferenceValue( 'merchant_reference2_mapping' )].toString();
			}
			catch( err )
			{
				log.error( "merchant_reference2 was not set. Error: {0} ", err.message );
			}
		}
		return this;
	};

	KlarnaPaymentsOrderRequestBuilder.prototype.buildBilling = function( order )
	{
		var billingAddress = order.getBillingAddress();
		if ( billingAddress === null )
		{
			return this;
		}
		buildBillingAddress.bind( this )( billingAddress );
		this.context.billing_address.email = order.customerEmail || '';

		return this;
	};

	KlarnaPaymentsOrderRequestBuilder.prototype.buildShipping = function( order )
	{
		// get default shipment shipping address
		var shippingAddress = order.getShipments().iterator().next().getShippingAddress(); 
		
		if ( shippingAddress === null || shippingAddress.address1 === null )
		{
			delete this.context.shipping_address;
			return this;
		}
		buildShippingAddress.bind( this )( shippingAddress );
		this.context.shipping_address.email = order.customerEmail;

		return this;
	};

	KlarnaPaymentsOrderRequestBuilder.prototype.buildLocale = function( order, localeObject )
	{
		var currency = order.getCurrencyCode();

		this.context.purchase_country = localeObject.country;
		this.context.purchase_currency = currency;
		this.context.locale = localeObject.klarnaLocale;

		return this;
	};

	KlarnaPaymentsOrderRequestBuilder.prototype.buildOrderLines = function( order, localeObject )
	{
		var lineItems = order.getAllProductLineItems().toArray();
		var giftCertificates = order.getGiftCertificateLineItems().toArray();
		var giftCertificatePIs = order.getGiftCertificatePaymentInstruments().toArray();
		var shipments = order.shipments;
		var country = localeObject.country;

		buildItems( lineItems, country, this.context );
		if ( giftCertificates.length > 0 )
		{
			buildItems( giftCertificates, country, this.context );
		}
		if ( giftCertificatePIs.length > 0 )
		{
			buildItemsGiftCertificatePIs( giftCertificatePIs, country, this.context );
		}
		buildShipments( shipments, country, this.context );

		return this;
	};

	KlarnaPaymentsOrderRequestBuilder.prototype.buildTotalAmount = function( order, localeObject )
	{
		var country = localeObject.country;
		var orderAmount = 0;
		var gcTotalAmount = getGCtotalAmount( order );
		if( order.totalGrossPrice.available )
		{
			orderAmount = order.totalGrossPrice.value * 100;
		}
		else
		{
			orderAmount = order.totalNetPrice.value * 100;
		}

		this.context.order_amount = Math.round( orderAmount - gcTotalAmount );

		// Set order discount line items
		addPriceAdjustments( order.priceAdjustments, null, null, country, this.context );

		return this;
	};

	KlarnaPaymentsOrderRequestBuilder.prototype.buildTotalTax = function( order, localeObject )
	{
		var country = localeObject.country;
		var totalTax = order.totalTax.value * 100;
		var usTotalTax = 0;
		var salesTaxItem = {};

		this.context.order_tax_amount = Math.round( totalTax );

		if( country === 'US' )
		{
			usTotalTax = ( order.totalTax.available ) ? order.totalTax.value * 100 : 0;
			salesTaxItem = new LineItem();
			salesTaxItem.quantity = 1;
			salesTaxItem.type = ORDER_LINE_TYPE.SALES_TAX;
			salesTaxItem.name = 'Sales Tax';
			salesTaxItem.reference = 'Sales Tax';
			salesTaxItem.unit_price = usTotalTax;
			salesTaxItem.tax_rate = 0;
			salesTaxItem.total_amount = usTotalTax;
			salesTaxItem.total_tax_amount = 0;

			this.context.order_lines.push( salesTaxItem );
		}

		return this;
	};

	KlarnaPaymentsOrderRequestBuilder.prototype.buildAdditionalCustomerInfo = function( order ) {
		if ( Site.getCurrent().getCustomPreferenceValue( 'kpAttachments' ) && HookMgr.hasHook( 'extra.merchant.data' ) ) {			
			this.context.attachment = new Object();
			this.context.attachment.content_type = CONTENT_TYPE;
			this.context.attachment.body = 	HookMgr.callHook( 'extra.merchant.data', 'BuildEMD', {
				LineItemCtnr: order
			} );	
		}

		return this;
	};

	KlarnaPaymentsOrderRequestBuilder.prototype.buildOptions = function()
	{
		this.context.options.color_details 					= Site.getCurrent().getCustomPreferenceValue( 'kpColorDetails' );
		this.context.options.color_button 					= Site.getCurrent().getCustomPreferenceValue( 'kpColorButton' );
		this.context.options.color_button_text 				= Site.getCurrent().getCustomPreferenceValue( 'kpColorButtonText' );
		this.context.options.color_checkbox 				= Site.getCurrent().getCustomPreferenceValue( 'kpColorCheckbox' );
		this.context.options.color_checkbox_checkmark 		= Site.getCurrent().getCustomPreferenceValue( 'kpColorCheckboxCheckmark' );
		this.context.options.color_header 					= Site.getCurrent().getCustomPreferenceValue( 'kpColorHeader' );
		this.context.options.color_link 					= Site.getCurrent().getCustomPreferenceValue( 'kpColorLink' );
		this.context.options.color_border 					= Site.getCurrent().getCustomPreferenceValue( 'kpColorBorder' );
		this.context.options.color_border_selected 			= Site.getCurrent().getCustomPreferenceValue( 'kpColorBorderSelected' );
		this.context.options.color_text 					= Site.getCurrent().getCustomPreferenceValue( 'kpColorText' );
		this.context.options.color_text_secondary 			= Site.getCurrent().getCustomPreferenceValue( 'kpColorTextSecondary' );
		this.context.options.radius_border 					= Site.getCurrent().getCustomPreferenceValue( 'kpRadiusBorder' );

		return this;
	};

	KlarnaPaymentsOrderRequestBuilder.prototype.buildMerchantInformation = function( order, localeObject )
	{
		var country = localeObject.country;

		this.context.merchant_urls.confirmation = URLUtils.https( 'KLARNA_PAYMENTS-Confirmation', 'klarna_country', country ).toString();
		this.context.merchant_urls.notification = URLUtils.https( 'KLARNA_PAYMENTS-Notification', 'klarna_country', country ).toString();

		return this;
	};


	function getItemPrice( li ) {
		return ( li.grossPrice.available && country !== 'US' ? li.grossPrice.value : li.netPrice.value ) * 100;
	}

	function getItemTaxRate( li ) {
		return ( country === 'US' ) ? 0 : Math.round( li.taxRate * 10000 );
	}

	function getItemTaxAmount( li ) {
		return ( country === 'US' ) ? 0 : Math.round( li.tax.value * 100 );
	}

	function getItemType( li ) {
		var type = '';

		if ( li.hasOwnProperty( 'optionProductLineItem' ) && li.optionProductLineItem ) {
			type = ORDER_LINE_TYPE.SURCHARGE;
		} else {
			type = ORDER_LINE_TYPE.PHYSICAL;
		}

		return type;
	}

	function getItemId( li ) {
		var id = '';

		if ( li.hasOwnProperty( 'optionProductLineItem' ) && li.optionProductLineItem ) {
			id = li.parent.productID + '_' + li.optionID + '_' + li.optionValueID;
		} else {
			id = li.productID;
		}

		return id;
	}

	function getItemBrand( li ) {
		var brand = '';

		if ( li.hasOwnProperty( 'optionProductLineItem' ) && li.optionProductLineItem ) {
			brand = ( !empty( li.parent.product ) ? li.parent.product.brand : null );
		} else {
			brand = ( !empty( li.product ) ? li.product.brand : null );
		}

		return brand;
	}

	function getItemCategoryPath( li ) {
		var path = '';

		if ( li.hasOwnProperty( 'optionProductLineItem' ) && li.optionProductLineItem ) {
			path = ( !empty( li.parent.product ) ? _getProductCategoryPath( li.parent.product ) : null );
		} else {
			path = ( !empty( li.product ) ? _getProductCategoryPath( li.product ) : null );
		}

		return path;
	}

	function generateItemProductURL( li ) {
		var url = '';

		if ( li.optionProductLineItem ) {
			url = ( URLUtils.http( 'Product-Show', 'pid', li.parent.productID ).toString() );
		} else {
			url = ( URLUtils.http( 'Product-Show', 'pid', li.productID ).toString() );
		}

		return url;
	}

	function generateItemImageURL( li ) {
		var url = '';

		if ( li.optionProductLineItem ) {
			url = ( li.parent.getProduct().getImage( 'small', 0 ).getImageURL( {} ).toString() );
		} else {
			url = ( li.getProduct().getImage( 'small', 0 ).getImageURL( {} ).toString() );
		}

		return url;
	}

	function buildItemProductAndImageUrls( li, item ) {
		if ( Site.getCurrent().getCustomPreferenceValue( 'sendProductAndImageURLs' ) ) {
			item.product_url = !empty( li.parent.productID ) ? generateItemProductURL( li ) : null;
			item.image_url = !empty( li.parent.getProduct().getImage( 'small', 0 ) ) ? generateItemImageURL( li ) : null;
		}
	}

	function buildItem( li ) {
		var itemPrice = getItemPrice( li );
		var	itemType = '';
		var item = {};
		var quantity = li.quantityValue;
		var brand = getItemBrand( li );
		var categoryPath = getCategoryPath( li );

		item = new LineItem();
		item.type = getItemType( li );
		item.reference = getItemId( li );
		item.quantity = quantity;
		item.type = itemType;
		item.name = li.productName.replace( /[^\x00-\x7F]/g, "" );
		item.unit_price = Math.round( itemPrice / quantity );
		item.tax_rate = getItemTaxRate( li );
		item.total_amount = Math.round( itemPrice );
		item.total_tax_amount = getItemTaxAmount( li );

		if ( !empty( brand ) ) {
			item.product_identifiers = item.product_identifiers || {};
			item.product_identifiers.brand = brand;
		}

		if ( !empty( categoryPath ) ) {
			item.product_identifiers = item.product_identifiers || {};
			item.product_identifiers.category_path = categoryPath;
		}

		buildItemProductAndImageUrls( li, item );

		return item;
	}

	function buildItems( items, country, context ) {
		var i = 0;
		var li = {};

		while ( i < items.length ) {
			li = items[i];

			// Add product-specific shipping line adjustments
			if ( !empty( li.shippingLineItem ) ) {
				addPriceAdjustments( li.shippingLineItem.priceAdjustments.toArray(), li.productID, null, country, context );
			}

			if ( !empty( li.priceAdjustments ) && li.priceAdjustments.length > 0 ) {
				addPriceAdjustments( li.priceAdjustments.toArray(), li.productID, li.optionID, country, context );
			}

			context.order_lines.push( buildItem( li ) );

			i += 1;
		}
	}
	
	function _getProductCategoryPath( product ) {
		var path = '';

		// get category from products primary category
		var category = product.primaryCategory;

		// get category from product master if not set at variant
		if( category === null && product.variant ) {
			category = product.variationModel.master.primaryCategory;
		}

		if ( category !== null ) {
			path = new ArrayList();
			while( category.parent !== null ) {
				if ( category.online ) { 
					path.addAt( 0, category.displayName );
				}
				category = category.parent;
			}
			path = path.join( ' > ' ).substring( 0, 749 ); //Maximum 750 characters per Klarna's documentation
		}

		return path;		
	}
	
	function buildItemsGiftCertificatePIs( items, country, context )
	{
		var li = [];
		var item = {};
		var paymentTransaction = {};
		var i = 0;

		for ( i = 0; i < items.length; i++ ) {
			li = items[i];
			paymentTransaction = li.getPaymentTransaction();

			item = new LineItem();
			item.quantity = 1;
			item.type = ORDER_LINE_TYPE.GIFT_CERTIFICATE_PI;
			item.name = 'Gift Certificate';
			item.reference = li.getMaskedGiftCertificateCode();
			item.unit_price = paymentTransaction.getAmount() * 100 * ( -1 );
			item.tax_rate = 0;
			item.total_amount = paymentTransaction.getAmount() * 100 * ( -1 );
			item.total_tax_amount = 0;

			context.order_lines.push( item );
		}
	}
	
	function getGCtotalAmount( order ) {
		var giftCertificatePIs = order.getGiftCertificatePaymentInstruments().toArray();
		var gcTotalAmount = 0;
		var i = 0;

		if ( giftCertificatePIs.length > 0 ) {			
			for ( i = 0; i < giftCertificatePIs.length; i++ ) {
				gcTotalAmount += giftCertificatePIs[i].getPaymentTransaction().getAmount() * 100;	
			}
		} 
		return gcTotalAmount;
	}


	function buildShipmentItem( shipment ) {
		var shipment_tax_rate = getShipmentTaxRate( shipment );
		var shipment_unit_price = getShipmentUnitPrice( shipment );

		shippingLineItem = new LineItem();
		shippingLineItem.quantity = 1;
		shippingLineItem.type = ORDER_LINE_TYPE.SHIPPING_FEE;
		shippingLineItem.name = shipment.shippingMethod.displayName.replace( /[^\x00-\x7F]/g, "" );
		shippingLineItem.reference = shipment.shippingMethod.ID;
		shippingLineItem.unit_price = Math.round( shipment_unit_price );
		shippingLineItem.tax_rate = Math.round( shipment_tax_rate );
		shippingLineItem.total_amount = shippingLineItem.unit_price;
		shippingLineItem.total_tax_amount = ( country === 'US' ) ? 0 : Math.round( shipment.shippingTotalTax.value * 100 );

		return shippingLineItem;
	}

	function getShipmentTaxRate( shipment ) {
		var shipment_tax_rate = 0;

		if ( !empty( shipment.shippingMethod ) && !empty( shipment.shippingMethod.taxClassID ) && !empty( shipment.shippingAddress ) ) {
			shipment_tax_rate = ( country === 'US' ) ? 0 : ( TaxMgr.getTaxRate( shipment.shippingMethod.taxClassID, TaxMgr.getTaxJurisdictionID( new dw.order.ShippingLocation( shipment.shippingAddress ) ) ) ) * 10000;
		}

		return shipment_tax_rate;
	}

	function getShipmentUnitPrice( shipment ) {
		var shipment_unit_price = ( shipment.shippingTotalGrossPrice.available && country !== 'US' ? shipment.shippingTotalGrossPrice.value : shipment.shippingTotalNetPrice.value ) * 100;

		return shipment_unit_price;
	}

	function buildShipments( shipments, country, context ) {
		var shipment = {};
		var shippingLineItem = {};

		for ( let i = 0; i < shipments.length; i++ ) {
			shipment = shipments[i];

			if ( !empty( shipment.shippingMethod ) ) {
				shippingLineItem = buildShipmentItem( shipment );

				addPriceAdjustments( shipment.shippingPriceAdjustments.toArray(), null, null, country, context );

				context.order_lines.push( shippingLineItem );
			}
		}
	}

	function getPriceAdjustmentPromoName( adj ) {
		var promoName = !empty( adj.promotion ) && !empty( adj.promotion.name ) ? adj.promotion.name : ORDER_LINE_TYPE.DISCOUNT;

		promoName = promoName.replace( /[^\x00-\x7F]/g, "" );

		return promoName;
	}

	function getPriceAdjustmentPromoId( adj, pid, oid ) {
		var promoId = adj.promotionID;

		if ( !empty( pid ) ) {
			promoId = pid + '_' + promoId;
		} else if ( !empty( oid ) ) {
			promoId = oid + '_' + promoId;
		}

		return promoId;
	}

	function getPriceAdjustmentMerchantData( adj ) {
		return ( adj.couponLineItem ? adj.couponLineItem.couponCode : '' );
	}

	function getPriceAdjustmentTaxRate( adj ) {
		return ( country === 'US' ) ? 0 : Math.round( adj.taxRate * 10000 );
	}

	function addPriceAdjustments( adjusments, pid, oid, country, context ) {
		var adjusmentPrice = 0;
		var promoName = '';
		var promoId = '';
		var adj = {};
		var adjustment = {};

		for ( let i = 0; i < adjusments.length; i++ ) {
			adj = adjusments[i];
			adjustment = new LineItem();
			adjusmentPrice = ( adj.grossPrice.available && country !== 'US' ? adj.grossPrice.value : adj.netPrice.value ) * 100;

			adjustment.quantity = 1;
			adjustment.type = ORDER_LINE_TYPE.DISCOUNT;
			adjustment.name = getPriceAdjustmentPromoName( adj );
			adjustment.reference = getPriceAdjustmentPromoId( adj );
			adjustment.unit_price = Math.round( adjusmentPrice );
			adjustment.merchant_data = getPriceAdjustmentMerchantData( adj );
			adjustment.tax_rate = getPriceAdjustmentTaxRate( adj );
			adjustment.total_amount = adjustment.unit_price;
			adjustment.total_tax_amount = ( country === 'US' ) ? 0 : Math.round( adj.tax.value * 100 );

			context.order_lines.push( adjustment );
		}
	}

	function buildBillingAddress( address )
	{
		this.context.billing_address.phone = address.phone;
		this.context.billing_address.given_name = address.firstName;
		this.context.billing_address.family_name = address.lastName;
		this.context.billing_address.street_address = strval( address.address1 );
		this.context.billing_address.street_address2 = strval( address.address2 );
		this.context.billing_address.postal_code = strval( address.postalCode );
		this.context.billing_address.city = strval( address.city );
		this.context.billing_address.region = strval( address.stateCode );
		this.context.billing_address.country = strval( address.countryCode.value );
	}
	
	function buildShippingAddress( address )
	{
		this.context.shipping_address.phone = address.phone;
		this.context.shipping_address.given_name = address.firstName;
		this.context.shipping_address.family_name = address.lastName;
		this.context.shipping_address.street_address = strval( address.address1 );
		this.context.shipping_address.street_address2 = strval( address.address2 );
		this.context.shipping_address.postal_code = strval( address.postalCode );
		this.context.shipping_address.city = strval( address.city );
		this.context.shipping_address.region = strval( address.stateCode );
		this.context.shipping_address.country = strval( address.countryCode.value );
	}

	function checkLocaleObjectParams( localeObject ) {
		return ( !empty( localeObject.custom.country ) || !empty( localeObject.custom.klarnaLocale ) );
	}

	function checkParams( params ) {
		return ( !empty( params.basket ) && !empty( params.localeObject ) && !checkLocaleObjectParams( params.localeObject ) );
	}

	function validateParams( params ) {
		if ( empty( params ) || !checkParams( params ) ) {
			throw new Error( 'Error when generating KlarnaPaymentsOrderRequestBuilder. Not valid params.' );
		}
	}

	function strval( obj ) {
		//  discuss at: http://locutus.io/php/strval/
		// original by: Brett Zamir (http://brett-zamir.me)
		// improved by: Kevin van Zonneveld (http://kvz.io)
		// bugfixed by: Brett Zamir (http://brett-zamir.me)
		//   example 1: strval({red: 1, green: 2, blue: 3, white: 4})
		//   returns 1: 'Object'

		if ( obj === null ) {
			return ''
		}

		return str;
	}

	module.exports = KlarnaPaymentsOrderRequestBuilder;
}() );