const path = require("path");
const express = require("express");
const cors = require("cors");
const db = require("./database");

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
                Staff.phone_no
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
app.post("/api/staff", (req, res) => {
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
        const passwordHash = "TEMP_HASH_REPLACE_BEFORE_AUTH";

        // Create both records together
        const createStaff = db.transaction(() => {
            db.prepare(`
                INSERT INTO User (
                    user_id,
                    full_name,
                    email,
                    password_hash,
                    role,
                    account_status
                )
                VALUES (?, ?, ?, ?, 'staff', 'Active')
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

            return result.lastInsertRowid;
        });

        const staffId = createStaff();

        return res.status(201).json({
            message: "Staff account created successfully.",
            staff_id: staffId
        });

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

app.listen(PORT, () => {
    console.log(`CareTrack server running at http://localhost:${PORT}`);
    console.log("SQLite database connected!");
});