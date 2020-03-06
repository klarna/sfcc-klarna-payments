'use strict';

var CustomObjectMgr = require( 'dw/object/CustomObjectMgr' );
var Locale = require( 'dw/util/Locale' );

/**
 * Klarna On-Site Messaging Component
 */
var KlarnaOSM = {
	countryCode: '',
	klarnaCountriesObject: null,
	setCountryCode: function( countryCode ) {
		this.countryCode = countryCode;
	},
	retrieveCountryCodeFromRequestLocale: function() {
		var requestLocale = Locale.getLocale( request.locale );
		var currentCountryCode = requestLocale.country;

		return currentCountryCode;
	},
	getCountryCode: function() {
		if ( !this.countryCode ) {
			this.countryCode = this.retrieveCountryCodeFromRequestLocale();
		}

		return this.countryCode;
	},
	 getLocale: function () {
        var currentLocale = Locale.getLocale(request.locale);
        var resultLocale = currentLocale.language;
        if (currentLocale.country) {
            resultLocale = resultLocale + '-' + currentLocale.country;
        }
        return resultLocale;
    },
	loadKlarnaCountriesObject: function() {
		var countryCode = this.getCountryCode();
		var localeObject = CustomObjectMgr.getCustomObject( 'KlarnaCountries', countryCode );

		return localeObject;
	},
	getKlarnaCountriesObject: function() {
		if ( !this.klarnaCountriesObject ) {
			this.klarnaCountriesObject = this.loadKlarnaCountriesObject();
		}

		return this.klarnaCountriesObject;
	},
	isEnabled: function() {
		return ( this.isEnabledCartPage() || this.isEnabledPDPPage() );
	},
	isEnabledCartPage: function() {
		var localeObject = this.getKlarnaCountriesObject();
		var value = localeObject.custom.osmCartEnabled;

		return value;
	},
	getCartPagePlacementTagId: function() {
		var localeObject = this.getKlarnaCountriesObject();
		var value = localeObject.custom.osmCartTagId;

		return value;
	},
	isEnabledPDPPage: function() {
		var localeObject = this.getKlarnaCountriesObject();
		var value = localeObject.custom.osmPDPEnabled;

		return value;
	},
	getPDPPagePlacementTagId: function() {
		var localeObject = this.getKlarnaCountriesObject();
		var value = localeObject.custom.osmPDPTagId;

		return value;
	},
	getUCI: function() {
		var localeObject = this.getKlarnaCountriesObject();
		var uci = localeObject.custom.osmUCI;

		return uci;
	},
	getScriptURL: function() {
        var localeObject = this.getKlarnaCountriesObject();
        var url = localeObject.custom.osmLibraryUrl;

        return url;
	},
	formatPurchaseAmount: function( price ) {
		var formattedAmount = Math.round( price.value * 100 );

		return formattedAmount;
	}
};

module.exports = KlarnaOSM;