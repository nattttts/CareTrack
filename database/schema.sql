
PRAGMA foreign_keys = ON;

-- =========================================
-- 1. USER
-- Stores login credentials and account roles
-- =========================================
CREATE TABLE IF NOT EXISTS User (
    user_id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL
        CHECK (role IN ('mother', 'staff', 'admin')),
    user_image TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================
-- 2. STAFF
-- Healthcare staff profile
-- =========================================
CREATE TABLE IF NOT EXISTS Staff (
    staff_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    position TEXT,
    phone_no TEXT,
    account_status TEXT NOT NULL DEFAULT 'Active',

    FOREIGN KEY (user_id)
        REFERENCES User(user_id)
);


-- =========================================
-- 3. MOTHER
-- Mother/patient profile
-- =========================================
CREATE TABLE IF NOT EXISTS Mother (
    mother_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    ic_number TEXT NOT NULL UNIQUE,
    date_of_birth TEXT NOT NULL,
    phone_no TEXT NOT NULL,
    address TEXT NOT NULL,

    FOREIGN KEY (user_id)
        REFERENCES User(user_id)
);


-- =========================================
-- 4. EMERGENCY CONTACT
-- A mother can have one contact
-- =========================================
CREATE TABLE IF NOT EXISTS Emergency_Contact (
    contact_id INTEGER PRIMARY KEY,
    mother_id INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    phone_no TEXT NOT NULL,

    FOREIGN KEY (mother_id)
        REFERENCES Mother(mother_id)
);


-- =========================================
-- 5. CHILD
-- Children registered under a mother
-- =========================================
CREATE TABLE IF NOT EXISTS Child (
    child_id INTEGER PRIMARY KEY,
    mother_id INTEGER NOT NULL,
    full_name TEXT NOT NULL,
    mykid_number TEXT UNIQUE,
    date_of_birth TEXT NOT NULL,
    gender TEXT NOT NULL,

    FOREIGN KEY (mother_id)
        REFERENCES Mother(mother_id)
);


-- =========================================
-- 6. SERVICE
-- E.g. Maternal follow-up, Child vaccination
-- =========================================
CREATE TABLE IF NOT EXISTS Service (
    service_id INTEGER PRIMARY KEY,
    service_name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL
);


-- =========================================
-- 7. VACCINATION
-- Catalogue of available vaccines
-- =========================================
CREATE TABLE IF NOT EXISTS Vaccination (
    vaccination_id INTEGER PRIMARY KEY,
    vaccine_name TEXT NOT NULL,
    description TEXT NOT NULL,
    dose_quantity INTEGER NOT NULL,
    booster INTEGER NOT NULL
);


-- =========================================
-- 8. APPOINTMENT SLOT
-- Available time slots assigned to staff
-- =========================================
CREATE TABLE IF NOT EXISTS Appointment_Slot (
    slot_id INTEGER PRIMARY KEY,
    service_id INTEGER NOT NULL,
    staff_id INTEGER NOT NULL,
    appointment_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Available'
        CHECK (
            status IN ('Available', 'Booked')
        ), 

    FOREIGN KEY (service_id)
        REFERENCES Service(service_id),

    FOREIGN KEY (staff_id)
        REFERENCES Staff(staff_id),

    CHECK (end_time > start_time),

    UNIQUE (staff_id, appointment_date, start_time)
);


-- =========================================
-- 9. APPOINTMENT
-- A booking made against an appointment slot
-- child_id is NULL for maternal-only appointments
-- =========================================
CREATE TABLE IF NOT EXISTS Appointment (
    appointment_id INTEGER PRIMARY KEY,
    slot_id INTEGER NOT NULL UNIQUE,
    mother_id INTEGER NOT NULL,
    child_id INTEGER,
    status TEXT NOT NULL DEFAULT 'Confirmed'
        CHECK (
            status IN (
                'Confirmed',
                'Pending Reschedule',
                'Completed',
                'Missed',
                'Cancelled'
            )
        ),
    reschedule_status TEXT NOT NULL DEFAULT 'None'
    CHECK (
        reschedule_status IN (
            'None',
            'Pending',
            'Approved',
            'Rejected'
        )
    ),

    FOREIGN KEY (slot_id)
        REFERENCES Appointment_Slot(slot_id),

    FOREIGN KEY (mother_id)
        REFERENCES Mother(mother_id),

    FOREIGN KEY (child_id)
        REFERENCES Child(child_id)
);


-- =========================================
-- 10. CHILD VACCINATION
-- Tracks a child's vaccine/dose and due date
-- appointment_id links to its associated booking
-- =========================================
CREATE TABLE IF NOT EXISTS Child_Vaccination (
    child_vaccination_id INTEGER PRIMARY KEY,
    child_id INTEGER NOT NULL,
    vaccination_id INTEGER NOT NULL,
    appointment_id INTEGER UNIQUE,
    due_date TEXT NOT NULL,
    dose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Upcoming'
        CHECK (
            status IN ('Upcoming', 'Completed')
        ), 

    FOREIGN KEY (child_id)
        REFERENCES Child(child_id),

    FOREIGN KEY (vaccination_id)
        REFERENCES Vaccination(vaccination_id),

    FOREIGN KEY (appointment_id)
        REFERENCES Appointment(appointment_id)
);


-- =========================================
-- 11. NOTIFICATION
-- Each user can receive multiple notifications.
-- A notification may refer to an appointment,
-- a vaccination record, or both.
-- =========================================
CREATE TABLE IF NOT EXISTS Notification (
    notification_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    appointment_id INTEGER,
    child_vaccination_id INTEGER,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT NOT NULL
        CHECK (
            notification_type IN (
                'maternal_appointment',
                'child_vaccination'
            )
        ),
    is_read INTEGER NOT NULL DEFAULT 0
        CHECK (is_read IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES User(user_id),

    FOREIGN KEY (appointment_id)
        REFERENCES Appointment(appointment_id),

    FOREIGN KEY (child_vaccination_id)
        REFERENCES Child_Vaccination(child_vaccination_id)
);


-- =========================================
-- 12. QUEUE ENTRY
-- Created when a patient checks in
-- =========================================
CREATE TABLE IF NOT EXISTS Queue_Entry (
    queue_entry_id INTEGER PRIMARY KEY,
    appointment_id INTEGER NOT NULL UNIQUE,
    queue_number INTEGER NOT NULL,
    check_in_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'Waiting'
        CHECK (
            status IN (
                'Waiting',
                'Called',
                'In Progress',
                'Completed',
                'Skipped'
            )
        ),
    called_at TEXT,
    visit_at TEXT,
    completed_at TEXT,
    skipped_at TEXT,

    FOREIGN KEY (appointment_id)
        REFERENCES Appointment(appointment_id),

    CHECK (queue_number > 0)
);