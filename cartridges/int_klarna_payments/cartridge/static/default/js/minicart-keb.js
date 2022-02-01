// Clone all children of the Custom Element
function cloneShadow( shadow ) {
    var frag = document.createDocumentFragment();
    var nodes = [...shadow.childNodes];
    nodes.forEach( function( node ) {
        frag.appendChild( node.cloneNode( true ) );
    } );
    return frag;
}

// If MiniCart KEB isn't present, clone Original KEB and add to MiniCart 
var miniCartKEB = document.querySelector( ".mini-cart-content .keb-cart klarna-express-button" );

if ( miniCartKEB && !miniCartKEB.shadowRoot ) {
    var originalKEB = document.querySelector( '#miniCartKEB .keb-cart klarna-express-button' );
    if ( originalKEB && originalKEB.shadowRoot ) {
        var clonedKEB = cloneShadow( originalKEB.shadowRoot );
        var clonedButton = clonedKEB.querySelector( 'button' );
        var originalButton = originalKEB.shadowRoot.querySelector( 'button' );
        if ( originalButton ) {
            clonedButton.addEventListener( 'click', function( e ) {
                originalButton.click();
            } );
        }
        miniCartKEB.appendChild( clonedKEB );
    }
}
