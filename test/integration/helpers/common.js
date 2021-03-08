function common() {}

common.variantId = '013742003154M';
common.shippingAddress = {
    firstName: 'John',
    lastName: 'Doe',
    address1: 'Lombard St 10',
    address2: '',
    country: 'US',
    stateCode: 'CA',
    city: 'Beverly Hills',
    postalCode: '90210',
    phone: '3106143376'
};
common.shippingMethodId = '001';
common.billingAddress = {
    firstName: 'John',
    lastName: 'Doe',
    address1: 'Lombard St 10',
    address2: '',
    country: 'US',
    stateCode: 'CA',
    city: 'Beverly Hills',
    postalCode: '90210',
    email: 'someone@example.com',
    phone: '3106143376'
};
common.paymentMethod = {
    id: 'KLARNA_PAYMENTS',
    category: 'pay_late'
};

module.exports = common;
