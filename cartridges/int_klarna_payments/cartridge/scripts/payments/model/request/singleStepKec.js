(function () {
    'use strict';

    /**
     * KEC single step request model
     * @returns {void}
     */
    function singleStepKECModel() {
        this.amount = '';
        this.currency = '';
        this.customer_interaction_config = {};
        this.supplementary_purchase_data = {};
    }

    /**
     * line item request model
     * @returns {void}
     */
    function LineItem() {
        this.name = '';
        this.line_item_reference = '';
        this.quantity = 0;
        this.unit_price = 0;
        this.total_amount = 0;
        this.total_tax_amount = 0;
        this.product_url = null;
        this.image_url = null;
    }

    module.exports.singleStepKECModel = singleStepKECModel;
    module.exports.LineItem = LineItem;
}());
