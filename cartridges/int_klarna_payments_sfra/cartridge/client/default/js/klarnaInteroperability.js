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
        if (window.KPPreferences.isKlarnaIntegratedViaPSP) {
            if (typeof Klarna !== 'undefined' && Klarna.Interoperability) {
                // If Klarna.Interoperability is available, listen for the 'tokenupdate' event
                Klarna.Interoperability.on('tokenupdate', (interoperabilityToken) => {
                    // When the token update event is fired, send the updated token to the server via an AJAX POST request to save in sfcc session
                    $.ajax({
                        url: window.KlarnaPaymentsUrls.saveInteroperabilityToken,
                        type: 'POST',
                        data: {
                            interoperabilityToken: interoperabilityToken
                        }
                    });
                });

                // Reset the retry count after successful initialization
                retryCount = 0;
            } else {
                // Retry initializing token update callback if Klarna.Interoperability event is not yet available and if the retry count is less than or equal to 10
                retryCount++; // eslint-disable-line no-plusplus
                if (retryCount <= 10) {
                    setTimeout(initInteroperabilityCallback, 500);
                }
            }
        }
    }

    // Initialize the interoperability callback function when the DOM is ready
    initInteroperabilityCallback();
});
