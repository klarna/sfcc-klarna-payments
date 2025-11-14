'use strict';

/**
 * address request model
 * @returns {void}
 */
function Address() {
    this.title = '';
    this.given_name = '';
    this.family_name = '';
    this.email = '';
    this.phone = '';
    this.street_address = '';
    this.street_address2 = '';
    this.postal_code = '';
    this.city = '';
    this.region = '';
    this.country = '';
}

/**
 * merchant urls request model
 * @returns {void}
 */
function MerchantUrls() {
    this.confirmation = '';
    this.notification = '';
}

/**
 * KP Order Request Model
 * @param {boolean} isRecurringOrder - is recurring order
 * @returns {void}
 */
function KlarnaPaymentsOrderModel( isRecurringOrder ) {
    this.purchase_country = '';
    this.purchase_currency = '';
    this.locale = '';
    if ( !isRecurringOrder ) {
        this.billing_address = new Address();
    }
    this.shipping_address = new Address();
    this.order_amount = 0;
    this.order_tax_amount = 0;
    this.order_lines = [];
    this.merchant_reference1 = '';
    this.merchant_reference2 = '';
    this.options = null;
    this.merchant_urls = new MerchantUrls();
    this.merchant_data = null;
}

/**
 * LineItem model
 * @returns {void}
 */
function LineItem() {
    this.type = '';
    this.name = '';
    this.reference = '';
    this.quantity = 0;
    this.merchant_data = '';
    this.unit_price = 0;
    this.tax_rate = 0;
    this.total_amount = 0;
    this.total_tax_amount = 0;
    this.total_discount_amount = 0;
    this.product_url = null;
    this.image_url = null;
}

module.exports.KlarnaPaymentsOrderModel = KlarnaPaymentsOrderModel;
module.exports.LineItem = LineItem;
module.exports.Address = Address;
