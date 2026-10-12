const express = require("express");
const cors = require("cors");
const db = require("./database");

const app = express();
app.use(cors());
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
                Staff.full_name,
                User.email,
                Staff.position,
                Staff.account_status,
                User.created_at
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

app.listen(PORT, () => {
    console.log(`CareTrack server running at http://localhost:${PORT}`);
    console.log("SQLite database connected!");
});