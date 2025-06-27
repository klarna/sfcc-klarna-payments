// Clone all children of the Custom Element
function cloneShadow(shadow) {
    var frag = document.createDocumentFragment();
    var nodes = [...shadow.childNodes];
    nodes.forEach(function (node) {
        frag.appendChild(node.cloneNode(true));
    });
    return frag;
}

// Clone Original KEC and add to MiniCart
var miniCartKEC = document.querySelector("#slotMiniCartKEC");

if (miniCartKEC) {
    var originalKEC = document.querySelector("#miniCartKEC .klarna-express-mini-cart");

    if (originalKEC && !originalKEC.shadowRoot) {
        // KEC single step button is added as a child of klarna-express-mini-cart element
        originalKEC = originalKEC.firstChild;
    }
    if (originalKEC && originalKEC.shadowRoot) {
        var clonedKEC = cloneShadow(originalKEC.shadowRoot);
        var clonedButton = clonedKEC.querySelector("button");
        var originalButton = originalKEC.shadowRoot.querySelector("button");

        if (originalButton) {
            clonedButton.addEventListener("click", function (e) {
                originalButton.click();
            });
        }
        miniCartKEC.appendChild(clonedKEC);
    }
}


$(function () {
    $('body').on('cart:update', function (e, data) {
        if (data && (data.hasOwnProperty('basket') || data.hasOwnProperty('valid'))) {
            var cartObj = data.hasOwnProperty('basket') ? data.basket : data;
            if (cartObj.hasSubscriptionOnlyProduct) {
                $(miniCartKEC).parent().addClass('d-none');
            } else {
                $(miniCartKEC).parent().removeClass('d-none');
            }
        }
    });
});
