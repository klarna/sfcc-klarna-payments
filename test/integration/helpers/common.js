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
common.subscriptionPayload = {
    'purchase_country': 'US',
    'purchase_currency': 'USD',
    'locale': 'en-us',
    'shipping_address': {
        'title': '',
        'given_name': 'John',
        'family_name': 'Doe',
        'email': 'someone@example.com',
        'phone': '3106143376',
        'street_address': 'Lombard St 10',
        'street_address2': '',
        'postal_code': '90210',
        'city': 'Beverly Hills',
        'region': 'CA',
        'country': 'US'
    },
    'order_amount': 7702,
    'order_tax_amount': 367,
    'order_lines': [
        {
            'type': 'physical',
            'name': 'Quilted Jacket',
            'reference': '701642853695M',
            'quantity': 1,
            'merchant_data': '',
            'unit_price': 7103,
            'tax_rate': 500,
            'total_amount': 7103,
            'total_tax_amount': 338,
            'total_discount_amount': 0,
            'product_url': '',
            'image_url': '',
            'product_identifiers': {
                'category_path': 'Womens > Clothing > Jackets & Coats'
            },
            'subscription': {
                'interval': 'DAY',
                'interval_count': 1,
                'name': 'Quilted Jacket'
            }
        },
        {
            'type': 'shipping_fee',
            'name': 'Ground Transport',
            'reference': '001',
            'quantity': 1,
            'merchant_data': '{\'products\':[\'013742003154M\'],\'address\':\' John Doe Lombard St 10,Beverly Hills,CA 90210 3106143376\'}',
            'unit_price': 599,
            'tax_rate': 500,
            'total_amount': 599,
            'total_tax_amount': 29,
            'total_discount_amount': 0,
            'product_url': null,
            'image_url': null
        }
    ],
    'merchant_reference1': '00003004',
    'merchant_reference2': 'f9a33871d94a6f0d2d1a6adc0a',
    'merchant_urls': {
        'confirmation': '',
        'notification': ''
    },
    'merchant_data': null
};
common.customerToken = '0a65cbb6-abaf-4c34-8bf0-d0dca0ca6061';

common.klarnaOrderId = '03975aa5-51c0-4718-9913-04611e474ea8';
common.subscriptionField = 'kpSubscriptionFrequency';
common.subscriptionFieldValue = '1';

module.exports = common;
