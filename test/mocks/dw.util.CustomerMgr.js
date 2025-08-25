// Mocking CustomerMgr
const CustomerMgr = {
    // Mock the method to get externally authenticated customer profile
    getExternallyAuthenticatedCustomerProfile: (provider, email) => {
        // Return a mock profile if it exists, else return null
        if (email === 'test@example.com') {
            return {
                firstName: 'John',
                lastName: 'Doe',
                email: email,
                phoneHome: '1234567890',
                customer: {
                    getExternalProfile: (provider, email) => {
                        // Simulating the existence of external profile
                        if (email === 'test@example.com') {
                            return { email: email, provider: 'Klarna' };
                        }
                        return null;
                    }
                }
            };
        }
        return null; // Simulate that no profile exists for other emails
    },

    // Mock the method to create externally authenticated customer
    createExternallyAuthenticatedCustomer: (provider, email) => {
        // Simulate customer creation if email doesn't exist
        if (email === 'new@example.com') {
            return {
                profile: {
                    firstName: 'Jane',
                    lastName: 'Smith',
                    email: email,
                    phoneHome: '0987654321',
                    customer: {
                        getExternalProfile: (provider, email) => null // Simulate no external profile
                    }
                }
            };
        }
        return null; // Simulate no customer created for other cases
    },

    // Mocking the login method for externally authenticated customers
    loginExternallyAuthenticatedCustomer: (provider, email, isNewCustomer) => {
        // Simulate that login is successful for a known customer
        if (email === 'existing@example.com') {
            return {
                profile: { email: email },
                isLoggedIn: true
            };
        }
        return null; // Simulate failure to log in for unknown customers
    }
};

module.exports = CustomerMgr;
