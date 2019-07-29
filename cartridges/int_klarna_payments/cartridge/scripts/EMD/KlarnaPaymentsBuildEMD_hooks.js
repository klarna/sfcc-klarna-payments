'use strict';

/**
 * Builds Extra Merchant Data
 * This is a sample script to help you develop your own extra merchant data.
 * 
 * @param {Object} args funciton arguments
 * 
 * @return {String} EMD as JSON string
 */
function BuildEMD( args )
{
	var LineItemCtnr = args.LineItemCtnr;
	
	var customer = LineItemCtnr.getCustomer();
	var body = new Object();

	body.customer_account_info = new Array( new Object() );
	if( customer.registered )
	{
		body.customer_account_info[0].unique_account_identifier = customer.profile.customerNo;
		body.customer_account_info[0].account_registration_date = !empty( customer.profile.creationDate ) ? customer.profile.creationDate.toISOString().slice( 0, -5 ) + 'Z' : '';
		body.customer_account_info[0].account_last_modified = !empty( customer.profile.lastModified ) ? customer.profile.lastModified.toISOString().slice( 0, -5 ) + 'Z' : '';
	}

	body.purchase_history_full = new Array( new Object() );
	body.purchase_history_full[0].unique_account_identifier = customer.ID;
	body.purchase_history_full[0].payment_option = "other";
	
	if( customer.getActiveData() )
	{
		body.purchase_history_full[0].number_paid_purchases = !empty( customer.activeData.orders ) ? customer.activeData.orders : 0;
		body.purchase_history_full[0].total_amount_paid_purchases = !empty( customer.activeData.orderValue ) ? customer.activeData.orderValue : 0;
		body.purchase_history_full[0].date_of_last_paid_purchase = !empty( customer.activeData.lastOrderDate ) ? customer.activeData.lastOrderDate.toISOString().slice( 0, -5 ) + 'Z' : '';
		body.purchase_history_full[0].date_of_first_paid_purchase = "";
	}

	return JSON.stringify( body );	
}

/**
 * Module exports
 */
exports.BuildEMD = BuildEMD;