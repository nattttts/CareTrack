const path = require("path");
const express = require("express");
const cors = require("cors");
const db = require("./database");
const { createInvitation } = require("./invitation");
const crypto = require("node:crypto");
const { hashPassword, verifyPassword } = require("./password");
const { sendInvitationEmail } = require("./email");
const session = require("express-session");
const SqliteStore = require("better-sqlite3-session-store")(session);
require("dotenv").config({
    path: require("node:path").join(__dirname, "../.env")
});


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
        secure: false,
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
    "set_password.html"
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

    "patient_dashboard.html": ["mother", "child"],
    "patient_appointments.html": ["mother", "child"],
    "child_vaccination.html": ["mother", "child"],
    "queue.html": ["mother", "child"],
    "notification.html": ["mother", "child"],
    "patient_profile.html": ["mother", "child"]
};

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


/* ================= API AUTHENTICATION ================= */
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
                SELECT staff_id, position, phone_no
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
                position: staff.position,
                phoneNo: staff.phone_no
            });
        }

        // Get Mother profile.
        if (user.role === "mother") {
            const mother = db.prepare(`
                SELECT
                    date_of_birth,
                    address,
                    phone_no,
                    contact_name,
                    relationship,
                    contact_phone_no
                FROM Mother
                WHERE user_id = ?
            `).get(userId);

            if (!mother) {
                return res.status(404).json({
                    message: "Mother profile not found."
                });
            }

            return res.json({
                ...userInfo,
                dateOfBirth: mother.date_of_birth,
                address: mother.address,
                phoneNo: mother.phone_no,
                contactName: mother.contact_name,
                relationship: mother.relationship,
                contactPhoneNo: mother.contact_phone_no
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
                Staff.position,
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
            process.env.APP_BASE_URL || `http://localhost:${PORT}`;

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
    const normalizedEmail = email.trim().toLowerCase();
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

// Get all mothers
app.get("/api/mothers", requireRole("staff"), (req, res) => {
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
                Mother.phone_no,
                Mother.address,
                Mother.contact_name,
                Mother.relationship,
                Mother.contact_phone_no,
                User.password_set
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

// Add a new mother
app.post("/api/mother", requireRole("staff"), async (req, res) => {
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
            message: "Please provide all required mother details."
        });
    }

    const name = full_name.trim();
    const icNumber = user_id.trim();
    const motherEmail = email.trim().toLowerCase();
    const dob = date_of_birth.trim();
    const phone = phone_no.trim();
    const motherAddress = address.trim();
    const contactName = contact_name.trim();
    const motherRelationship = relationship.trim();
    const contactPhoneNo = contact_phone_no.trim();

    if (!name || !icNumber || !motherEmail || !dob || !phone || 
        !motherAddress || !contactName || !motherRelationship || !contactPhoneNo) {
        return res.status(400).json({
            message: "All fields are required."
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(motherEmail)) {
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

    // Validate Malaysian mobile number format for mother
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
        `).get(motherEmail);

        if (duplicateEmail) {
            return res.status(409).json({
                message: "This email is already used by another account."
            });
        }

        // TEMPORARY: Replace with a real password hash before implementing login
        // The login route must reject accounts where password_set = 0
        const passwordHash = "TEMP_HASH_REPLACE_BEFORE_AUTH";

        // Create the user, mother profile and invitation together
        // If any database operation fails, the transaction rolls back
        const createMother = db.transaction(() => {
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
                VALUES (?, ?, ?, ?, 'mother', 'Active', 0)
            `).run(
                icNumber,
                name,
                motherEmail,
                passwordHash
            );

            const result = db.prepare(`
                INSERT INTO Mother (
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
                motherAddress,
                contactName,
                motherRelationship,
                contactPhoneNo
            );
 
            // Create an invitation for the newly created mother account.
            // createInvitation() uses a nested transaction, which
            // better-sqlite3 supports through a savepoint
            const token = createInvitation(icNumber);

            return {
                motherId: result.lastInsertRowid,
                token
            };
        });

        const { motherId, token } = createMother();

        // Construct the invitation URL for local testing
        const baseUrl = (
            process.env.APP_BASE_URL || `http://localhost:${PORT}`
        ).replace(/\/+$/, "");

        const invitationUrl =
            `${baseUrl}/set_password.html?token=${encodeURIComponent(token)}`;
        
        let emailError = false;

        try {
            await sendInvitationEmail(motherEmail, invitationUrl);
        } catch (error) {
            emailError = true;
            console.error("Failed to send mother invitation email:", error);
        }

        const response = {
            message: emailError
                ? "Mother account created, but the invitation email could not be sent. Please resend it."
                : "Mother account created and invitation email sent.",
            mother_id: motherId
        };

        return res.status(201).json(response);

    } catch (error) {
        console.error("Error creating mother:", error);

        if (
            error.code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
            error.code === "SQLITE_CONSTRAINT_UNIQUE"
        ) {
            return res.status(409).json({
                message: "A mother account with these details already exists."
            });
        }

        return res.status(500).json({
            message: "Failed to create mother account."
        });
    }
});

// Resend invitation link for password setup
app.post("/api/mother/:motherId/resend-invitation", requireRole("staff"), async (req, res) => {
    try {
        const mother = db.prepare(`
            SELECT
                Mother.user_id,
                User.email,
                User.password_set,
                User.account_status
            FROM Mother
            INNER JOIN User
                ON Mother.user_id = User.user_id
            WHERE Mother.mother_id = ?
        `).get(req.params.motherId);

        if (!mother) {
            return res.status(404).json({
                message: "Mother account not found."
            });
        }

        if (Number(mother.password_set) === 1) {
            return res.status(409).json({
                message: "This mother member has already set their password."
            });
        }

        if (mother.account_status !== "Active") {
            return res.status(409).json({
                message: "Activate this mother account before sending an invitation."
            });
        }

        const token = createInvitation(mother.user_id);

        const baseUrl =
            process.env.APP_BASE_URL || `http://localhost:${PORT}`;

        const invitationUrl =
            `${baseUrl}/set_password.html?token=${encodeURIComponent(token)}`;

        try {
            await sendInvitationEmail(mother.email, invitationUrl);

            return res.status(200).json({
                message: "Invitation email sent successfully."
            });

        } catch (error) {
            console.error("Failed to resend mother invitation:", error);

            return res.status(500).json({
                message: "The new invitation was created, but the email could not be sent. Please try resending it."
            });
        }

    } catch (error) {
        console.error("Error creating mother invitation:", error);

        return res.status(500).json({
            message: "Failed to create the mother invitation."
        });
    }
});

// Update mother details
app.patch("/api/mother/:motherId", requireRole("staff"), (req, res) => {
    const motherId = Number(req.params.motherId);

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

    // Validate mother ID
    if (!Number.isInteger(motherId) || motherId <= 0) {
        return res.status(400).json({
            message: "Invalid mother ID."
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
            message: "Please provide all required mother details."
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

    // Validate Malaysian mobile number format for mother
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
        // Find the existing mother account
        const existingMother = db.prepare(`
            SELECT Mother.user_id
            FROM Mother
            WHERE Mother.mother_id = ?
        `).get(motherId);

        if (!existingMother) {
            return res.status(404).json({
                message: "Mother member not found."
            });
        }

        // Check whether the new IC belongs to another account
        const duplicateIC = db.prepare(`
            SELECT user_id
            FROM User
            WHERE user_id = ?
            AND user_id != ?
        `).get(newIC, existingMother.user_id);

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
        `).get(normalizedEmail, existingMother.user_id);

        if (duplicateEmail) {
            return res.status(409).json({
                message: "This email is already used by another account."
            });
        }

        // Update everything in one transaction
        const updateMother = db.transaction(() => {
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
                existingMother.user_id
            );

            db.prepare(`
                UPDATE Mother
                SET date_of_birth = ?,
                    phone_no = ?,
                    address = ?,
                    contact_name = ?,
                    relationship = ?,
                    contact_phone_no = ?
                WHERE mother_id = ?
            `).run(
                dob, 
                phone, 
                newAddress, 
                contactName, 
                newRelationship, 
                contactPhoneNo, 
                motherId
            );
        });

        updateMother();

        return res.status(200).json({
            message: "Mother details updated successfully."
        });

    } catch (error) {
        console.error("Error updating mother:", error);

        return res.status(500).json({
            message: "Failed to update mother details."
        });
    }
});

// Update a mother account's status (Active or Inactive)
app.patch("/api/mother/:motherId/status", requireRole("staff"), (req, res) => {
    const motherId = Number(req.params.motherId);
    const { account_status } = req.body;

    // Validate the mother ID
    if (!Number.isInteger(motherId) || motherId <= 0) {
        return res.status(400).json({
            message: "Invalid mother ID."
        });
    }

    // Only allow these two account statuses
    if (!["Active", "Inactive"].includes(account_status)) {
        return res.status(400).json({
            message: "Status must be Active or Inactive."
        });
    }

    try {
        // Check that the mother account exists
        const mother = db.prepare(`
            SELECT user_id
            FROM Mother
            WHERE mother_id = ?
        `).get(motherId);

        if (!mother) {
            return res.status(404).json({
                message: "Mother account not found."
            });
        }

        // Update the account status in the User table
        db.prepare(`
            UPDATE User
            SET account_status = ?
            WHERE user_id = ?
        `).run(account_status, mother.user_id);

        const action = account_status === "Inactive"
            ? "deactivated"
            : "activated";

        return res.status(200).json({
            message: `Mother account ${action} successfully.`,
            account_status
        });

    } catch (error) {
        console.error("Error updating mother status:", error);

        return res.status(500).json({
            message: "Failed to update mother account status."
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
            process.env.APP_BASE_URL || `http://localhost:${PORT}`
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
            process.env.APP_BASE_URL || `http://localhost:${PORT}`;

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
    "/api/vaccination-management/records/:recordId", requireRole("staff"),
    (req, res) => {
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

            const result = db.prepare(`
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

            if (result.changes === 0) {
                return res.status(404).json({
                    message: "Vaccination record not found."
                });
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


// POST: Add a vaccination record for a child.
app.post(
    "/api/vaccination-management/children/:userId/records", requireRole("staff"),
    (req, res) => {
        const userId = String(req.params.userId || "").trim();

        const {
            vaccination_id,
            dose,
            status,
            due_date
        } = req.body;

        if (
            !userId ||
            !Number.isInteger(Number(vaccination_id)) ||
            typeof dose !== "string" ||
            !dose.trim() ||
            !["Upcoming", "Completed"].includes(status) ||
            typeof due_date !== "string"
        ) {
            return res.status(400).json({
                message: "Please provide a vaccine, dose, status and due date."
            });
        }

        // Validate the date, including invalid calendar dates.
        const date = new Date(due_date);

        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(due_date) ||
            Number.isNaN(date.getTime()) ||
            date.toISOString().slice(0, 10) !== due_date
        ) {
            return res.status(400).json({
                message: "Please provide a valid due date."
            });
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

            // appointment_id is no longer required.
            const result = db.prepare(`
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

            return res.status(201).json({
                message: "Vaccination record added successfully.",
                record_id: result.lastInsertRowid
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
    "/api/vaccination-management/records/:recordId", requireRole("staff"),
    (req, res) => {
        const recordId = Number(req.params.recordId);

        if (!Number.isInteger(recordId) || recordId <= 0) {
            return res.status(400).json({
                message: "Invalid vaccination record ID."
            });
        }

        try {
            const result = db.prepare(`
                DELETE FROM Child_Vaccination
                WHERE child_vaccination_id = ?
            `).run(recordId);

            if (result.changes === 0) {
                return res.status(404).json({
                    message: "Vaccination record not found."
                });
            }

            return res.json({
                message: "Vaccination record deleted successfully."
            });

        } catch (error) {
            console.error("Error deleting vaccination record:", error);

            return res.status(500).json({
                message: "Failed to delete vaccination record."
            });
        }
    }
);

// Get all appointments
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
                a.end_time,
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


// Get pending reschedule requests 
app.get("/api/staff/reschedule-requests", (req, res) => {
    try {
        const requests = db.prepare(`
            SELECT
                rr.reschedule_request_id,
                rr.appointment_id,
                rr.appointment_date AS proposed_date,
                rr.start_time AS proposed_start_time,
                rr.end_time AS proposed_end_time,
                rr.status AS request_status,
                rr.reject_reason,
                rr.created_at,

                a.user_id,
                u.full_name AS patient_name,
                u.role AS patient_role,
                u.account_status,

                a.appointment_type,
                a.appointment_date AS original_date,
                a.start_time AS original_start_time,
                a.end_time AS original_end_time,
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
            WHERE role IN ('mother', 'child')
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


// Add new patient appointments
app.post("/api/staff/appointments", requireRole("staff"), (req, res) => {
    try {
        const {
            user_id,
            appointment_date,
            start_time,
            end_time
        } = req.body;

        // Check required fields
        if (!user_id || !appointment_date || !start_time || !end_time) {
            return res.status(400).json({
                message: "Please provide the patient, date, start time and end time."
            });
        }

        // Validate date and time formats
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(appointment_date) ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(start_time) ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(end_time)
        ) {
            return res.status(400).json({
                message: "Invalid appointment date or time format."
            });
        }

        // Confirm that the patient exists and is active
        const patient = db.prepare(`
            SELECT user_id, role
            FROM User
            WHERE user_id = ?
              AND role IN ('mother', 'child')
              AND account_status = 'Active'
        `).get(user_id);

        if (!patient) {
            return res.status(400).json({
                message: "The selected patient does not exist or is inactive."
            });
        }

        // Determine the appointment type from the patient's role
        const appointmentType =
            patient.role === "child"
                ? "Child Vaccination"
                : "Maternal Follow-up";

        // Validate the calendar date
        const [year, month, day] = appointment_date.split("-").map(Number);

        const selectedDate = new Date(Date.UTC(year, month - 1, day));

        if (
            selectedDate.getUTCFullYear() !== year ||
            selectedDate.getUTCMonth() !== month - 1 ||
            selectedDate.getUTCDate() !== day
        ) {
            return res.status(400).json({
                message: "Please provide a valid appointment date."
            });
        }

        // Check clinic operating days and hours
        const dayOfWeek = selectedDate.getUTCDay();

        let openingTime;
        let closingTime;

        if (dayOfWeek === 0) {
            return res.status(400).json({
                message: "The clinic is closed on Sundays."
            });
        } else if (dayOfWeek === 6) {
            openingTime = "09:00";
            closingTime = "13:00";
        } else {
            openingTime = "08:30";
            closingTime = "17:00";
        }

        if (
            start_time < openingTime ||
            start_time >= closingTime ||
            end_time <= start_time ||
            end_time > closingTime
        ) {
            return res.status(400).json({
                message: `Appointment time must be within clinic hours (${openingTime}–${closingTime}), and the end time must be after the start time.`
            });
        }

        // Get today's date in Malaysia (YYYY-MM-DD)
        const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kuala_Lumpur",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date());

        // Prevent appointments in the past
        if (appointment_date < today) {
            return res.status(400).json({
                message: "The appointment date cannot be in the past."
            });
        }

        // Prevent a start time in the past today
        if (appointment_date === today) {
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
        
        // Prevent overlapping appointments across the entire clinic
        const overlappingAppointment = db.prepare(`
            SELECT appointment_id, start_time, end_time
            FROM Appointment
            WHERE appointment_date = ?
                AND appointment_type = ?
                AND status = 'Confirmed'
                AND start_time < ?
                AND end_time > ?
            LIMIT 1
        `).get(
            appointment_date,
            appointmentType,
            end_time,
            start_time
        );

        if (overlappingAppointment) {
            return res.status(409).json({
                message:
                    `An appointment already exists from ${overlappingAppointment.start_time} to ${overlappingAppointment.end_time}. Please choose another time.`
            });
        }

        // Save the appointment
        const result = db.prepare(`
            INSERT INTO Appointment (
                user_id,
                appointment_type,
                appointment_date,
                start_time,
                end_time
            )
            VALUES (?, ?, ?, ?, ?)
        `).run(
            user_id,
            appointmentType,
            appointment_date,
            start_time,
            end_time
        );

        res.status(201).json({
            message: "Appointment scheduled successfully.",
            appointment_id: result.lastInsertRowid
        });

    } catch (error) {
        console.error("Failed to create appointment:", error);

        res.status(500).json({
            message: "Failed to schedule the appointment. Please try again."
        });
    }
});


// Edit an existing appointment 
app.patch("/api/staff/appointments/:appointmentId", (req, res) => {
    try {
        const appointmentId = Number(req.params.appointmentId);

        const {
            appointment_date,
            start_time,
            end_time
        } = req.body;

        // Validate appointment ID
        if (!Number.isSafeInteger(appointmentId) || appointmentId <= 0) {
            return res.status(400).json({
                message: "Invalid appointment ID."
            });
        }

        // Validate required fields
        if (!appointment_date || !start_time || !end_time) {
            return res.status(400).json({
                message: "Please provide the appointment date, start time and end time."
            });
        }

        // Validate date and time formats
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(appointment_date) ||
            !/^\d{2}:\d{2}$/.test(start_time) ||
            !/^\d{2}:\d{2}$/.test(end_time)
        ) {
            return res.status(400).json({
                message: "Invalid date or time format."
            });
        }

        // Confirm that the date is a real calendar date
        const [year, month, day] = appointment_date.split("-").map(Number);

        const selectedDate = new Date(
            Date.UTC(year, month - 1, day)
        );

        if (
            selectedDate.getUTCFullYear() !== year ||
            selectedDate.getUTCMonth() !== month - 1 ||
            selectedDate.getUTCDate() !== day
        ) {
            return res.status(400).json({
                message: "Please select a valid appointment date."
            });
        }

        // Validate actual time values
        const [startHour, startMinute] = start_time.split(":").map(Number);
        const [endHour, endMinute] = end_time.split(":").map(Number);

        if (
            startHour > 23 ||
            startMinute > 59 ||
            endHour > 23 ||
            endMinute > 59
        ) {
            return res.status(400).json({
                message: "Please enter valid appointment times."
            });
        }

        if (end_time <= start_time) {
            return res.status(400).json({
                message: "The end time must be later than the start time."
            });
        }

        // Get today's date in Malaysia
        const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kuala_Lumpur",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date());

        // Only allow editing appointments scheduled for a future date
        if (appointment_date <= today) {
            return res.status(400).json({
                message: "The appointment date must be a future date."
            });
        }

        // Find the existing appointment
        const appointment = db.prepare(`
            SELECT appointment_id, appointment_type, status
            FROM Appointment
            WHERE appointment_id = ?
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

        // Determine clinic opening and closing times
        // JavaScript getUTCDay(): Sunday = 0, Saturday = 6
        const dayOfWeek = selectedDate.getUTCDay();

        if (dayOfWeek === 0) {
            return res.status(400).json({
                message: "The clinic is closed on Sundays."
            });
        }

        const openingTime = dayOfWeek === 6 ? "09:00" : "08:30";
        const closingTime = dayOfWeek === 6 ? "13:00" : "17:00";

        if (
            start_time < openingTime ||
            end_time > closingTime
        ) {
            return res.status(400).json({
                message: dayOfWeek === 6
                    ? "Saturday appointments must be between 9:00 AM and 1:00 PM."
                    : "Weekday appointments must be between 8:30 AM and 5:00 PM."
            });
        }

        // Check for overlapping appointments of the same type
        // Exclude the appointment currently being edited
        const overlappingAppointment = db.prepare(`
            SELECT appointment_id, start_time, end_time
            FROM Appointment
            WHERE appointment_date = ?
              AND appointment_type = ?
              AND status = 'Confirmed'
              AND appointment_id != ?
              AND start_time < ?
              AND end_time > ?
            LIMIT 1
        `).get(
            appointment_date,
            appointment.appointment_type,
            appointmentId,
            end_time,
            start_time
        );

        if (overlappingAppointment) {
            return res.status(409).json({
                message: `This time slot is unavailable. Another appointment of the same type is scheduled from ${overlappingAppointment.start_time} to ${overlappingAppointment.end_time}. Please choose another time.`
            });
        }

        // Update the existing appointment
        const updateResult = db.prepare(`
            UPDATE Appointment
            SET appointment_date = ?,
                start_time = ?,
                end_time = ?
            WHERE appointment_id = ?
              AND status = 'Confirmed'
        `).run(
            appointment_date,
            start_time,
            end_time,
            appointmentId
        );

        if (updateResult.changes === 0) {
            return res.status(409).json({
                message: "The appointment could not be updated. Please refresh and try again."
            });
        }

        return res.status(200).json({
            message: "Appointment updated successfully."
        });

    } catch (error) {
        console.error("Error updating appointment:", error);

        return res.status(500).json({
            message: "An unexpected error occurred while updating the appointment."
        });
    }
});


// Approve a reschedule request
app.patch("/api/staff/reschedule-requests/:requestId/approve", (req, res) => {
    try {
        const requestId = Number(req.params.requestId);

        if (!Number.isSafeInteger(requestId) || requestId <= 0) {
            return res.status(400).json({
                message: "Invalid reschedule request ID."
            });
        }

        const request = db.prepare(`
            SELECT
                rr.reschedule_request_id,
                rr.appointment_id,
                rr.appointment_date AS proposed_date,
                rr.start_time AS proposed_start_time,
                rr.end_time AS proposed_end_time,
                rr.status AS request_status,
                a.appointment_type,
                a.status AS appointment_status
            FROM Reschedule_Request AS rr
            JOIN Appointment AS a
                ON a.appointment_id = rr.appointment_id
            WHERE rr.reschedule_request_id = ?
        `).get(requestId);

        if (!request) {
            return res.status(404).json({
                message: "Reschedule request not found."
            });
        }

        if (request.request_status !== "Pending") {
            return res.status(409).json({
                message: "This reschedule request has already been processed."
            });
        }

        if (request.appointment_status !== "Confirmed") {
            return res.status(409).json({
                message: "The original appointment is no longer confirmed."
            });
        }

        const date = request.proposed_date;
        const startTime = request.proposed_start_time;
        const endTime = request.proposed_end_time;

        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            !/^\d{2}:\d{2}$/.test(startTime) ||
            !/^\d{2}:\d{2}$/.test(endTime)
        ) {
            return res.status(400).json({
                message: "The proposed date or time is invalid."
            });
        }

        const [year, month, day] = date.split("-").map(Number);
        const selectedDate = new Date(
            Date.UTC(year, month - 1, day)
        );

        if (
            selectedDate.getUTCFullYear() !== year ||
            selectedDate.getUTCMonth() !== month - 1 ||
            selectedDate.getUTCDate() !== day
        ) {
            return res.status(400).json({
                message: "The proposed date is not a valid calendar date."
            });
        }

        const [startHour, startMinute] = startTime.split(":").map(Number);
        const [endHour, endMinute] = endTime.split(":").map(Number);

        if (
            startHour > 23 || startMinute > 59 ||
            endHour > 23 || endMinute > 59 ||
            endTime <= startTime
        ) {
            return res.status(400).json({
                message: "The proposed appointment times are invalid."
            });
        }

        const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kuala_Lumpur",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date());

        if (date <= today) {
            return res.status(400).json({
                message: "The proposed appointment date must be in the future."
            });
        }

        const dayOfWeek = selectedDate.getUTCDay();

        if (dayOfWeek === 0) {
            return res.status(400).json({
                message: "The clinic is closed on Sundays."
            });
        }

        const openingTime = dayOfWeek === 6 ? "09:00" : "08:30";
        const closingTime = dayOfWeek === 6 ? "13:00" : "17:00";

        if (startTime < openingTime || endTime > closingTime) {
            return res.status(400).json({
                message: dayOfWeek === 6
                    ? "Saturday appointments must be between 9:00 AM and 1:00 PM."
                    : "Weekday appointments must be between 8:30 AM and 5:00 PM."
            });
        }

        const overlappingAppointment = db.prepare(`
            SELECT appointment_id, start_time, end_time
            FROM Appointment
            WHERE appointment_date = ?
                AND appointment_type = ?
                AND status = 'Confirmed'
                AND appointment_id != ?
                AND start_time < ?
                AND end_time > ?
            LIMIT 1
        `).get(
            date,
            request.appointment_type,
            request.appointment_id,
            endTime,
            startTime
        );

        if (overlappingAppointment) {
            return res.status(409).json({
                message: `Cannot approve this request. Another appointment of the same type is scheduled from ${overlappingAppointment.start_time} to ${overlappingAppointment.end_time}.`
            });
        }

        const approveTransaction = db.transaction(() => {
            const updatedRequest = db.prepare(`
                UPDATE Reschedule_Request
                SET status = 'Approved'
                WHERE reschedule_request_id = ?
                    AND status = 'Pending'
            `).run(requestId);

            if (updatedRequest.changes !== 1) {
                throw new Error("REQUEST_ALREADY_PROCESSED");
            }

            const updatedAppointment = db.prepare(`
                UPDATE Appointment
                SET appointment_date = ?,
                    start_time = ?,
                    end_time = ?
                WHERE appointment_id = ?
                    AND status = 'Confirmed'
            `).run(
                date,
                startTime,
                endTime,
                request.appointment_id
            );

            if (updatedAppointment.changes !== 1) {
                throw new Error("APPOINTMENT_NOT_UPDATED");
            }
        });

        approveTransaction();

        return res.json({
            message: "Reschedule request approved successfully."
        });

    } catch (error) {
        if (error.message === "REQUEST_ALREADY_PROCESSED") {
            return res.status(409).json({
                message: "This reschedule request has already been processed."
            });
        }

        if (error.message === "APPOINTMENT_NOT_UPDATED") {
            return res.status(409).json({
                message: "The appointment could not be updated."
            });
        }

        console.error("Error approving reschedule request:", error);

        return res.status(500).json({
            message: "An error occurred while approving the request."
        });
    }   
});


// Reject a reschedule request
app.patch("/api/staff/reschedule-requests/:requestId/reject", (req, res) => {
    try {
        const requestId = Number(req.params.requestId);

        if (!Number.isSafeInteger(requestId) || requestId <= 0) {
            return res.status(400).json({
                message: "Invalid reschedule request ID."
            });
        }

        const rejectReason =
            typeof req.body.reject_reason === "string"
                ? req.body.reject_reason.trim()
                : "";

        if (!rejectReason) {
            return res.status(400).json({
                message: "A rejection reason is required."
            });
        }
            
        if (rejectReason.length > 500) {
            return res.status(400).json({
                message: "The rejection reason cannot exceed 500 characters."
            });
        }

        const updateResult = db.prepare(`
            UPDATE Reschedule_Request
            SET status = 'Rejected',
                reject_reason = ?
            WHERE reschedule_request_id = ?
                AND status = 'Pending'
        `).run(
            rejectReason || null,
            requestId
        );

        if (updateResult.changes === 0) {
            const request = db.prepare(`
                SELECT reschedule_request_id, status
                FROM Reschedule_Request
                WHERE reschedule_request_id = ?
            `).get(requestId);

            if (!request) {
                return res.status(404).json({
                    message: "Reschedule request not found."
                });
            }

            return res.status(409).json({
                message: "This reschedule request has already been processed."
            });
        }

        return res.json({
            message: "Reschedule request rejected successfully."
        });

    } catch (error) {
        console.error("Error rejecting reschedule request:", error);

        return res.status(500).json({
            message: "An error occurred while rejecting the request."
        });
    }
});


app.listen(PORT, () => {
    console.log(`CareTrack server running at http://localhost:${PORT}`);
    console.log("SQLite database connected!");
});