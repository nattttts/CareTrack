const crypto = require("node:crypto");
const db = require("./database");

// Create a password reset token for an existing user
// Only the SHA-256 hash is stored in the database
function createPasswordReset(userId) {
    // Generate a secure random token
    const token = crypto.randomBytes(32).toString("hex");

    // Hash the token before storing it
    const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    // Set the token to expire after 15 minutes
    const expiresAt = new Date(
        Date.now() + 15 * 60 * 1000
    ).toISOString();

    // Revoke old tokens and save the new token together
    const savePasswordReset = db.transaction(() => {
        db.prepare(`
            UPDATE Password_Reset_Token
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND used_at IS NULL
              AND revoked_at IS NULL
        `).run(userId);

        db.prepare(`
            INSERT INTO Password_Reset_Token (
                user_id,
                token_hash,
                expires_at
            )
            VALUES (?, ?, ?)
        `).run(userId, tokenHash, expiresAt);
    });

    savePasswordReset();

    // Return the original token for the reset email link
    return token;
}

module.exports = { createPasswordReset };