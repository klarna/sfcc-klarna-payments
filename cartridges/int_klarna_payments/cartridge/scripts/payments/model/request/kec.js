(function () {
    'use strict';

    /**
     * KEC single step request model
     * @param {boolean} preAssement If locale country is preassessed
     * @returns {void}
     */
    function KlarnaPaymentsSessionModel( preAssement ) {
        this.amount = '';
        this.currency = '';
        this.customerInteractionConfig = {};
        this.supplementaryPurchaseData = {};
    }

    /**
     * line item request model
     * @returns {void}
     */
    function LineItem() {
        this.name = '';
        this.lineItemReference = '';
        this.quantity = 0;
        this.unitPrice = 0;
        this.totalAmount = 0;
        this.totalTaxAmount = 0;
        this.productUrl = null;
        this.imageUrl = null;
    }

    module.exports.KlarnaPaymentsSessionModel = KlarnaPaymentsSessionModel;
    module.exports.LineItem = LineItem;
}());
