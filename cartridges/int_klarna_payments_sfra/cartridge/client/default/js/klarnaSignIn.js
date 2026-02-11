/* globals $, Klarna */

'use strict';

/**
 * Initialize SIWK button using the v2 SDK loaded in pageFooter.isml
 */
async function initializeSignIn() {
    // Wait for the KlarnaSDK to be ready from pageFooter
    await new Promise((resolve) => {
        if (window.initializedKlarnaSDK || window.siwkSDK) {
            resolve();
        } else {
            window.addEventListener('KlarnaSDK:ready', resolve, { once: true });
        }
    });

    const klarna = window.getKlarnaSDK('siwk');
    if (!klarna || !klarna.Identity) {
        console.error('Klarna SDK Identity not available'); // eslint-disable-line no-console
        return;
    }

    const klarnaPreferences = window.KPPreferences;
    const redirectUri = klarnaPreferences.kpSignInRedirectUri;

    const siwkButton = klarna.Identity.button({
        scope: klarnaPreferences.kpSignInScope,
        redirectUri: redirectUri,
        interactionMode: 'DEVICE_BEST',
        hideOverlay: false,
        shape: klarnaPreferences.kpSignInButtonShape,
        theme: klarnaPreferences.kpSignInButtonTheme,
        logoAlignment: klarnaPreferences.kpSignInButtonLogoAlignment
    });
    siwkButton.mount('.klarna-signin-button #container');

    sessionStorage.setItem('siwkRedirectError', window.location.href);
    sessionStorage.setItem('siwkRedirect', $('.klarna-signin-button').attr('action-url'));

    klarna.Identity.on('signin', (data) => {
        var url = $('.klarna-signin-button').attr('action-url');
        $.ajax({
            url: url,
            type: 'POST',
            data: { data: JSON.stringify(data) },
            context: this,
            dataType: 'json',
            success: function (response) {
                if (response.success) {
                    location.href = response.redirectUrl; // eslint-disable-line no-restricted-globals
                } else {
                    $('.klarna-login-error').removeClass('d-none');
                }
            },
            error: function () {
                $('.klarna-login-error').removeClass('d-none');
            }
        });
    });

    klarna.Identity.on('error', (data) => { // eslint-disable-line no-unused-vars
        $('.klarna-login-error').removeClass('d-none');
    });
}

// Initialize on DOM ready
$(document).ready(function () {
    if (document.querySelector('.klarna-signin-button')) {
        initializeSignIn();
    }
});
