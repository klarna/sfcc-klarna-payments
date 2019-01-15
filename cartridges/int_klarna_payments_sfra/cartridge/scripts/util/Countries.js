/* globals dw */

var countriesData = require('~/cartridge/config/countries');
var Locale = require('dw/util/Locale');

/**
 *
 *		No changes were made to this script. It was copied over from
 *		Site Genesis to prevent complications with external cartridge
 *		references
 *
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

function getCountriesGroupedBy(group) {
    var countries = getCountries();
    var countriesGrouped = {};
    countries.forEach(function (country) {
        var key = country.hasOwnProperty(group) ? country[group] : undefined;
        if (countriesGrouped.hasOwnProperty(key)) {
            countriesGrouped[key].push(country);
        } else {
            countriesGrouped[key] = [country];
        }
    });
    return countriesGrouped;
}

/**
 * @description iterate over the countries array, find the first country that has the current locale
 * @param {PipelineDictionary} currentLocale the current locale object
 * @return {Object} country the object containing the country's settings
 */
function getCurrent(currentLocale) {
    if (!countriesData || countriesData.length === 0) {
        return;
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
exports.getCountriesGroupedBy = getCountriesGroupedBy;
exports.getCurrent = getCurrent;
