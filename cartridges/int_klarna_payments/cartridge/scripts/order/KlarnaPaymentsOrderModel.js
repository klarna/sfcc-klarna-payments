( function()
{
	'use strict';

	function KlarnaPaymentsOrderModel()
	{
		this.purchase_country = '';
		this.purchase_currency = '';
		this.locale = '';
		this.billing_address = new BillingAddress();
		this.order_amount = 0;
		this.order_tax_amount = 0;
		this.order_lines = [];
		this.merchant_reference1 = '';
		this.merchant_reference2 = '';
		this.options = new Options();
		this.merchant_urls = new MerchantUrls();
		this.merchant_data = null;
	}

	function BillingAddress()
	{
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

	function LineItem()
	{
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

	function Options()
	{
		this.color_details = '#0074C8';
		this.color_button = '#0074C8';
		this.color_button_text = '#FFFFFF';
		this.color_checkbox = '#0074C8';
		this.color_checkbox_checkmark = '#FFFFFF';
		this.color_header = '#0074C8';
		this.color_link = '#0074C8';
		this.color_border = '#CBCBCD';
		this.color_border_selected = '#0074C8';
		this.color_text = '#3C3C3E';
		this.color_text_secondary = '#9E9EA0';
		this.radius_border = '5px';
	}

	function MerchantUrls()
	{
		this.confirmation = '';
		this.notification = '';
	}

	module.exports.KlarnaPaymentsOrderModel = KlarnaPaymentsOrderModel;
	module.exports.LineItem = LineItem;
}() );