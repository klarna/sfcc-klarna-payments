/* globals empty */

'use strict';

var URLUtils = require( 'dw/web/URLUtils' );
var Site = require( 'dw/system/Site' );
var ArrayList = require( 'dw/util/ArrayList' );
var Transaction = require( 'dw/system/Transaction' );
var Money = require( 'dw/value/Money' );

var Builder = require( '*/cartridge/scripts/payments/builder' );
var LineItem = require( '*/cartridge/scripts/payments/model/request/session' ).LineItem;

var isTaxationPolicyNet = require( '*/cartridge/scripts/util/klarnaHelper' ).isTaxationPolicyNet;
var discountTaxationMethod = require( '*/cartridge/scripts/util/klarnaHelper' ).getDiscountsTaxation();
var isOMSEnabled = require( '*/cartridge/scripts/util/klarnaHelper' ).isOMSEnabled();

var ORDER_LINE_TYPE = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' ).ORDER_LINE_TYPE;

/**
 * KP Order Line Item Builder
 * @return {void}
 */
function OrderLineItem() {
    this.item = null;
}

OrderLineItem.prototype = new Builder();

OrderLineItem.prototype.getItemPrice = function( li ) {
    return ( li.grossPrice.available && !isTaxationPolicyNet() ? li.grossPrice.value : li.netPrice.value ) * 100;
};

OrderLineItem.prototype.getItemProratedPrice = function( li ) {
    return li.proratedPrice.available ? li.proratedPrice.value * 100 : 0;
};

OrderLineItem.prototype.getItemTaxRate = function( li ) {
    return isTaxationPolicyNet() ? 0 : li.taxRate * 10000;
};

OrderLineItem.prototype.getItemTaxAmount = function( li ) {
    return isTaxationPolicyNet() ? 0 : li.tax.value * 100;
};

OrderLineItem.prototype.getItemType = function( li ) {
    var type = '';

    if ( Object.prototype.hasOwnProperty.call( li, 'optionProductLineItem' ) && li.optionProductLineItem ) {
        type = ORDER_LINE_TYPE.SURCHARGE;
    } else {
        type = ORDER_LINE_TYPE.PHYSICAL;
    }

    return type;
};

OrderLineItem.prototype.getItemId = function( li ) {
    var id = '';

    if ( Object.prototype.hasOwnProperty.call( li, 'optionProductLineItem' ) && li.optionProductLineItem ) {
        id = li.parent.productID + '_' + li.optionID + '_' + li.optionValueID;
    } else {
        id = li.productID;
    }

    return id;
};

OrderLineItem.prototype.getItemBrand = function( li ) {
    var brand = '';

    if ( Object.prototype.hasOwnProperty.call( li, 'optionProductLineItem' ) && li.optionProductLineItem ) {
        brand = ( !empty( li.parent.product ) ? li.parent.product.brand : null );
    } else {
        brand = ( !empty( li.product ) ? li.product.brand : null );
    }

    return brand;
};

OrderLineItem.prototype.getProductCategoryPath = function( product ) {
    var path = '';
    // get category from products primary category
    var category = product.primaryCategory;

    // get category from product master if not set at variant
    if ( category === null && product.variant ) {
        category = product.variationModel.master.primaryCategory;
    }

    if ( category !== null ) {
        path = new ArrayList();
        while ( category.parent !== null ) {
            if ( category.online ) {
                path.addAt( 0, category.displayName );
            }

            category = category.parent;
        }
        path = path.join( ' > ' ).substring( 0, 749 ); // Maximum 750 characters per Klarna's documentation
    }

    return path;
};

OrderLineItem.prototype.getItemCategoryPath = function( li ) {
    var path = '';

    if ( Object.prototype.hasOwnProperty.call( li, 'optionProductLineItem' ) && li.optionProductLineItem ) {
        path = ( !empty( li.parent.product ) ? this.getProductCategoryPath( li.parent.product ) : null );
    } else {
        path = ( !empty( li.product ) ? this.getProductCategoryPath( li.product ) : null );
    }

    return path;
};

OrderLineItem.prototype.generateItemProductURL = function( li ) {
    var url = '';

    if ( li.optionProductLineItem ) {
        url = ( URLUtils.http( 'Product-Show', 'pid', li.parent.productID ).toString() );
    } else {
        url = ( URLUtils.http( 'Product-Show', 'pid', li.productID ).toString() );
    }

    return url;
};

OrderLineItem.prototype.generateItemImageURL = function( li ) {
    var url = '';

    if ( li.optionProductLineItem ) {
        url = ( li.parent.getProduct().getImage( 'small', 0 ).getImageURL( {} ).toString() );
    } else {
        url = ( li.getProduct().getImage( 'small', 0 ).getImageURL( {} ).toString() );
    }

    return url;
};

OrderLineItem.prototype.buildItemProductAndImageUrls = function( li ) {
    this.item.product_url = this.generateItemProductURL( li );
    this.item.image_url = this.generateItemImageURL( li );
};

OrderLineItem.prototype.getItemName = function( li ) {
    return li.productName;
};

OrderLineItem.prototype.build = function( li ) {
    var itemPrice = this.getItemPrice( li );
    var itemProratedPrice = this.getItemProratedPrice( li );
    var quantity = li.quantityValue;
    var brand = this.getItemBrand( li );
    var categoryPath = this.getItemCategoryPath( li );
    var currencyCode = li.getPrice().getCurrencyCode();
    var itemPriceMoney = new Money( itemPrice, currencyCode );
    var itemProratedPriceMoney = new Money( itemProratedPrice, currencyCode );

    this.item = new LineItem();
    this.item.type = this.getItemType( li );
    this.item.reference = this.getItemId( li );
    this.item.quantity = quantity;
    this.item.name = this.getItemName( li );
    this.item.unit_price = itemPriceMoney.divide( quantity ).getValue();
    this.item.tax_rate = this.getItemTaxRate( li );
    this.item.total_amount = isOMSEnabled || ( !isTaxationPolicyNet() && discountTaxationMethod === 'adjustment' ) ? itemProratedPrice : itemPrice;
    this.item.total_tax_amount = this.getItemTaxAmount( li );

    if ( isOMSEnabled || ( !isTaxationPolicyNet() && discountTaxationMethod === 'adjustment' && itemProratedPrice !== itemPrice ) ) {
        this.item.total_discount_amount = itemPriceMoney.subtract( itemProratedPriceMoney ).getValue();
    }

    if ( !empty( brand ) ) {
        this.item.product_identifiers = this.item.product_identifiers || {};
        this.item.product_identifiers.brand = brand;
    }

    if ( !empty( categoryPath ) ) {
        this.item.product_identifiers = this.item.product_identifiers || {};
        this.item.product_identifiers.category_path = categoryPath;
    }

    this.buildItemProductAndImageUrls( li );

    if ( isOMSEnabled ) {
        var itemObj = this.item;
        Transaction.wrap( function() {
            li.custom.klarna_oms__lineItemJSON = JSON.stringify( itemObj );
        } );
    }

    return this.item;
};

module.exports = OrderLineItem;
