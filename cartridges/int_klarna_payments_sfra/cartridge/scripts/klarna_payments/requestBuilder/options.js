/* globals empty */

'use strict';

var Builder = require('*/cartridge/scripts/klarna_payments/builder');

/**
 * Options request builder
 */
function Options() {
    this.item = null;
}

Options.prototype = new Builder();

Options.prototype.build = function (preferences) {
    this.item = {};

    if (preferences.kpColorDetails) {
        this.item.color_details = preferences.kpColorDetails;
    }

    if (preferences.kpColorButton) {
        this.item.color_button = preferences.kpColorButton;
    }

    if (preferences.kpColorButtonText) {
        this.item.color_button_text = preferences.kpColorButtonText;
    }

    if (preferences.kpColorCheckbox) {
        this.item.color_checkbox = preferences.kpColorCheckbox;
    }

    if (preferences.kpColorCheckboxCheckmark) {
        this.item.color_checkbox_checkmark = preferences.kpColorCheckboxCheckmark;
    }

    if (preferences.kpColorHeader) {
        this.item.color_header = preferences.kpColorHeader;
    }

    if (preferences.kpColorLink) {
        this.item.color_link = preferences.kpColorLink;
    }

    if (preferences.kpColorBorder) {
        this.item.color_border = preferences.kpColorBorder;
    }

    if (preferences.kpColorBorderSelected) {
        this.item.color_border_selected = preferences.kpColorBorderSelected;
    }

    if (preferences.kpColorText) {
        this.item.color_text = preferences.kpColorText;
    }

    if (preferences.kpColorTextSecondary) {
        this.item.color_text_secondary = preferences.kpColorTextSecondary;
    }

    if (preferences.kpRadiusBorder) {
        this.item.radius_border = preferences.kpRadiusBorder;
    }

    return this.item;
};

module.exports = Options;
