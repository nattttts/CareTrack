
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
            (user_id, email, password_hash, role)
        VALUES (?, ?, ?, ?)
    `),

    staff: db.prepare(`
        INSERT INTO Staff
            (staff_id, user_id, full_name, position,
             phone_no, account_status)
        VALUES (?, ?, ?, ?, ?, ?)
    `),

    mother: db.prepare(`
        INSERT INTO Mother
            (mother_id, user_id, full_name, ic_number,
             date_of_birth, phone_no, address)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `),

    contact: db.prepare(`
        INSERT INTO Emergency_Contact
            (contact_id, mother_id, name, relationship, phone_no)
        VALUES (?, ?, ?, ?, ?)
    `),

    child: db.prepare(`
        INSERT INTO Child
            (child_id, mother_id, full_name, mykid_number,
             date_of_birth, gender)
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

    slot: db.prepare(`
        INSERT INTO Appointment_Slot
            (slot_id, service_id, staff_id, appointment_date,
             start_time, end_time, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `),

    appointment: db.prepare(`
        INSERT INTO Appointment
            (appointment_id, slot_id, mother_id, child_id,
             status, reschedule_status)
        VALUES (?, ?, ?, ?, ?, ?)
    `),

    childVaccination: db.prepare(`
        INSERT INTO Child_Vaccination
            (child_vaccination_id, child_id, vaccination_id,
             appointment_id, due_date, dose, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `),

    notification: db.prepare(`
        INSERT INTO Notification
            (notification_id, user_id, appointment_id,
             child_vaccination_id, title, message,
             notification_type, is_read)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),

    queue: db.prepare(`
        INSERT INTO Queue_Entry
            (queue_entry_id, appointment_id, queue_number, 
             check_in_time, status, called_at, visit_at,
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
        [1, "admin@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "admin"],
        [2, "staff1@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "staff"],
        [3, "staff2@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "staff"],
        [4, "staff3@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "staff"],
        [5, "mother1@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "mother"],
        [6, "mother2@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "mother"],
        [7, "mother3@gmail.com", "TEMP_HASH_REPLACE_BEFORE_AUTH", "mother"]
    ];

    users.forEach(row => insert.user.run(...row));

    // =========================================
    // 2. STAFF
    // =========================================
    const staff = [
        [1, 2, "Aisha Rahman", "Doctor", "012-3001001", "Active"],
        [2, 3, "Mei Ling Tan", "Nurse", "012-3001002", "Active"],
        [3, 4, "Ming Chong Lim", "Doctor", "012-3001003", "Inactive"]
    ];

    staff.forEach(row => insert.staff.run(...row));

    // =========================================
    // 3. MOTHERS
    // =========================================
    const mothers = [
        [1, 5, "Sarah Lim", "TEST-MY-0001", "1998-04-12",
            "012-4001001", "10 Example Street, Penang"],
        [2, 6, "Nur Aina", "TEST-MY-0002", "1996-08-23",
            "012-4001002", "20 Sample Avenue, Penang"],
        [3, 7, "Priya Kumar", "TEST-MY-0003", "2000-01-17",
            "012-4001003", "30 Demo Road, Penang"]
    ];

    mothers.forEach(row => insert.mother.run(...row));

    // =========================================
    // 4. EMERGENCY CONTACTS
    // =========================================
    const contacts = [
        [1, 1, "Alex Lim", "Spouse", "012-5001001"],
        [2, 2, "Farah Hassan", "Sibling", "012-5001002"],
        [3, 3, "Arun Kumar", "Spouse", "012-5001003"]
    ];

    contacts.forEach(row => insert.contact.run(...row));

    // =========================================
    // 5. CHILDREN
    // =========================================
    const children = [
        [1, 1, "Ethan Lim", "TEST-CHILD-0001", "2025-02-10", "Male"],
        [2, 2, "Sofia Aina", "TEST-CHILD-0002", "2024-06-15", "Female"],
        [3, 1, "Olivia Lim", "TEST-CHILD-0003", "2026-01-08", "Female"]
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
        [1, "BCG", "Bacillus Calmette-Guerin", 1, 0],
        [2, "Hepatitis B", "Hepatitis B", 1, 0],
        [3, "DTaP-IPV-HepB-Hib", "Diphteria-Tetanus-Pertussis-Polio-Hepatitis B-Haemophilus influenzae type B", 3, 1],
        [4, "MMR", "Measles, Mumps, Rubella", 2, 0],
        [5, "PCV", "Pneumococcal", 2, 1]
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

    slots.forEach(row => insert.slot.run(...row));

    // =========================================
    // 9. APPOINTMENTS
    // reschedule_status: None / Pending / Approved / Rejected
    // =========================================
    const appointments = [
        [1, 1, 1, null, "Completed", "None"],
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
