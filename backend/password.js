
const argon2 = require("@node-rs/argon2");

// Hash a password before saving it to the database
async function hashPassword(password) {
    return argon2.hash(password, {
        // Argon2id is the password-hashing algorithm chosen
        algorithm: argon2.Algorithm.Argon2id,

        // Memory used for hashing, in KiB (19 MiB)
        // More memory makes large-scale password guessing more expensive
        memoryCost: 19456,

        // Number of passes through the hashing process
        // Higher values increase the computation required
        timeCost: 2,

        // Number of parallel threads used for hashing
        parallelism: 1
    });
}

// Check a password entered by a user against the saved hash
// Returns true if it matches, or false if it does not
async function verifyPassword(hash, password) {
    return argon2.verify(hash, password);
}

// Export both functions so server.js and other backend files can use them
module.exports = {
    hashPassword,
    verifyPassword
};
