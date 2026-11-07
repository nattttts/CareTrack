const path = require("path");
const express = require("express");
const cors = require("cors");
const db = require("./database");
const { createInvitation } = require("./invitation");
const crypto = require("node:crypto");
const { hashPassword, verifyPassword } = require("./password");
const { createPasswordReset } = require("./password_reset");
const {
    sendInvitationEmail,
    sendPasswordResetEmail,
    sendAppointmentScheduledEmail,
    sendAppointmentUpdatedEmail,
    sendVaccinationNotificationEmail,
    sendQueueCalledEmail
} = require("./email");
const session = require("express-session");
const SqliteStore = require("better-sqlite3-session-store")(session);
require("dotenv").config({
    path: require("node:path").join(__dirname, "../.env")
});
const https = require("node:https");
const fs = require("node:fs");

const app = express();
app.use(cors());
app.use(express.json());

// Session configuration
app.use(session({
    store: new SqliteStore({
        client: db,
        expired: {
            clear: true,
            intervalMs: 900000
        }
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        maxAge: 60 * 60 * 1000
    }
}));


/* ================= PROTECT HTML PAGES ================= */

// Public pages that do not require login
const publicHtmlPages = new Set([
    "home.html",
    "about.html",
    "contact.html",
    "login.html",
    "set_password.html",
    "forgot_password.html",
    "reset_password.html"
]);

// Define which roles can access each protected page
const pageRoles = {
    "staff_management.html": ["admin"],

    "staff_dashboard.html": ["staff"],
    "staff_appointments.html": ["staff"],
    "patient_management.html": ["staff"],
    "staff_vaccination.html": ["staff"],
    "staff_queue.html": ["staff"],
    "followup_management.html": ["staff"],
    "staff_profile.html": ["staff"],

    "patient_dashboard.html": ["pregnant_woman", "child"],
    "patient_appointments.html": ["pregnant_woman", "child"],

    // Only child accounts can access vaccination records
    "child_vaccination.html": ["child"],

    // Only pregnant woman accounts can access maternal records
    "mother_maternal.html": ["pregnant_woman"],

    "queue.html": ["pregnant_woman", "child"],
    "notification.html": ["pregnant_woman", "child"],
    "patient_profile.html": ["pregnant_woman", "child"]
};

const APPOINTMENT_CAPACITY = 4;

app.use((req, res, next) => {
    // Only check HTML page requests
    if (path.extname(req.path).toLowerCase() !== ".html") {
        return next();
    }

    const pageName = path.basename(req.path).toLowerCase();

    // Allow public pages without login
    if (publicHtmlPages.has(pageName)) {
        return next();
    }

    // Require login for other HTML pages
    if (!req.session.user) {
        return res.redirect("/login.html");
    }

    // Check the required role for known protected pages
    const allowedRoles = pageRoles[pageName];

    if (
        allowedRoles &&
        !allowedRoles.includes(req.session.user.role)
    ) {
        return res.status(403).send(
            "Access denied. You do not have permission to access this page."
        );
    }

    next();
});

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


// Check whether the logged-in user has the required role
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.status(401).json({
                message: "Please log in first."
            });
        }

        if (!allowedRoles.includes(req.session.user.role)) {
            return res.status(403).json({
                message: "Access denied. You do not have permission to perform this action."
            });
        }

        next();
    };
}

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

// Request a password reset link
app.post("/api/forgot-password", async (req, res) => {
    const genericMessage =
        "If an eligible account matches the information provided, a password reset link will be sent to its registered email address.";

    try {
        const { userId } = req.body;

        if (typeof userId !== "string" || !userId.trim()) {
            return res.json({ message: genericMessage });
        }

        const user = db.prepare(`
            SELECT user_id, email
            FROM User
            WHERE user_id = ?
              AND account_status = 'Active'
              AND password_set = 1
        `).get(userId.trim());

        // Return the same public response if no eligible account is found.
        if (!user) {
            return res.json({ message: genericMessage });
        }

        // Create a reset token and save its hash.
        const resetToken = createPasswordReset(user.user_id);

        const baseUrl = (
            process.env.APP_BASE_URL || "https://localhost:3000"
        ).replace(/\/+$/, "");

        const resetUrl =
            `${baseUrl}/reset_password.html?token=${resetToken}`;

        await sendPasswordResetEmail(user.email, resetUrl);

        return res.json({ message: genericMessage });

    } catch (error) {
        console.error("Error requesting password reset:", error);
        return res.json({ message: genericMessage });
    }
});

// Reset an existing account password
app.post("/api/reset-password", async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body;

        // Validate required fields.
        if (
            typeof token !== "string" ||
            typeof password !== "string" ||
            typeof confirmPassword !== "string"
        ) {
            return res.status(400).json({
                message: "Please complete all required fields."
            });
        }

        // Check the token format.
        if (!/^[a-f0-9]{64}$/i.test(token)) {
            return res.status(400).json({
                message: "This password reset link is invalid or has expired. Please request a new link."
            });
        }

        // Enforce the same password policy as initial setup.
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

        // Hash the submitted token before looking it up.
        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        // Find the reset token and its associated account.
        const resetRecord = db.prepare(`
            SELECT
                Password_Reset_Token.reset_id,
                Password_Reset_Token.user_id,
                Password_Reset_Token.expires_at,
                Password_Reset_Token.used_at,
                Password_Reset_Token.revoked_at,
                User.password_set,
                User.account_status
            FROM Password_Reset_Token
            INNER JOIN User
                ON Password_Reset_Token.user_id = User.user_id
            WHERE Password_Reset_Token.token_hash = ?
        `).get(tokenHash);

        // Reject invalid, expired, used, revoked, or ineligible tokens.
        if (
            !resetRecord ||
            resetRecord.used_at ||
            resetRecord.revoked_at ||
            new Date(resetRecord.expires_at).getTime() <= Date.now() ||
            Number(resetRecord.password_set) !== 1 ||
            resetRecord.account_status !== "Active"
        ) {
            return res.status(400).json({
                message: "This password reset link is invalid or has expired. Please request a new link."
            });
        }

        // Hash the new password using the existing Argon2id helper.
        const passwordHash = await hashPassword(password);

        // Recheck the token and account inside a transaction.
        const completeReset = db.transaction(() => {
            const currentRecord = db.prepare(`
                SELECT
                    Password_Reset_Token.user_id,
                    Password_Reset_Token.expires_at,
                    User.password_set,
                    User.account_status
                FROM Password_Reset_Token
                INNER JOIN User
                    ON Password_Reset_Token.user_id = User.user_id
                WHERE Password_Reset_Token.reset_id = ?
                  AND Password_Reset_Token.token_hash = ?
                  AND Password_Reset_Token.used_at IS NULL
                  AND Password_Reset_Token.revoked_at IS NULL
            `).get(resetRecord.reset_id, tokenHash);

            if (
                !currentRecord ||
                new Date(currentRecord.expires_at).getTime() <= Date.now() ||
                Number(currentRecord.password_set) !== 1 ||
                currentRecord.account_status !== "Active"
            ) {
                return false;
            }

            // Update the password hash, never the plain-text password.
            const updateUser = db.prepare(`
                UPDATE User
                SET password_hash = ?
                WHERE user_id = ?
                  AND password_set = 1
                  AND account_status = 'Active'
            `).run(passwordHash, currentRecord.user_id);

            if (updateUser.changes !== 1) {
                return false;
            }

            // Mark this token as used.
            const useToken = db.prepare(`
                UPDATE Password_Reset_Token
                SET used_at = CURRENT_TIMESTAMP
                WHERE reset_id = ?
                  AND used_at IS NULL
                  AND revoked_at IS NULL
            `).run(resetRecord.reset_id);

            if (useToken.changes !== 1) {
                throw new Error("Could not mark the reset token as used.");
            }

            // Invalidate any other outstanding reset links for this account.
            db.prepare(`
                UPDATE Password_Reset_Token
                SET revoked_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                  AND reset_id != ?
                  AND used_at IS NULL
                  AND revoked_at IS NULL
            `).run(currentRecord.user_id, resetRecord.reset_id);

            return true;
        });

        const success = completeReset();

        if (!success) {
            return res.status(400).json({
                message: "This password reset link is invalid or has expired. Please request a new link."
            });
        }

        return res.json({
            message: "Your password has been reset successfully. You can now log in."
        });

    } catch (error) {
        console.error("Error resetting password:", error);

        return res.status(500).json({
            message: "Unable to reset your password right now. Please try again."
        });
    }
});

app.post("/api/login", (req, res) => {
    const { icNumber, password } = req.body;

    // Check required fields
    if (!icNumber || !password) {
        return res.status(400).json({
            message: "Please enter your IC Number / MyKid Number and password."
        });
    }

    try {
        // Find user by IC Number / MyKid Number
        const user = db.prepare(`
            SELECT user_id, password_hash, role, account_status, password_set
            FROM User
            WHERE user_id = ?
        `).get(icNumber.trim());

        // Reject invalid credentials
        if (!user || user.account_status !== "Active" || user.password_set !== 1) {
            return res.status(401).json({
                message: "Invalid IC Number / MyKid Number or password."
            });
        }

        // Verify password
        verifyPassword(user.password_hash, password)
            .then((isValid) => {
                if (!isValid) {
                    return res.status(401).json({
                        message: "Invalid IC Number / MyKid Number or password."
                    });
                }

                // Regenerate session after successful login
                req.session.regenerate((err) => {
                    if (err) {
                        return res.status(500).json({
                            message: "Unable to log in. Please try again."
                        });
                    }

                    req.session.user = {
                        userId: user.user_id,
                        role: user.role
                    };

                    req.session.save((err) => {
                        if (err) {
                            return res.status(500).json({
                                message: "Unable to log in. Please try again."
                            });
                        }

                        return res.json({
                            message: "Login successful.",
                            role: user.role
                        });
                    });
                });
            })
            .catch((error) => {
                console.error("Login password verification error:", error);
                return res.status(500).json({
                    message: "Unable to log in. Please try again."
                });
            });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            message: "Unable to log in. Please try again."
        });
    }
});

// Get current logged-in user
app.get("/api/me", (req, res) => {
    // Check whether the user is logged in.
    if (!req.session.user) {
        return res.status(401).json({
            message: "Please log in to continue."
        });
    }

    const userId = req.session.user.userId;

    try {
        // Get basic information from User.
        const user = db.prepare(`
            SELECT
                user_id,
                full_name,
                email,
                role,
                account_status,
                created_at
            FROM User
            WHERE user_id = ?
        `).get(userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        // Common information for all roles.
        const userInfo = {
            userId: user.user_id,
            fullName: user.full_name,
            email: user.email,
            role: user.role,
            accountStatus: user.account_status,
            createdAt: user.created_at
        };

        // Get Staff profile.
        if (user.role === "staff") {
            const staff = db.prepare(`
                SELECT staff_id, phone_no
                FROM Staff
                WHERE user_id = ?
            `).get(userId);

            if (!staff) {
                return res.status(404).json({
                    message: "Staff profile not found."
                });
            }

            return res.json({
                ...userInfo,
                staffId: staff.staff_id,
                phoneNo: staff.phone_no
            });
        }

        // Get Pregnant Woman profile.
        if (user.role === "pregnant_woman") {
            const pregnantWoman = db.prepare(`
                SELECT
                    date_of_birth,
                    address,
                    phone_no,
                    contact_name,
                    relationship,
                    contact_phone_no
                FROM Pregnant_Woman
                WHERE user_id = ?
            `).get(userId);

            if (!pregnantWoman) {
                return res.status(404).json({
                    message: "Pregnant woman profile not found."
                });
            }

            return res.json({
                ...userInfo,
                dateOfBirth: pregnantWoman.date_of_birth,
                address: pregnantWoman.address,
                phoneNo: pregnantWoman.phone_no,
                contactName: pregnantWoman.contact_name,
                relationship: pregnantWoman.relationship,
                contactPhoneNo: pregnantWoman.contact_phone_no
            });
        }

        // Get Child profile.
        if (user.role === "child") {
            const child = db.prepare(`
                SELECT
                    date_of_birth,
                    gender,
                    guardian_name,
                    phone_no
                FROM Child
                WHERE user_id = ?
            `).get(userId);

            if (!child) {
                return res.status(404).json({
                    message: "Child profile not found."
                });
            }

            return res.json({
                ...userInfo,
                myKid: user.user_id,
                dateOfBirth: child.date_of_birth,
                gender: child.gender,
                guardianName: child.guardian_name,
                phoneNo: child.phone_no
            });
        }

        // Admin only receives basic user information.
        if (user.role === "admin") {
            return res.json(userInfo);
        }

        return res.status(403).json({
            message: "Unsupported user role."
        });

    } catch (error) {
        console.error("Get current user error:", error);

        return res.status(500).json({
            message: "Unable to retrieve user information."
        });
    }
});

// Log out current user
app.post("/api/logout", (req, res) => {
    if (!req.session) {
        return res.status(200).json({
            message: "Logged out successfully."
        });
    }

    req.session.destroy((err) => {
        if (err) {
            console.error("Logout error:", err);
            return res.status(500).json({
                message: "Unable to log out. Please try again."
            });
        }

        res.clearCookie("connect.sid");

        return res.json({
            message: "Logged out successfully."
        });
    });
});

// Get all staff members
app.get("/api/staff", requireRole("admin"), (req, res) => {
    try {
        const staff = db.prepare(`
            SELECT
                Staff.staff_id,
                User.user_id,
                User.full_name,
                User.email,
                User.account_status,
                User.created_at,
                Staff.phone_no,
                User.password_set
            FROM Staff
            INNER JOIN User
                ON Staff.user_id = User.user_id
            ORDER BY User.account_status, User.full_name
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
app.post("/api/staff", requireRole("admin"), async (req, res) => {
    const { full_name, user_id, email, phone_no } = req.body;

    // Validate required fields
    if (
        typeof full_name !== "string" ||
        typeof user_id !== "string" ||
        typeof email !== "string" ||
        typeof phone_no !== "string"
    ) {
        return res.status(400).json({
            message: "Please provide all required staff details."
        });
    }

    const name = full_name.trim();
    const icNumber = user_id.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const phone = phone_no.trim();

    if (!name || !icNumber || !normalizedEmail || !phone) {
        return res.status(400).json({
            message: "All fields are required."
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({
            message: "Please enter a valid email address."
        });
    }

    // Validate IC number format
    if (!/^[0-9]{6}-[0-9]{2}-[0-9]{4}$/.test(icNumber)) {
        return res.status(400).json({
            message: "Please enter a valid IC number e.g. 920101-07-1234"
        });
    }

    // Validate Malaysian mobile number format
    if (!/^01[0-9]-[0-9]{7,8}$/.test(phone)) {
        return res.status(400).json({
            message: "Please enter a valid phone number e.g. 012-3456789"
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

        // Check whether another account uses this email
        const duplicateEmail = db.prepare(`
            SELECT user_id
            FROM User
            WHERE LOWER(TRIM(email)) = LOWER(?)
        `).get(normalizedEmail);

        if (duplicateEmail) {
            return res.status(409).json({
                message: "This email is already used by another account."
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
                normalizedEmail,
                passwordHash
            );

            const result = db.prepare(`
                INSERT INTO Staff (
                    user_id,
                    phone_no
                )
                VALUES (?, ?)
            `).run(
                icNumber,
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
            process.env.APP_BASE_URL || `https://localhost:${PORT}`
        ).replace(/\/+$/, "");

        const invitationUrl =
            `${baseUrl}/set_password.html?token=${encodeURIComponent(token)}`;
        
        let emailError = false;

        try {
            await sendInvitationEmail(normalizedEmail, invitationUrl);
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
app.post("/api/staff/:staffId/resend-invitation", requireRole("admin"), async (req, res) => {
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
            process.env.APP_BASE_URL || `https://localhost:${PORT}`;

        const invitationUrl =
            `${baseUrl}/set_password.html?token=${encodeURIComponent(token)}`;

        try {
            await sendInvitationEmail(staff.email, invitationUrl);

            return res.status(200).json({
                message: "Invitation email sent successfully."
            });

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
app.patch("/api/staff/:staffId", requireRole("admin"), (req, res) => {
    const staffId = Number(req.params.staffId);

    const {
        user_id,
        full_name,
        email,
        phone_no
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
        typeof phone_no !== "string"
    ) {
        return res.status(400).json({
            message: "Please provide all required staff details."
        });
    }

    const newIC = user_id.trim();
    const name = full_name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const phone = phone_no.trim();

    if (!newIC || !name || !normalizedEmail || !phone) {
        return res.status(400).json({
            message: "All fields are required."
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({
            message: "Please enter a valid email address."
        });
    }

    // Validate IC number format
    if (!/^[0-9]{6}-[0-9]{2}-[0-9]{4}$/.test(newIC)) {
        return res.status(400).json({
            message: "Please enter a valid IC number e.g. 920101-07-1234"
        });
    }

    // Validate Malaysian mobile number format
    if (!/^01[0-9]-[0-9]{7,8}$/.test(phone)) {
        return res.status(400).json({
            message: "Please enter a valid phone number e.g. 012-3456789"
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
                SET phone_no = ?
                WHERE staff_id = ?
            `).run(phone, staffId);
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
app.patch("/api/staff/:staffId/status", requireRole("admin"), (req, res) => {
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

// Get all pregnant women
app.get("/api/pregnant-women", requireRole("staff"), (req, res) => {
    try {
        const pregnantWomen = db.prepare(`
            SELECT
                Pregnant_Woman.pregnant_woman_id,
                User.user_id,
                User.full_name,
                User.email,
                User.account_status,
                User.created_at,
                Pregnant_Woman.date_of_birth,
                Pregnant_Woman.phone_no,
                Pregnant_Woman.address,
                Pregnant_Woman.contact_name,
                Pregnant_Woman.relationship,
                Pregnant_Woman.contact_phone_no,
                User.password_set
            FROM Pregnant_Woman
            INNER JOIN User
                ON Pregnant_Woman.user_id = User.user_id
            ORDER BY User.account_status, User.full_name
        `).all();
            
        res.json(pregnantWomen);

    } catch (error) {
        console.error("Error retrieving pregnant women:", error);

        res.status(500).json({
            message: "Failed to retrieve pregnant women records."
        });
    }
});

// Add a new pregnant woman
app.post("/api/pregnant-woman", requireRole("staff"), async (req, res) => {
    const { full_name, user_id, email, date_of_birth, phone_no, address, contact_name, relationship, contact_phone_no } = req.body;

    // Validate required fields
    if (
        typeof full_name !== "string" ||
        typeof user_id !== "string" ||
        typeof email !== "string" ||
        typeof date_of_birth !== "string" ||
        typeof phone_no !== "string" ||
        typeof address !== "string" ||
        typeof contact_name !== "string" ||
        typeof relationship !== "string" ||
        typeof contact_phone_no !== "string"
    ) {
        return res.status(400).json({
            message: "Please provide all required pregnant woman details."
        });
    }

    const name = full_name.trim();
    const icNumber = user_id.trim();
    const pregnantWomanEmail = email.trim().toLowerCase();
    const dob = date_of_birth.trim();
    const phone = phone_no.trim();
    const pregnantWomanAddress = address.trim();
    const contactName = contact_name.trim();
    const pregnantWomanRelationship = relationship.trim();
    const contactPhoneNo = contact_phone_no.trim();

    if (!name || !icNumber || !pregnantWomanEmail || !dob || !phone || 
        !pregnantWomanAddress || !contactName || !pregnantWomanRelationship || !contactPhoneNo) {
        return res.status(400).json({
            message: "All fields are required."
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pregnantWomanEmail)) {
        return res.status(400).json({
            message: "Please enter a valid email address."
        });
    }

    // Validate date of birth
    const date = new Date(dob);

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== dob
    ) {
        return res.status(400).json({
            message: "Please enter a valid date of birth."
        });
    }

    // Validate IC number format
    if (!/^[0-9]{6}-[0-9]{2}-[0-9]{4}$/.test(icNumber)) {
        return res.status(400).json({
            message: "Please enter a valid IC number e.g. 920101-07-1234"
        });
    }

    // Validate Malaysian mobile number format
    if (!/^01[0-9]-[0-9]{7,8}$/.test(phone)) {
        return res.status(400).json({
            message: "Please enter a valid phone number e.g. 012-3456789"
        });
    }

    // Validate Malaysian mobile number format for emergency contact
    if (!/^01[0-9]-[0-9]{7,8}$/.test(contactPhoneNo)) {
        return res.status(400).json({
            message: "Please enter a valid emergency contact phone number e.g. 012-3456789"
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

        // Check whether another account uses this email
        const duplicateEmail = db.prepare(`
            SELECT user_id
            FROM User
            WHERE LOWER(TRIM(email)) = LOWER(?)
            AND role != 'child'
        `).get(pregnantWomanEmail);

        if (duplicateEmail) {
            return res.status(409).json({
                message: "This email is already used by another account."
            });
        }

        // TEMPORARY: Replace with a real password hash before implementing login
        // The login route must reject accounts where password_set = 0
        const passwordHash = "TEMP_HASH_REPLACE_BEFORE_AUTH";

        // Create the user, pregnant woman profile and invitation together
        // If any database operation fails, the transaction rolls back
        const createPregnantWoman = db.transaction(() => {
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
                VALUES (?, ?, ?, ?, 'pregnant_woman', 'Active', 0)
            `).run(
                icNumber,
                name,
                pregnantWomanEmail,
                passwordHash
            );

            const result = db.prepare(`
                INSERT INTO Pregnant_Woman (
                    user_id,
                    date_of_birth,
                    phone_no,
                    address,
                    contact_name,
                    relationship,
                    contact_phone_no
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                icNumber,
                dob,
                phone,
                pregnantWomanAddress,
                contactName,
                pregnantWomanRelationship,
                contactPhoneNo
            );
 
            // Create an invitation for the newly created pregnant woman account.
            // createInvitation() uses a nested transaction, which
            // better-sqlite3 supports through a savepoint
            const token = createInvitation(icNumber);

            return {
                pregnantWomanId: result.lastInsertRowid,
                token
            };
        });

        const { pregnantWomanId, token } = createPregnantWoman();

        // Construct the invitation URL for local testing
        const baseUrl = (
            process.env.APP_BASE_URL || `https://localhost:${PORT}`
        ).replace(/\/+$/, "");

        const invitationUrl =
            `${baseUrl}/set_password.html?token=${encodeURIComponent(token)}`;
        
        let emailError = false;

        try {
            await sendInvitationEmail(pregnantWomanEmail, invitationUrl);
        } catch (error) {
            emailError = true;
            console.error("Failed to send pregnant woman invitation email:", error);
        }

        const response = {
            message: emailError
                ? "Pregnant woman account created, but the invitation email could not be sent. Please resend it."
                : "Pregnant woman account created and invitation email sent.",
            pregnant_woman_id: pregnantWomanId
        };

        return res.status(201).json(response);

    } catch (error) {
        console.error("Error creating pregnant woman:", error);

        if (
            error.code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
            error.code === "SQLITE_CONSTRAINT_UNIQUE"
        ) {
            return res.status(409).json({
                message: "A pregnant woman account with these details already exists."
            });
        }

        return res.status(500).json({
            message: "Failed to create pregnant woman account."
        });
    }
});

// Resend invitation link for password setup
app.post("/api/pregnant-woman/:pregnantWomanId/resend-invitation", requireRole("staff"), async (req, res) => {
    try {
        const pregnantWoman = db.prepare(`
            SELECT
                Pregnant_Woman.user_id,
                User.email,
                User.password_set,
                User.account_status
            FROM Pregnant_Woman
            INNER JOIN User
                ON Pregnant_Woman.user_id = User.user_id
            WHERE Pregnant_Woman.pregnant_woman_id = ?
        `).get(req.params.pregnantWomanId);

        if (!pregnantWoman) {
            return res.status(404).json({
                message: "Pregnant woman account not found."
            });
        }

        if (Number(pregnantWoman.password_set) === 1) {
            return res.status(409).json({
                message: "This pregnant woman member has already set their password."
            });
        }

        if (pregnantWoman.account_status !== "Active") {
            return res.status(409).json({
                message: "Activate this pregnant woman account before sending an invitation."
            });
        }

        const token = createInvitation(pregnantWoman.user_id);

        const baseUrl =
            process.env.APP_BASE_URL || `https://localhost:${PORT}`;

        const invitationUrl =
            `${baseUrl}/set_password.html?token=${encodeURIComponent(token)}`;

        try {
            await sendInvitationEmail(pregnantWoman.email, invitationUrl);

            return res.status(200).json({
                message: "Invitation email sent successfully."
            });

        } catch (error) {
            console.error("Failed to resend pregnant woman invitation:", error);

            return res.status(500).json({
                message: "The new invitation was created, but the email could not be sent. Please try resending it."
            });
        }

    } catch (error) {
        console.error("Error creating pregnant woman invitation:", error);

        return res.status(500).json({
            message: "Failed to create the pregnant woman invitation."
        });
    }
});

// Update pregnant woman details
app.patch("/api/pregnant-woman/:pregnantWomanId", requireRole("staff"), (req, res) => {
    const pregnantWomanId = Number(req.params.pregnantWomanId);

    const {
        user_id,
        full_name,
        email,
        date_of_birth,
        phone_no,
        address,
        contact_name,
        relationship,
        contact_phone_no
    } = req.body;

    // Validate pregnant woman ID
    if (!Number.isInteger(pregnantWomanId) || pregnantWomanId <= 0) {
        return res.status(400).json({
            message: "Invalid pregnant woman ID."
        });
    }

    // Validate required fields
    if (
        typeof user_id !== "string" ||
        typeof full_name !== "string" ||
        typeof email !== "string" ||
        typeof date_of_birth !== "string" ||
        typeof phone_no !== "string" ||
        typeof address !== "string" ||
        typeof contact_name !== "string" ||
        typeof relationship !== "string" ||
        typeof contact_phone_no !== "string"
    ) {
        return res.status(400).json({
            message: "Please provide all required pregnant woman details."
        });
    }

    const newIC = user_id.trim();
    const name = full_name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const dob = date_of_birth.trim();
    const phone = phone_no.trim();
    const newAddress = address.trim();
    const contactName = contact_name.trim();
    const newRelationship = relationship.trim();
    const contactPhoneNo = contact_phone_no.trim();

    if (!newIC || !name || !normalizedEmail || !dob || !phone || 
        !newAddress || !contactName || !newRelationship || !contactPhoneNo) {
        return res.status(400).json({
            message: "All fields are required."
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({
            message: "Please enter a valid email address."
        });
    }

    // Validate date of birth
    const date = new Date(dob);

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== dob
    ) {
        return res.status(400).json({
            message: "Please enter a valid date of birth."
        });
    }

    // Validate IC number format
    if (!/^[0-9]{6}-[0-9]{2}-[0-9]{4}$/.test(newIC)) {
        return res.status(400).json({
            message: "Please enter a valid IC number e.g. 920101-07-1234"
        });
    }

    // Validate Malaysian mobile number format
    if (!/^01[0-9]-[0-9]{7,8}$/.test(phone)) {
        return res.status(400).json({
            message: "Please enter a valid phone number e.g. 012-3456789"
        });
    }

    // Validate Malaysian mobile number format for emergency contact
    if (!/^01[0-9]-[0-9]{7,8}$/.test(contactPhoneNo)) {
        return res.status(400).json({
            message: "Please enter a valid emergency contact phone number e.g. 012-3456789"
        });
    }

    try {
        // Find the existing pregnant woman account
        const existingPregnantWoman = db.prepare(`
            SELECT Pregnant_Woman.user_id
            FROM Pregnant_Woman
            WHERE Pregnant_Woman.pregnant_woman_id = ?
        `).get(pregnantWomanId);

        if (!existingPregnantWoman) {
            return res.status(404).json({
                message: "Pregnant woman member not found."
            });
        }

        // Check whether the new IC belongs to another account
        const duplicateIC = db.prepare(`
            SELECT user_id
            FROM User
            WHERE user_id = ?
            AND user_id != ?
        `).get(newIC, existingPregnantWoman.user_id);

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
            AND role != 'child'
        `).get(normalizedEmail, existingPregnantWoman.user_id);

        if (duplicateEmail) {
            return res.status(409).json({
                message: "This email is already used by another account."
            });
        }

        // Update everything in one transaction
        const updatePregnantWoman = db.transaction(() => {
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
                existingPregnantWoman.user_id
            );

            db.prepare(`
                UPDATE Pregnant_Woman
                SET date_of_birth = ?,
                    phone_no = ?,
                    address = ?,
                    contact_name = ?,
                    relationship = ?,
                    contact_phone_no = ?
                WHERE pregnant_woman_id = ?
            `).run(
                dob, 
                phone, 
                newAddress, 
                contactName, 
                newRelationship, 
                contactPhoneNo, 
                pregnantWomanId
            );
        });

        updatePregnantWoman();

        return res.status(200).json({
            message: "Pregnant woman details updated successfully."
        });

    } catch (error) {
        console.error("Error updating pregnant woman:", error);

        return res.status(500).json({
            message: "Failed to update pregnant woman details."
        });
    }
});

// Update a pregnant woman's account status (Active or Inactive)
app.patch("/api/pregnant-woman/:pregnantWomanId/status", requireRole("staff"), (req, res) => {
    const pregnantWomanId = Number(req.params.pregnantWomanId);
    const { account_status } = req.body;

    // Validate the pregnant woman ID
    if (!Number.isInteger(pregnantWomanId) || pregnantWomanId <= 0) {
        return res.status(400).json({
            message: "Invalid pregnant woman ID."
        });
    }

    // Only allow these two account statuses
    if (!["Active", "Inactive"].includes(account_status)) {
        return res.status(400).json({
            message: "Status must be Active or Inactive."
        });
    }

    try {
        // Check that the pregnant woman account exists
        const pregnantWoman = db.prepare(`
            SELECT user_id
            FROM Pregnant_Woman
            WHERE pregnant_woman_id = ?
        `).get(pregnantWomanId);

        if (!pregnantWoman) {
            return res.status(404).json({
                message: "Pregnant woman account not found."
            });
        }

        // Update the account status in the User table
        db.prepare(`
            UPDATE User
            SET account_status = ?
            WHERE user_id = ?
        `).run(account_status, pregnantWoman.user_id);

        const action = account_status === "Inactive"
            ? "deactivated"
            : "activated";

        return res.status(200).json({
            message: `Pregnant woman account ${action} successfully.`,
            account_status
        });

    } catch (error) {
        console.error("Error updating pregnant woman status:", error);

        return res.status(500).json({
            message: "Failed to update pregnant woman account status."
        });
    }
});

// Get all children
app.get("/api/children", requireRole("staff"), (req, res) => {
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
                Child.phone_no,
                User.password_set
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

// Add a new child
app.post("/api/child", requireRole("staff"), async (req, res) => {
    const { full_name, user_id, date_of_birth, gender, guardian_name, phone_no, email } = req.body;

    // Validate required fields
    if (
        typeof full_name !== "string" ||
        typeof user_id !== "string" ||
        typeof date_of_birth !== "string" ||
        typeof gender !== "string" ||
        typeof guardian_name !== "string" ||
        typeof phone_no !== "string" ||
        typeof email !== "string"
    ) {
        return res.status(400).json({
            message: "Please provide all required child details."
        });
    }

    const name = full_name.trim();
    const myKidNumber = user_id.trim();
    const dob = date_of_birth.trim();
    const guardianName = guardian_name.trim();
    const guardianPhone = phone_no.trim();
    const guardianEmail = email.trim().toLowerCase();

    if (!name || !myKidNumber || !dob || !guardianName || !guardianPhone || !guardianEmail) {
        return res.status(400).json({
            message: "All fields are required."
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail)) {
        return res.status(400).json({
            message: "Please enter a valid email address."
        });
    }

    // Validate date of birth
    const date = new Date(dob);

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== dob
    ) {
        return res.status(400).json({
            message: "Please enter a valid date of birth."
        });
    }

     if (!["Male", "Female"].includes(gender)) {
        return res.status(400).json({
            message: "Please select a valid gender."
        });
    }

    // Validate MyKid number format
    if (!/^[0-9]{6}-[0-9]{2}-[0-9]{4}$/.test(myKidNumber)) {
        return res.status(400).json({
            message: "Please enter a valid MyKid number e.g. 260101-07-1234"
        });
    }

    // Validate Malaysian mobile number format
    if (!/^01[0-9]-[0-9]{7,8}$/.test(guardianPhone)) {
        return res.status(400).json({
            message: "Please enter a valid phone number e.g. 012-3456789"
        });
    }

    try {
        // Check whether this MyKid number already has an account
        const existingUser = db.prepare(`
            SELECT user_id
            FROM User
            WHERE user_id = ?
        `).get(myKidNumber);

        if (existingUser) {
            return res.status(409).json({
                message: "An account with this MyKid number already exists."
            });
        }

        // Check whether the email is used by a staff or admin account
        const duplicateEmail = db.prepare(`
            SELECT user_id
            FROM User
            WHERE LOWER(TRIM(email)) = LOWER(?)
            AND role IN ('staff', 'admin')
        `).get(guardianEmail);

        if (duplicateEmail) {
            return res.status(409).json({
                message: "This email is already used by another account."
            });
        }

        // TEMPORARY: Replace with a real password hash before implementing login
        // The login route must reject accounts where password_set = 0
        const passwordHash = "TEMP_HASH_REPLACE_BEFORE_AUTH";

        // Create the user, child profile and invitation together
        // If any database operation fails, the transaction rolls back
        const createChild = db.transaction(() => {
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
                VALUES (?, ?, ?, ?, 'child', 'Active', 0)
            `).run(
                myKidNumber,
                name,
                guardianEmail,
                passwordHash
            );

            const result = db.prepare(`
                INSERT INTO Child (
                    user_id,
                    date_of_birth,
                    gender,
                    guardian_name,
                    phone_no
                )
                VALUES (?, ?, ?, ?, ?)
            `).run(
                myKidNumber,
                dob,
                gender,
                guardianName,
                guardianPhone
            );
 
            // Create an invitation for the newly created child account.
            // createInvitation() uses a nested transaction, which
            // better-sqlite3 supports through a savepoint
            const token = createInvitation(myKidNumber);

            return {
                childId: result.lastInsertRowid,
                token
            };
        });

        const { childId, token } = createChild();

        // Construct the invitation URL for local testing
        const baseUrl = (
            process.env.APP_BASE_URL || `https://localhost:${PORT}`
        ).replace(/\/+$/, "");

        const invitationUrl =
            `${baseUrl}/set_password.html?token=${encodeURIComponent(token)}`;
        
        let emailError = false;

        try {
            await sendInvitationEmail(guardianEmail, invitationUrl);
        } catch (error) {
            emailError = true;
            console.error("Failed to send child invitation email:", error);
        }

        const response = {
            message: emailError
                ? "Child account created, but the invitation email could not be sent. Please resend it."
                : "Child account created and invitation email sent.",
            child_id: childId
        };

        return res.status(201).json(response);

    } catch (error) {
        console.error("Error creating child:", error);

        if (
            error.code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
            error.code === "SQLITE_CONSTRAINT_UNIQUE"
        ) {
            return res.status(409).json({
                message: "A child account with these details already exists."
            });
        }

        return res.status(500).json({
            message: "Failed to create child account."
        });
    }
});

// Resend invitation link for password setup
app.post("/api/child/:childId/resend-invitation", requireRole("staff"), async (req, res) => {
    try {
        const child = db.prepare(`
            SELECT
                Child.user_id,
                User.email,
                User.password_set,
                User.account_status
            FROM Child
            INNER JOIN User
                ON Child.user_id = User.user_id
            WHERE Child.child_id = ?
        `).get(req.params.childId);

        if (!child) {
            return res.status(404).json({
                message: "Child account not found."
            });
        }

        if (Number(child.password_set) === 1) {
            return res.status(409).json({
                message: "This child member has already set their password."
            });
        }

        if (child.account_status !== "Active") {
            return res.status(409).json({
                message: "Activate this child account before sending an invitation."
            });
        }

        const token = createInvitation(child.user_id);

        const baseUrl =
            process.env.APP_BASE_URL || `https://localhost:${PORT}`;

        const invitationUrl =
            `${baseUrl}/set_password.html?token=${encodeURIComponent(token)}`;

        try {
            await sendInvitationEmail(child.email, invitationUrl);

            return res.status(200).json({
                message: "Invitation email sent successfully."
            });

        } catch (error) {
            console.error("Failed to resend child invitation:", error);

            return res.status(500).json({
                message: "The new invitation was created, but the email could not be sent. Please try resending it."
            });
        }

    } catch (error) {
        console.error("Error creating child invitation:", error);

        return res.status(500).json({
            message: "Failed to create the child invitation."
        });
    }
});

// Update child details
app.patch("/api/child/:childId", requireRole("staff"), (req, res) => {
    const childId = Number(req.params.childId);

    const {
        user_id,
        full_name,
        date_of_birth,
        gender,
        guardian_name,
        phone_no,
        email
    } = req.body;

    // Validate child ID
    if (!Number.isInteger(childId) || childId <= 0) {
        return res.status(400).json({
            message: "Invalid child ID."
        });
    }

    // Validate required fields
    if (
        typeof user_id !== "string" ||
        typeof full_name !== "string" ||
        typeof date_of_birth !== "string" ||
        typeof gender !== "string" ||
        typeof guardian_name !== "string" ||
        typeof phone_no !== "string" ||
        typeof email !== "string"
    ) {
        return res.status(400).json({
            message: "Please provide all required child details."
        });
    }

    const newMyKid = user_id.trim();
    const name = full_name.trim();
    const dob = date_of_birth.trim();
    const guardianName = guardian_name.trim();
    const phone = phone_no.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!newMyKid || !name || !dob || !guardianName || !phone || !normalizedEmail) {
        return res.status(400).json({
            message: "All fields are required."
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({
            message: "Please enter a valid email address."
        });
    }

    // Validate date of birth
    const date = new Date(dob);

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== dob
    ) {
        return res.status(400).json({
            message: "Please enter a valid date of birth."
        });
    }

    if (!["Male", "Female"].includes(gender)) {
        return res.status(400).json({
            message: "Please select a valid gender."
        });
    }

    // Validate MyKid number format
    if (!/^[0-9]{6}-[0-9]{2}-[0-9]{4}$/.test(newMyKid)) {
        return res.status(400).json({
            message: "Please enter a valid MyKid number e.g. 260101-07-1234"
        });
    }

    // Validate Malaysian mobile number format
    if (!/^01[0-9]-[0-9]{7,8}$/.test(phone)) {
        return res.status(400).json({
            message: "Please enter a valid phone number e.g. 012-3456789"
        });
    }

    try {
        // Find the existing child account
        const existingChild = db.prepare(`
            SELECT Child.user_id
            FROM Child
            WHERE Child.child_id = ?
        `).get(childId);

        if (!existingChild) {
            return res.status(404).json({
                message: "Child member not found."
            });
        }

        // Check whether the new MyKid number belongs to another account
        const duplicateMyKid = db.prepare(`
            SELECT user_id
            FROM User
            WHERE user_id = ?
            AND user_id != ?
        `).get(newMyKid, existingChild.user_id);

        if (duplicateMyKid) {
            return res.status(409).json({
                message: "This MyKid number is already registered."
            });
        }

        // Check whether the email is used by a staff or admin account
        const duplicateEmail = db.prepare(`
            SELECT user_id
            FROM User
            WHERE LOWER(TRIM(email)) = LOWER(?)
            AND user_id != ?
            AND role IN ('staff', 'admin')
        `).get(normalizedEmail, existingChild.user_id);

        if (duplicateEmail) {
            return res.status(409).json({
                message: "This email is already used by a staff or admin account."
            });
        }

        // Update everything in one transaction
        const updateChild = db.transaction(() => {
            db.prepare(`
                UPDATE User
                SET user_id = ?,
                    full_name = ?,
                    email = ?
                WHERE user_id = ?
            `).run(
                newMyKid,
                name,
                normalizedEmail,
                existingChild.user_id
            );

            db.prepare(`
                UPDATE Child
                SET date_of_birth = ?,
                    gender = ?,
                    guardian_name = ?,
                    phone_no = ?
                WHERE child_id = ?
            `).run(
                dob, 
                gender,
                guardianName,
                phone,
                childId
            );
        });

        updateChild();

        return res.status(200).json({
            message: "Child details updated successfully."
        });

    } catch (error) {
        console.error("Error updating child:", error);

        return res.status(500).json({
            message: "Failed to update child details."
        });
    }
});

// Update a child account's status (Active or Inactive)
app.patch("/api/child/:childId/status", requireRole("staff"), (req, res) => {
    const childId = Number(req.params.childId);
    const { account_status } = req.body;

    // Validate the child ID
    if (!Number.isInteger(childId) || childId <= 0) {
        return res.status(400).json({
            message: "Invalid child ID."
        });
    }

    // Only allow these two account statuses
    if (!["Active", "Inactive"].includes(account_status)) {
        return res.status(400).json({
            message: "Status must be Active or Inactive."
        });
    }

    try {
        // Check that the child account exists
        const child = db.prepare(`
            SELECT user_id
            FROM Child
            WHERE child_id = ?
        `).get(childId);

        if (!child) {
            return res.status(404).json({
                message: "Child account not found."
            });
        }

        // Update the account status in the User table
        db.prepare(`
            UPDATE User
            SET account_status = ?
            WHERE user_id = ?
        `).run(account_status, child.user_id);

        const action = account_status === "Inactive"
            ? "deactivated"
            : "activated";

        return res.status(200).json({
            message: `Child account ${action} successfully.`,
            account_status
        });

    } catch (error) {
        console.error("Error updating child status:", error);

        return res.status(500).json({
            message: "Failed to update child account status."
        });
    }
});


/* =========================================================
   VACCINATION MANAGEMENT API
   ========================================================= */

// GET: Load all children and their vaccination records.
app.get("/api/vaccination-management/children", requireRole("staff"), (req, res) => {
    try {
        const children = db.prepare(`
            SELECT
                Child.child_id,
                Child.user_id,
                User.full_name,
                User.email,
                Child.date_of_birth,
                Child.gender,
                Child.guardian_name,
                Child.phone_no
            FROM Child
            INNER JOIN User
                ON User.user_id = Child.user_id
            WHERE User.role = 'child'
            ORDER BY User.full_name
        `).all();

        // appointment_id has been removed from Child_Vaccination.
        const getRecords = db.prepare(`
            SELECT
                cv.child_vaccination_id,
                cv.user_id,
                cv.vaccination_id,
                v.vaccine_name,
                cv.due_date,
                cv.dose,
                cv.status
            FROM Child_Vaccination AS cv
            INNER JOIN Vaccination AS v
                ON v.vaccination_id = cv.vaccination_id
            WHERE cv.user_id = ?
            ORDER BY cv.due_date, cv.child_vaccination_id
        `);
        

        const result = children.map(child => ({
            ...child,
            records: getRecords.all(child.user_id)
        }));

        return res.json(result);

    } catch (error) {
        console.error("Error retrieving vaccination data:", error);

        return res.status(500).json({
            message: "Failed to retrieve children and vaccination records."
        });
    }
});


// GET: Load available vaccines.
app.get("/api/vaccination-management/vaccines", requireRole("staff"), (req, res) => {
    try {
        const vaccines = db.prepare(`
            SELECT
                vaccination_id,
                vaccine_name,
                description,
                dose_quantity,
                booster
            FROM Vaccination
            ORDER BY vaccine_name
        `).all();

        return res.json(vaccines);

    } catch (error) {
        console.error("Error retrieving vaccines:", error);

        return res.status(500).json({
            message: "Failed to retrieve vaccine options."
        });
    }
});

// PATCH: Update a child's details.
app.patch(
    "/api/vaccination-management/children/:userId", requireRole("staff"),
    (req, res) => {
        const oldUserId = String(req.params.userId || "").trim();

        const {
            user_id,
            full_name,
            gender,
            date_of_birth,
            guardian_name,
            phone_no
        } = req.body;

        // Validate required fields.
        if (
            !oldUserId ||
            typeof user_id !== "string" ||
            typeof full_name !== "string" ||
            typeof gender !== "string" ||
            typeof date_of_birth !== "string" ||
            typeof guardian_name !== "string" ||
            typeof phone_no !== "string"
        ) {
            return res.status(400).json({
                message: "Please complete all child details."
            });
        }

        const newUserId = user_id.trim();
        const name = full_name.trim();
        const dob = date_of_birth.trim();
        const guardianName = guardian_name.trim();
        const phoneNo = phone_no.trim();

        if (
            !newUserId ||
            !name ||
            !dob ||
            !guardianName ||
            !phoneNo ||
            !["Male", "Female"].includes(gender)
        ) {
            return res.status(400).json({
                message: "Enter valid child details."
            });
        }

        // Validate date of birth.
        const date = new Date(dob);

        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
            Number.isNaN(date.getTime()) ||
            date.toISOString().slice(0, 10) !== dob
        ) {
            return res.status(400).json({
                message: "Please enter a valid date of birth."
            });
        }

        try {
            const child = db.prepare(`
                SELECT user_id
                FROM Child
                WHERE user_id = ?
            `).get(oldUserId);

            if (!child) {
                return res.status(404).json({
                    message: "Child not found."
                });
            }

            // Prevent using another account's IC/MyKid number.
            const duplicate = db.prepare(`
                SELECT user_id
                FROM User
                WHERE user_id = ?
                  AND user_id != ?
            `).get(newUserId, oldUserId);

            if (duplicate) {
                return res.status(409).json({
                    message: "This MyKid number is already registered."
                });
            }

            // Update User and Child in one transaction.
            const updateChild = db.transaction(() => {
                db.prepare(`
                    UPDATE User
                    SET user_id = ?,
                        full_name = ?
                    WHERE user_id = ?
                `).run(
                    newUserId,
                    name,
                    oldUserId
                );

                db.prepare(`
                    UPDATE Child
                    SET date_of_birth = ?,
                        gender = ?,
                        guardian_name = ?,
                        phone_no = ?
                    WHERE user_id = ?
                `).run(
                    dob,
                    gender,
                    guardianName,
                    phoneNo,
                    newUserId
                );
            });

            updateChild();

            return res.json({
                message: "Child details updated successfully.",
                user_id: newUserId
            });

        } catch (error) {
            console.error("Error updating child details:", error);

            return res.status(500).json({
                message: "Failed to update child details."
            });
        }
    }
);


// PATCH: Update an existing vaccination record.
app.patch(
    "/api/vaccination-management/records/:recordId",
    requireRole("staff"),
    async (req, res) => {
        const recordId = Number(req.params.recordId);

        const {
            vaccination_id,
            dose,
            status
        } = req.body;

        if (
            !Number.isInteger(recordId) ||
            recordId <= 0 ||
            !Number.isInteger(Number(vaccination_id)) ||
            typeof dose !== "string" ||
            !dose.trim() ||
            !["Upcoming", "Completed"].includes(status)
        ) {
            return res.status(400).json({
                message: "Please provide a valid vaccine, dose and status."
            });
        }

        try {
            // Get the existing record to identify the child.
            const existingRecord = db.prepare(`
                SELECT user_id
                FROM Child_Vaccination
                WHERE child_vaccination_id = ?
            `).get(recordId);

            if (!existingRecord) {
                return res.status(404).json({
                    message: "Vaccination record not found."
                });
            }

            const vaccine = db.prepare(`
                SELECT vaccination_id
                FROM Vaccination
                WHERE vaccination_id = ?
            `).get(Number(vaccination_id));

            if (!vaccine) {
                return res.status(400).json({
                    message: "Please select a valid vaccine."
                });
            }

            db.prepare(`
                UPDATE Child_Vaccination
                SET vaccination_id = ?,
                    dose = ?,
                    status = ?
                WHERE child_vaccination_id = ?
            `).run(
                Number(vaccination_id),
                dose.trim(),
                status,
                recordId
            );

            // Trigger notification and email after a successful update.
            // Define this helper using your actual database schema.
            try {
                await notifyVaccinationChange(
                    existingRecord.user_id,
                    "updated",
                    recordId
                );
            } catch (notificationError) {
                console.error(
                    "Vaccination updated, but notification failed:",
                    notificationError
                );
            }

            return res.json({
                message: "Vaccination record updated successfully."
            });

        } catch (error) {
            console.error("Error updating vaccination record:", error);

            return res.status(500).json({
                message: "Failed to update vaccination record."
            });
        }
    }
);

/* =========================================
   POST: ADD VACCINATION RECORD + APPOINTMENT
========================================= */
app.post(
    "/api/vaccination-management/children/:userId/records",
    requireRole("staff"),
    async (req, res) => {
        const userId = String(req.params.userId || "").trim();

        const {
            vaccination_id,
            dose,
            status,
            due_date,
            start_time
        } = req.body;

        const validTime = value =>
            typeof value === "string" &&
            /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

        if (
            !userId ||
            !Number.isInteger(Number(vaccination_id)) ||
            Number(vaccination_id) <= 0 ||
            typeof dose !== "string" ||
            !dose.trim() ||
            !["Upcoming", "Completed"].includes(status) ||
            typeof due_date !== "string"
        ) {
            return res.status(400).json({
                message: "Please provide a valid vaccine, dose, status and due date."
            });
        }

        // Validate the calendar date.
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due_date);

        if (!match) {
            return res.status(400).json({
                message: "Please provide a valid date."
            });
        }

        const [, y, m, d] = match;
        const selectedDate = new Date(
            Date.UTC(Number(y), Number(m) - 1, Number(d))
        );

        if (
            selectedDate.getUTCFullYear() !== Number(y) ||
            selectedDate.getUTCMonth() !== Number(m) - 1 ||
            selectedDate.getUTCDate() !== Number(d)
        ) {
            return res.status(400).json({
                message: "Please provide a valid calendar date."
            });
        }

        // Only Upcoming vaccinations require an appointment time.
        if (status === "Upcoming") {
            if (!validTime(start_time)) {
                return res.status(400).json({
                    message: "Please provide a valid appointment start time."
                });
            }

            const today = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Kuala_Lumpur",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }).format(new Date());

            if (due_date < today) {
                return res.status(400).json({
                    message: "The appointment date cannot be in the past."
                });
            }

            const dayOfWeek = selectedDate.getUTCDay();

            if (dayOfWeek === 0) {
                return res.status(400).json({
                    message: "The clinic is closed on Sundays."
                });
            }

            const allowedSlots = getAllowedTimeSlots(due_date);

            if (allowedSlots === null) {
                return res.status(400).json({
                    message: "Please provide a valid appointment date."
                });
            }

            if (allowedSlots.length === 0) {
                return res.status(400).json({
                    message: "The clinic is closed on Sundays."
                });
            }

            if (!allowedSlots.includes(start_time)) {
            const dayOfWeek = selectedDate.getUTCDay();

            if (dayOfWeek === 6) {
                return res.status(400).json({
                    message: "For Saturday appointments, only 9:00 AM to 12:00 PM is available."
                });
            }

            return res.status(400).json({
                message: "Weekday appointments are available from 8:00 AM to 12:00 PM and 1:00 PM to 5:00 PM."
            });
        }

            if (due_date === today) {
                const currentTime = new Intl.DateTimeFormat("en-GB", {
                    timeZone: "Asia/Kuala_Lumpur",
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23"
                }).format(new Date());

                if (start_time <= currentTime) {
                    return res.status(400).json({
                        message: "The start time must be later than the current time."
                    });
                }
            }
        }

        try {
            const child = db.prepare(`
                SELECT user_id
                FROM Child
                WHERE user_id = ?
            `).get(userId);

            if (!child) {
                return res.status(404).json({
                    message: "Child not found."
                });
            }

            const vaccine = db.prepare(`
                SELECT vaccination_id
                FROM Vaccination
                WHERE vaccination_id = ?
            `).get(Number(vaccination_id));

            if (!vaccine) {
                return res.status(400).json({
                    message: "Please select a valid vaccine."
                });
            }

            const createRecords = db.transaction(() => {
                const vaccinationResult = db.prepare(`
                    INSERT INTO Child_Vaccination (
                        user_id,
                        vaccination_id,
                        due_date,
                        dose,
                        status
                    )
                    VALUES (?, ?, ?, ?, ?)
                `).run(
                    userId,
                    Number(vaccination_id),
                    due_date,
                    dose.trim(),
                    status
                );

                let appointmentId = null;

                if (status === "Upcoming") {
                    /*
                     * This requires Appointment.end_time to allow NULL.
                     * The existing appointments UI and other routes must
                     * also be updated to support appointments without it.
                     */
                    
                const [startHour, startMinute] = start_time.split(":").map(Number);

                const totalMinutes = startHour * 60 + startMinute + 30;

                const endHour = Math.floor(totalMinutes / 60);
                const endMinute = totalMinutes % 60;

                const calculatedEndTime =
                    `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;

                if (totalMinutes >= 24 * 60) {
                    throw new Error("The appointment end time is invalid.");
                }

                const appointmentResult = db.prepare(`
                    INSERT INTO Appointment (
                        user_id,
                        appointment_type,
                        appointment_date,
                        start_time,
                        child_vaccination_id
                    )
                    VALUES (?, ?, ?, ?, ?)
                `).run(
                    userId,
                    "Child Vaccination",
                    due_date,
                    start_time,
                    Number(vaccinationResult.lastInsertRowid)
                );

                appointmentId = Number(appointmentResult.lastInsertRowid);

                    db.prepare(`
                        INSERT INTO Notification (
                            user_id,
                            title,
                            message
                        )
                        VALUES (?, ?, ?)
                    `).run(
                        userId,
                        "New Appointment Scheduled",
                        `Your Child Vaccination appointment is scheduled for ${due_date} at ${start_time}.`
                    );
                }

                return {
                    recordId: Number(vaccinationResult.lastInsertRowid),
                    appointmentId
                };
            });

            const created = createRecords();

            try {
                await notifyVaccinationChange(
                    userId,
                    "added",
                    created.recordId
                );
            } catch (notificationError) {
                console.error(
                    "Vaccination saved, but notification failed:",
                    notificationError
                );
            }

            return res.status(201).json({
                message: created.appointmentId
                    ? "Upcoming vaccination added successfully."
                    : "Completed vaccination record added successfully.",
                record_id: created.recordId,
                appointment_id: created.appointmentId
            });

        } catch (error) {
            console.error("Error adding vaccination record:", error);

            return res.status(500).json({
                message: "Failed to add vaccination record."
            });
        }
    }
);

// DELETE: Delete a vaccination record.
app.delete(
    "/api/vaccination-management/records/:recordId",
    requireRole("staff"),
    (req, res) => {
        const recordId = Number(req.params.recordId);

        if (!Number.isInteger(recordId) || recordId <= 0) {
            return res.status(400).json({
                message: "Invalid vaccination record ID."
            });
        }

        try {
            const deleteVaccination = db.transaction(() => {

                const record = db.prepare(`
                    SELECT child_vaccination_id, user_id, due_date
                    FROM Child_Vaccination
                    WHERE child_vaccination_id = ?
                `).get(recordId);

                if (!record) {
                    return false;
                }

                // Find appointments linked to this vaccination record.
                let appointments = db.prepare(`
                    SELECT appointment_id
                    FROM Appointment
                    WHERE child_vaccination_id = ?
                `).all(recordId);

                // For older records without a direct appointment link,
                // find appointments using the child's ID and due date.
                if (appointments.length === 0) {
                    appointments = db.prepare(`
                        SELECT appointment_id
                        FROM Appointment
                        WHERE user_id = ?
                        AND appointment_date = ?
                        AND appointment_type = 'Child Vaccination'
                    `).all(record.user_id, record.due_date);
                }

                // Delete related appointment data first.
                for (const appointment of appointments) {
                    const appointmentId = appointment.appointment_id;

                    db.prepare(`
                        DELETE FROM Queue_Entry
                        WHERE appointment_id = ?
                    `).run(appointmentId);

                    db.prepare(`
                        DELETE FROM Reschedule_Request
                        WHERE appointment_id = ?
                    `).run(appointmentId);

                    // Notification has no appointment_id column,
                    // so it cannot be deleted using this relationship.

                    db.prepare(`
                        DELETE FROM Appointment
                        WHERE appointment_id = ?
                    `).run(appointmentId);
                }

                // Notification has no child_vaccination_id column,
                // so do not attempt to delete notifications using it.

                // Delete the vaccination record last.
                db.prepare(`
                    DELETE FROM Child_Vaccination
                    WHERE child_vaccination_id = ?
                `).run(recordId);

                return true;
            });

            const deleted = deleteVaccination();

            if (!deleted) {
                return res.status(404).json({
                    message: "Vaccination record not found."
                });
            }

            return res.json({
                message: "Vaccination record deleted successfully."
            });

        } catch (error) {
            console.error(
                "Error deleting vaccination record:",
                error
            );

            return res.status(500).json({
                message: "Failed to delete vaccination record."
            });
        }
    }
);

// Get all appointments for staff
app.get("/api/staff/appointments", requireRole("staff"), (req, res) => {
    try {
        const appointments = db.prepare(`
            SELECT
                a.appointment_id,
                a.user_id,
                u.full_name AS patient_name,
                u.role,
                u.account_status,
                a.appointment_type,
                a.appointment_date,
                a.start_time,
                a.status,
                EXISTS (
                    SELECT 1
                    FROM Reschedule_Request AS rr
                    WHERE rr.appointment_id = a.appointment_id
                    AND rr.status = 'Pending'
                ) AS has_pending_reschedule
            FROM Appointment a
            JOIN User u
                ON a.user_id = u.user_id
            ORDER BY
                a.appointment_date ASC,
                a.start_time ASC
        `).all();

        res.json(appointments);
    } catch (error) {
        console.error("Failed to fetch appointments:", error);

        res.status(500).json({
            message: "Failed to retrieve appointments."
        });
    }
});


// Get appointments for the logged-in patient
app.get("/api/patient/appointments", requireRole("pregnant_woman", "child"), (req, res) => {
    try {
        const userId = req.session.user.userId;

        const appointments = db.prepare(`
            SELECT
                a.appointment_id,
                a.user_id,
                u.full_name AS patient_name,
                u.role,
                a.appointment_type,
                a.appointment_date,
                a.start_time,
                a.status,

                rr.reschedule_request_id,
                rr.reason AS reschedule_reason,
                rr.status AS reschedule_status,
                rr.created_at AS reschedule_created_at

            FROM Appointment AS a
            JOIN User AS u
                ON a.user_id = u.user_id

            LEFT JOIN Reschedule_Request AS rr
                ON rr.reschedule_request_id = (
                    SELECT rr2.reschedule_request_id
                    FROM Reschedule_Request AS rr2
                    WHERE rr2.appointment_id = a.appointment_id
                    ORDER BY rr2.reschedule_request_id DESC
                    LIMIT 1
                )

            WHERE a.user_id = ?

            ORDER BY a.appointment_date ASC, a.start_time ASC
        `).all(userId);

        res.json(appointments);
    } catch (error) {
        console.error("Failed to fetch patient appointments:", error);

        res.status(500).json({
            message: "Failed to retrieve appointments."
        });
    }
});


// Get pending reschedule requests 
app.get("/api/staff/reschedule-requests", requireRole("staff"), (req, res) => {
    try {
        const requests = db.prepare(`
            SELECT
                rr.reschedule_request_id,
                rr.appointment_id,
                rr.reason,
                rr.status AS request_status,
                rr.created_at,

                a.user_id,
                u.full_name AS patient_name,
                u.role AS patient_role,
                u.account_status,

                a.appointment_type,
                a.appointment_date AS original_date,
                a.start_time AS original_start_time,
                a.status AS appointment_status

            FROM Reschedule_Request AS rr

            JOIN Appointment AS a
                ON rr.appointment_id = a.appointment_id

            JOIN User AS u
                ON a.user_id = u.user_id

            WHERE rr.status = 'Pending'

            ORDER BY
                rr.created_at ASC,
                rr.reschedule_request_id ASC
        `).all();

        res.json(requests);
    } catch (error) {
        console.error(
            "Error loading pending reschedule requests:",
            error
        );

        res.status(500).json({
            message: "Failed to load pending reschedule requests."
        });
    }
});


// Search for patients
app.get("/api/staff/patients/search", requireRole("staff"), (req, res) => {
    try {
        const searchTerm = req.query.q?.trim();

        if (!searchTerm || searchTerm.length < 2) {
            return res.status(400).json({
                message: "Enter at least 2 characters to search."
            });
        }

        const patients = db.prepare(`
            SELECT
                user_id,
                full_name,
                role
            FROM User
            WHERE role IN ('pregnant_woman', 'child')
              AND account_status = 'Active'
              AND (
                  user_id LIKE ?
                  OR full_name LIKE ?
              )
            ORDER BY full_name ASC
            LIMIT 20
        `).all(`%${searchTerm}%`, `%${searchTerm}%`);

        res.json(patients);
    } catch (error) {
        console.error("Failed to search patients:", error);

        res.status(500).json({
            message: "Failed to search patients."
        });
    }
});


/* =====================================================
   MATERNAL RECORDS API
===================================================== */

/* =====================================================
   PREGNANT WOMAN: VIEW OWN MATERNAL VISIT HISTORY
===================================================== */
app.get(
    "/api/maternal-records/my-visits",
    requireRole("pregnant_woman"),
    (req, res) => {
        try {
            const userId = req.session.user.userId;

            // Find the Pregnant Woman profile linked to this account.
            const pregnantWoman = db.prepare(`
                SELECT pregnant_woman_id
                FROM Pregnant_Woman
                WHERE user_id = ?
            `).get(userId);

            if (!pregnantWoman) {
                return res.status(404).json({
                    message: "Pregnant woman profile not found."
                });
            }

            // Return only this Pregnant woman's visit records.
            const visits = db.prepare(`
                SELECT *
                FROM Maternal_Record
                WHERE pregnant_woman_id = ?
                ORDER BY visit_number
            `).all(pregnantWoman.pregnant_woman_id);

            return res.json({ visits });

        } catch (error) {
            console.error(
                "Pregnant woman maternal visit history error:",
                error
            );

            return res.status(500).json({
                message: "Unable to load your maternal visit records."
            });
        }
    }
);

// Search registered pregnant women by name or user ID / IC number.
app.get(
    "/api/maternal-records/pregnant-women",
    requireRole("staff"),
    (req, res) => {
        const search = String(req.query.search || "").trim();

        if (!search) {
            return res.status(400).json({
                message: "Please enter a pregnant woman's name or IC number."
            });
        }

        try {
            const pregnantWomen = db.prepare(`
                SELECT
                    Pregnant_Woman.pregnant_woman_id,
                    User.user_id,
                    User.full_name,
                    User.email
                FROM Pregnant_Woman
                INNER JOIN User
                    ON User.user_id = Pregnant_Woman.user_id
                WHERE User.role = 'pregnant_woman'
                  AND (
                      User.full_name LIKE ?
                      OR User.user_id LIKE ?
                  )
                ORDER BY User.full_name
                LIMIT 50
            `).all(`%${search}%`, `%${search}%`);

            return res.json({ pregnantWomen });
        } catch (error) {
            console.error("Pregnant woman search error:", error);

            return res.status(500).json({
                message: "Unable to search for pregnant women."
            });
        }
    }
);

// Get a pregnant woman's maternal visit history.
app.get(
    "/api/maternal-records/pregnant-women/:pregnantWomanId/visits",
    requireRole("staff"),
    (req, res) => {
        const pregnantWomanId = Number(req.params.pregnantWomanId);

        if (!Number.isInteger(pregnantWomanId) || pregnantWomanId <= 0) {
            return res.status(400).json({
                message: "Invalid pregnant woman ID."
            });
        }

        try {
            const pregnantWoman = db.prepare(`
                SELECT pregnant_woman_id
                FROM Pregnant_Woman
                WHERE pregnant_woman_id = ?
            `).get(pregnantWomanId);

            if (!pregnantWoman) {
                return res.status(404).json({
                    message: "Pregnant woman not found."
                });
            }

            const visits = db.prepare(`
                SELECT *
                FROM Maternal_Record
                WHERE pregnant_woman_id = ?
                ORDER BY visit_number
            `).all(pregnantWomanId);

            return res.json({ visits });
        } catch (error) {
            console.error("Maternal visit retrieval error:", error);

            return res.status(500).json({
                message: "Unable to load maternal visit records."
            });
        }
    }
);

// Add a maternal visit.
app.post(
    "/api/maternal-records/visits",
    requireRole("staff"),
    (req, res) => {
        const {
            pregnant_woman_id,
            visit_number,
            visit_date,
            height,
            weight,
            systolic,
            diastolic,
            urine_test,
            blood_test,
            doctor_remarks
        } = req.body;

        const pregnantWomanId = Number(pregnant_woman_id);
        const visitNumber = Number(visit_number);

        // Validate required fields.
        if (
            !Number.isInteger(pregnantWomanId) ||
            pregnantWomanId <= 0 ||
            !Number.isInteger(visitNumber) ||
            visitNumber <= 0 ||
            typeof visit_date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(visit_date)
        ) {
            return res.status(400).json({
                message: "Please provide a valid pregnant woman, visit number and date."
            });
        }

        // Validate that the date is not in the future.
        if (visit_date > new Date().toLocaleDateString("en-CA", {
            timeZone: "Asia/Kuala_Lumpur"
        })) {
            return res.status(400).json({
                message: "Visit date cannot be in the future."
            });
        }

        // Validate height.
        if (
            height != null &&
            (typeof height !== "number" ||
                !Number.isFinite(height) ||
                height <= 0 ||
                height > 300)
        ) {
            return res.status(400).json({
                message: "Please enter a valid height."
            });
        }

        // Validate weight.
        if (
            weight != null &&
            (typeof weight !== "number" ||
                !Number.isFinite(weight) ||
                weight <= 0 ||
                weight > 500)
        ) {
            return res.status(400).json({
                message: "Please enter a valid weight."
            });
        }

        // Blood pressure must have both values or neither.
        if (
            (systolic == null) !== (diastolic == null)
        ) {
            return res.status(400).json({
                message: "Please enter both systolic and diastolic values."
            });
        }

        // Validate systolic.
        if (
            systolic != null &&
            (!Number.isInteger(systolic) ||
                systolic < 1 ||
                systolic > 300)
        ) {
            return res.status(400).json({
                message: "Please enter a valid systolic value."
            });
        }

        // Validate diastolic.
        if (
            diastolic != null &&
            (!Number.isInteger(diastolic) ||
                diastolic < 1 ||
                diastolic > 200)
        ) {
            return res.status(400).json({
                message: "Please enter a valid diastolic value."
            });
        }

        if (
            systolic != null &&
            diastolic != null &&
            systolic <= diastolic
        ) {
            return res.status(400).json({
                message: "Systolic must be higher than diastolic."
            });
        }

        // Validate test results.
        if (
            (urine_test != null && typeof urine_test !== "string") ||
            (blood_test != null && typeof blood_test !== "string") ||
            (doctor_remarks != null && typeof doctor_remarks !== "string")
        ) {
            return res.status(400).json({
                message: "Invalid maternal test results or doctor's remarks."
            });
        }

        if (
            (urine_test?.length ?? 0) > 1000 ||
            (blood_test?.length ?? 0) > 1000 ||
            (doctor_remarks?.length ?? 0) > 3000
        ) {
            return res.status(400).json({
                message: "One or more text fields exceed the allowed length."
            });
        }

        try {
            const pregnantWoman = db.prepare(`
                SELECT pregnant_woman_id
                FROM Pregnant_Woman
                WHERE pregnant_woman_id = ?
            `).get(pregnantWomanId);

            if (!pregnantWoman) {
                return res.status(404).json({
                    message: "Pregnant woman not found."
                });
            }

            const result = db.prepare(`
                INSERT INTO Maternal_Record (
                    pregnant_woman_id,
                    visit_number,
                    visit_date,
                    height,
                    weight,
                    systolic,
                    diastolic,
                    urine_test,
                    blood_test,
                    doctor_remarks
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                pregnantWomanId,
                visitNumber,
                visit_date,
                height ?? null,
                weight ?? null,
                systolic ?? null,
                diastolic ?? null,
                String(urine_test ?? "").trim(),
                String(blood_test ?? "").trim(),
                String(doctor_remarks ?? "").trim()
            );

            return res.status(201).json({
                message: "Maternal visit added successfully.",
                maternal_record_id: Number(result.lastInsertRowid)
            });

        } catch (error) {
            if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
                return res.status(409).json({
                    message: "This visit number already exists."
                });
            }

            console.error("Maternal visit creation error:", error);

            return res.status(500).json({
                message: "Unable to save the maternal visit."
            });
        }
    }
);

// Update an existing maternal visit.
app.put(
    "/api/maternal-records/visits/:recordId",
    requireRole("staff"),
    (req, res) => {
        const recordId = Number(req.params.recordId);

        const {
            pregnant_woman_id,
            visit_number,
            visit_date,
            height,
            weight,
            systolic,
            diastolic,
            urine_test,
            blood_test,
            doctor_remarks
        } = req.body;

        const pregnantWomanId = Number(pregnant_woman_id);
        const visitNumber = Number(visit_number);

        if (
            !Number.isInteger(recordId) ||
            recordId <= 0 ||
            !Number.isInteger(pregnantWomanId) ||
            pregnantWomanId <= 0 ||
            !Number.isInteger(visitNumber) ||
            visitNumber <= 0 ||
            typeof visit_date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(visit_date)
        ) {
            return res.status(400).json({
                message: "Please provide valid maternal visit details."
            });
        }

        if (visit_date > new Date().toLocaleDateString("en-CA", {
            timeZone: "Asia/Kuala_Lumpur"
        })) {
            return res.status(400).json({
                message: "Visit date cannot be in the future."
            });
        }

        if (
            height != null &&
            (typeof height !== "number" ||
                !Number.isFinite(height) ||
                height <= 0 ||
                height > 300)
        ) {
            return res.status(400).json({
                message: "Please enter a valid height."
            });
        }

        if (
            weight != null &&
            (typeof weight !== "number" ||
                !Number.isFinite(weight) ||
                weight <= 0 ||
                weight > 500)
        ) {
            return res.status(400).json({
                message: "Please enter a valid weight."
            });
        }

        if (
            (systolic == null) !== (diastolic == null)
        ) {
            return res.status(400).json({
                message: "Please enter both systolic and diastolic values."
            });
        }

        if (
            systolic != null &&
            (!Number.isInteger(systolic) ||
                systolic < 1 ||
                systolic > 300)
        ) {
            return res.status(400).json({
                message: "Please enter a valid systolic value."
            });
        }

        if (
            diastolic != null &&
            (!Number.isInteger(diastolic) ||
                diastolic < 1 ||
                diastolic > 200)
        ) {
            return res.status(400).json({
                message: "Please enter a valid diastolic value."
            });
        }

        if (
            systolic != null &&
            diastolic != null &&
            systolic <= diastolic
        ) {
            return res.status(400).json({
                message: "Systolic must be higher than diastolic."
            });
        }

        if (
            (urine_test != null && typeof urine_test !== "string") ||
            (blood_test != null && typeof blood_test !== "string") ||
            (doctor_remarks != null && typeof doctor_remarks !== "string")
        ) {
            return res.status(400).json({
                message: "Invalid maternal test results or doctor's remarks."
            });
        }

        if (
            (urine_test?.length ?? 0) > 1000 ||
            (blood_test?.length ?? 0) > 1000 ||
            (doctor_remarks?.length ?? 0) > 3000
        ) {
            return res.status(400).json({
                message: "One or more text fields exceed the allowed length."
            });
        }

        try {
            const existing = db.prepare(`
                SELECT maternal_record_id
                FROM Maternal_Record
                WHERE maternal_record_id = ?
                  AND pregnant_woman_id = ?
            `).get(recordId, pregnantWomanId);

            if (!existing) {
                return res.status(404).json({
                    message: "Maternal visit not found for this pregnant woman."
                });
            }

            const result = db.prepare(`
                UPDATE Maternal_Record
                SET visit_number = ?,
                    visit_date = ?,
                    height = ?,
                    weight = ?,
                    systolic = ?,
                    diastolic = ?,
                    urine_test = ?,
                    blood_test = ?,
                    doctor_remarks = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE maternal_record_id = ?
                  AND pregnant_woman_id = ?
            `).run(
                visitNumber,
                visit_date,
                height ?? null,
                weight ?? null,
                systolic ?? null,
                diastolic ?? null,
                String(urine_test ?? "").trim(),
                String(blood_test ?? "").trim(),
                String(doctor_remarks ?? "").trim(),
                recordId,
                pregnantWomanId
            );

            return res.json({
                message: "Maternal visit updated successfully."
            });

        } catch (error) {
            if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
                return res.status(409).json({
                    message: "This visit number already exists."
                });
            }

            console.error("Maternal visit update error:", error);

            return res.status(500).json({
                message: "Unable to update the maternal visit."
            });
        }
    }
);

function getAllowedTimeSlots(appointmentDate) {
    const [year, month, day] = appointmentDate.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    // Reject invalid calendar dates
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }

    const dayOfWeek = date.getUTCDay();

    if (dayOfWeek === 0) {
        return [];
    }

    if (dayOfWeek === 6) {
        return ["09:00", "10:00", "11:00", "12:00"];
    }

    return [
        "08:00", "09:00", "10:00", "11:00",
        "13:00", "14:00", "15:00", "16:00"
    ];
}

function getMalaysiaDateTime() {
    const now = new Date();

    return {
        date: new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kuala_Lumpur",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(now),

        time: new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Kuala_Lumpur",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23"
        }).format(now)
    };
}

// Retreive available time slots for appointments for staff
app.get("/api/staff/available-slots", requireRole("staff"), (req, res) => {
    try {
        const {
            user_id,
            date,
            appointment_id,
            child_vaccination_id
        } = req.query;

        if (!user_id || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                message: "Please provide a valid patient and appointment date."
            });
        }

        const patient = db.prepare(`
            SELECT user_id, role
            FROM User
            WHERE user_id = ?
                AND role IN ('pregnant_woman', 'child')
                AND account_status = 'Active'
        `).get(user_id);

        if (!patient) {
            return res.status(400).json({
                message: "The selected patient does not exist or is inactive."
            });
        }

        const allowedSlots = getAllowedTimeSlots(date);

        if (allowedSlots === null) {
            return res.status(400).json({
                message: "Please provide a valid appointment date."
            });
        }

        const { date: today, time: currentTime } =
            getMalaysiaDateTime();

        if (date < today) {
            return res.json({ slots: [] });
        }

        const appointmentType =
            patient.role === "child"
                ? "Child Vaccination"
                : "Maternal Follow-up";

        const getAppointmentCount = db.prepare(`
            SELECT COUNT(*) AS total
            FROM Appointment
            WHERE appointment_date = ?
                AND start_time = ?
                AND appointment_type = ?
                AND (
                    ? IS NULL
                    OR appointment_id != ?
                )
        `);

        const availableSlots = allowedSlots.filter(slot => {
            if (date === today && slot <= currentTime) {
                return false;
            }

        const result = getAppointmentCount.get(
            date,
            slot,
            appointmentType,
            appointment_id || null,
            appointment_id || null
        );

            return result.total < APPOINTMENT_CAPACITY;
        });

        return res.json({ slots: availableSlots });
    } catch (error) {
        console.error("Failed to retrieve available slots:", error);

        return res.status(500).json({
            message: "Failed to retrieve available time slots."
        });
    }
});


// Get available reschedule slots for a patient's appointment
app.get("/api/patient/appointments/:appointmentId/available-reschedule-slots",
    requireRole("pregnant_woman", "child"), (req, res) => {
        try {
            const appointmentId = Number(req.params.appointmentId);
            const userId = req.session.user.userId;
            const date = req.query.date;

            if (
                !Number.isSafeInteger(appointmentId) ||
                appointmentId <= 0
            ) {
                return res.status(400).json({
                    message: "Invalid appointment ID."
                });
            }

            if (
                typeof date !== "string" ||
                !/^\d{4}-\d{2}-\d{2}$/.test(date)
            ) {
                return res.status(400).json({
                    message: "Please select a valid appointment date."
                });
            }

            const appointment = db.prepare(`
                SELECT appointment_id, appointment_type, status
                FROM Appointment
                WHERE appointment_id = ?
                  AND user_id = ?
            `).get(appointmentId, userId);

            if (!appointment) {
                return res.status(404).json({
                    message: "Appointment not found."
                });
            }

            if (appointment.status !== "Confirmed") {
                return res.status(409).json({
                    message: "Only confirmed appointments can be rescheduled."
                });
            }

            // Only one pending request is allowed per appointment.
            const pendingRequest = db.prepare(`
                SELECT reschedule_request_id
                FROM Reschedule_Request
                WHERE appointment_id = ?
                  AND status = 'Pending'
            `).get(appointmentId);

            if (pendingRequest) {
                return res.status(409).json({
                    message: "You already have a pending reschedule request for this appointment."
                });
            }

            const allowedSlots = getAllowedTimeSlots(date);

            if (allowedSlots === null) {
                return res.status(400).json({
                    message: "Please select a valid calendar date."
                });
            }

            if (allowedSlots.length === 0) {
                return res.json({ slots: [] });
            }

            const { date: today, time: currentTime } =
                getMalaysiaDateTime();

            if (date < today) {
                return res.json({ slots: [] });
            }

            const getAppointmentCount = db.prepare(`
                SELECT COUNT(*) AS total
                FROM Appointment
                WHERE appointment_date = ?
                  AND start_time = ?
                  AND appointment_type = ?
                  AND appointment_id != ?
            `);

            const slots = allowedSlots.filter(slot => {
                if (date === today && slot <= currentTime) {
                    return false;
                }

                const result = getAppointmentCount.get(
                    date,
                    slot,
                    appointment.appointment_type,
                    appointmentId
                );

                return result.total < APPOINTMENT_CAPACITY;
            });

            return res.json({ slots });

        } catch (error) {
            console.error(
                "Failed to retrieve reschedule slots:",
                error
            );

            return res.status(500).json({
                message: "Unable to load available appointment slots."
            });
        }
    }
);

// Add new patient appointments
app.post("/api/staff/appointments", requireRole("staff"), async (req, res) => {
    try {
        const {
            user_id,
            appointment_date,
            start_time,
            child_vaccination_id
        } = req.body;

        if (!user_id || !appointment_date || !start_time) {
            return res.status(400).json({
                message: "Please provide the patient, date and time slot."
            });
        }

        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(appointment_date) ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(start_time)
        ) {
            return res.status(400).json({
                message: "Invalid appointment date or time format."
            });
        }

        const patient = db.prepare(`
            SELECT user_id, role, full_name, email
            FROM User
            WHERE user_id = ?
                AND role IN ('pregnant_woman', 'child')
                AND account_status = 'Active'
        `).get(user_id);

        if (!patient) {
            return res.status(400).json({
                message: "The selected patient does not exist or is inactive."
            });
        }

        const allowedSlots = getAllowedTimeSlots(appointment_date);

        if (allowedSlots === null) {
            return res.status(400).json({
                message: "Please provide a valid appointment date."
            });
        }

        if (allowedSlots.length === 0) {
            return res.status(400).json({
                message: "The clinic is closed on Sundays."
            });
        }

        if (!allowedSlots.includes(start_time)) {
            return res.status(400).json({
                message: "Please select a valid clinic appointment time slot."
            });
        }

        const { date: today, time: currentTime } =
            getMalaysiaDateTime();

        if (appointment_date < today) {
            return res.status(400).json({
                message: "The appointment date cannot be in the past."
            });
        }

        if (
            appointment_date === today &&
            start_time <= currentTime
        ) {
            return res.status(400).json({
                message: "Please select a time slot that has not started yet."
            });
        }

        const appointmentType =
            patient.role === "child"
                ? "Child Vaccination"
                : "Maternal Follow-up";

        let vaccinationRecordId = null;

        if (patient.role === "child" && child_vaccination_id) {
            const vaccinationRecord = db.prepare(`
                SELECT child_vaccination_id
                FROM Child_Vaccination
                WHERE child_vaccination_id = ?
                AND user_id = ?
            `).get(child_vaccination_id, user_id);

            if (!vaccinationRecord) {
                return res.status(400).json({
                    message: "The selected vaccination record was not found."
                });
            }

            vaccinationRecordId = vaccinationRecord.child_vaccination_id;
        }

        const createAppointmentTransaction = db.transaction(() => {
            // Recheck appointment capacity before inserting.
            const existingAppointments = db.prepare(`
                SELECT COUNT(*) AS total
                FROM Appointment
                WHERE appointment_date = ?
                AND start_time = ?
                AND appointment_type = ?
            `).get(
                appointment_date,
                start_time,
                appointmentType
            );

            if (existingAppointments.total >= APPOINTMENT_CAPACITY) {
                const error = new Error(
                    "This time slot is full. Please select another available slot."
                );
                error.statusCode = 409;
                throw error;
            }

            // Create the appointment.
            const result = db.prepare(`
                INSERT INTO Appointment (
                    user_id,
                    appointment_type,
                    appointment_date,
                    start_time,
                    child_vaccination_id
                )
                VALUES (?, ?, ?, ?, ?)
            `).run(
                user_id,
                appointmentType,
                appointment_date,
                start_time,
                vaccinationRecordId
            );
            
            const appointmentId = Number(result.lastInsertRowid);

            // Automatically create a maternal record for maternal appointments only.
            // Child vaccination appointments are not affected.
            if (appointmentType === "Maternal Follow-up") {
                const pregnantWoman = db.prepare(`
                    SELECT pregnant_woman_id
                    FROM Pregnant_Woman
                    WHERE user_id = ?
                `).get(user_id);

                if (!pregnantWoman) {
                    throw new Error(
                        "Pregnant woman profile not found. The appointment was not saved."
                    );
                }

                // Assign the next visit number for this pregnant woman.
                const nextVisit = db.prepare(`
                    SELECT COALESCE(MAX(visit_number), 0) + 1 AS next_visit_number
                    FROM Maternal_Record
                    WHERE pregnant_woman_id = ?
                `).get(pregnantWoman.pregnant_woman_id);

                // Create the record using the appointment date.
                // Height, weight and remarks remain blank until staff updates them.
                db.prepare(`
                    INSERT INTO Maternal_Record (
                        pregnant_woman_id,
                        appointment_id,
                        visit_number,
                        visit_date,
                        height,
                        weight,
                        doctor_remarks
                    )
                    VALUES (?, ?, ?, ?, NULL, NULL, '')
                `).run(
                    pregnantWoman.pregnant_woman_id,
                    appointmentId,
                    nextVisit.next_visit_number,
                    appointment_date
                );
            }

            // Notify the patient.
            db.prepare(`
                INSERT INTO Notification (
                    user_id,
                    title,
                    message
                )
                VALUES (?, ?, ?)
            `).run(
                user_id,
                "New Appointment Scheduled",
                `A new ${appointmentType} appointment has been scheduled for ${appointment_date} at ${start_time}.`
            );

            return appointmentId;
        });

        const appointmentId = createAppointmentTransaction();

        try {
            await sendAppointmentScheduledEmail(
                patient.email,
                patient.full_name,
                appointmentType,
                appointment_date,
                start_time
            );
        } catch (emailError) {
            console.error(
                "Appointment saved, but confirmation email failed:",
                emailError
            );
        }

        return res.status(201).json({
            message: "Appointment scheduled successfully.",
            appointment_id: appointmentId
        });

    } catch (error) {
        if (error.statusCode === 409) {
            return res.status(409).json({
                message: error.message
            });
        }

        console.error("Failed to create appointment:", error);

        return res.status(500).json({
            message: "Failed to schedule the appointment. Please try again."
        });
    }
});


// Edit an existing appointment 
app.patch("/api/staff/appointments/:appointmentId", requireRole("staff"), async (req, res) => {
    try {
        const appointmentId = Number(req.params.appointmentId);
        const { appointment_date, start_time } = req.body;

        // Validate appointment ID
        if (!Number.isSafeInteger(appointmentId) || appointmentId <= 0) {
            return res.status(400).json({
                message: "Invalid appointment ID."
            });
        }

        // Validate required fields
        if (!appointment_date || !start_time) {
            return res.status(400).json({
                message: "Please provide the appointment date and time slot."
            });
        }

        // Validate formats
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(appointment_date) ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(start_time)
        ) {
            return res.status(400).json({
                message: "Invalid appointment date or time format."
            });
        }

        // Find the existing appointment
        const appointment = db.prepare(`
            SELECT
                a.appointment_id,
                a.user_id,
                a.appointment_type,
                a.appointment_date,
                a.start_time,
                a.status,
                u.full_name AS patient_name,
                u.email AS patient_email
            FROM Appointment AS a
            JOIN User AS u ON u.user_id = a.user_id
            WHERE a.appointment_id = ?
        `).get(appointmentId);

        if (!appointment) {
            return res.status(404).json({
                message: "Appointment not found."
            });
        }

        // Only confirmed appointments can be edited
        if (appointment.status !== "Confirmed") {
            return res.status(400).json({
                message: "Only confirmed appointments can be edited."
            });
        }

        // Preserve the existing rule: the appointment being edited
        // must already be scheduled for a future date.
        const { date: today } = getMalaysiaDateTime();

        if (appointment_date <= today) {
            return res.status(400).json({
                message: "The appointment date must be a future date."
            });
        }

        // Validate the date and its permitted time slots
        const allowedSlots = getAllowedTimeSlots(appointment_date);

        if (allowedSlots === null) {
            return res.status(400).json({
                message: "Please select a valid appointment date."
            });
        }

        if (allowedSlots.length === 0) {
            return res.status(400).json({
                message: "The clinic is closed on Sundays."
            });
        }

        if (!allowedSlots.includes(start_time)) {
            const dayOfWeek = selectedDate.getUTCDay();

            if (dayOfWeek === 6) {
                return res.status(400).json({
                    message: "For Saturday appointments, only 9:00 AM to 12:00 PM is available."
                });
            }

            return res.status(400).json({
                message: "Weekday appointments are available from 8:00 AM to 12:00 PM and 1:00 PM to 5:00 PM."
            });
        }

        // Check whether any appointment details actually changed
        const detailsChanged =
            appointment.appointment_date !== appointment_date ||
            appointment.start_time !== start_time;

        if (!detailsChanged) {
            return res.status(200).json({
                message: "No changes were made to the appointment.",
                changed: false
            });
        }

        // Check capacity and update the appointment atomically
        const updateAppointmentTransaction = db.transaction(() => {

            // Confirm that this appointment has a pending reschedule request
            const pendingRequest = db.prepare(`
                SELECT reschedule_request_id
                FROM Reschedule_Request
                WHERE appointment_id = ?
                    AND status = 'Pending'
            `).get(appointmentId);

            if (!pendingRequest) {
                const error = new Error(
                    "This appointment does not have a pending reschedule request."
                );
                error.statusCode = 409;
                throw error;
            }

            // Check appointment slot capacity
            const existingAppointments = db.prepare(`
                SELECT COUNT(*) AS total
                FROM Appointment
                WHERE appointment_date = ?
                    AND start_time = ?
                    AND appointment_type = ?
                    AND appointment_id != ?
            `).get(
                appointment_date,
                start_time,
                appointment.appointment_type,
                appointmentId
            );

            if (existingAppointments.total >= 4) {
                const error = new Error(
                    "This time slot is full. Please select another available slot."
                );
                error.statusCode = 409;
                throw error;
            }

            // Update the appointment
            const result = db.prepare(`
                UPDATE Appointment
                SET appointment_date = ?,
                    start_time = ?
                WHERE appointment_id = ?
                    AND status = 'Confirmed'
            `).run(
                appointment_date,
                start_time,
                appointmentId
            );

            if (result.changes !== 1) {
                const error = new Error(
                    "The appointment could not be updated. It may have changed or is no longer available for editing."
                );
                error.statusCode = 409;
                throw error;
            }

            // Mark the pending reschedule request as Approved
            const requestUpdate = db.prepare(`
                UPDATE Reschedule_Request
                SET status = 'Approved'
                WHERE appointment_id = ?
                    AND status = 'Pending'
            `).run(appointmentId);

            if (requestUpdate.changes !== 1) {
                const error = new Error(
                    "The reschedule request could not be updated."
                );
                error.statusCode = 409;
                throw error;
            }

            // Create notification
            db.prepare(`
                INSERT INTO Notification (user_id, title, message)
                VALUES (?, ?, ?)
            `).run(
                appointment.user_id,
                "Appointment Details Updated",
                `Your ${appointment.appointment_type} appointment has been updated. Your appointment is now scheduled for ${appointment_date} at ${start_time}.`
            );
        });

        try {
            updateAppointmentTransaction();
        } catch (error) {
            if (error.statusCode === 409) {
                return res.status(409).json({
                    message: error.message
                });
            }

            throw error;
        }

        // Send the email after the transaction succeeds
        try {
            await sendAppointmentUpdatedEmail(
                appointment.patient_email,
                appointment.patient_name,
                appointment.appointment_type,
                appointment_date,
                start_time
            );
        } catch (emailError) {
            console.error(
                "Appointment updated, but update email failed:",
                emailError
            );
        }

        return res.status(200).json({
            message: "Appointment updated successfully.",
            changed: true
        });

    } catch (error) {
        console.error("Error updating appointment:", error);

        return res.status(500).json({
            message: "An unexpected error occurred while updating the appointment."
        });
    }
});


// Submit a reschedule request
app.post(
    "/api/patient/appointments/:appointmentId/reschedule-requests",
    requireRole("pregnant_woman", "child"),
    (req, res) => {
        try {
            const appointmentId = Number(req.params.appointmentId);
            const userId = req.session.user.userId;
            const { reason } = req.body;

            if (!Number.isSafeInteger(appointmentId) || appointmentId <= 0) {
                return res.status(400).json({
                    message: "Invalid appointment ID."
                });
            }

            if (
                typeof reason !== "string" ||
                !reason.trim() ||
                reason.trim().length > 500
            ) {
                return res.status(400).json({
                    message: "Please provide a reason of no more than 500 characters."
                });
            }

            // Verify that the appointment belongs to the patient
            const appointment = db.prepare(`
                SELECT
                    appointment_id,
                    status
                FROM Appointment
                WHERE appointment_id = ?
                    AND user_id = ?
            `).get(appointmentId, userId);

            if (!appointment) {
                return res.status(404).json({
                    message: "Appointment not found."
                });
            }

            if (appointment.status !== "Confirmed") {
                return res.status(409).json({
                    message: "Only confirmed appointments can be rescheduled."
                });
            }

            // Prevent multiple pending requests for the same appointment
            const pendingRequest = db.prepare(`
                SELECT reschedule_request_id
                FROM Reschedule_Request
                WHERE appointment_id = ?
                    AND status = 'Pending'
            `).get(appointmentId);

            if (pendingRequest) {
                return res.status(409).json({
                    message: "You already have a pending reschedule request for this appointment."
                });
            }

            // Save the request without changing the original appointment
            const result = db.prepare(`
                INSERT INTO Reschedule_Request (
                    appointment_id,
                    reason,
                    status
                )
                VALUES (?, ?, 'Pending')
            `).run(
                appointmentId,
                reason.trim()
            );

            return res.status(201).json({
                message: "Reschedule request submitted successfully.",
                reschedule_request_id: Number(result.lastInsertRowid)
            });

        } catch (error) {
            console.error("Error submitting reschedule request:", error);

            return res.status(500).json({
                message: "An error occurred while submitting the reschedule request."
            });
        }
    }
);


// =========================================
// GET NOTIFICATIONS FOR THE LOGGED-IN USER
// =========================================
app.get(
    "/api/notifications",
    requireRole("pregnant_woman", "child"),
    (req, res) => {
        try {
            const userId = req.session.user.userId;

            const notifications = db.prepare(`
                SELECT
                    notification_id,
                    title,
                    type,
                    message,
                    created_at,
                    is_read,
                    appointment_date,
                    appointment_time,
                    note
                FROM Notification
                WHERE user_id = ?
                ORDER BY created_at DESC, notification_id DESC
            `).all(userId);

            res.json(notifications);
        } catch (error) {
            console.error("Error loading notifications:", error);

            res.status(500).json({
                message: "Failed to load notifications."
            });
        }
    }
);

// =========================================
// MARK ONE NOTIFICATION AS READ
// =========================================
app.patch(
    "/api/notifications/:id/read",
    requireRole("pregnant_woman", "child"),
    (req, res) => {
        const notificationId = Number(req.params.id);
        const userId = req.session.user.userId;

        if (
            !Number.isSafeInteger(notificationId) ||
            notificationId <= 0
        ) {
            return res.status(400).json({
                message: "Invalid notification ID."
            });
        }

        try {
            const result = db.prepare(`
                UPDATE Notification
                SET is_read = 1
                WHERE notification_id = ?
                  AND user_id = ?
            `).run(notificationId, userId);

            if (result.changes === 0) {
                return res.status(404).json({
                    message: "Notification not found."
                });
            }

            res.json({
                message: "Notification marked as read."
            });
        } catch (error) {
            console.error("Error updating notification:", error);

            res.status(500).json({
                message: "Failed to update notification."
            });
        }
    }
);


/* =========================================================
   PATIENT CHILD VACCINATION API
   Used by child_vaccination.html
   ========================================================= */

// Get children the logged-in user is allowed to view.
app.get(
    "/api/patient/vaccination-children",
    requireRole("pregnant_woman", "child"),
    (req, res) => {
        try {
            const { userId, role } = req.session.user;

            let children;

            if (role === "child") {
                // A child account can only see its own profile.
                children = db.prepare(`
                    SELECT
                        User.user_id,
                        User.full_name,
                        Child.gender,
                        Child.date_of_birth
                    FROM User
                    INNER JOIN Child
                        ON Child.user_id = User.user_id
                    WHERE User.user_id = ?
                      AND User.role = 'child'
                `).all(userId);
            } else {
                // A pregnant woman can see children whose guardian name
                // matches the logged-in pregnant woman's full name.
                children = db.prepare(`
                    SELECT
                        Child.user_id,
                        User.full_name,
                        Child.gender,
                        Child.date_of_birth
                    FROM Child
                    INNER JOIN User
                        ON User.user_id = Child.user_id
                    WHERE User.role = 'child'
                      AND LOWER(TRIM(Child.guardian_name)) = (
                          SELECT LOWER(TRIM(full_name))
                          FROM User
                          WHERE user_id = ?
                            AND role = 'pregnant_woman'
                      )
                    ORDER BY User.full_name
                `).all(userId);
            }

            return res.json(children);
        } catch (error) {
            console.error(
                "Error retrieving patient vaccination children:",
                error
            );

            return res.status(500).json({
                message: "Unable to load child information."
            });
        }
    }
);

// Get vaccination records for an authorised child.
app.get(
    "/api/patient/vaccinations/:userId",
    requireRole("pregnant_woman", "child"),
    (req, res) => {
        try {
            const loggedInUserId = req.session.user.userId;
            const role = req.session.user.role;
            const requestedChildId = String(req.params.userId || "").trim();

            let child;

            if (role === "child") {
                // A child cannot request another child's records.
                if (requestedChildId !== loggedInUserId) {
                    return res.status(403).json({
                        message: "You are not allowed to view this child's records."
                    });
                }

                child = db.prepare(`
                    SELECT
                        User.user_id,
                        User.full_name,
                        Child.gender,
                        Child.date_of_birth
                    FROM User
                    INNER JOIN Child
                        ON Child.user_id = User.user_id
                    WHERE User.user_id = ?
                      AND User.role = 'child'
                `).get(loggedInUserId);
            } else {
                // Verify the child belongs to this pregnant woman using the
                // guardian-name relationship before returning records.
                child = db.prepare(`
                    SELECT
                        Child.user_id,
                        User.full_name,
                        Child.gender,
                        Child.date_of_birth
                    FROM Child
                    INNER JOIN User
                        ON User.user_id = Child.user_id
                    WHERE Child.user_id = ?
                      AND User.role = 'child'
                      AND LOWER(TRIM(Child.guardian_name)) = (
                          SELECT LOWER(TRIM(full_name))
                          FROM User
                          WHERE user_id = ?
                            AND role = 'pregnant_woman'
                      )
                `).get(requestedChildId, loggedInUserId);
            }

            if (!child) {
                return res.status(404).json({
                    message: "Child not found or you do not have permission to view this child."
                });
            }

            const records = db.prepare(`
                SELECT
                    cv.child_vaccination_id,
                    cv.vaccination_id,
                    v.vaccine_name,
                    cv.dose,
                    cv.status,
                    cv.due_date
                FROM Child_Vaccination AS cv
                INNER JOIN Vaccination AS v
                    ON v.vaccination_id = cv.vaccination_id
                WHERE cv.user_id = ?
                ORDER BY
                    CASE WHEN cv.status = 'Upcoming' THEN 0 ELSE 1 END,
                    cv.due_date,
                    cv.child_vaccination_id
            `).all(child.user_id);

            return res.json({
                child,
                records
            });
        } catch (error) {
            console.error(
                "Error retrieving patient vaccination records:",
                error
            );

            return res.status(500).json({
                message: "Unable to load vaccination records."
            });
        }
    }
);


/* =========================================
   CHILD PROFILE: GET GUARDIAN EMERGENCY CONTACT
========================================= */
app.get("/api/patient/emergency-contact", (req, res) => {
    if (!req.session?.user) {
        return res.status(401).json({
            message: "Please log in to continue."
        });
    }

    const userId =
        req.session.user.userId || req.session.user.user_id;

    if (
        String(req.session.user.role || "").toLowerCase() !== "child"
    ) {
        return res.status(403).json({
            message: "This endpoint is for child accounts only."
        });
    }

    try {
        const guardian = db.prepare(`
            SELECT
                Child.guardian_name,
                Child.phone_no,
                User.email
            FROM Child
            INNER JOIN User
                ON User.user_id = Child.user_id
            WHERE Child.user_id = ?
            LIMIT 1
        `).get(userId);

        if (!guardian) {
            return res.status(404).json({
                message: "Child profile not found."
            });
        }

        return res.json({
            mother: {
                fullName: guardian.guardian_name || "",
                phoneNo: guardian.phone_no || "",
                email: guardian.email || "",
                relationship: "Mother"
            }
        });

    } catch (error) {
        console.error(
            "Error loading guardian emergency contact:",
            error
        );

        return res.status(500).json({
            message: "Unable to load guardian contact details."
        });
    }
});

app.put("/api/pregnant-woman/emergency-contact", (req, res) => {
    try {
        // Check login session
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                message: "Please log in to continue."
            });
        }

        const user = req.session.user;

        const userId = user.userId || user.user_id;
        const role = String(user.role || "").trim().toLowerCase();

        // Only pregnant woman accounts can edit their emergency contact
        if (role !== "pregnant_woman") {
            return res.status(403).json({
                message: "Only pregnant woman accounts can edit emergency contacts."
            });
        }

        const contactName = String(
            req.body.contactName || ""
        ).trim();

        const relationship = String(
            req.body.relationship || ""
        ).trim();

        const contactPhone = String(
            req.body.contactPhone || ""
        ).trim();

        if (!userId) {
            return res.status(401).json({
                message: "User ID is missing from the login session."
            });
        }

        if (!contactName || !relationship || !contactPhone) {
            return res.status(400).json({
                message: "Please fill in all emergency contact fields."
            });
        }

        // Save to the existing Pregnant_Woman table
        const result = db.prepare(`
            UPDATE Pregnant_Woman
            SET contact_name = ?,
                relationship = ?,
                contact_phone_no = ?
            WHERE user_id = ?
        `).run(
            contactName,
            relationship,
            contactPhone,
            userId
        );

        if (result.changes === 0) {
            return res.status(404).json({
                message: "Pregnant woman profile not found in the database."
            });
        }

        return res.status(200).json({
            message: "Emergency contact saved successfully.",
            contact: {
                contactName,
                relationship,
                contactPhone
            }
        });

    } catch (error) {
        console.error(
            "Emergency contact database error:",
            error
        );

        return res.status(500).json({
            message: "Unable to save emergency contact. Check the backend terminal for details."
        });
    }
});

app.put("/api/me", (req, res) => {
    try {
        const sessionUser = req.session?.user;

        const userId =
            sessionUser?.userId ||
            sessionUser?.user_id ||
            sessionUser?.id;

        if (!userId) {
            return res.status(401).json({
                message: "Please log in again."
            });
        }

        const role = String(sessionUser.role || "").toLowerCase();

        const {
            fullName,
            phoneNo,
            email,
            dateOfBirth,
            address
        } = req.body;

        // Only staff and pregnant women can edit their profiles.
        if (!["staff", "pregnant_woman"].includes(role)) {
            return res.status(403).json({
                message: "You are not allowed to edit this profile."
            });
        }

        if (
            typeof fullName !== "string" ||
            !fullName.trim() ||
            typeof email !== "string" ||
            !email.trim() ||
            typeof phoneNo !== "string" ||
            !phoneNo.trim()
        ) {
            return res.status(400).json({
                message: "Name, email and phone number are required."
            });
        }

        const newFullName = fullName.trim();
        const newEmail = email.trim().toLowerCase();
        const newPhone = phoneNo.trim();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            return res.status(400).json({
                message: "Please enter a valid email address."
            });
        }

        if (role === "pregnant_woman") {
            if (
                typeof dateOfBirth !== "string" ||
                !dateOfBirth.trim() ||
                typeof address !== "string" ||
                !address.trim()
            ) {
                return res.status(400).json({
                    message: "Date of birth and address are required."
                });
            }
        }

        const existingUser = db.prepare(`
            SELECT full_name, role
            FROM User
            WHERE user_id = ?
        `).get(userId);

        if (!existingUser) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        const oldFullName = existingUser.full_name;

        // Check whether another account already uses this email.
        const duplicateEmail = db.prepare(`
            SELECT user_id
            FROM User
            WHERE LOWER(TRIM(email)) = ?
            AND user_id != ?
        `).get(newEmail, userId);

        if (duplicateEmail) {
            return res.status(409).json({
                message: "This email is already used by another account."
            });
        }

        // Save all profile information in one transaction.
        const updateProfile = db.transaction(() => {

            // Update common account information.
            db.prepare(`
                UPDATE User
                SET full_name = ?,
                    email = ?
                WHERE user_id = ?
            `).run(
                newFullName,
                newEmail,
                userId
            );

            if (role === "staff") {

                // Update staff phone number.
                const result = db.prepare(`
                    UPDATE Staff
                    SET phone_no = ?
                    WHERE user_id = ?
                `).run(
                    newPhone,
                    userId
                );

                if (result.changes === 0) {
                    throw new Error("Staff profile not found.");
                }
            }

            if (role === "pregnant_woman") {

                // Update pregnant woman's personal information.
                const result = db.prepare(`
                    UPDATE Pregnant_Woman
                    SET phone_no = ?,
                        date_of_birth = ?,
                        address = ?
                    WHERE user_id = ?
                `).run(
                    newPhone,
                    dateOfBirth.trim(),
                    address.trim(),
                    userId
                );

                if (result.changes === 0) {
                    throw new Error("Pregnant woman profile not found.");
                }

                // Synchronise guardian names if the mother changes her name.
                if (
                    oldFullName &&
                    oldFullName.trim().toLowerCase() !==
                    newFullName.toLowerCase()
                ) {
                    db.prepare(`
                        UPDATE Child
                        SET guardian_name = ?
                        WHERE LOWER(TRIM(guardian_name)) =
                              LOWER(TRIM(?))
                    `).run(
                        newFullName,
                        oldFullName
                    );
                }
            }
        });

        updateProfile();

        return res.json({
            message: "Profile updated successfully.",
            fullName: newFullName,
            email: newEmail,
            phoneNo: newPhone,
            dateOfBirth: dateOfBirth || null,
            address: address || null
        });

    } catch (error) {
        console.error("Profile update error:", error);

        return res.status(500).json({
            message: "Unable to update profile."
        });
    }
});

app.put("/api/pregnant-woman/emergency-contact", (req, res) => {
    if (!req.session?.user) {
        return res.status(401).json({
            message: "Please log in to continue."
        });
    }

    const userId =
        req.session.user.userId || req.session.user.user_id;

    if (
        String(req.session.user.role || "").toLowerCase() !== "pregnant_woman"
    ) {
        return res.status(403).json({
            message: "Only pregnant woman accounts can update emergency contacts."
        });
    }

    const contactName = String(req.body.contactName || "").trim();
    const relationship = String(req.body.relationship || "").trim();
    const contactPhone = String(req.body.contactPhone || "").trim();

    if (!contactName || !relationship || !contactPhone) {
        return res.status(400).json({
            message: "Please fill in all emergency contact fields."
        });
    }

    try {
        const result = db.prepare(`
            UPDATE Pregnant_Woman
            SET
                contact_name = ?,
                relationship = ?,
                contact_phone_no = ?
            WHERE user_id = ?
        `).run(
            contactName,
            relationship,
            contactPhone,
            userId
        );

        if (result.changes === 0) {
            return res.status(404).json({
                message: "Pregnant woman profile not found."
            });
        }

        return res.json({
            message: "Emergency contact saved successfully."
        });
    } catch (error) {
        console.error("Emergency contact save error:", error);

        return res.status(500).json({
            message: "Unable to save emergency contact."
        });
    }
});

// Get today's date in Malaysia (YYYY-MM-DD)
function getMalaysiaDate() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kuala_Lumpur",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());
}

// Get clinic closing time
function getClinicClosingTime(appointmentDate) {
    const [year, month, day] = appointmentDate.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    const dayOfWeek = date.getUTCDay();

    // Saturday: 1:00 PM
    if (dayOfWeek === 6) {
        return "13:00";
    }

    // Monday to Friday: 5:00 PM
    return "17:00";
}

// ================= QUEUE CONFIGURATION =================
const SERVICE_CONFIG = {
    "Maternal Follow-up": {
        startingNumber: 1001,
        maxCalled: 2,
        estimatedDuration: 20
    },

    "Child Vaccination": {
        startingNumber: 6001,
        maxCalled: 1,
        estimatedDuration: 15
    }
};

// Update missed appointments
function updateMissedAppointments() {
    try {
        const today = getMalaysiaDate();

        const currentTime = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Kuala_Lumpur",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).format(new Date());

        const clinicClosingTime = getClinicClosingTime(today);

        // Only update appointments after the clinic has closed.
        if (currentTime < clinicClosingTime) {
            return;
        }

        const updateMissedTransaction = db.transaction(() => {

            // Mark unfinished queue entries as skipped.
            const queueResult = db.prepare(`
                UPDATE Queue_Entry
                SET status = 'Skipped'
                WHERE status = 'Waiting'
                AND appointment_id IN (
                    SELECT appointment_id
                    FROM Appointment
                    WHERE appointment_date = ?
                    AND status = 'Confirmed'
                )
            `).run(today);

            // Mark appointments without a queue entry or with an unfinished queue entry as missed.
            const appointmentResult = db.prepare(`
                UPDATE Appointment
                SET status = 'Missed'
                WHERE appointment_date = ?
                AND status = 'Confirmed'
                AND (
                    NOT EXISTS (
                        SELECT 1
                        FROM Queue_Entry
                        WHERE Queue_Entry.appointment_id =
                              Appointment.appointment_id
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM Queue_Entry
                        WHERE Queue_Entry.appointment_id =
                              Appointment.appointment_id
                        AND Queue_Entry.status = 'Skipped'
                    )
                )
            `).run(today);

            return {
                queueChanges: queueResult.changes,
                appointmentChanges: appointmentResult.changes
            };
        });

        const result = updateMissedTransaction();

        if (
            result.queueChanges > 0 ||
            result.appointmentChanges > 0
        ) {
            console.log(
                `${result.appointmentChanges} appointment(s) marked as missed.`
            );
        }

    } catch (error) {
        console.error("Error updating missed appointments:", error);
    }
}

// ================= ESTIMATED WAITING TIME =================
function calculateEstimatedWaitingTimes(today) {
    // Get all active queue entries for today.
    const queueEntries = db.prepare(`
        SELECT
            q.queue_entry_id,
            q.queue_number,
            q.waiting_since,
            q.called_at,
            q.status AS queue_status,
            a.appointment_type

        FROM Queue_Entry AS q

        INNER JOIN Appointment AS a
            ON q.appointment_id = a.appointment_id

        WHERE a.appointment_date = ?
        AND date(q.check_in_time, '+8 hours') = ?
        AND q.status IN ('Waiting', 'Called')
    `).all(today, today);

    // Store estimated waiting times for Waiting patients.
    const estimatedWaitingTimes = new Map();

    // Calculate waiting time separately for each service.
    for (const [serviceType, serviceConfig] of Object.entries(SERVICE_CONFIG)) {

        const serviceEntries = queueEntries.filter(
            entry => entry.appointment_type === serviceType
        );

        // Get patients who are currently Called.
        const calledPatients = serviceEntries.filter(
            entry => entry.queue_status === "Called"
        );

        // Get patients who are still Waiting.
        const waitingPatients = serviceEntries
            .filter(entry => entry.queue_status === "Waiting")
            .sort((a, b) => {
                return (
                    a.waiting_since.localeCompare(b.waiting_since) ||
                    a.queue_number - b.queue_number
                );
            });

        // Calculate the remaining time for each Called patient.
        const availableSlots = calledPatients.map(patient => {

            // SQLite CURRENT_TIMESTAMP is stored in UTC.
            const calledAt = new Date(
                patient.called_at.replace(" ", "T") + "Z"
            );

            const elapsedMinutes =
                (Date.now() - calledAt.getTime()) / 60000;

            return Math.max(
                0,
                serviceConfig.estimatedDuration - elapsedMinutes
            );
        });

        // Add unused service capacity as available slots.
        const unusedSlots = Math.max(
            0,
            serviceConfig.maxCalled - calledPatients.length
        );

        for (let i = 0; i < unusedSlots; i++) {
            availableSlots.push(0);
        }

        // Calculate the estimated waiting time for each patient.
        for (const patient of waitingPatients) {

            // Find the earliest available slot.
            availableSlots.sort((a, b) => a - b);

            const estimatedTime = availableSlots[0];

            // Save the estimated waiting time in minutes.
            estimatedWaitingTimes.set(
                patient.queue_entry_id,
                Math.ceil(estimatedTime)
            );

            // Update the slot after assigning this patient.
            availableSlots[0] += serviceConfig.estimatedDuration;
        }
    }

    return estimatedWaitingTimes;
}

// Patient queue: Get Today's Appointments
app.get("/api/patient/queue", requireRole("pregnant_woman", "child"),
    (req, res) => {
        try {
            const userId = req.session.user.userId;
            const today = getMalaysiaDate();

            const appointments = db.prepare(`
                SELECT
                    a.appointment_id,
                    a.appointment_type,
                    a.appointment_date,
                    a.start_time,
                    a.status AS appointment_status,

                    q.queue_entry_id,
                    q.queue_number,
                    q.check_in_time,
                    q.status AS queue_status,

                    CASE
                        -- No queue entry means the patient has not checked in
                        WHEN q.queue_entry_id IS NULL THEN NULL

                        -- Called, Completed and Skipped patients have no waiting position
                        WHEN q.status IN ('Called', 'Completed', 'Skipped') THEN NULL
                        
                        -- Count Waiting patients within the same service only
                        ELSE (
                            SELECT COUNT(*)
                            FROM Queue_Entry AS q2

                            INNER JOIN Appointment AS a2
                                ON q2.appointment_id = a2.appointment_id

                            WHERE date(q2.check_in_time, '+8 hours') = ?
                            AND q2.status = 'Waiting'

                            -- Only count patients from the same service
                            AND a2.appointment_type = a.appointment_type

                            -- Compare Waiting patients by waiting_since
                            AND (
                                q2.waiting_since < q.waiting_since
                                OR (
                                    q2.waiting_since = q.waiting_since
                                    AND q2.queue_number <= q.queue_number
                                )
                            )
                        )
                    END AS queue_position

                FROM Appointment AS a

                LEFT JOIN Queue_Entry AS q
                    ON q.appointment_id = a.appointment_id

                WHERE a.user_id = ?
                AND a.appointment_date = ?
                AND a.status IN ('Confirmed', 'Missed')

                ORDER BY a.start_time ASC, a.appointment_id ASC
            `).all(today, userId, today);

            // Calculate estimated waiting times for today's queue.
            const estimatedWaitingTimes = calculateEstimatedWaitingTimes(today);

            // Add estimated waiting time to the patient's appointments.
            const appointmentsWithWaitingTime = appointments.map(appointment => ({
                ...appointment,

                estimated_waiting_time:
                    appointment.queue_status === "Waiting"
                        ? estimatedWaitingTimes.get(appointment.queue_entry_id) ?? null
                        : null
            }));

            return res.json(appointmentsWithWaitingTime);

        } catch (error) {
            console.error("Error loading patient queue:", error);

            return res.status(500).json({
                message: "Failed to load today's appointments."
            });
        }
    }
);

// Patient queue: Check in
app.post(
    "/api/patient/queue/:appointmentId/check-in", requireRole("pregnant_woman", "child"),
    (req, res) => {
        const appointmentId = Number(req.params.appointmentId);
        const userId = req.session.user.userId;
        const role = req.session.user.role;
        const today = getMalaysiaDate();

        if (!Number.isSafeInteger(appointmentId) || appointmentId <= 0) {
            return res.status(400).json({
                message: "Invalid appointment ID."
            });
        }

        try {
            const checkInTransaction = db.transaction(() => {
                // Confirm the appointment belongs to this patient.
                const appointment = db.prepare(`
                    SELECT
                        a.appointment_id,
                        a.user_id,
                        a.appointment_type,
                        a.appointment_date,
                        a.start_time,
                        a.status,
                        u.role AS patient_role,
                        u.account_status
                    FROM Appointment AS a
                    INNER JOIN User AS u
                        ON u.user_id = a.user_id
                    WHERE a.appointment_id = ?
                    AND a.user_id = ?
                `).get(appointmentId, userId);

                if (!appointment) {
                    throw new Error("APPOINTMENT_NOT_FOUND");
                }

                if (
                    appointment.account_status !== "Active" ||
                    appointment.patient_role !== role
                ) {
                    throw new Error("ACCOUNT_INACTIVE");
                }

                // Ensure the appointment type matches the account role.
                const correctType =
                    (role === "pregnant_woman" &&
                        appointment.appointment_type === "Maternal Follow-up") ||
                    (role === "child" &&
                        appointment.appointment_type === "Child Vaccination");

                if (!correctType) {
                    throw new Error("INVALID_APPOINTMENT_TYPE");
                }

                if (appointment.appointment_date !== today) {
                    throw new Error("NOT_TODAY");
                }

                // Check whether the appointment has already been missed.
                if (appointment.status === "Missed") {
                    throw new Error("APPOINTMENT_MISSED");
                }

                if (appointment.status !== "Confirmed") {
                    throw new Error("APPOINTMENT_NOT_CONFIRMED");
                }

                // If already checked in, return the existing queue entry.
                const existingEntry = db.prepare(`
                    SELECT
                        queue_entry_id,
                        appointment_id,
                        queue_number,
                        check_in_time,
                        status
                    FROM Queue_Entry
                    WHERE appointment_id = ?
                `).get(appointmentId);

                if (existingEntry) {
                    return {
                        alreadyCheckedIn: true,
                        queueEntry: existingEntry
                    };
                }

                // Check whether the appointment is within the allowed check-in period.
                const appointmentStartTime = Date.parse(
                    `${appointment.appointment_date}T${appointment.start_time}+08:00`
                );

                if (Number.isNaN(appointmentStartTime)) {
                    throw new Error("INVALID_APPOINTMENT_TIME");
                }

                const now = Date.now();

                // Get clinic closing time
                const clinicClosingTime = getClinicClosingTime(appointment.appointment_date);

                // Last check-in time = 15 minutes before clinic closing
                const clinicCloseAt = Date.parse(
                    `${appointment.appointment_date}T${clinicClosingTime}+08:00`
                );

                const checkInCloseAt = clinicCloseAt - 15 * 60 * 1000;

                if (now >= checkInCloseAt) {
                    throw new Error("CLINIC_CLOSED");
                }

                // Check-in opens 15 minutes before the appointment.
                const checkInOpensAt =
                    appointmentStartTime - 15 * 60 * 1000;

                if (now < checkInOpensAt) {
                    throw new Error("CHECK_IN_NOT_OPEN");
                }

                // Get the queue starting number for this service.
                const serviceConfig = SERVICE_CONFIG[appointment.appointment_type];

                if (!serviceConfig) {
                    throw new Error("INVALID_SERVICE_CONFIG");
                }

                // Find the latest queue number for the same service today.
                const latestEntry = db.prepare(`
                    SELECT MAX(queue_number) AS last_number

                    FROM Queue_Entry AS q

                    INNER JOIN Appointment AS a
                        ON q.appointment_id = a.appointment_id

                    WHERE a.appointment_type = ?
                    AND date(q.check_in_time, '+8 hours') = ?
                `).get(appointment.appointment_type, today);

                // Generate the next queue number.
                const nextNumber = latestEntry.last_number == null
                    ? serviceConfig.startingNumber
                    : latestEntry.last_number + 1;

                const queueNumber = nextNumber;

                // Create the queue entry only after successful check-in.
                const result = db.prepare(`
                    INSERT INTO Queue_Entry (
                        appointment_id,
                        queue_number,
                        status
                    )
                    VALUES (?, ?, 'Waiting')
                `).run(appointmentId, queueNumber);

                const queueEntry = db.prepare(`
                    SELECT
                        queue_entry_id,
                        appointment_id,
                        queue_number,
                        check_in_time,
                        status
                    FROM Queue_Entry
                    WHERE queue_entry_id = ?
                `).get(result.lastInsertRowid);

                return {
                    alreadyCheckedIn: false,
                    queueEntry
                };
            });

            const result = checkInTransaction();

            return res.status(result.alreadyCheckedIn ? 200 : 201).json({
                message: result.alreadyCheckedIn
                    ? "You have already checked in."
                    : "Check-in successful.",
                ...result.queueEntry,
                alreadyCheckedIn: result.alreadyCheckedIn
            });

        } catch (error) {
            if (error.message === "APPOINTMENT_NOT_FOUND") {
                return res.status(404).json({
                    message: "Appointment not found."
                });
            }

            if (error.message === "ACCOUNT_INACTIVE") {
                return res.status(403).json({
                    message: "Your account is inactive."
                });
            }

            if (error.message === "INVALID_APPOINTMENT_TYPE") {
                return res.status(403).json({
                    message: "This appointment type is not available for your account."
                });
            }

            if (error.message === "NOT_TODAY") {
                return res.status(400).json({
                    message: "You can only check in for today's appointment."
                });
            }

            if (error.message === "APPOINTMENT_NOT_CONFIRMED") {
                return res.status(400).json({
                    message: "Only confirmed appointments can check in."
                });
            }

            if (error.message === "APPOINTMENT_MISSED") {
                return res.status(400).json({
                    message: "This appointment has already been marked as missed."
                });
            }

            if (error.message === "CLINIC_CLOSED") {
                return res.status(400).json({
                    message: "Check-in is no longer available for today."
                });
            }

            if (error.message === "CHECK_IN_NOT_OPEN") {
                return res.status(400).json({
                    message: "Check-in opens 15 minutes before your appointment."
                });
            }

            if (error.message === "INVALID_APPOINTMENT_TIME") {
                return res.status(500).json({
                    message: "Unable to verify the appointment time."
                });
            }

            console.error("Patient check-in error:", error);

            return res.status(500).json({
                message: "Check-in failed. Please try again."
            });
        }
    }
);

// Patient live queue
app.get("/api/patient/live-queue", requireRole("pregnant_woman", "child"),
    (req, res) => {
        try {
            const today = getMalaysiaDate();

            const queueEntries = db.prepare(`
                SELECT
                    q.queue_number,
                    a.appointment_type,
                    q.status AS queue_status
                FROM Queue_Entry AS q

                INNER JOIN Appointment AS a
                    ON q.appointment_id = a.appointment_id

                WHERE a.appointment_date = ?
                  AND date(q.check_in_time, '+8 hours') = ?
                  AND q.status IN ('Waiting', 'Called')

                ORDER BY
                    CASE q.status
                        WHEN 'Called' THEN 1
                        WHEN 'Waiting' THEN 2
                        ELSE 3
                    END,
                    CASE
                        WHEN q.status = 'Waiting' THEN q.waiting_since
                        ELSE q.queue_number
                    END ASC,
                    q.queue_number ASC
            `).all(today, today);

            return res.json(queueEntries);

        } catch (error) {
            console.error("Error loading patient live queue:", error);

            return res.status(500).json({
                message: "Failed to load the live queue."
            });
        }
    }
);

// Staff queue: Get today's queue
app.get("/api/staff/queue", requireRole("staff"),
    (req, res) => {
        try {
            const today = getMalaysiaDate();

            const queueEntries = db.prepare(`
                SELECT
                    q.queue_entry_id,
                    q.appointment_id,
                    q.queue_number,
                    q.check_in_time,
                    q.status AS queue_status,

                    a.appointment_type,
                    a.appointment_date,
                    a.start_time,
                    a.status AS appointment_status,

                    u.user_id,
                    u.full_name AS patient_name,
                    u.role AS patient_role,

                    c.guardian_name

                FROM Queue_Entry AS q

                INNER JOIN Appointment AS a
                    ON q.appointment_id = a.appointment_id

                INNER JOIN User AS u
                    ON a.user_id = u.user_id

                LEFT JOIN Child AS c
                    ON c.user_id = u.user_id

                WHERE a.appointment_date = ?
                  AND date(q.check_in_time, '+8 hours') = ?

                ORDER BY
                    CASE q.status
                        WHEN 'Called' THEN 1
                        WHEN 'Waiting' THEN 2
                        WHEN 'Completed' THEN 3
                        WHEN 'Skipped' THEN 4
                        ELSE 5
                    END,
                    CASE
                        WHEN q.status = 'Waiting' THEN q.waiting_since
                        ELSE q.queue_number
                    END ASC,
                    q.queue_number ASC
            `).all(today, today);

            return res.json(queueEntries);

        } catch (error) {
            console.error("Error loading staff queue:", error);

            return res.status(500).json({
                message: "Failed to load today's queue."
            });
        }
    }
);

// Staff queue: Update queue status
app.patch("/api/staff/queue/:queueEntryId/status", requireRole("staff"),
    async (req, res) => {
        const queueEntryId = Number(req.params.queueEntryId);
        const { status: newStatus } = req.body;

        const today = getMalaysiaDate();

        // Validate queue entry ID.
        if (
            !Number.isSafeInteger(queueEntryId) ||
            queueEntryId <= 0
        ) {
            return res.status(400).json({
                message: "Invalid queue entry ID."
            });
        }

        // Only these status transitions are supported.
        const allowedStatuses = ["Called", "Completed", "Skipped"];

        if (!allowedStatuses.includes(newStatus)) {
            return res.status(400).json({
                message: "Invalid queue status."
            });
        }

        try {
            const updateQueueTransaction = db.transaction(() => {

                // Get the queue entry and its appointment.
                const entry = db.prepare(`
                    SELECT
                        q.queue_entry_id,
                        q.appointment_id,
                        q.queue_number,
                        q.status AS queue_status,

                        a.user_id,
                        a.appointment_type,
                        a.appointment_date,
                        a.start_time,
                        a.status AS appointment_status,

                        u.full_name AS patient_name,
                        u.email AS patient_email

                    FROM Queue_Entry AS q

                    INNER JOIN Appointment AS a
                        ON q.appointment_id = a.appointment_id

                    INNER JOIN User AS u
                        ON a.user_id = u.user_id

                    WHERE q.queue_entry_id = ?
                      AND a.appointment_date = ?
                      AND date(q.check_in_time, '+8 hours') = ?
                `).get(queueEntryId, today, today);

                if (!entry) {
                    throw new Error("QUEUE_ENTRY_NOT_FOUND");
                }

                // Ensure the appointment is confirmed before calling or completing the visit
                const currentStatus = entry.queue_status;

                // Call patient
                if (newStatus === "Called") {

                    if (currentStatus !== "Waiting") {
                        throw new Error("INVALID_STATUS_TRANSITION");
                    }

                    if (entry.appointment_status !== "Confirmed") {
                        throw new Error("APPOINTMENT_NOT_CONFIRMED");
                    }

                    // Check the maximum number of patients who can be called for this service.
                    const serviceConfig = SERVICE_CONFIG[entry.appointment_type];

                    if (!serviceConfig) {
                        throw new Error("INVALID_SERVICE_CONFIG");
                    }

                    // Count patients who are currently Called in the same service today.
                    const activeCalledCount = db.prepare(`
                        SELECT COUNT(*) AS total

                        FROM Queue_Entry AS q

                        INNER JOIN Appointment AS a
                            ON q.appointment_id = a.appointment_id

                        WHERE a.appointment_type = ?
                        AND a.appointment_date = ?
                        AND date(q.check_in_time, '+8 hours') = ?
                        AND q.status = 'Called'
                    `).get(
                        entry.appointment_type,
                        today,
                        today
                    ).total;

                    // Prevent calling more patients than the service capacity.
                    if (activeCalledCount >= serviceConfig.maxCalled) {
                        throw new Error("SERVICE_CAPACITY_FULL");
                    }

                    // Record the date and time when the patient is called.
                    const queueUpdate = db.prepare(`
                        UPDATE Queue_Entry
                        SET
                            status = 'Called',
                            called_at = CURRENT_TIMESTAMP
                        WHERE queue_entry_id = ?
                        AND status = 'Waiting'
                    `).run(queueEntryId);

                    if (queueUpdate.changes !== 1) {
                        throw new Error("QUEUE_UPDATE_FAILED");
                    }

                    // Create a notification when the patient is called.
                    db.prepare(`
                        INSERT INTO Notification (
                            user_id,
                            title,
                            message
                        )
                        VALUES (?, ?, ?)
                    `).run(
                        entry.user_id,
                        "You Have Been Called",  
                        `Your queue number is ${entry.queue_number}. Please proceed to the service point.`
                    );
                }

                // Complete visit
                else if (newStatus === "Completed") {

                    if (currentStatus !== "Called") {
                        throw new Error("INVALID_STATUS_TRANSITION");
                    }

                    if (entry.appointment_status !== "Confirmed") {
                        throw new Error("APPOINTMENT_NOT_CONFIRMED");
                    }

                    // Update the queue status first.
                    const queueUpdate = db.prepare(`
                        UPDATE Queue_Entry
                        SET status = 'Completed'
                        WHERE queue_entry_id = ?
                        AND status = 'Called'
                    `).run(queueEntryId);

                    if (queueUpdate.changes !== 1) {
                        throw new Error("QUEUE_UPDATE_FAILED");
                    }

                    // Update the associated appointment as well.
                    const appointmentUpdate = db.prepare(`
                        UPDATE Appointment
                        SET status = 'Completed'
                        WHERE appointment_id = ?
                        AND status = 'Confirmed'
                    `).run(entry.appointment_id);

                    if (appointmentUpdate.changes !== 1) {
                        throw new Error("APPOINTMENT_UPDATE_FAILED");
                    }
                }

                // Skip patient
                else if (newStatus === "Skipped") {

                    if (currentStatus !== "Called") {
                        throw new Error("INVALID_STATUS_TRANSITION");
                    }

                    if (entry.appointment_status !== "Confirmed") {
                        throw new Error("APPOINTMENT_NOT_CONFIRMED");
                    }

                    // Return the patient to the end of the waiting queue.
                    const queueUpdate = db.prepare(`
                        UPDATE Queue_Entry
                        SET
                            status = 'Waiting',
                            waiting_since = CURRENT_TIMESTAMP,
                            called_at = NULL
                        WHERE queue_entry_id = ?
                        AND status = 'Called'
                    `).run(queueEntryId);

                    if (queueUpdate.changes !== 1) {
                        throw new Error("QUEUE_UPDATE_FAILED");
                    }
                }

                // Return the latest saved queue entry and email details.
                return {
                    queueEntry: db.prepare(`
                        SELECT
                            q.queue_entry_id,
                            q.appointment_id,
                            q.queue_number,
                            q.check_in_time,
                            q.waiting_since,
                            q.called_at,
                            q.status AS queue_status,
                            a.status AS appointment_status
                        FROM Queue_Entry AS q
                        INNER JOIN Appointment AS a
                            ON q.appointment_id = a.appointment_id
                        WHERE q.queue_entry_id = ?
                    `).get(queueEntryId),

                    emailDetails: {
                        email: entry.patient_email,
                        patientName: entry.patient_name,
                        queueNumber: entry.queue_number,
                        serviceType: entry.appointment_type
                    }
                };
            });

            const result = updateQueueTransaction();
            const updatedEntry = result.queueEntry;

            // Send queue called email
            if (newStatus === "Called") {
                try {
                    await sendQueueCalledEmail(
                        result.emailDetails.email,
                        result.emailDetails.patientName,
                        result.emailDetails.queueNumber,
                        result.emailDetails.serviceType
                    );
                } catch (emailError) {
                    // Email failure should not undo the successful queue update.
                    console.error(
                        "Failed to send queue called email:",
                        emailError
                    );
                }
            }

            return res.json({
                message: "Queue status updated successfully.",
                queueEntry: updatedEntry
            });

        } catch (error) {

            if (error.message === "QUEUE_ENTRY_NOT_FOUND") {
                return res.status(404).json({
                    message: "Queue entry not found for today."
                });
            }

            if (error.message === "INVALID_STATUS_TRANSITION") {
                return res.status(409).json({
                    message: "This queue entry cannot move to the requested status."
                });
            }

            if (error.message === "APPOINTMENT_NOT_CONFIRMED") {
                return res.status(409).json({
                    message: "The appointment is not confirmed."
                });
            }

            if (error.message === "SERVICE_CAPACITY_FULL") {
                return res.status(409).json({
                    message: "The maximum number of patients called for this service has been reached."
                });
            }

            if (error.message === "INVALID_SERVICE_CONFIG") {
                return res.status(500).json({
                    message: "Invalid service configuration."
                });
            }

            if (error.message === "QUEUE_UPDATE_FAILED" || error.message === "APPOINTMENT_UPDATE_FAILED") {
                return res.status(409).json({
                    message: "Unable to update the queue and appointment status."
                });
            }

            console.error("Error updating staff queue:", error);

            return res.status(500).json({
                message: "Failed to update queue status."
            });
        }
    }
);

/* =========================================
   CHANGE PASSWORD FOR LOGGED-IN STAFF
========================================= */
app.patch(
    "/api/me/change-password",
    requireRole("staff"),
    async (req, res) => {
        try {
            const { currentPassword, newPassword, confirmPassword } = req.body;
            const userId = req.session.user.userId;

            if (
                typeof currentPassword !== "string" ||
                typeof newPassword !== "string" ||
                typeof confirmPassword !== "string"
            ) {
                return res.status(400).json({
                    message: "Please complete all password fields."
                });
            }

            if (!currentPassword.trim()) {
                return res.status(400).json({
                    message: "Please enter your current password."
                });
            }

            if (newPassword.length < 8 || newPassword.length > 128) {
                return res.status(400).json({
                    message: "Your new password must contain 8–128 characters."
                });
            }

            if (newPassword !== confirmPassword) {
                return res.status(400).json({
                    message: "The new passwords do not match."
                });
            }

            if (currentPassword === newPassword) {
                return res.status(400).json({
                    message: "Your new password must differ from your current password."
                });
            }

            const user = db.prepare(`
                SELECT password_hash, password_set, account_status
                FROM User
                WHERE user_id = ?
                  AND role = 'staff'
            `).get(userId);

            if (!user) {
                return res.status(404).json({
                    message: "Staff account not found."
                });
            }

            if (
                user.account_status !== "Active" ||
                Number(user.password_set) !== 1
            ) {
                return res.status(403).json({
                    message: "This account cannot change its password."
                });
            }

            const isValid = await verifyPassword(
                user.password_hash,
                currentPassword
            );

            if (!isValid) {
                return res.status(400).json({
                    message: "Your current password is incorrect."
                });
            }

            const newPasswordHash = await hashPassword(newPassword);

            const update = db.prepare(`
                UPDATE User
                SET password_hash = ?
                WHERE user_id = ?
                  AND role = 'staff'
                  AND account_status = 'Active'
                  AND password_set = 1
            `).run(newPasswordHash, userId);

            if (update.changes !== 1) {
                return res.status(409).json({
                    message: "Unable to update your password. Please try again."
                });
            }

            return res.json({
                message: "Your password has been changed successfully!"
            });

        } catch (error) {
            console.error("Staff password change error:", error);

            return res.status(500).json({
                message: "Unable to change your password. Please try again."
            });
        }
    }
);

async function notifyVaccinationChange(childUserId, action, recordId) {
    // Find the child, vaccine and matching pregnant woman account.
    const child = db.prepare(`
        SELECT
            childUser.user_id AS child_user_id,
            childUser.full_name AS child_name,
            childUser.email AS child_email,
            Child.guardian_name,
            cv.dose,
            cv.status,
            cv.due_date,
            Vaccination.vaccine_name,
            pregnantWomanUser.user_id AS pregnant_woman_user_id,
            pregnantWomanUser.full_name AS pregnant_woman_name,
            pregnantWomanUser.email AS pregnant_woman_email
        FROM Child
        INNER JOIN User AS childUser
            ON childUser.user_id = Child.user_id
        INNER JOIN Child_Vaccination AS cv
            ON cv.user_id = Child.user_id
        INNER JOIN Vaccination
            ON Vaccination.vaccination_id = cv.vaccination_id
        LEFT JOIN User AS pregnantWomanUser
            ON LOWER(TRIM(pregnantWomanUser.full_name)) =
               LOWER(TRIM(Child.guardian_name))
           AND pregnantWomanUser.role = 'pregnant_woman'
        WHERE Child.user_id = ?
        AND cv.child_vaccination_id = ?
        LIMIT 1
    `).get(childUserId, recordId);

    if (!child) {
        console.warn("Vaccination notification skipped: child not found.");
        return;
    }

    const title = action === "updated"
        ? "Vaccination Record Updated"
        : "New Vaccination Record";

    const message =
        `The vaccination record for ${child.child_name} has been ${action}. ` +
        `Vaccine: ${child.vaccine_name}. ` +
        `Dose: ${child.dose}. Status: ${child.status}. ` +
        `Due date: ${child.due_date || "Not specified"}.`;

    const recipients = [
        {
            userId: child.child_user_id,
            name: child.child_name,
            email: child.child_email
        }
    ];

    // Only include a matching pregnant woman account if one exists.
    if (child.pregnant_woman_user_id) {
        recipients.push({
            userId: child.pregnant_woman_user_id,
            name: child.pregnant_woman_name,
            email: child.pregnant_woman_email
        });
    }

    // Save in-app notifications for each recipient.
    const insertNotification = db.prepare(`
        INSERT INTO Notification (
            user_id,
            title,
            type,
            message,
            is_read,
            note
        )
        VALUES (?, ?, ?, ?, 0, ?)
    `);

    for (const recipient of recipients) {
        insertNotification.run(
            recipient.userId,
            title,
            "vaccination",
            message,
            `Vaccination record ${action}`
        );
    }

    // Email failures should not undo the saved vaccination record
    // or prevent in-app notifications from being created.
    for (const recipient of recipients) {
        if (!recipient.email || !recipient.email.trim()) {
            continue;
        }

        try {
            await sendVaccinationNotificationEmail(
                recipient.email,
                recipient.name,
                child.child_name,
                child.vaccine_name,
                child.dose,
                child.status,
                child.due_date || "Not specified",
                action
            );
        } catch (error) {
            console.error(
                `Vaccination email failed for ${recipient.email}:`,
                error.message
            );
        }
    }
}

// Get latest 3 notifications for dashboard
app.get(
    "/api/patient/dashboard/notifications",
    requireRole("pregnant_woman", "child"),
    (req, res) => {
        try {
            const userId = req.session.user.userId;

            const notifications = db.prepare(`
                SELECT
                    notification_id,
                    title,
                    type,
                    message,
                    created_at,
                    is_read
                FROM Notification
                WHERE user_id = ?
                ORDER BY created_at DESC, notification_id DESC
                LIMIT 3
            `).all(userId);

            res.json(notifications);
        } catch (error) {
            console.error(
                "Error loading dashboard notifications:",
                error
            );

            res.status(500).json({
                message: "Failed to load dashboard notifications."
            });
        }
    }
);

// Auto-update missed appointments when the server start
updateMissedAppointments();

// Check for missed appointments every 10 second.
setInterval(updateMissedAppointments, 10000);

const httpsOptions = {
    key: fs.readFileSync(
        path.join(__dirname, "certs", "localhost-key.pem")
    ),
    cert: fs.readFileSync(
        path.join(__dirname, "certs", "localhost.pem")
    )
};

https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`HTTPS server running at https://localhost:${PORT}`);
    console.log("SQLite database connected!");
});