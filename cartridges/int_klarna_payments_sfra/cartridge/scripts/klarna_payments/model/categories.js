'use strict';

/**
 *
 * @param {Object} categories KP categories
 */
function KlarnaPaymentsCategories(categories) {
    this.categories = categories;
}

KlarnaPaymentsCategories.prototype.findCategoryById = function (categoryId) {
    var cat = null;

    this.categories.toArray().forEach(function (item) {
        if (item.identifier === categoryId) {
            cat = item;
            return;
        }
    });

    return cat;
};

module.exports = KlarnaPaymentsCategories;
