'use strict';

var CustomObjectMgr = require( 'dw/object/CustomObjectMgr' );
var Locale = require( 'dw/util/Locale' );

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
    setCountryCode: function( countryCode ) {
        this.countryCode = countryCode;
    },
    /**
     * Retrieves country code from request locale
     * @return {string} country code
     */
    retrieveCountryCodeFromRequestLocale: function() {
        var requestLocale = Locale.getLocale( request.locale );
        var currentCountryCode = requestLocale.country;

        return currentCountryCode;
    },
    /**
     * Function that returns the country code set in the OSM object
     * @return {string} country code
     */
    getCountryCode: function() {
        if ( !this.countryCode ) {
            this.countryCode = this.retrieveCountryCodeFromRequestLocale();
        }

        return this.countryCode;
    },
    /**
     * Function that returns the current locale in a klarna compatible format
     *
     * @return {string} locale code
     */
    getLocale: function() {
        var currentLocale = Locale.getLocale( request.locale );
        var resultLocale = currentLocale.language;
        if ( currentLocale.country ) {
            resultLocale = resultLocale + '-' + currentLocale.country;
        }
        return resultLocale;
    },
    /**
     * Function that returns the KlarnaCountries custom object for the selected country
     * @return {dw.object.CustomObject} locale Object
     */
    loadKlarnaCountriesObject: function() {
        var countryCode = this.getCountryCode();
        var localeObject = CustomObjectMgr.getCustomObject( 'KlarnaCountries', countryCode );

        return localeObject;
    },
    /**
     * Function that sets and returns the KlarnaCountries custom object
     * @return {dw.object.CustomObject} locale Object 
     */
    getKlarnaCountriesObject: function() {
        if ( !this.klarnaCountriesObject ) {
            this.klarnaCountriesObject = this.loadKlarnaCountriesObject();
        }

        return this.klarnaCountriesObject;
    },
    /**
     * Function that checks if OSM object is enabled
     * @return {boolean} enabled/disabled
     */
    isEnabled: function() {
        return ( this.isEnabledCartPage() || this.isEnabledPDPPage() || this.isEnabledHeader() || this.isEnabledFooter() || this.isEnabledInfoPage() );
    },
    /**
     * Function that checks if OSM is enabled for cart
     * @return {boolean} enable status
     */
    isEnabledCartPage: function() {
        var localeObject = this.getKlarnaCountriesObject();
        var value = localeObject.custom.osmCartEnabled;

        return value;
    },
    /**
     * Function that checks if OSM is enabled for cart page tag
     * @return {boolean} enable status
     */
    getCartPagePlacementTagId: function() {
        var localeObject = this.getKlarnaCountriesObject();
        var value = localeObject.custom.osmCartTagId;

        return value;
    },
    /**
     * Function that checks if OSM is enabled for PDP
     * @return {boolean} enable status
     */
    isEnabledPDPPage: function() {
        var localeObject = this.getKlarnaCountriesObject();
        var value = localeObject.custom.osmPDPEnabled;

        return value;
    },
    /**
     * Function that checks if OSM is enabled for PDP page tag
     * @return {boolean} enable status
     */
    getPDPPagePlacementTagId: function() {
        var localeObject = this.getKlarnaCountriesObject();
        var value = localeObject.custom.osmPDPTagId;

        return value;
    },
    /**
     * Function that checks if OSM is enabled for header
     * @return {boolean} enable status
     */
    isEnabledHeader: function() {
        var localeObject = this.getKlarnaCountriesObject();
        var value = localeObject.custom.osmHeaderEnabled;

        return value;
    },
    /**
     * Function that checks if OSM is enabled for header placement tag
     * @return {boolean} enable status
     */
    getHeaderPlacementTagId: function() {
        var localeObject = this.getKlarnaCountriesObject();
        var value = localeObject.custom.osmHeaderTagId;

        return value;
    },
    /**
     * Function that checks if OSM is enabled for footer
     * @return {boolean} enable status
     */
    isEnabledFooter: function() {
        var localeObject = this.getKlarnaCountriesObject();
        var value = localeObject.custom.osmFooterEnabled;

        return value;
    },
    /**
     * Function that checks if OSM is enabled for footer tag
     * @return {boolean} enable status
     */
    getFooterPlacementTagId: function() {
        var localeObject = this.getKlarnaCountriesObject();
        var value = localeObject.custom.osmFooterTagId;

        return value;
    },
    /**
     * Function that checks if OSM is enabled for info page
     * @return {boolean} enable status
     */
    isEnabledInfoPage: function() {
        var localeObject = this.getKlarnaCountriesObject();
        var value = localeObject.custom.osmInfoPageEnabled;

        return value;
    },
    /**
     * Function that checks if OSM is enabled for info page tag
     * @return {boolean} enable status
     */
    getInfoPagePlacementTagId: function() {
        var localeObject = this.getKlarnaCountriesObject();
        var value = localeObject.custom.osmInfoPageTagId;

        return value;
    },
    /**
     * Function that checks if OSM attribute "data-inline" is enabled for PDP/Cart placements
     * @return {boolean} enable status
     */
    isEnabledDataInline: function() {
        var localeObject = this.getKlarnaCountriesObject();
        var value = localeObject.custom.osmDataInlineEnabled;

        return value;
    },
    /**
     * Function that returns OSM client ID
     * @return {string} clientID
     */
    getUCI: function() {
        var localeObject = this.getKlarnaCountriesObject();
        var uci = localeObject.custom.osmUCI;

        return uci;
    },
    /**
     * Function that returns OSM library URL
     * @return {string} library URL
     */
    getScriptURL: function() {
        var localeObject = this.getKlarnaCountriesObject();
        var url = localeObject.custom.osmLibraryUrl;

        return url;
    },
    /**
     * Function that returns rounded price
     * 
     * @param {Object} price price object
     * @return {number} formatted amount
     */
    formatPurchaseAmount: function( price ) {
        var formattedAmount = Math.round( price.value * 100 );

        return formattedAmount;
    }
};

module.exports = KlarnaOSM;