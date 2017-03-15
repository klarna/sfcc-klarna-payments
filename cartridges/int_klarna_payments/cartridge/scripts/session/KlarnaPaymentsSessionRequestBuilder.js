/*global empty, dw */
(function () {
    'use strict';

    var ShippingMgr = require('dw/order/ShippingMgr');
    var Transaction = require('dw/system/Transaction');
    var URLUtils = require('dw/web/URLUtils');
    var Site = require('dw/system/Site');
    var Logger = require( 'dw/system/Logger' );
    
    var Builder = require('../util/Builder');
    var ORDER_LINE_TYPE = require('../util/KlarnaPaymentsConstants.js').ORDER_LINE_TYPE;
    var KlarnaPaymentsSessionModel = require('./KlarnaPaymentsSessionModel').KlarnaPaymentsSessionModel;
    var LineItem = require('./KlarnaPaymentsSessionModel').LineItem;   
   	var log = Logger.getLogger( 'klarnaPaymentsHelper.js' );

    function KlarnaPaymentsSessionRequestBuilder() {
        this.context = null;
    }

    KlarnaPaymentsSessionRequestBuilder.prototype = new Builder();
    KlarnaPaymentsSessionRequestBuilder.prototype.get = function () {
        return this.context;
    };

    /*
        Build request here
    */
    KlarnaPaymentsSessionRequestBuilder.prototype.buildRequest = function (params) {
        try {
            handleRequire(params);
        } catch (e) {
            throw new Error(e);
        }

        var basket = params.basket;
        var localeObject = params.localeObject.custom;

        var requestBodyObject = this.init()
        	.setMerchantReference(basket)
        	.buildLocale(basket, localeObject)
            .buildBilling(basket)
            .buildOrderLines(basket, localeObject)
            .buildTotalAmount(basket, localeObject)
            .buildTotalTax(basket, localeObject);        

        return requestBodyObject;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.init = function () {
        this.context = new KlarnaPaymentsSessionModel();
    	
        return this;
    };
    
    KlarnaPaymentsSessionRequestBuilder.prototype.setMerchantReference = function (basket) {
    	this.context.merchant_reference2="";
    	
    	if( Site.getCurrent().getCustomPreferenceValue( 'MerchantReference2MappedTo' ) && basket.getOrderBeingEdited() )
		{
			try
			{
				this.context.merchant_reference2 = basket.getOrderBeingEdited()[Site.getCurrent().getCustomPreferenceValue( 'MerchantReference2MappedTo' ).toString()];
			}
			catch( err )
			{
				log.error("merchant_reference2 was not set. Error: {0} ", err.message);
			}
			
		}   
    	return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildBilling = function (basket) {
    	var currentCustomer = basket.getCustomer();
    	
    	this.context.billing_address.email = basket.customerEmail || '';

    	if ( empty(currentCustomer) || empty(currentCustomer.profile)) {
    		let billingAddress = basket.getShipments().iterator().next().getShippingAddress();
    		
    		this.context.billing_address.given_name 		= billingAddress.getFirstName();
    		this.context.billing_address.family_name 		= billingAddress.getLastName();
    		this.context.billing_address.email				= "";
    		this.context.billing_address.title 				= !empty( billingAddress.getTitle() ) ? billingAddress.getTitle() : "";
    		this.context.billing_address.street_address 	= billingAddress.getAddress1();
    		this.context.billing_address.street_address2 	= !empty( billingAddress.getAddress2() ) ? billingAddress.getAddress2() : "";
    		this.context.billing_address.postal_code 		= billingAddress.getPostalCode();
    		this.context.billing_address.city 				= billingAddress.getCity();
    		this.context.billing_address.region 			= billingAddress.getStateCode();
    		this.context.billing_address.phone 				= billingAddress.getPhone();
    		this.context.billing_address.country 			= billingAddress.getCountryCode().toString();
    		
    		return this;
        }
    	
    	this.context.billing_address.email = currentCustomer.profile.email;
        this.context.billing_address.phone = currentCustomer.profile.phoneMobile;
        this.context.billing_address.given_name = currentCustomer.profile.firstName;
        this.context.billing_address.family_name = currentCustomer.profile.lastName;

        var customerPreferredAddress = currentCustomer.addressBook.preferredAddress;
    	if (!empty(customerPreferredAddress)) {
        	buildAddress.bind(this)(customerPreferredAddress);
        }

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildLocale = function (basket, localeObject) {
        var currency = basket.getCurrencyCode();        

        this.context.purchase_country = localeObject.country;
        this.context.purchase_currency = currency;
        this.context.locale = localeObject.klarnaLocale;

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildOrderLines = function (basket, localeObject) {
        var lineItems = basket.getAllProductLineItems().toArray();
        var shipments = basket.shipments;
        var country = localeObject.country

        buildItems(lineItems, country, this.context);
        buildShipments(shipments, country, this.context);

        return this;
    };   
    
    KlarnaPaymentsSessionRequestBuilder.prototype.buildTotalAmount = function (basket, localeObject) {
    	var country = localeObject.country;
    	var orderAmount = (basket.totalGrossPrice.available ? basket.totalGrossPrice.value : basket.totalNetPrice.value)*100;

    	this.context.order_amount = Math.round(orderAmount);

    	// Set order discount line items
		addPriceAdjustments(basket.priceAdjustments, null, null, country, this.context);

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildTotalTax = function (basket, localeObject) {
    	var country = localeObject.country;
        var totalTax = basket.totalTax.value*100;
        
        this.context.order_tax_amount = Math.round(totalTax);

        if (country === 'US') {
			var usTotalTax : Number = (basket.totalTax.available) ? basket.totalTax.value*100 : 0;
        	var salesTaxItem = new LineItem();
        	salesTaxItem.quantity = 1;
        	salesTaxItem.type = ORDER_LINE_TYPE.SALES_TAX;
        	salesTaxItem.name = 'Sales Tax';
        	salesTaxItem.reference = 'Sales Tax';
        	salesTaxItem.unit_price = usTotalTax;
        	salesTaxItem.tax_rate = 0;
        	salesTaxItem.total_amount = usTotalTax;
        	salesTaxItem.total_tax_amount = 0;

        	this.context.order_lines.push(salesTaxItem);
		}

        return this;
    };   

   function buildItems(items, country, context) {
    	var itemPrice = 0,
    		itemID = '',
    		itemType = '';

    	for (var i = 0; i < items.length; i++) {
    		var li = items[i];

            if (li.optionProductLineItem) {
            	itemType = ORDER_LINE_TYPE.SURCHARGE;
            	itemID = li.parent.productID + '_' + li.optionID + '_' + li.optionValueID;
            } else {
            	itemType = ORDER_LINE_TYPE.PHYSICAL;
            	itemID = li.productID;
            }

            itemPrice = (li.grossPrice.available && country != 'US' ? li.grossPrice.value : li.netPrice.value)*100;

            var item = new LineItem();
            item.quantity = li.quantityValue;
            item.type = itemType;
            item.name = li.productName.replace(/[^\x00-\x7F]/g, "");
            item.reference = itemID;           
            item.unit_price = Math.round(itemPrice / li.quantityValue);
            item.tax_rate = (country === 'US') ? 0 : Math.round(li.taxRate*10000);
            item.total_amount = Math.round(itemPrice);
            item.total_tax_amount = (country === 'US') ? 0 : Math.round(li.tax.value*100);

            // Add product-specific shipping line adjustments
			if (!empty(li.shippingLineItem)) {
				addPriceAdjustments(li.shippingLineItem.priceAdjustments.toArray(), li.productID, null, country, context);
			}

			if (!empty(li.priceAdjustments) && li.priceAdjustments.length > 0) {
				addPriceAdjustments(li.priceAdjustments.toArray(), li.productID, li.optionID, country, context);
			}
			
			if( Site.getCurrent().getCustomPreferenceValue( 'sendProductAndImageURLs' ) )
			{
				item.product_url= ( !empty( li.getProduct() ) && li.getProduct().getPageURL() !== null ) ? li.getProduct().getPageURL() : "";
				item.image_url 	= !empty( li.getProduct() ) ? li.getProduct().getImage('small', 0).getImageURL({}).toString() : "";
			}	

			context.order_lines.push(item);
    	};
    }   

   function buildShipments(shipments, country, context) {
   	var shipment_unit_price = 0;
		var shipment_tax_rate = 0;

   	for (var i = 0; i < shipments.length; i++) {
   		var shipment = shipments[i];
			shipment_unit_price = (shipment.shippingTotalGrossPrice.available && country !== 'US' ? shipment.shippingTotalGrossPrice.value : shipment.shippingTotalNetPrice.value)*100;
			shipment_tax_rate = 0;
			
			if (shipment.shippingTotalTax.available && shipment.shippingTotalNetPrice.available && shipment.shippingTotalTax.value > 0 && shipment.shippingTotalNetPrice.value > 0) {
				shipment_tax_rate = (country === 'US') ? 0 : (shipment.shippingTotalTax.value/shipment.shippingTotalNetPrice.value)*10000;
			}

			if (!empty(shipment.shippingMethod)) {
				var shippingLineItem = new LineItem();
				shippingLineItem.quantity = 1;
				shippingLineItem.type = ORDER_LINE_TYPE.SHIPPING_FEE;
				shippingLineItem.name = shipment.shippingMethod.displayName.replace(/[^\x00-\x7F]/g, "");
				shippingLineItem.reference = shipment.shippingMethod.ID;
				shippingLineItem.unit_price = Math.round(shipment_unit_price);
				shippingLineItem.tax_rate = Math.round(shipment_tax_rate);
				shippingLineItem.total_amount = shippingLineItem.unit_price;
				shippingLineItem.total_tax_amount = (country === 'US') ? 0 : Math.round(shipment.shippingTotalTax.value*100);

				addPriceAdjustments(shipment.shippingPriceAdjustments.toArray(), null, null, country, context);

				context.order_lines.push(shippingLineItem);
			}
		}
    }
   
    function addPriceAdjustments(adjusments, pid, oid, country, context) {
    	var adjusmentPrice = 0;
        var promoName = '';
    	var promoId = '';

    	for (var i = 0; i < adjusments.length; i++) {
    		var adj = adjusments[i];
    		var adjustment = new LineItem();
            adjusmentPrice = (adj.grossPrice.available && country != 'US' ? adj.grossPrice.value : adj.netPrice.value)*100;
            promoName = !empty(adj.promotion) && !empty(adj.promotion.name) ? adj.promotion.name : ORDER_LINE_TYPE.DISCOUNT;
        	promoId = adj.promotionID;

			// Include product ID with promotion ID if available
			if (!empty(pid)) {
				promoId = pid + '_' + promoId;
			}
			// Include option ID with promotion ID if available
			if (!empty(oid)) {
				promoId = oid + '_' + promoId;
			}

            adjustment.quantity = 1;
            adjustment.type = ORDER_LINE_TYPE.DISCOUNT;
            adjustment.name = promoName.replace(/[^\x00-\x7F]/g, "");
            adjustment.reference = promoId;
            adjustment.unit_price = Math.round(adjusmentPrice);
            adjustment.merchant_data = adj.couponLineItem ? adj.couponLineItem.couponCode : '';
            adjustment.tax_rate = (country === 'US') ? 0 : Math.round(adj.taxRate*10000);
            adjustment.total_amount = adjustment.unit_price
            adjustment.total_tax_amount = (country === 'US') ? 0 : Math.round(adj.tax.value*100);
            
            context.order_lines.push(adjustment);
    	};
    }

    function buildAddress(address) {
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

    function handleRequire(params) {
        if (empty(params) ||
                empty(params.basket) ||               
                empty(params.localeObject) ||
                empty(params.localeObject.custom.country) ||
                empty(params.localeObject.custom.klarnaLocale)) {
            throw new Error('Error when generating KlarnaPaymentsSessionRequestBuilder. Not valid params.');
        }
    }

    module.exports = KlarnaPaymentsSessionRequestBuilder;
}());