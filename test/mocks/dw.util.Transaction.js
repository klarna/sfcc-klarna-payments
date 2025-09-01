// Mocking Transaction
const Transaction = {
    wrap: (callback) => {
        // Simulating a successful transaction
        try {
            // Execute the callback inside a mock transaction
            callback();
            return true; // Transaction succeeded
        } catch (error) {
            // Simulating a failed transaction
            return false; // Transaction failed
        }
    }
};

module.exports = Transaction;
