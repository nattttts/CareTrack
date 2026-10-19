
const crypto = require("node:crypto");
const db = require("./database");

// Generate a new invitation token for a user account
// The original token is returned so it can be included in an invitation link
// Only its SHA-256 hash is saved in the database
function createInvitation(userId) {
    // Generate 32 random bytes (256 bits of randomness)
    // Hex encoding turns these bytes into a 64-character string
    const token = crypto.randomBytes(32).toString("hex");

    // Hash the token before storing it
    // This means the database doesn't contain the usable invitation token
    const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    // Set the invitation to expire 24 hours from now
    const expiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();

    // Use a transaction so revoking old invitations and creating
    // the new invitation happen together.
    const saveInvitation = db.transaction(() => {
        // Revoke any previous invitations that haven't been used
        // or revoked yet. This also handles previously expired tokens.
        db.prepare(`
            UPDATE Invitation_Token
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND used_at IS NULL
              AND revoked_at IS NULL
        `).run(userId);

        // Save the new invitation's hash and expiry time
        db.prepare(`
            INSERT INTO Invitation_Token (
                user_id,
                token_hash,
                expires_at
            )
            VALUES (?, ?, ?)
        `).run(userId, tokenHash, expiresAt);
    });

    // Execute the transaction
    saveInvitation();

    // Return the original token to the caller
    return token;
}

module.exports = {
    createInvitation
};
