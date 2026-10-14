
const db = require("./database");

// Generate dates relative to today, using local calendar dates.
function dateOffset(days) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// Refuse to seed a database that already has user records.
// This prevents accidental duplicate or conflicting sample data.
const userCount = db.prepare(
    "SELECT COUNT(*) AS count FROM User"
).get().count;

if (userCount > 0) {
    console.log("Sample data was not inserted.");
    console.log("The database already contains user records.");
    console.log("No data was changed.");
    db.close();
    process.exit(0);
}

const today = dateOffset(0);
const past30 = dateOffset(-30);
const past20 = dateOffset(-20);
const past10 = dateOffset(-10);
const past5 = dateOffset(-5);
const tomorrow = dateOffset(1);
const future2 = dateOffset(2);
const future3 = dateOffset(3);
const future7 = dateOffset(7);

const insert = {
    user: db.prepare(`
        INSERT INTO User
            (user_id, full_name, email, password_hash, role, account_status)
        VALUES (?, ?, ?, ?, ?, ?)
    `),

    staff: db.prepare(`
        INSERT INTO Staff
            (staff_id, user_id, position, phone_no)
        VALUES (?, ?, ?, ?)
    `),

    mother: db.prepare(`
        INSERT INTO Mother
            (mother_id, user_id, date_of_birth, address, phone_no, contact_name, relationship, contact_phone_no)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),

    child: db.prepare(`
        INSERT INTO Child
            (child_id, user_id, date_of_birth, gender, guardian_name, phone_no)
        VALUES (?, ?, ?, ?, ?, ?)
    `),

    service: db.prepare(`
        INSERT INTO Service
            (service_id, service_name, description)
        VALUES (?, ?, ?)
    `),

    vaccine: db.prepare(`
        INSERT INTO Vaccination
            (vaccination_id, vaccine_name, description, dose_quantity, booster)
        VALUES (?, ?, ?, ?, ?)
    `),

    appointment: db.prepare(`
        INSERT INTO Appointment
            (appointment_id, user_id, appointment_date, start_time, end_time, status, reschedule_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `),

    childVaccination: db.prepare(`
        INSERT INTO Child_Vaccination
            (child_vaccination_id, user_id, vaccination_id, appointment_id, due_date, dose, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `),

    notification: db.prepare(`
        INSERT INTO Notification
            (notification_id, user_id, appointment_id, child_vaccination_id, title, message, is_read)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `),

    queue: db.prepare(`
        INSERT INTO Queue_Entry
            (queue_entry_id, appointment_id, queue_number, check_in_time, status, called_at, visit_at,
             completed_at, skipped_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
};

const seed = db.transaction(() => {
    // =========================================
    // 1. USERS
    // These are fictional test accounts.
    // Replace placeholder hashes when auth is built.
    // =========================================
    const users = [
        ["1", "Admin", "admin@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "admin", "Active"],
        ["920102-07-0002", "Aisha Rahman", "staff1@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "staff", "Active"],
        ["930103-07-0004", "Tan Mei Ling", "staff2@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "staff", "Active"],
        ["940104-07-0005", "Lim Ming Chong", "staff3@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "staff", "Inactive"],
        ["950105-07-0006", "Amelie Chong", "mother1@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "mother", "Active"],
        ["960106-07-0008", "Beatrice Chew", "mother2@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "mother"],
        ["970107-07-0010", "Nurul binti Rashid", "mother3@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "mother", "Inactive"],
        ["260901-07-0002", "Jennie Low", "mother1@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "child", "Active"],
        ["260902-07-0003", "Tan Yi Xing", "mother2@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "child", "Active"],
        ["260903-07-0007", "Ali bin Ahmad", "mother3@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "child", "Active"]
    ];

    users.forEach(row => insert.user.run(...row));

    // =========================================
    // 2. STAFF
    // =========================================
    const staff = [
        [1, "920102-07-0002",  "Doctor", "012-3001001"],
        [2, "930103-07-0004",  "Nurse", "012-3001002",],
        [3, "940104-07-0005",  "Doctor", "012-3001003"]
    ];

    staff.forEach(row => insert.staff.run(...row));

    // =========================================
    // 3. MOTHERS
    // =========================================
    const mothers = [
        [1, "950105-07-0006", "1995-01-05", "10 Example Street, Penang", "012-4001001"],
        [2, "960106-07-0008", "1996-01-06", "20 Sample Avenue, Penang", "012-4001002"],
        [3, "970107-07-0010", "1997-01-07", "30 Demo Road, Penang", "012-4001003"]
    ];

    mothers.forEach(row => insert.mother.run(...row));

    // =========================================
    // 5. CHILDREN
    // =========================================
    const children = [
        [1, "260901-07-0002", "2026-09-01", "Female", "Amelie Chong", "012-4001001"],
        [2, "260902-07-0003", "2026-09-02", "Female", "Beatrice Chew", "012-4001002"],
        [3, "260903-07-0007", "2026-09-03", "Female", "Nurul binti Rashid", "012-4001003"]
    ];

    children.forEach(row => insert.child.run(...row));

    // =========================================
    // 6. SERVICES
    // =========================================
    const services = [
        [1, "Maternal Follow-up", "Maternal healthcare follow-up appointments"],
        [2, "Child Vaccination", "Childhood vaccination appointments"]
    ];

    services.forEach(row => insert.service.run(...row));

    // =========================================
    // 7. VACCINATION CATALOGUE
    // =========================================
    const vaccines = [
        [1, "DTaP-IPV-HepB-Hib", "Diphteria-Tetanus-Pertussis-Polio-Hepatitis B-Haemophilus influenzae type B", 3, 1],
        [2, "MMR", "Measles, Mumps, Rubella", 2, 0],
        [3, "PCV", "Pneumococcal", 2, 1]
    ];

    vaccines.forEach(row => insert.vaccine.run(...row));

    // =========================================
    // 8. APPOINTMENT SLOTS
    // Slots 1-7 are booked.
    // Slots 8-9 are available.
    // =========================================
    const slots = [
        [1, 1, 1, past20, "09:00", "09:30", "Booked"],
        [2, 1, 2, past10, "10:00", "10:30", "Booked"],
        [3, 1, 1, today, "14:00", "14:30", "Booked"],
        [4, 1, 2, future2, "09:00", "09:30", "Booked"],
        [5, 2, 1, past5, "10:00", "10:30", "Booked"],
        [6, 2, 2, future3, "11:00", "11:30", "Booked"],
        [7, 2, 1, past30, "11:00", "11:30", "Booked"],
        [8, 1, 1, tomorrow, "10:00", "10:30", "Available"],
        [9, 2, 2, future7, "14:00", "14:30", "Available"]
    ];

    // =========================================
    // 9. APPOINTMENTS
    // reschedule_status: None / Pending / Approved / Rejected
    // =========================================
    const appointments = [
        [1, "950105-07-0006", "2026-10-14", "09:00", "09:30", "Completed", "None"],
        [2, 2, 2, null, "Missed", "None"],
        [3, 3, 1, null, "Confirmed", "Pending"],
        [4, 4, 1, 1, "Confirmed", "None"],
        [5, 5, 2, 2, "Missed", "None"],
        [6, 6, 1, 1, "Confirmed", "None"],
        [7, 7, 1, 1, "Completed", "None"]
    ];

    appointments.forEach(row => insert.appointment.run(...row));

    // =========================================
    // 10. CHILD VACCINATION RECORDS
    // =========================================
    const childVaccinations = [
        [1, 2, 1, 5, past5, "Dose 1", "Upcoming"],
        [2, 1, 2, 6, future3, "Dose 2", "Upcoming"],
        [3, 1, 1, 7, past30, "Dose 1", "Completed"],
        [4, 3, 3, null, future7, "Dose 2", "Upcoming"]
    ];

    childVaccinations.forEach(row =>
        insert.childVaccination.run(...row)
    );

    // =========================================
    // 11. NOTIFICATIONS
    // Both linked records can be provided for vaccination
    // appointment notifications.
    // is_read: 0 = unread, 1 = read.
    // =========================================
    const notifications = [
        [1, 5, 3, null, "Reschedule request received",
            "Your reschedule request has been submitted.",
            "maternal_appointment", 0],

        [2, 5, 4, 2, "Vaccination appointment confirmed",
            "Your child's vaccination appointment is confirmed.",
            "child_vaccination", 0],

        [3, 6, 2, null, "Missed appointment",
            "Your maternal follow-up appointment was missed.",
            "maternal_appointment", 1],

        [4, 6, 5, 1, "Vaccination appointment missed",
            "The scheduled vaccination appointment was missed.",
            "child_vaccination", 0]
    ];

    notifications.forEach(row => insert.notification.run(...row));

    // =========================================
    // 12. QUEUE ENTRIES
    // Only appointments that have checked in.
    // =========================================
    const queueEntries = [
        [1, 1, 1, 
            past20 + " 08:55:00", 
            "Completed",
            past20 + " 09:00:00",
            past20 + " 09:05:00",
            past20 + " 09:25:00",
            null],

        [2, 3, 1, 
            today + " 13:45:00", 
            "Waiting",
            today + " 13:45:00",
            null, null, null],

        [3, 4, 2, 
            today + " 13:45:00", 
            "Called",
            today + " 13:50:00",
            today + " 14:00:00",
            null, null]
    ];

    queueEntries.forEach(row => insert.queue.run(...row));
});

try {
    seed();

    console.log("Sample data inserted successfully!");
    console.log("Admin: admin@gmail.com");
    console.log("Staff: staff1@gmail.com, staff2@gmail.com, staff3@gmail.com");
    console.log("Mothers: mother1@gmail.com, mother2@gmail.com, mother3@gmail.com");
    console.log("These accounts do not have usable passwords yet.");

    const counts = db.prepare(`
        SELECT
            (SELECT COUNT(*) FROM User) AS users,
            (SELECT COUNT(*) FROM Staff) AS staff,
            (SELECT COUNT(*) FROM Mother) AS mothers,
            (SELECT COUNT(*) FROM Appointment) AS appointments,
            (SELECT COUNT(*) FROM Notification) AS notifications
    `).get();

    console.log("\nRecord counts:", counts);

    const violations = db.pragma("foreign_key_check");

    if (violations.length === 0) {
        console.log("Foreign-key check passed!");
    } else {
        console.error("Foreign-key violations:", violations);
    }
} catch (error) {
    console.error("Failed to insert sample data.");
    console.error(error.message);
    process.exitCode = 1;
} finally {
    db.close();
}
