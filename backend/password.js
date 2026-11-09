const { argon2, randomBytes, timingSafeEqual } = require("node:crypto");

// Argon2id configuration
const MEMORY_COST = 19456;
const TIME_COST = 2;
const PARALLELISM = 1;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

// Convert a Buffer into unpadded Base64
function toBase64(buffer) {
    return buffer.toString("base64").replace(/=+$/, "");
}

// Hash a password before saving it to the database
async function hashPassword(password) {
    const salt = randomBytes(SALT_LENGTH);

    const hash = await new Promise((resolve, reject) => {
        argon2("argon2id", {
            message: Buffer.from(password, "utf8"),
            nonce: salt,
            memory: MEMORY_COST,
            passes: TIME_COST,
            parallelism: PARALLELISM,
            tagLength: HASH_LENGTH
        }, (error, derivedKey) => {
            if (error) reject(error);
            else resolve(derivedKey);
        });
    });

    return `$argon2id$v=19$m=${MEMORY_COST},t=${TIME_COST},p=${PARALLELISM}$${toBase64(salt)}$${toBase64(hash)}`;
}

// Verify a password against its saved hash
async function verifyPassword(savedHash, password) {
    const parts = savedHash.split("$");

    if (
        parts.length !== 6 ||
        parts[1] !== "argon2id" ||
        parts[2] !== "v=19"
    ) {
        return false;
    }

    const parameters = Object.fromEntries(
        parts[3].split(",").map(item => item.split("="))
    );

    if (
        Number(parameters.m) !== MEMORY_COST ||
        Number(parameters.t) !== TIME_COST ||
        Number(parameters.p) !== PARALLELISM
    ) {
        return false;
    }

    const salt = Buffer.from(parts[4], "base64");
    const expectedHash = Buffer.from(parts[5], "base64");

    if (
        salt.length !== SALT_LENGTH ||
        expectedHash.length !== HASH_LENGTH
    ) {
        return false;
    }

    const actualHash = await new Promise((resolve, reject) => {
        argon2("argon2id", {
            message: Buffer.from(password, "utf8"),
            nonce: salt,
            memory: MEMORY_COST,
            passes: TIME_COST,
            parallelism: PARALLELISM,
            tagLength: HASH_LENGTH
        }, (error, derivedKey) => {
            if (error) reject(error);
            else resolve(derivedKey);
        });
    });

    return timingSafeEqual(actualHash, expectedHash);
}

module.exports = {
    hashPassword,
    verifyPassword
};
