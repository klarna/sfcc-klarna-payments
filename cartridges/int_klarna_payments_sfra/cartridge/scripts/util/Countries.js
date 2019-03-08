/* globals dw */

var countriesData = require('*/cartridge/config/countries');
var Locale = require('dw/util/Locale');

/**
 * @description filter out the countries array to return only ones that are allowed in
 * site's allowedLocales
 * @return {array} allowedCountries array of countries that have allowed locales
 */
function getCountries() {
    var site = dw.system.Site.getCurrent();
    var allowedLocales = site.getAllowedLocales();
    var allowedCountries = countriesData.filter(function (country) {
        var hasAllowedLocale = false;
		// loop over allowed locales
        for (var i = 0; i < allowedLocales.length; i++) {
            var locale = Locale.getLocale(allowedLocales[i]);
            if (country.id === locale.ID) {
                hasAllowedLocale = true;
                break;
            }
        }
        return hasAllowedLocale;
    });
    return allowedCountries;
}

/**
 * @description iterate over the countries array, find the first country that has the current locale
 * @param {PipelineDictionary} currentLocale the current locale object
 * @returns {Object|null} country the object containing the country's settings; null if no data available
 */
function getCurrent(currentLocale) {
    if (!countriesData || countriesData.length === 0) {
        return null;
    }

    var selectedCountry = null;

    if (!currentLocale.ID) {
        return countriesData[0]; // return the first in the list if the requested one is not available
    }
    for (var i = 0; i < countriesData.length; i++) {
        var country = countriesData[i];
        if (country.id === currentLocale.ID) {
            selectedCountry = country;
            break;
        }
    }
    return selectedCountry || countriesData[0];  // return the first in the list if the requested one is not available
}

exports.getCountries = getCountries;
exports.getCurrent = getCurrent;
