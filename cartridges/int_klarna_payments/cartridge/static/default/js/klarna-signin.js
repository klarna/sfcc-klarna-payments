'use strict';

var klarnaPreferences = window.KPPreferences;
var klarnaUrls = window.KlarnaPaymentsUrls;

var redirectUri = klarnaPreferences.kpSignInRedirectUri;

window.onload = async function () {
    const klarna = await Klarna.init({
        clientId: klarnaPreferences.kpSignInClientID,
        environment: klarnaPreferences.kpSignInEnvironment,
        locale: klarnaPreferences.kpSignInLocale
    });
    // if (!klarna.Identity.canMakeLogin(KlarnaOSM.getCountryCode())) return;
    const siwkButton = klarna.Identity.button({
        scope: klarnaPreferences.kpSignInScope,
        redirectUri: redirectUri,
        interactionMode: "DEVICE_BEST",
        hideOverlay: false,
        shape: klarnaPreferences.kpSignInButtonShape,
        theme: klarnaPreferences.kpSignInButtonTheme,
        logoAlignment: klarnaPreferences.kpSignInButtonLogoAlignment
    })
    siwkButton.mount(".klarna-signin-button #container");

    sessionStorage.setItem("siwkRedirectError", window.location.href);
    sessionStorage.setItem("siwkRedirect", $('.klarna-signin-button').attr('action-url'));

    klarna.Identity.on("signin", (data) => {
        var url = $('.klarna-signin-button').attr('action-url');
        $.ajax({
            url: url,
            type: 'POST',
            data: { data: JSON.stringify(data) },
            context: this,
            dataType: 'json',
            success: function (data) {
                if (data.success) {
                    location.href = data.redirectUrl;
                } else {
                    $('.klarna-signin-error').css('display', 'block');
                }
            },
            error: function () {
                $('.klarna-signin-error').css('display', 'block');
            }
        });
    })

    klarna.Identity.on("error", (data) => {
        $('.klarna-signin-error').css('display', 'block');
    });
}
