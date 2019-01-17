(function () {
    'use strict';

    /**
     * @constructor
     * @classdesc Abstract Builder, extend for building complex Objects.
     */
    var Builder = function () {};

    var log = function (name) {
        return 'Abstract method "' + name + '" must be overriden';
    };

    Builder.prototype.build = function () {
        throw new Error(log('build'));
    };

    module.exports = Builder;
}());
