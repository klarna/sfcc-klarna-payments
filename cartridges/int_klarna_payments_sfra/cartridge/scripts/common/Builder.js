(function () {
    'use strict';

    var Builder = function () {};

    var log = function (name) {
        return 'Abstract method "' + name + '" must be override';
    };

    Builder.prototype.build = function () {
        throw new Error(log('build'));
    };

    module.exports = Builder;
}());
