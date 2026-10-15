
const db = require("./database");

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
        ["960106-07-0008", "Beatrice Chew", "mother2@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "mother", "Active"],
        ["970107-07-0010", "Nurul binti Rashid", "mother3@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "mother", "Inactive"],
        ["980108-07-0012", "Jennie Lim", "mother4@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "mother", "Inactive"],
        ["260801-07-0007", "Ali bin Ahmad", "mother3@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "child", "Active"],
        ["260902-07-0003", "Tan Yi Xing", "mother4@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "child", "Active"]
    ];

    users.forEach(row => insert.user.run(...row));

    // =========================================
    // 2. STAFF
    // =========================================
    const staff = [
        [1, "920102-07-0002", "Doctor", "012-3001001"],
        [2, "930103-07-0004", "Nurse", "012-3001002",],
        [3, "940104-07-0005", "Doctor", "012-3001003"]
    ];

    staff.forEach(row => insert.staff.run(...row));

    // =========================================
    // 3. MOTHERS
    // =========================================
    const mothers = [
        [1, "970107-07-0010", "1997-01-07", "30 Demo Road, Penang", "012-4001003", "Ahmad bin Mohammad", "Husband", "012-5001001"],
        [2, "980108-07-0012", "1998-01-08", "40 Red Street, Penang", "012-4001004", "Miguel Liew", "Husband", "012-5001002"],
        [3, "950105-07-0006", "1995-01-05", "10 Example Street, Penang", "012-4001001", "Chew Jia Hao", "Husband", "012-5001003"],
        [4, "960106-07-0008", "1996-01-06", "20 Sample Avenue, Penang", "012-4001002", "Aaron Lim", "Husband", "012-5001004"]
    ];

    mothers.forEach(row => insert.mother.run(...row));

    // =========================================
    // 5. CHILDREN
    // =========================================
    const children = [
        [1, "260801-07-0007", "2026-08-01", "Male", "Nurul binti Rashid", "012-4001001"],
        [2, "260902-07-0003", "2026-09-02", "Male", "Jennie Lim", "012-4001002"]
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
    // 9. APPOINTMENTS
    // reschedule_status: None / Pending / Approved / Rejected
    // =========================================
    const appointments = [
        [1, "970107-07-0010", "2026-07-20", "11:00", "11:30", "Completed", "None"],
        [2, "980108-07-0012", "2026-08-20", "10:30", "11:00", "Completed", "None"],
        [3, "260801-07-0007", "2026-10-01", "10:00", "10:30", "Completed", "None"],
        [4, "950105-07-0006", "2026-10-13", "09:00", "09:30", "Completed", "Approved"],
        [5, "950105-07-0006", "2026-11-13", "09:00", "09:30", "Confirmed", "Pending"],
        [6, "960106-07-0008", "2026-10-13", "10:00", "10:30", "Missed", "None"],
        [7, "960106-07-0008", "2026-10-20", "10:00", "10:30", "Confirmed", "None"],
        [8, "260801-07-0007", "2026-11-01", "10:00", "10:30", "Confirmed", "None"],
        [9, "260902-07-0003", "2026-11-01", "09:00", "09:30", "Confirmed", "Pending"]
    ];

    appointments.forEach(row => insert.appointment.run(...row));

    // =========================================
    // 10. CHILD VACCINATION RECORDS
    // =========================================
    const childVaccinations = [
        [1, "260801-07-0007", 1, 3, "2026-10-01", "Dose 1", "Completed"],
        [2, "260801-07-0007", 1, 8, "2026-11-01", "Dose 2", "Upcoming"],
        [3, "260902-07-0003", 1, 9, "2026-11-01", "Dose 1", "Upcoming"]
    ];

    childVaccinations.forEach(row => insert.childVaccination.run(...row));

    // =========================================
    // 11. NOTIFICATIONS
    // Both linked records can be provided for vaccination
    // appointment notifications.
    // is_read: 0 = unread, 1 = read.
    // =========================================
    const notifications = [
        [1, "970107-07-0010", 1, null, "Appointment Scheduled",
            "Your next appointment has been scheduled on 20 July 2026 at 11:00.", 1],

        [2, "980108-07-0012", 2, null, "Appointment Scheduled",
            "Your next appointment has been scheduled on 20 August 2026 at 10:30.", 1],

        [3, "950105-07-0006", 6, null, "Appointment Scheduled",
            "Your next appointment has been scheduled on 13 October 2026 at 09:00.", 0],

        [4, "260801-07-0007", 3, 1, "Vaccination Appointment Scheduled",
            "Your next vaccination appointment has been scheduled on 1 October 2026", 1],

        [5, "950105-07-0006", 4, null, "Appointment Scheduled",
            "Your next appointment has been scheduled on 12 October 2026 at 09:00.", 1],
        
        [6, "950105-07-0006", 4, null, "Appointment Successfully Rescheduled",
            "Your appointment has been rescheduled to 13 October 2026 at 09:00.", 1],
        
        [7, "950105-07-0006", 5, null, "Appointment Scheduled",
            "Your next appointment has been scheduled on 13 November 2026 at 09:00.", 0],

        [8, "960106-07-0008", 6, null, "Missed Appointment",
            "Your appointment that was scheduled on 13 October 2026 was missed.", 1],
        
        [9, "960106-07-0008", 7, null, "Appointment Scheduled",
            "Your next appointment has been scheduled on 20 October 2026", 0],
        
        [10, "260801-07-0007", 8, 2, "Vaccination Appointment Scheduled",
            "Your next vaccination appointment has been scheduled on 1 November 2026", 0],

        [11, "260902-07-0003", 9, 3, "Vaccination Appointment Scheduled",
            "Your next vaccination appointment has been scheduled on 1 November 2026", 0]
    ];

    notifications.forEach(row => insert.notification.run(...row));

    // =========================================
    // 12. QUEUE ENTRIES
    // Only appointments that have checked in.
    // =========================================
    const queueEntries = [
        [1, 1, 3, "10:50:00", "Completed", "11:00:00", "11:01:00", "11:25:00", null],
        [2, 2, 2, "10:20:00", "Completed", "10:30:00", "10:31:00", "10:58:00", null],
        [3, 3, 1, "09:50:00", "Completed", "10:00:00", "10:01:00", "10:28:00", null],
        [4, 4, 1, "08:50:00", "Completed", "09:00:00", "09:01:00", "09:28:00", null]
    ];

    queueEntries.forEach(row => insert.queue.run(...row));
});

try {
    seed();

    console.log("Sample data inserted successfully!");
    console.log("Admin: admin@gmail.com");
    console.log("Staff: staff1@gmail.com, staff2@gmail.com, staff3@gmail.com");
    console.log("Mothers: mother1@gmail.com, mother2@gmail.com, mother3@gmail.com, mother4@gmail.com");
    console.log("Children: mother3@gmail.com, mother4@gmail.com");
    console.log("These accounts do not have usable passwords yet.");

    const counts = db.prepare(`
        SELECT
            (SELECT COUNT(*) FROM User) AS users,
            (SELECT COUNT(*) FROM Staff) AS staff,
            (SELECT COUNT(*) FROM Mother) AS mothers,
            (SELECT COUNT(*) FROM Child) AS children,
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
