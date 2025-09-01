
function getPaymentMethod( ) {
    var PAYMENT_METHOD = require( './klarnaPaymentsConstants' ).PAYMENT_METHOD;
    return PAYMENT_METHOD;
}

function getKlarnaResources( countryCode ) {
    var KPPreferences = {
        // isKlarnaIntegratedViaPSP: currentSite.getCustomPreferenceValue('kpIntegrationViaPSP')
        isKlarnaIntegratedViaPSP: false
    };

    return {
        KPPreferences: JSON.stringify(KPPreferences)
    };
}

exports.getPaymentMethod = getPaymentMethod;
exports.getKlarnaResources = getKlarnaResources;