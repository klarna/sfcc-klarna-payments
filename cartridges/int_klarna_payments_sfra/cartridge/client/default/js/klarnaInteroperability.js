/* global Klarna $ */

$(function () {
    // Initialize the retry count to limit the number of attempts to check Klarna's interoperability event
    var retryCount = 0;

    /**
     * Initializes the Klarna interoperability token update callback.
     *
     * @returns {void}
     */
    function initInteroperabilityCallback() {
        if (!window.KPPreferences.isKlarnaIntegratedViaPSP) return;

        var sdkInstances = [window.initializedKlarnaSDK, window.kecSDK, window.osmSDK, window.siwkSDK];
        var attached = false;

        sdkInstances.forEach(function (instance) {
            if (instance && instance.Network && instance.Network.Session) {
                instance.Network.Session.on('tokenupdate', function (klarnaNetworkSessionToken) {
                    $.ajax({
                        url: window.KlarnaPaymentsUrls.saveNetworkSessionToken,
                        type: 'POST',
                        data: { klarnaNetworkSessionToken: klarnaNetworkSessionToken }
                    });
                });
                attached = true;
            }
        });

        if (attached) return;

        // Retry initializing token update callback if Klarna.Network event is not yet available and if the retry count is less than or equal to 10
        if (retryCount++ < 10) {
            setTimeout(initInteroperabilityCallback, 500);
        }
    }

    // Initialize the interoperability callback function when the DOM is ready
    initInteroperabilityCallback();
});
