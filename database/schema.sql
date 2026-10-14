
PRAGMA foreign_keys = ON;

-- =========================================
-- 1. USER
-- Stores login credentials and account roles
-- =========================================
CREATE TABLE IF NOT EXISTS User (
    user_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL
        CHECK (role IN ('mother', 'child', 'staff', 'admin')),
    account_status TEXT NOT NULL DEFAULT 'Active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================
-- 2. STAFF
-- Healthcare staff profile
-- =========================================
CREATE TABLE IF NOT EXISTS Staff (
    staff_id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    position TEXT,
    phone_no TEXT NOT NULL,

    FOREIGN KEY (user_id)
        REFERENCES User(user_id)
);


-- =========================================
-- 3. MOTHER
-- Mother/patient profile
-- =========================================
CREATE TABLE IF NOT EXISTS Mother (
    mother_id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    date_of_birth TEXT NOT NULL,
    address TEXT NOT NULL,
    phone_no TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    contact_phone_no TEXT NOT NULL,

    FOREIGN KEY (user_id)
        REFERENCES User(user_id)
);

-- =========================================
-- 5. CHILD
-- =========================================
CREATE TABLE IF NOT EXISTS Child (
    child_id INTEGER PRIMARY KEY,
    date_of_birth TEXT NOT NULL,
    gender TEXT NOT NULL,
    
    guardian_name TEXT NOT NULL,
    guardian_email TEXT NOT NULL,
    phone_no TEXT NOT NULL
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
-- 9. APPOINTMENT
-- =========================================
CREATE TABLE IF NOT EXISTS Appointment (
    appointment_id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL,
    appointment_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
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

    FOREIGN KEY (user_id)
        REFERENCES User(user_id)
);


-- =========================================
-- 10. CHILD VACCINATION
-- Tracks a child's vaccine/dose and due date
-- appointment_id links to its associated booking
-- =========================================
CREATE TABLE IF NOT EXISTS Child_Vaccination (
    child_vaccination_id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL,
    vaccination_id INTEGER NOT NULL,
    appointment_id INTEGER UNIQUE,
    due_date TEXT NOT NULL,
    dose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Upcoming'
        CHECK (
            status IN ('Upcoming', 'Completed')
        ), 

    FOREIGN KEY (user_id)
        REFERENCES User(user_id),

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
    user_id TEXT NOT NULL,
    appointment_id INTEGER,
    child_vaccination_id INTEGER,

    title TEXT NOT NULL,
    message TEXT NOT NULL,
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