'use strict';

function KlarnaPaymentsCategories(categories) {
    this.categories = categories;
};

KlarnaPaymentsCategories.prototype.findCategoryById = function(categoryId) {
    var cat = null;

    for each (var item in this.categories) {
        if (item.identifier === categoryId) {
            cat = item;
            break;
        }
    }

    return cat;
};

module.exports = KlarnaPaymentsCategories;