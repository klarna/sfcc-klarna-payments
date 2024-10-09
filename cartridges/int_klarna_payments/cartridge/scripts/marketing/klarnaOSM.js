'use strict';

var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var Locale = require('dw/util/Locale');
var currentSite = require('dw/system/Site').current;
var KlarnaConstants = require('*/cartridge/scripts/util/klarnaPaymentsConstants');
var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');

/**
 * Klarna On-Site Messaging Component
 */
var KlarnaOSM = {
    countryCode: '',
    klarnaCountriesObject: null,
    /**
     * sets the country code for the OSM object
     * @param {String} countryCode country code
     * @return {void}
     */
    setCountryCode: function (countryCode) {
        this.countryCode = countryCode;
    },
    /**
     * Retrieves country code from request locale
     * @return {string} country code
     */
    retrieveCountryCodeFromRequestLocale: function () {
        var requestLocale = Locale.getLocale(request.locale);
        var currentCountryCode = requestLocale.country;

        return currentCountryCode;
    },
    /**
     * Function that returns the country code set in the OSM object
     * @return {string} country code
     */
    getCountryCode: function () {
        if (!this.countryCode) {
            this.countryCode = this.retrieveCountryCodeFromRequestLocale();
        }

        return this.countryCode;
    },
    /**
     * Function that returns the current locale in a klarna compatible format
     *
     * @return {string} locale code
     */
    getLocale: function () {
        var currentLocale = Locale.getLocale(request.locale);
        var resultLocale = currentLocale.language;
        if (currentLocale.country) {
            resultLocale = resultLocale + '-' + currentLocale.country;
        }
        return resultLocale;
    },
    /**
     * Function that returns the KlarnaCountries custom object for the selected country
     * @return {dw.object.CustomObject} locale Object
     */
    loadKlarnaCountriesObject: function () {
        var countryCode = this.getCountryCode();
        var localeObject = CustomObjectMgr.getCustomObject('KlarnaCountries', countryCode);

        return localeObject;
    },
    /**
     * Function that sets and returns the KlarnaCountries custom object
     * @return {dw.object.CustomObject} locale Object
     */
    getKlarnaCountriesObject: function () {
        if (!this.klarnaCountriesObject) {
            this.klarnaCountriesObject = this.loadKlarnaCountriesObject() ? this.loadKlarnaCountriesObject() : { custom: {} };
        }

        return this.klarnaCountriesObject;
    },
    /**
     * Function that checks if OSM object is enabled
     * @return {boolean} enabled/disabled
     */
    isEnabled: function () {
        return this.isKlarnaEnabled() && (this.isEnabledCartPage() || this.isEnabledPDPPage() || this.isEnabledHeader() || this.isEnabledFooter() || this.isEnabledInfoPage());
    },
    /**
     * Check if Klarna is enabled for current country
     * in Klarna Activation CO, Klarna Activation SP or Klarna Countries
     */
    isKlarnaEnabled: function () {
        return KlarnaHelper.isCurrentCountryKlarnaEnabled();
    },
    /**
     * Function that checks if OSM is enabled for cart
     * @return {boolean} enable status
     */
    isEnabledCartPage: function () {
        var localeObject = this.getKlarnaCountriesObject();
        var isCartPlacement = currentSite.getCustomPreferenceValue('osm_placement').find(page => page.value === 'cartPage');
        var value = (!empty(currentSite.getCustomPreferenceValue('osm_enable')) && isCartPlacement) ? currentSite.getCustomPreferenceValue('osm_enable') :
            (localeObject.custom.osmCartEnabled) || false;

        return value;
    },
    /**
     * Function that checks if OSM is enabled for cart page tag
     * @return {boolean} enable status
     */
    getCartPagePlacementTagId: function () {
        var localeObject = this.getKlarnaCountriesObject();
        var isCartSitePref = currentSite.getCustomPreferenceValue('osm_placement').find(page => page.value === 'cartPage');
        var value = isCartSitePref ? 'credit-promotion-badge' : localeObject.custom.osmCartTagId;

        return value;
    },
    /**
     * Function that checks if OSM is enabled for PDP
     * @return {boolean} enable status
     */
    isEnabledPDPPage: function () {
        var localeObject = this.getKlarnaCountriesObject();
        var isPdpPlacement = currentSite.getCustomPreferenceValue('osm_placement').find(page => page.value === 'productPage');
        var value = (!empty(currentSite.getCustomPreferenceValue('osm_enable')) && isPdpPlacement) ? currentSite.getCustomPreferenceValue('osm_enable') :
            (localeObject.custom.osmPDPEnabled) || false;

        return value && this.isKlarnaEnabled();
    },
    /**
     * Function that checks if OSM is enabled for PDP page tag
     * @return {boolean} enable status
     */
    getPDPPagePlacementTagId: function () {
        var localeObject = this.getKlarnaCountriesObject();
        var isPDPSitePref = currentSite.getCustomPreferenceValue('osm_placement').find(page => page.value === 'productPage');
        var value = isPDPSitePref ? 'credit-promotion-auto-size' : localeObject.custom.osmPDPTagId;

        return value;
    },
    /**
     * Function that checks if OSM is enabled for header
     * @return {boolean} enable status
     */
    isEnabledHeader: function () {
        var localeObject = this.getKlarnaCountriesObject();
        var isHeaderPlacement = currentSite.getCustomPreferenceValue('osm_placement').find(page => page.value === 'siteBanners');
        var value = (!empty(currentSite.getCustomPreferenceValue('osm_enable')) && isHeaderPlacement) ? currentSite.getCustomPreferenceValue('osm_enable') :
            (localeObject.custom.osmHeaderEnabled) || false;

        return value;
    },
    /**
     * Function that checks if OSM is enabled for header placement tag
     * @return {boolean} enable status
     */
    getHeaderPlacementTagId: function () {
        var localeObject = this.getKlarnaCountriesObject();
        var isHeaderSitePref = currentSite.getCustomPreferenceValue('osm_placement').find(page => page.value === 'siteBanners');
        var value = isHeaderSitePref ? 'top-strip-promotion-badge' : localeObject.custom.osmHeaderTagId;

        return value;
    },
    /**
     * Function that checks if OSM is enabled for footer
     * @return {boolean} enable status
     */
    isEnabledFooter: function () {
        var localeObject = this.getKlarnaCountriesObject();
        var isFooterPlacement = currentSite.getCustomPreferenceValue('osm_placement').find(page => page.value === 'footer');
        var value = (!empty(currentSite.getCustomPreferenceValue('osm_enable')) && isFooterPlacement) ? currentSite.getCustomPreferenceValue('osm_enable') :
            (localeObject.custom.osmFooterEnabled) || false;

        return value;
    },
    /**
     * Function that checks if OSM is enabled for footer tag
     * @return {boolean} enable status
     */
    getFooterPlacementTagId: function () {
        var localeObject = this.getKlarnaCountriesObject();
        var isFooterSitePref = currentSite.getCustomPreferenceValue('osm_placement').find(page => page.value === 'footer');
        var value = isFooterSitePref ? 'footer-promotion-auto-size' : localeObject.custom.osmFooterTagId;

        return value;
    },
    /**
     * Function that checks if OSM is enabled for info page
     * @return {boolean} enable status
     */
    isEnabledInfoPage: function () {
        var localeObject = this.getKlarnaCountriesObject();
        var isInfoPlacement = currentSite.getCustomPreferenceValue('osm_placement').find(page => page.value === 'faq');
        var value = (!empty(currentSite.getCustomPreferenceValue('osm_enable')) && isInfoPlacement) ? currentSite.getCustomPreferenceValue('osm_enable') :
            (localeObject.custom.osmInfoPageEnabled) || false;

        return value;
    },
    /**
     * Function that checks if OSM is enabled for info page tag
     * @return {boolean} enable status
     */
    getInfoPagePlacementTagId: function () {
        var localeObject = this.getKlarnaCountriesObject();
        var isInfoSitePref = currentSite.getCustomPreferenceValue('osm_placement').find(page => page.value === 'faq');
        var value = isInfoSitePref ? 'info-page' : localeObject.custom.osmInfoPageTagId;

        return value;
    },
    /**
     * Function that returns OSM client ID
     * @return {string} clientID
     */
    getUCI: function () {
        var klarnaClientKey = KlarnaHelper.getKlarnaClientId();
        if (klarnaClientKey) {
            return klarnaClientKey;
        }
        var localeObject = this.getKlarnaCountriesObject();
        var uci = localeObject.custom.osmUCI;

        return uci;
    },
    /**
     * Function that returns OSM library URL
     * @return {string} library URL
     */
    getScriptURL: function () {
        return KlarnaConstants.KLARNA_LIBS_URLS.KLARNA_OSM_SCRIPT_URL;
    },
    /**
     * Function that returns rounded price
     *
     * @param {Object} price price object
     * @return {number} formatted amount
     */
    formatPurchaseAmount: function (price) {
        var formattedAmount = Math.round(price.value * 100);

        return formattedAmount;
    },

    getExpressButtonScriptURL: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return localeObject.custom.kebLibraryUrl;
    },

    getExpressButtonMID: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return localeObject.custom.kebMerchantID;
    },

    isEnabledExpressButtonCart: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return localeObject.custom.kebCartEnabled || false;
    },

    isEnabledExpress: function () {
        return this.isEnabledExpressButtonCart();
    },

    getExpressButtonTheme: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return localeObject.custom.kebTheme.value || 'default';
    },
    getExpressButtonEnvironment: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return localeObject.custom.kebEnvironment.value || 'playground';
    },

    getExpressButtonCategory: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return localeObject.custom.kebCategory || '';
    },

    isEnabledMCExpressButton: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return localeObject.custom.kebMCEnabled || false;
    },
    getMCExpressButtonTheme: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return localeObject.custom.kebMCTheme.value || 'default';
    },
    getExpressButtonShape: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return localeObject.custom.kebShape.value || 'default';
    },
    getMiniCartExpressButtonShape: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return localeObject.custom.kebMiniCartShape.value || 'default';
    },
    isKlarnExpressCheckoutEnabled: function () {
        return !empty(currentSite.getCustomPreferenceValue('kec_enable')) ? (this.isKlarnaEnabled() && currentSite.getCustomPreferenceValue('kec_enable')) :
            (currentSite.getCustomPreferenceValue('kpECEnabled') || false);
    },
    showExpressCheckoutButton: function () {
        var showECButton = currentSite.getCustomPreferenceValue('kec_placement');
        var showECButtonObj = {
            cart: false,
            pdp: false,
            miniCart: false
        };
        if (showECButton && showECButton.length) {
            showECButton.forEach(function (item) {
                if (item.value === 'pdp') {
                    showECButtonObj.pdp = true;
                }
                if (item.value === 'cart') {
                    showECButtonObj.cart = true;
                }
                if (item.value === 'minicart') {
                    showECButtonObj.miniCart = true;
                }
            });
        }
        return showECButtonObj;
    },
    getKlarnExpressCheckoutClientKey: function () {
        return KlarnaHelper.getExpressCheckoutClientKey();
    },
    getKlarnExpressCheckoutScriptURL: function () {
        return KlarnaConstants.KLARNA_LIBS_URLS.EXPRESS_CHECKOUT_URL;
    },
    getKlarnaSignInScriptURL: function () {
        return KlarnaConstants.KLARNA_LIBS_URLS.KLARNA_SIGNIN_SCRIPT_URL;
    },
    getOSMEnvironment: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return KlarnaHelper.getKlarnaEnvironment() || (localeObject.custom.osmEnvironment.value || 'playground');
    },
    getCartPlacementCustomStyling: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return !empty(currentSite.getCustomPreferenceValue('osm_custom_styling')) ? currentSite.getCustomPreferenceValue('osm_custom_styling') : (localeObject.custom.osmCartCustomStyling || null);
    },
    getOSMCartTheme: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return !empty(currentSite.getCustomPreferenceValue('osm_theme')) ? currentSite.getCustomPreferenceValue('osm_theme').value : (localeObject.custom.osmCartTheme.value || 'default');
    },
    getOSMHeaderTheme: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return !empty(currentSite.getCustomPreferenceValue('osm_theme')) ? currentSite.getCustomPreferenceValue('osm_theme').value : (localeObject.custom.osmHeaderTheme.value || 'default');
    },
    getHeaderPlacementCustomStyling: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return !empty(currentSite.getCustomPreferenceValue('osm_custom_styling')) ? currentSite.getCustomPreferenceValue('osm_custom_styling') : (localeObject.custom.osmHeaderCustomStyling || null);
    },
    getOSMFooterTheme: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return !empty(currentSite.getCustomPreferenceValue('osm_theme')) ? currentSite.getCustomPreferenceValue('osm_theme').value : (localeObject.custom.osmFooterTheme.value || 'default');
    },
    getFooterPlacementCustomStyling: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return !empty(currentSite.getCustomPreferenceValue('osm_custom_styling')) ? currentSite.getCustomPreferenceValue('osm_custom_styling') : (localeObject.custom.osmFooterCustomStyling || null);
    },
    getOSMInfoPageTheme: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return !empty(currentSite.getCustomPreferenceValue('osm_theme')) ? currentSite.getCustomPreferenceValue('osm_theme').value : (localeObject.custom.osmInfoPageTheme.value || 'default');
    },
    getInfoPagePlacementCustomStyling: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return !empty(currentSite.getCustomPreferenceValue('osm_custom_styling')) ? currentSite.getCustomPreferenceValue('osm_custom_styling') : (localeObject.custom.osmInfoPageCustomStyling || null);
    },
    getOSMPDPTheme: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return !empty(currentSite.getCustomPreferenceValue('osm_theme')) ? currentSite.getCustomPreferenceValue('osm_theme').value : (localeObject.custom.osmPDPTheme.value || 'default');
    },
    getPDPPlacementCustomStyling: function () {
        var localeObject = this.getKlarnaCountriesObject();
        return !empty(currentSite.getCustomPreferenceValue('osm_custom_styling')) ? currentSite.getCustomPreferenceValue('osm_custom_styling') : (localeObject.custom.osmPDPCustomStyling || null);
    },
    getKlarnaSignInClientId: function () {
        var newKlarnaClientKey = KlarnaHelper.getKlarnaClientId();
        if (newKlarnaClientKey) {
            return newKlarnaClientKey;
        }
        var localeObject = this.getKlarnaCountriesObject();
        return localeObject.custom.signInClientId || '';
    },
    isKlarnaSignInEnabled: function () {
        return this.isKlarnaEnabled() && (currentSite.getCustomPreferenceValue('siwk_enable') || false);
    },
    getKlarnaSignInButtonShape: function () {
        return currentSite.getCustomPreferenceValue('siwk_shape').value || 'default';
    },
    getKlarnaSignInButtonTheme: function () {
        return currentSite.getCustomPreferenceValue('siwk_theme').value || 'default';
    },
    getKlarnaSignInEnvironment: function () {
        return KlarnaHelper.getKlarnaEnvironment();
    },
    getKlarnaSignInScope: function () {
        return KlarnaConstants.SIGN_IN_DEFAULT_SCOPE + currentSite.getCustomPreferenceValue('siwk_scope').join(" ");
    },
    getKlarnaSignInButtonLogoAlignment: function () {
        return currentSite.getCustomPreferenceValue('siwk_alignment').value || 'default';
    },
    getKlarnaSignInRedirectURL: function () {
        return currentSite.getCustomPreferenceValue('siwk_redirect_url');
    },
    showKlarnaSigninButton: function () {
        var showSignInButton = currentSite.getCustomPreferenceValue('siwk_placement');
        var showSignInButtonObj = {
            checkoutPage: false,
            loginPage: false
        };
        if (showSignInButton && showSignInButton.length) {
            showSignInButton.forEach(function (item) {
                if (item.value === 'checkoutPage') {
                    showSignInButtonObj.checkoutPage = true;
                }
                if (item.value === 'loginPage') {
                    showSignInButtonObj.loginPage = true;
                }
            });
        }
        return showSignInButtonObj;
    }
};

module.exports = KlarnaOSM;
