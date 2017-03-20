(function () {
    'use strict';

    function KlarnaPaymentsSessionModel() {
        this.purchase_country = '';
        this.purchase_currency = '';
        this.locale = '';
        this.billing_address = new BillingAddress();
        this.order_amount = 0;
        this.order_tax_amount = 0;
        this.order_lines = [];
        this.merchant_reference2 = '';
        this.attachment = new Attachment();
    }

    function BillingAddress() {
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
        this.product_url = '';
        this.image_url = '';
    } 
    function Attachment() {
    	this.content_type = '';
        this.body = new AttachementBody();        
    } 
    function AttachementBody() {
    	this.customer_account_info = new AccountInfo();     
    	this.purchase_history_full = new PurchaseHistory();
    }    
    function AccountInfo() {
    	this.unique_account_identifier = '';
    	this.account_registration_date = '';
    	this.account_last_modified = '';
    }
    function PurchaseHistory() {
    	this.number_paid_purchases = 0;
    	this.total_amount_paid_purchases = 0;
    	this.date_of_last_paid_purchase = '';
    }
    
    module.exports.KlarnaPaymentsSessionModel = KlarnaPaymentsSessionModel;
    module.exports.LineItem = LineItem;
}());