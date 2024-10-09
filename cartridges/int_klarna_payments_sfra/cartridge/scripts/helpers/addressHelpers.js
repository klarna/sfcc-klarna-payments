'use strict';

var superMdl = module.superModule;

/**
 * Stores a new address for a given customer
 * @param {Object} address - New address to be saved
 * @param {Object} customer - Current customer
 * @param {string} addressId - Id of a new address to be created
 * @returns {void}
 */
superMdl.saveAddress = function (address, customer, addressId) {
    var Transaction = require('dw/system/Transaction');

    var addressBook = customer.raw.getProfile().getAddressBook();
    Transaction.wrap(function () {
        var newAddress = addressBook.createAddress(addressId);
        if (newAddress) {
            superMdl.updateAddressFields(newAddress, address);
        }
    });
};

/**
 * Generate address name based on the full address object
 * @param {dw.order.OrderAddress} address - Object that contains shipping address
 * @returns {string} - String with the generated address name
 */
superMdl.generateAddressName = function (address) {
    return [(address.city || ''), (address.postalCode || '')].join(' - ');
};

function saveExtAddress(address, customer, addressId) {
    var Transaction = require('dw/system/Transaction');

    var addressBook = customer.getProfile().getAddressBook();
    Transaction.wrap(function () {
        var newAddress = addressBook.createAddress(addressId);
        if (newAddress) {
            superMdl.updateAddressFields(newAddress, address);
            newAddress.setCountryCode(address.countryCode.value);
        }
    });

}

superMdl.saveExtAddress = saveExtAddress;
module.exports = superMdl;

