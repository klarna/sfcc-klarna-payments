'use strict';

/**
 * Clones all child nodes from a given shadow root into a new DocumentFragment.
 *
 * @param {ShadowRoot|HTMLElement} shadow - The shadow root or element whose child nodes should be cloned.
 * @returns {DocumentFragment} A new DocumentFragment containing deep clones of the shadow's child nodes.
 */
function cloneShadow(shadow) {
    var frag = document.createDocumentFragment();
    var nodes = [...shadow.childNodes];
    nodes.forEach(function (node) {
        frag.appendChild(node.cloneNode(true));
    });
    return frag;
}

// Clone Original KEB and add to MiniCart
var miniCartKEB = document.querySelector('#slotMiniCartKEB');

if (miniCartKEB) {
    var originalKEB = document.querySelector('#miniCartKEB .keb-cart klarna-express-button');

    if (originalKEB && originalKEB.shadowRoot) {
        var clonedKEB = cloneShadow(originalKEB.shadowRoot);
        var clonedButton = clonedKEB.querySelector('button');
        var originalButton = originalKEB.shadowRoot.querySelector('button');

        if (originalButton) {
            clonedButton.addEventListener('click', function () {
                originalButton.click();
            });
        }
        miniCartKEB.appendChild(clonedKEB);
    }
}
