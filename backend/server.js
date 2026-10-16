const express = require("express");
const cors = require("cors");
const db = require("./database");

const app = express();
app.use(cors());
app.use(express.json());
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

app.listen(PORT, () => {
    console.log(`CareTrack server running at http://localhost:${PORT}`);
    console.log("SQLite database connected!");
});