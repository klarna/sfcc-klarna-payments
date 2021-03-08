'use strict';

/**
 *
 * @param {Object} categories KP categories
 */
function KlarnaPaymentsCategories(categories) {
    this.categories = categories;
}

/**
 * Finds a given category
 *
 * @param {string} categoryId category ID
 * @return {Object} category
 */
KlarnaPaymentsCategories.prototype.findCategoryById = function (categoryId) {
    var cat = null;

    this.categories.forEach(function (item) {
        if (item.identifier === categoryId) {
            cat = item;
            return;
        }
    });

    return cat;
};

module.exports = KlarnaPaymentsCategories;
