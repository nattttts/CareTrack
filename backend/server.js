const path = require("path");
const express = require("express");
const cors = require("cors");
const db = require("./database");
const { createInvitation } = require("./invitation");
const crypto = require("node:crypto");
const { hashPassword } = require("./password");
const { sendInvitationEmail } = require("./email");
require("dotenv").config({
    path: require("node:path").join(__dirname, "../.env")
});

const app = express();
app.use(cors());
app.use(express.json());

// Serve HTML files
app.use(express.static(path.join(__dirname, "../html")));

// Serve CSS files
app.use("/css", express.static(path.join(__dirname, "../css")));

// Serve JavaScript files
app.use("/js", express.static(path.join(__dirname, "../js")));

// Serve icon files
app.use("/icons", express.static(path.join(__dirname, "../icons")));

// Serve image files
app.use("/images", express.static(path.join(__dirname, "../images")));

const PORT = 3000;

app.get("/", (req, res) => {
    res.send("CareTrack backend is working!");
});

// Set up password
app.post("/api/set-password", async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body;

        // Check that all required fields were submitted
        if (
            typeof token !== "string" ||
            typeof password !== "string" ||
            typeof confirmPassword !== "string"
        ) {
            return res.status(400).json({
                message: "Please complete all required fields."
            });
        }

        // Apply the password policy on the server
        if (password.length < 12 || password.length > 128) {
            return res.status(400).json({
                message: "Your password must be between 12 and 128 characters."
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                message: "The passwords do not match."
            });
        }

        // The invitation tokens are 32 random bytes encoded as 64 hex characters.
        if (!/^[a-f0-9]{64}$/i.test(token)) {
            return res.status(400).json({
                message: "This invitation link is invalid or has expired."
            });
        }

        // Hash the token before searching the database
        // The database stores token_hash, not the original token
        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        // Find the invitation and the account it belongs to
        const invitation = db.prepare(`
            SELECT
                Invitation_Token.invitation_id,
                Invitation_Token.user_id,
                Invitation_Token.expires_at,
                Invitation_Token.used_at,
                Invitation_Token.revoked_at,
                User.password_set,
                User.account_status
            FROM Invitation_Token
            INNER JOIN User
                ON Invitation_Token.user_id = User.user_id
            WHERE Invitation_Token.token_hash = ?
        `).get(tokenHash);

        // Return a generic message so account details are not exposed
        if (
            !invitation ||
            invitation.used_at ||
            invitation.revoked_at ||
            new Date(invitation.expires_at).getTime() <= Date.now() ||
            Number(invitation.password_set) === 1 ||
            invitation.account_status !== "Active"
        ) {
            return res.status(400).json({
                message: "This invitation link is invalid or has expired. Please request a new invitation."
            });
        }

        // Hash the new password using Argon2id
        const passwordHash = await hashPassword(password);

        // Recheck the invitation inside a transaction before saving
        // This prevents two simultaneous requests from using the same token
        const completeSetup = db.transaction(() => {
            const currentInvitation = db.prepare(`
                SELECT
                    Invitation_Token.user_id,
                    Invitation_Token.expires_at,
                    User.password_set,
                    User.account_status
                FROM Invitation_Token
                INNER JOIN User
                    ON Invitation_Token.user_id = User.user_id
                WHERE Invitation_Token.invitation_id = ?
                  AND Invitation_Token.token_hash = ?
                  AND Invitation_Token.used_at IS NULL
                  AND Invitation_Token.revoked_at IS NULL
            `).get(invitation.invitation_id, tokenHash);

            if (
                !currentInvitation ||
                new Date(currentInvitation.expires_at).getTime() <= Date.now() ||
                Number(currentInvitation.password_set) !== 0 ||
                currentInvitation.account_status !== "Active"
            ) {
                return false;
            }

            // Save the hash, not the original password
            const updateUser = db.prepare(`
                UPDATE User
                SET password_hash = ?,
                    password_set = 1
                WHERE user_id = ?
                  AND password_set = 0
                  AND account_status = 'Active'
            `).run(passwordHash, currentInvitation.user_id);

            if (updateUser.changes !== 1) {
                return false;
            }

            // Mark the invitation as used so it cannot be reused
            const useToken = db.prepare(`
                UPDATE Invitation_Token
                SET used_at = CURRENT_TIMESTAMP
                WHERE invitation_id = ?
                  AND used_at IS NULL
                  AND revoked_at IS NULL
            `).run(invitation.invitation_id);

            if (useToken.changes !== 1) {
                throw new Error("Could not mark the invitation as used.");
            }

            return true;
        });

        const success = completeSetup();

        if (!success) {
            return res.status(400).json({
                message: "This invitation link is invalid or has expired. Please request a new invitation."
            });
        }

        return res.json({
            message: "Your password has been set successfully. You can now log in."
        });
    } catch (error) {
        console.error("Error setting password:", error);

        return res.status(500).json({
            message: "Unable to set your password right now. Please try again."
        });
    }
});

// Get all staff members
app.get("/api/staff", (req, res) => {
    try {
        const staff = db.prepare(`
            SELECT
                Staff.staff_id,
                User.user_id,
                User.full_name,
                User.email,
                Staff.position,
                User.account_status,
                User.created_at,
                Staff.phone_no,
                User.password_set
            FROM Staff
            INNER JOIN User
                ON Staff.user_id = User.user_id
            ORDER BY Staff.staff_id
        `).all();

        res.json(staff);
    } catch (error) {
        console.error("Error retrieving staff:", error);
        res.status(500).json({
            message: "Failed to retrieve staff records."
        });
    }
});

// Add a new staff
app.post("/api/staff", async (req, res) => {
    const { full_name, user_id, email, phone_no, position } = req.body;

    // Validate required fields
    if (
        typeof full_name !== "string" ||
        typeof user_id !== "string" ||
        typeof email !== "string" ||
        typeof phone_no !== "string" ||
        typeof position !== "string"
    ) {
        return res.status(400).json({
            message: "Please provide all required staff details."
        });
    }

    const name = full_name.trim();
    const icNumber = user_id.trim();
    const staffEmail = email.trim().toLowerCase();
    const phone = phone_no.trim();

    if (!name || !icNumber || !staffEmail || !phone) {
        return res.status(400).json({
            message: "All fields are required."
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffEmail)) {
        return res.status(400).json({
            message: "Please enter a valid email address."
        });
    }

    if (!["Doctor", "Nurse"].includes(position)) {
        return res.status(400).json({
            message: "Position must be Doctor or Nurse."
        });
    }

    try {
        // Check whether this IC number already has an account
        const existingUser = db.prepare(`
            SELECT user_id
            FROM User
            WHERE user_id = ?
        `).get(icNumber);

        if (existingUser) {
            return res.status(409).json({
                message: "An account with this IC number already exists."
            });
        }

        // TEMPORARY: Replace with a real password hash before implementing login
        // The login route must reject accounts where password_set = 0
        const passwordHash = "TEMP_HASH_REPLACE_BEFORE_AUTH";

        // Create the user, staff profile and invitation together
        // If any database operation fails, the transaction rolls back
        const createStaff = db.transaction(() => {
            db.prepare(`
                INSERT INTO User (
                    user_id,
                    full_name,
                    email,
                    password_hash,
                    role,
                    account_status,
                    password_set
                )
                VALUES (?, ?, ?, ?, 'staff', 'Active', 0)
            `).run(
                icNumber,
                name,
                staffEmail,
                passwordHash
            );

            const result = db.prepare(`
                INSERT INTO Staff (
                    user_id,
                    position,
                    phone_no
                )
                VALUES (?, ?, ?)
            `).run(
                icNumber,
                position,
                phone
            );
            
            // Create an invitation for the newly created staff account.
            // createInvitation() uses a nested transaction, which
            // better-sqlite3 supports through a savepoint
            const token = createInvitation(icNumber);

            return {
                staffId: result.lastInsertRowid,
                token
            };
        });

        const { staffId, token } = createStaff();

        // Construct the invitation URL for local testing
        const baseUrl = (
            process.env.APP_BASE_URL || `http://localhost:${PORT}`
        ).replace(/\/+$/, "");

        const invitationUrl =
            `${baseUrl}/set_password.html?token=${encodeURIComponent(token)}`;
        
        let emailPreviewUrl = null;
        let emailError = false;

        try {
            const emailResult = await sendInvitationEmail(
                staffEmail,
                invitationUrl
            );

            emailPreviewUrl = emailResult.previewUrl;
        } catch (error) {
            emailError = true;
            console.error("Failed to send staff invitation email:", error);
        }

        const response = {
            message: emailError
                ? "Staff account created, but the invitation email could not be sent. Please resend it."
                : "Staff account created and invitation email sent.",
            staff_id: staffId
        };

        // Never return the usable invitation token in production
        if (process.env.NODE_ENV !== "production") {
            response.emailPreviewUrl = emailPreviewUrl;
            // response.developmentInvitationUrl = invitationUrl;
        }

        return res.status(201).json(response);

    } catch (error) {
        console.error("Error creating staff:", error);

        if (
            error.code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
            error.code === "SQLITE_CONSTRAINT_UNIQUE"
        ) {
            return res.status(409).json({
                message: "A staff account with these details already exists."
            });
        }

        return res.status(500).json({
            message: "Failed to create staff account."
        });
    }
});

// Resend invitation link for password setup
app.post("/api/staff/:staffId/resend-invitation", async (req, res) => {
    try {
        const staff = db.prepare(`
            SELECT
                Staff.user_id,
                User.email,
                User.password_set,
                User.account_status
            FROM Staff
            INNER JOIN User
                ON Staff.user_id = User.user_id
            WHERE Staff.staff_id = ?
        `).get(req.params.staffId);

        if (!staff) {
            return res.status(404).json({
                message: "Staff account not found."
            });
        }

        if (Number(staff.password_set) === 1) {
            return res.status(409).json({
                message: "This staff member has already set their password."
            });
        }

        if (staff.account_status !== "Active") {
            return res.status(409).json({
                message: "Activate this staff account before sending an invitation."
            });
        }

        const token = createInvitation(staff.user_id);

        const baseUrl =
            process.env.APP_BASE_URL || `http://localhost:${PORT}`;

        const invitationUrl =
            `${baseUrl}/set_password.html?token=${encodeURIComponent(token)}`;

        try {
            const emailResult = await sendInvitationEmail(
                staff.email,
                invitationUrl
            );

            const response = {
                message: "Invitation email sent successfully."
            };

            if (process.env.NODE_ENV !== "production") {
                response.emailPreviewUrl = emailResult.previewUrl;
            }

            return res.status(200).json(response);
        } catch (error) {
            console.error("Failed to resend staff invitation:", error);

            return res.status(500).json({
                message: "The new invitation was created, but the email could not be sent. Please try resending it."
            });
        }

    } catch (error) {
        console.error("Error creating staff invitation:", error);

        return res.status(500).json({
            message: "Failed to create the staff invitation."
        });
    }
});

// Update staff details
app.patch("/api/staff/:staffId", (req, res) => {
    const staffId = Number(req.params.staffId);

    const {
        user_id,
        full_name,
        email,
        phone_no,
        position
    } = req.body;

    // Validate staff ID
    if (!Number.isInteger(staffId) || staffId <= 0) {
        return res.status(400).json({
            message: "Invalid staff ID."
        });
    }

    // Validate required fields
    if (
        typeof user_id !== "string" ||
        typeof full_name !== "string" ||
        typeof email !== "string" ||
        typeof phone_no !== "string" ||
        typeof position !== "string"
    ) {
        return res.status(400).json({
            message: "Please provide all required staff details."
        });
    }

    const newIC = user_id.trim();
    const name = full_name.trim();
    const normalizedEmail = email.trim();
    const phone = phone_no.trim();

    if (!newIC || !name || !normalizedEmail || !phone || !position) {
        return res.status(400).json({
            message: "All fields are required."
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({
            message: "Please enter a valid email address."
        });
    }

    if (!["Doctor", "Nurse"].includes(position)) {
        return res.status(400).json({
            message: "Please select a valid staff position."
        });
    }

    try {
        // Find the existing staff account
        const existingStaff = db.prepare(`
            SELECT Staff.user_id
            FROM Staff
            WHERE Staff.staff_id = ?
        `).get(staffId);

        if (!existingStaff) {
            return res.status(404).json({
                message: "Staff member not found."
            });
        }

        // Check whether the new IC belongs to another account
        const duplicateIC = db.prepare(`
            SELECT user_id
            FROM User
            WHERE user_id = ?
              AND user_id != ?
        `).get(newIC, existingStaff.user_id);

        if (duplicateIC) {
            return res.status(409).json({
                message: "This IC number is already registered."
            });
        }

        // Check whether another account uses this email
        const duplicateEmail = db.prepare(`
            SELECT user_id
            FROM User
            WHERE LOWER(TRIM(email)) = LOWER(?)
            AND user_id != ?
        `).get(normalizedEmail, existingStaff.user_id);

        if (duplicateEmail) {
            return res.status(409).json({
                message: "This email is already used by another account."
            });
        }

        // Update everything in one transaction
        const updateStaff = db.transaction(() => {
            db.prepare(`
                UPDATE User
                SET user_id = ?,
                    full_name = ?,
                    email = ?
                WHERE user_id = ?
            `).run(
                newIC,
                name,
                normalizedEmail,
                existingStaff.user_id
            );

            db.prepare(`
                UPDATE Staff
                SET phone_no = ?,
                    position = ?
                WHERE staff_id = ?
            `).run(phone, position, staffId);
        });

        updateStaff();

        return res.status(200).json({
            message: "Staff details updated successfully."
        });

    } catch (error) {
        console.error("Error updating staff:", error);

        return res.status(500).json({
            message: "Failed to update staff details."
        });
    }
});

// Update a staff account's status (Active or Inactive)
app.patch("/api/staff/:staffId/status", (req, res) => {
    const staffId = Number(req.params.staffId);
    const { account_status } = req.body;

    // Validate the staff ID
    if (!Number.isInteger(staffId) || staffId <= 0) {
        return res.status(400).json({
            message: "Invalid staff ID."
        });
    }

    // Only allow these two account statuses
    if (!["Active", "Inactive"].includes(account_status)) {
        return res.status(400).json({
            message: "Status must be Active or Inactive."
        });
    }

    try {
        // Check that the staff account exists
        const staff = db.prepare(`
            SELECT user_id
            FROM Staff
            WHERE staff_id = ?
        `).get(staffId);

        if (!staff) {
            return res.status(404).json({
                message: "Staff account not found."
            });
        }

        // Update the account status in the User table
        db.prepare(`
            UPDATE User
            SET account_status = ?
            WHERE user_id = ?
        `).run(account_status, staff.user_id);

        const action = account_status === "Inactive"
            ? "deactivated"
            : "activated";

        return res.status(200).json({
            message: `Staff account ${action} successfully.`,
            account_status
        });

    } catch (error) {
        console.error("Error updating staff status:", error);

        return res.status(500).json({
            message: "Failed to update staff account status."
        });
    }
});

// Get all mothers
app.get("/api/mothers", (req, res) => {
    try {
        const mothers = db.prepare(`
            SELECT
                Mother.mother_id,
                User.user_id,
                User.full_name,
                User.email,
                User.account_status,
                User.created_at,
                Mother.date_of_birth,
                Mother.address,
                Mother.phone_no,
                Mother.contact_name,
                Mother.relationship,
                Mother.contact_phone_no
            FROM Mother
            INNER JOIN User
                ON Mother.user_id = User.user_id
            ORDER BY User.account_status, User.full_name
        `).all();

        res.json(mothers);

    } catch (error) {
        console.error("Error retrieving mothers:", error);

        res.status(500).json({
            message: "Failed to retrieve mother records."
        });
    }
});

// Get all children
app.get("/api/children", (req, res) => {
    try {
        const children = db.prepare(`
            SELECT
                Child.child_id,
                User.user_id,
                User.full_name,
                User.email,
                User.account_status,
                User.created_at,
                Child.date_of_birth,
                Child.gender,
                Child.guardian_name,
                Child.phone_no
            FROM Child
            INNER JOIN User
                ON Child.user_id = User.user_id
            ORDER BY User.account_status, User.full_name
        `).all();

        res.json(children);

    } catch (error) {
        console.error("Error retrieving children:", error);

        res.status(500).json({
            message: "Failed to retrieve child records."
        });
    }
});

app.listen(PORT, () => {
    console.log(`CareTrack server running at http://localhost:${PORT}`);
    console.log("SQLite database connected!");
});