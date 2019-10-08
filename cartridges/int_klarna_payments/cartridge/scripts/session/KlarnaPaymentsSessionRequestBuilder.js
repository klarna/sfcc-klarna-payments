( function()
{
	'use strict';

	var URLUtils = require( 'dw/web/URLUtils' );
	var Site = require( 'dw/system/Site' );
	var Logger = require( 'dw/system/Logger' );
	var TaxMgr = require( 'dw/order/TaxMgr' );
	var HookMgr = require( 'dw/system/HookMgr' );
	var ArrayList = require( 'dw/util/ArrayList' );

	var Builder = require( '*/cartridge/scripts/util/Builder' );
	var ORDER_LINE_TYPE = require( '*/cartridge/scripts/util/KlarnaPaymentsConstants.js' ).ORDER_LINE_TYPE;
	var CONTENT_TYPE = require( '*/cartridge/scripts/util/KlarnaPaymentsConstants.js' ).CONTENT_TYPE;
	var KlarnaPaymentsSessionModel = require( '*/cartridge/scripts/session/KlarnaPaymentsSessionModel' ).KlarnaPaymentsSessionModel;
	var LineItem = require( '*/cartridge/scripts/session/KlarnaPaymentsSessionModel' ).LineItem;
	var log = Logger.getLogger( 'KlarnaPaymentsSessionRequestBuilder.js' );

	function KlarnaPaymentsSessionRequestBuilder()
	{
		this.context = null;
	}

	KlarnaPaymentsSessionRequestBuilder.prototype = new Builder();
	KlarnaPaymentsSessionRequestBuilder.prototype.get = function()
	{
		return this.context;
	};

	/*
	    Build request here
	*/
	KlarnaPaymentsSessionRequestBuilder.prototype.buildRequest = function( params )
	{
		var basket = {};
		var localeObject = {};
		var requestBodyObject = {};
		
		try
		{
			handleRequire( params );
		}
		catch( e )
		{
			throw new Error( e );
		}

		basket = params.basket;
		localeObject = params.localeObject.custom;
		
		var country = localeObject.country;
		var preAssement = false;
		if ( !isCountryInEU( country ) )
		{
			preAssement = true;
		}

		requestBodyObject = this.init( preAssement )
			.setMerchantReference( basket )
			.buildLocale( basket, localeObject )
			.buildBilling( basket, localeObject, preAssement )
			.buildShipping( basket, localeObject, preAssement )
			.buildOrderLines( basket, localeObject )
			.buildTotalAmount( basket, localeObject )
			.buildTotalTax( basket, localeObject )
			.buildAdditionalCustomerInfo( basket )
			.buildOptions();

		return requestBodyObject;
	};

	KlarnaPaymentsSessionRequestBuilder.prototype.init = function( preAssement )
	{		
		this.context = new KlarnaPaymentsSessionModel( preAssement );

		return this;
	};

	KlarnaPaymentsSessionRequestBuilder.prototype.setMerchantReference = function( basket )
	{
		this.context.merchant_reference2 = "";

		if ( Site.getCurrent().getCustomPreferenceValue( 'merchant_reference2_mapping' ) )
		{
			try
			{
				this.context.merchant_reference2 = basket[Site.getCurrent().getCustomPreferenceValue( 'merchant_reference2_mapping' )].toString();
			}
			catch( err )
			{
				log.error( "merchant_reference2 was not set. Error: {0} ", err.message );
			}

		}
		return this;
	};

	KlarnaPaymentsSessionRequestBuilder.prototype.buildBilling = function( basket, localeObject, preAssement )
	{
		if ( preAssement )
		{
			var currentCustomer = basket.getCustomer();
			var customerPreferredAddress = {};
			
			this.context.billing_address.email = basket.customerEmail || '';

			if ( empty( currentCustomer ) || empty( currentCustomer.profile ) )
			{
				let billingAddress = basket.getShipments().iterator().next().getShippingAddress();
				if ( empty( billingAddress ) ) 
				{
					return this;
				}		
				this.context.billing_address.given_name = billingAddress.getFirstName();
				this.context.billing_address.family_name = billingAddress.getLastName();
				this.context.billing_address.email = !empty( basket.getCustomerEmail() ) ? basket.getCustomerEmail() : "";
				this.context.billing_address.title = !empty( billingAddress.getTitle() ) ? billingAddress.getTitle() : "";
				this.context.billing_address.street_address = billingAddress.getAddress1();
				this.context.billing_address.street_address2 = !empty( billingAddress.getAddress2() ) ? billingAddress.getAddress2() : "";
				this.context.billing_address.postal_code = billingAddress.getPostalCode();
				this.context.billing_address.city = billingAddress.getCity();
				this.context.billing_address.region = billingAddress.getStateCode();
				this.context.billing_address.phone = billingAddress.getPhone();
				this.context.billing_address.country = billingAddress.getCountryCode().toString();

				return this;
			}

			this.context.billing_address.email = currentCustomer.profile.email;
			this.context.billing_address.phone = currentCustomer.profile.phoneMobile;
			this.context.billing_address.given_name = currentCustomer.profile.firstName;
			this.context.billing_address.family_name = currentCustomer.profile.lastName;

			customerPreferredAddress = currentCustomer.addressBook.preferredAddress;
			if ( !empty( customerPreferredAddress ) )
			{
				buildBillingAddress.bind( this )( customerPreferredAddress );
			}
		}		

		return this;
	};
	
	KlarnaPaymentsSessionRequestBuilder.prototype.buildShipping = function( basket, localeObject, preAssement )
	{
		if ( preAssement )
		{
			var currentCustomer = basket.getCustomer();
			var customerPreferredAddress = {};
			
			this.context.shipping_address.email = basket.customerEmail || '';

			if ( empty( currentCustomer ) || empty( currentCustomer.profile ) )
			{
				// get default shipment shipping address
				let shippingAddress = basket.getShipments().iterator().next().getShippingAddress();
				if ( empty( shippingAddress ) ) 
				{
					delete this.context.shipping_address;
					return this;
				}
				this.context.shipping_address.given_name = shippingAddress.getFirstName();
				this.context.shipping_address.family_name = shippingAddress.getLastName();
				this.context.shipping_address.email = !empty( basket.getCustomerEmail() ) ? basket.getCustomerEmail() : "";
				this.context.shipping_address.title = !empty( shippingAddress.getTitle() ) ? shippingAddress.getTitle() : "";
				this.context.shipping_address.street_address = shippingAddress.getAddress1();
				this.context.shipping_address.street_address2 = !empty( shippingAddress.getAddress2() ) ? shippingAddress.getAddress2() : "";
				this.context.shipping_address.postal_code = shippingAddress.getPostalCode();
				this.context.shipping_address.city = shippingAddress.getCity();
				this.context.shipping_address.region = shippingAddress.getStateCode();
				this.context.shipping_address.phone = shippingAddress.getPhone();
				this.context.shipping_address.country = shippingAddress.getCountryCode() ? shippingAddress.getCountryCode().getValue() : "";

				return this;
			}

			this.context.shipping_address.email = "";
			this.context.shipping_address.phone = currentCustomer.profile.phoneMobile;
			this.context.shipping_address.given_name = currentCustomer.profile.firstName;
			this.context.shipping_address.family_name = currentCustomer.profile.lastName;

			customerPreferredAddress = currentCustomer.addressBook.preferredAddress;
			if ( !empty( customerPreferredAddress ) )
			{
				buildShippingAddress.bind( this )( customerPreferredAddress );
			}
		}		

		return this;
	};

	KlarnaPaymentsSessionRequestBuilder.prototype.buildLocale = function( basket, localeObject )
	{
		var currency = basket.getCurrencyCode();

		this.context.purchase_country = localeObject.country;
		this.context.purchase_currency = currency;
		this.context.locale = localeObject.klarnaLocale;

		return this;
	};

	KlarnaPaymentsSessionRequestBuilder.prototype.buildOrderLines = function( basket, localeObject )
	{
		var lineItems = basket.getAllProductLineItems().toArray();
		var giftCertificates = basket.getGiftCertificateLineItems().toArray();
		var giftCertificatePIs = basket.getGiftCertificatePaymentInstruments().toArray();
		var shipments = basket.shipments;
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

	KlarnaPaymentsSessionRequestBuilder.prototype.buildTotalAmount = function( basket, localeObject )
	{
		var country = localeObject.country;
		var gcTotalAmount = getGCtotalAmount( basket );
		var orderAmount = ( basket.totalGrossPrice.available ? basket.totalGrossPrice.value : basket.totalNetPrice.value ) * 100 - gcTotalAmount;

		this.context.order_amount = Math.round( orderAmount );

		// Set order discount line items
		addPriceAdjustments( basket.priceAdjustments, null, null, country, this.context );

		return this;
	};

	KlarnaPaymentsSessionRequestBuilder.prototype.buildTotalTax = function( basket, localeObject )
	{
		var country = localeObject.country;
		var totalTax = basket.totalTax.value * 100;
		var usTotalTax = 0;
		var salesTaxItem = {};

		this.context.order_tax_amount = Math.round( totalTax );

		if ( country === 'US' )
		{
			usTotalTax = ( basket.totalTax.available ) ? basket.totalTax.value * 100 : 0;
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

	KlarnaPaymentsSessionRequestBuilder.prototype.buildAdditionalCustomerInfo = function( basket )
	{
		if ( Site.getCurrent().getCustomPreferenceValue( 'kpAttachments' ) && HookMgr.hasHook( 'extra.merchant.data' ) )
		{			
			this.context.attachment = new Object();
			this.context.attachment.content_type = CONTENT_TYPE;
			this.context.attachment.body = 	HookMgr.callHook( 'extra.merchant.data', 'BuildEMD', {
	            LineItemCtnr: basket
	        } );		
		}

		return this;
	};

	KlarnaPaymentsSessionRequestBuilder.prototype.buildOptions = function()
	{
		this.context.options.color_details 				= Site.getCurrent().getCustomPreferenceValue( 'kpColorDetails' );
		this.context.options.color_button 				= Site.getCurrent().getCustomPreferenceValue( 'kpColorButton' );
		this.context.options.color_button_text 			= Site.getCurrent().getCustomPreferenceValue( 'kpColorButtonText' );
		this.context.options.color_checkbox 			= Site.getCurrent().getCustomPreferenceValue( 'kpColorCheckbox' );
		this.context.options.color_checkbox_checkmark 	= Site.getCurrent().getCustomPreferenceValue( 'kpColorCheckboxCheckmark' );
		this.context.options.color_header 				= Site.getCurrent().getCustomPreferenceValue( 'kpColorHeader' );
		this.context.options.color_link 				= Site.getCurrent().getCustomPreferenceValue( 'kpColorLink' );
		this.context.options.color_border 				= Site.getCurrent().getCustomPreferenceValue( 'kpColorBorder' );
		this.context.options.color_border_selected 		= Site.getCurrent().getCustomPreferenceValue( 'kpColorBorderSelected' );
		this.context.options.color_text 				= Site.getCurrent().getCustomPreferenceValue( 'kpColorText' );
		this.context.options.color_text_secondary 		= Site.getCurrent().getCustomPreferenceValue( 'kpColorTextSecondary' );
		this.context.options.radius_border 				= Site.getCurrent().getCustomPreferenceValue( 'kpRadiusBorder' );

		return this;
	};

	function buildItems( items, country, context )
	{
		var itemPrice = 0;
		var	itemID = '';
		var	itemType = '';
		var li = [];
		var item = {};
		var quantity = 0;
		var brand = null;
		var categoryPath = null;

		for ( var i = 0; i < items.length; i++ )
		{
			li = items[i];
			var isGiftCertificate = ( li.describe().getSystemAttributeDefinition( 'recipientEmail' ) && !empty( li.recipientEmail ) ) ? true : false;
			
			if ( isGiftCertificate )
			{
				itemType = ORDER_LINE_TYPE.GIFT_CERTIFICATE;
				itemID = li.getGiftCertificateID();
			}
			else
			{
				if ( li.hasOwnProperty( 'optionProductLineItem' ) && li.optionProductLineItem )
				{
					itemType = ORDER_LINE_TYPE.SURCHARGE;
					itemID = li.parent.productID + '_' + li.optionID + '_' + li.optionValueID;
					brand = !empty( li.parent.product ) ? li.parent.product.brand : null;
					categoryPath = !empty( li.parent.product ) ? _getProductCategoryPath( li.parent.product ) : null;
				}			
				else
				{
					itemType = ORDER_LINE_TYPE.PHYSICAL;
					itemID = li.productID;
					brand = !empty( li.product ) ? li.product.brand : null;
					categoryPath = !empty( li.product ) ? _getProductCategoryPath( li.product ) : null;
				}
			}
			
			quantity = isGiftCertificate ? 1 : li.quantityValue;
			itemPrice = ( li.grossPrice.available && country !== 'US' ? li.grossPrice.value : li.netPrice.value ) * 100;

			item = new LineItem();
			item.quantity = quantity;
			item.type = itemType;
			item.name = isGiftCertificate ? 'Gift Certificate' : li.productName;
			item.reference = itemID;
			item.unit_price = Math.round( itemPrice / quantity );
			item.tax_rate = ( country === 'US' ) ? 0 : Math.round( li.taxRate * 10000 );
			item.total_amount = Math.round( itemPrice );
			item.total_tax_amount = ( country === 'US' ) ? 0 : Math.round( li.tax.value * 100 );
			if ( !empty( brand ) ) 
			{
				item.product_identifiers = item.product_identifiers || {};
				item.product_identifiers.brand = brand;
			}	
			if ( !empty( categoryPath ) ) 
			{
				item.product_identifiers = item.product_identifiers || {};
				item.product_identifiers.category_path = categoryPath;
			}

			// Add product-specific shipping line adjustments
			if ( !isGiftCertificate && !empty( li.shippingLineItem ) )
			{
				addPriceAdjustments( li.shippingLineItem.priceAdjustments.toArray(), li.productID, null, country, context );
			}

			if ( !isGiftCertificate && !empty( li.priceAdjustments ) && li.priceAdjustments.length > 0 )
			{
				addPriceAdjustments( li.priceAdjustments.toArray(), li.productID, li.optionID, country, context );
			}

			if ( Site.getCurrent().getCustomPreferenceValue( 'sendProductAndImageURLs' ) && !isGiftCertificate )
			{
				if ( li.optionProductLineItem )
				{
					item.product_url = !empty( li.parent.productID ) ? URLUtils.http( 'Product-Show', 'pid', li.parent.productID ).toString() : null;
					item.image_url = !empty( li.parent.getProduct().getImage( 'small', 0 ) ) ? li.parent.getProduct().getImage( 'small', 0 ).getImageURL( {} ).toString() : null;
				} 
				else
				{
					item.product_url = !empty( li.productID ) ? URLUtils.http( 'Product-Show', 'pid', li.productID ).toString() : null;
					item.image_url = !empty( li.getProduct().getImage( 'small', 0 ) ) ? li.getProduct().getImage( 'small', 0 ).getImageURL( {} ).toString() : null;
				}
				
			}

			context.order_lines.push( item );
		}
	}
	
	function _getProductCategoryPath( product )
	{
		var path = null;
		// get category from products primary category
		var category = product.primaryCategory;

		// get category from product master if not set at variant
		if( category === null && product.variant )
		{
			category = product.variationModel.master.primaryCategory;
		}
		if ( category !== null )
		{
			path = new ArrayList();
			while( category.parent !== null )
			{
				if( category.online ) { path.addAt( 0, category.displayName ) }
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

		for ( var i = 0; i < items.length; i++ )
		{
			li = items[i];
			var paymentTransaction = li.getPaymentTransaction();

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
	
	function getGCtotalAmount( basket )
	{
		var giftCertificatePIs = basket.getGiftCertificatePaymentInstruments().toArray();
		var gcTotalAmount = 0;
		if ( giftCertificatePIs.length > 0 )
		{			
			for ( var i = 0; i < giftCertificatePIs.length; i++ )
			{
				gcTotalAmount += giftCertificatePIs[i].getPaymentTransaction().getAmount() * 100;
				
			}
		} 
		return gcTotalAmount;
	}

	function buildShipments( shipments, country, context )
	{
		var shipment_unit_price = 0;
		var shipment_tax_rate = 0;
		var shipment = {};
		var shippingLineItem = {};

		for ( let i = 0; i < shipments.length; i++ )
		{
			shipment = shipments[i];
			shipment_unit_price = ( shipment.shippingTotalGrossPrice.available && ( TaxMgr.taxationPolicy !== TaxMgr.TAX_POLICY_NET ) ? shipment.shippingTotalGrossPrice.value : shipment.shippingTotalNetPrice.value ) * 100;
			shipment_tax_rate = 0;

			if ( !empty( shipment.shippingMethod ) && !empty( shipment.shippingMethod.taxClassID ) && !empty( shipment.shippingAddress ) )
			{
				shipment_tax_rate = ( TaxMgr.taxationPolicy === TaxMgr.TAX_POLICY_NET ) ? 0 : ( shipment.shippingTotalTax.value / shipment.shippingTotalNetPrice.value ) * 10000;
			}			

			if ( !empty( shipment.shippingMethod ) )
			{
				shippingLineItem = new LineItem();
				shippingLineItem.quantity = 1;
				shippingLineItem.type = ORDER_LINE_TYPE.SHIPPING_FEE;
				shippingLineItem.name = shipment.shippingMethod.displayName;
				shippingLineItem.reference = shipment.shippingMethod.ID;
				shippingLineItem.unit_price = Math.round( shipment_unit_price );
				shippingLineItem.tax_rate = Math.round( shipment_tax_rate );
				shippingLineItem.total_amount = shippingLineItem.unit_price;
				shippingLineItem.total_tax_amount = ( TaxMgr.taxationPolicy === TaxMgr.TAX_POLICY_NET ) ? 0 : Math.round( shipment.shippingTotalTax.value * 100 );

				addPriceAdjustments( shipment.shippingPriceAdjustments.toArray(), null, null, country, context );

				context.order_lines.push( shippingLineItem );
			}
		}
	}

	function addPriceAdjustments( adjusments, pid, oid, country, context )
	{
		var adjusmentPrice = 0;
		var promoName = '';
		var promoId = '';
		var adj = {};
		var adjustment = {};

		for ( let i = 0; i < adjusments.length; i++ )
		{
			adj = adjusments[i];
			adjustment = new LineItem();
			adjusmentPrice = ( adj.grossPrice.available && country !== 'US' ? adj.grossPrice.value : adj.netPrice.value ) * 100;
			promoName = !empty( adj.promotion ) && !empty( adj.promotion.name ) ? adj.promotion.name : ORDER_LINE_TYPE.DISCOUNT;
			promoId = adj.promotionID;

			// Include product ID with promotion ID if available
			if ( !empty( pid ) )
			{
				promoId = pid + '_' + promoId;
			}
			// Include option ID with promotion ID if available
			if ( !empty( oid ) )
			{
				promoId = oid + '_' + promoId;
			}

			adjustment.quantity = 1;
			adjustment.type = ORDER_LINE_TYPE.DISCOUNT;
			adjustment.name = promoName;
			adjustment.reference = promoId;
			adjustment.unit_price = Math.round( adjusmentPrice );
			adjustment.merchant_data = adj.couponLineItem ? adj.couponLineItem.couponCode : '';
			adjustment.tax_rate = ( country === 'US' ) ? 0 : Math.round( adj.taxRate * 10000 );
			adjustment.total_amount = adjustment.unit_price
			adjustment.total_tax_amount = ( country === 'US' ) ? 0 : Math.round( adj.tax.value * 100 );

			context.order_lines.push( adjustment );
		}
	}

	function buildBillingAddress( address )
	{
		this.context.billing_address.phone = address.phone;
		this.context.billing_address.given_name = address.firstName;
		this.context.billing_address.family_name = address.lastName;
		this.context.billing_address.street_address = address.address1 || '';
		this.context.billing_address.street_address2 = address.address2 || '';
		this.context.billing_address.postal_code = address.postalCode || '';
		this.context.billing_address.city = address.city || '';
		this.context.billing_address.region = address.stateCode || '';
		this.context.billing_address.country = address.countryCode.value || '';
	}
	
	function buildShippingAddress( address )
	{
		this.context.shipping_address.phone = address.phone;
		this.context.shipping_address.given_name = address.firstName;
		this.context.shipping_address.family_name = address.lastName;
		this.context.shipping_address.street_address = address.address1 || '';
		this.context.shipping_address.street_address2 = address.address2 || '';
		this.context.shipping_address.postal_code = address.postalCode || '';
		this.context.shipping_address.city = address.city || '';
		this.context.shipping_address.region = address.stateCode || '';
		this.context.shipping_address.country = address.countryCode.value || '';
	}

	function handleRequire( params )
	{
		if ( empty( params ) ||
			empty( params.basket ) ||
			empty( params.localeObject ) ||
			empty( params.localeObject.custom.country ) ||
			empty( params.localeObject.custom.klarnaLocale ) )
		{
			throw new Error( 'Error when generating KlarnaPaymentsSessionRequestBuilder. Not valid params.' );
		}
	}	
	
	function isCountryInEU( country )
	{

		var isInEU = true;
		var EUCountries = "BE, BG, CZ, DK, DE, EE, IE, EL, ES, FR, HR, IT, CY, LV, LT, LU, HU, MT, NL, AT, PL, PT, RO, SI, SK, FI, SE, UK, GB";
		
		if( EUCountries.indexOf( country ) === -1 )
		{
			isInEU = false;
		}

		return isInEU;
	}	

	module.exports = KlarnaPaymentsSessionRequestBuilder;
}() );