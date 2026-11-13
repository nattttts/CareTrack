
PRAGMA foreign_keys = ON;

-- =========================================
-- 1. USER
-- Stores login credentials and account roles
-- =========================================
CREATE TABLE IF NOT EXISTS User (
    user_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL
        CHECK (role IN ('pregnant_woman', 'child', 'staff', 'admin')),
    account_status TEXT NOT NULL DEFAULT 'Active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    password_set INTEGER NOT NULL DEFAULT 0
        CHECK (password_set IN (0, 1))
);


-- =========================================
-- 2. STAFF
-- Healthcare staff profile
-- =========================================
CREATE TABLE IF NOT EXISTS Staff (
    staff_id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    phone_no TEXT NOT NULL,

    FOREIGN KEY (user_id)
        REFERENCES User(user_id)
        ON UPDATE CASCADE
);

-- =========================================
-- 3. USER INVITATION TOKEN
-- Stores tokens used to activate new accounts
-- =========================================
CREATE TABLE IF NOT EXISTS Invitation_Token (
    invitation_id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    revoked_at TEXT,

    FOREIGN KEY (user_id)
        REFERENCES User(user_id)
        ON UPDATE CASCADE
);

-- =========================================
-- 4. PASSWORD RESET TOKEN
-- Stores tokens used to reset existing passwords
-- =========================================
CREATE TABLE IF NOT EXISTS Password_Reset_Token (
    reset_id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    revoked_at TEXT,

    FOREIGN KEY (user_id)
        REFERENCES User(user_id)
        ON UPDATE CASCADE
);

-- =========================================
-- 5. PREGNANT WOMAN
-- Pregnant woman profile
-- =========================================
CREATE TABLE IF NOT EXISTS Pregnant_Woman (
    pregnant_woman_id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    date_of_birth TEXT NOT NULL,
    address TEXT NOT NULL,
    phone_no TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    contact_phone_no TEXT NOT NULL,

    FOREIGN KEY (user_id)
        REFERENCES User(user_id)
        ON UPDATE CASCADE
);

-- =========================================
-- 6. CHILD
-- =========================================
CREATE TABLE IF NOT EXISTS Child (
    child_id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    date_of_birth TEXT NOT NULL,
    gender TEXT NOT NULL,
    
    guardian_name TEXT NOT NULL,
    phone_no TEXT NOT NULL,

    FOREIGN KEY (user_id)
        REFERENCES User(user_id)
        ON UPDATE CASCADE
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
-- 8. APPOINTMENT
-- =========================================
CREATE TABLE IF NOT EXISTS Appointment (
    appointment_id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL,
    child_vaccination_id INTEGER,
    appointment_type TEXT NOT NULL 
        CHECK (
            appointment_type IN (
                'Maternal Follow-up',
                'Child Vaccination'
            )
        ),
    appointment_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Confirmed'
        CHECK (
            status IN (
                'Confirmed',
                'Completed',
                'Missed',
                'Rebooked'
            )
        ),

    FOREIGN KEY (user_id)
        REFERENCES User(user_id)
        ON UPDATE CASCADE
    
    FOREIGN KEY (child_vaccination_id)
        REFERENCES Child_Vaccination(child_vaccination_id)
);

-- =========================================
-- 9. RESCHEDULE REQUEST
-- Tracks reschedule requests by patients
-- =========================================
CREATE TABLE IF NOT EXISTS Reschedule_Request (
    reschedule_request_id INTEGER PRIMARY KEY,
    appointment_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending'
        CHECK (
            status IN ('Pending', 'Approved')
        ), 
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (appointment_id)
        REFERENCES Appointment(appointment_id)
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
    due_date TEXT NOT NULL,
    dose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Upcoming'
        CHECK (
            status IN ('Upcoming', 'Completed')
        ), 

    FOREIGN KEY (user_id)
        REFERENCES User(user_id)
        ON UPDATE CASCADE,

    FOREIGN KEY (vaccination_id)
        REFERENCES Vaccination(vaccination_id)
);


-- =========================================
-- 11. NOTIFICATION
-- Each user can receive multiple notifications.
-- =========================================
CREATE TABLE IF NOT EXISTS Notification (
    notification_id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    note TEXT,

    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0
        CHECK (is_read IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES User(user_id)
        ON UPDATE CASCADE
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
    waiting_since TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    called_at TEXT,
    status TEXT NOT NULL DEFAULT 'Waiting'
        CHECK (
            status IN (
                'Waiting',
                'Called',
                'Completed',
                'Skipped'
            )
        ),

    FOREIGN KEY (appointment_id)
        REFERENCES Appointment(appointment_id),

    CHECK (queue_number > 0)
);

/* =====================================================
13. MATERNAL RECORDS TABLE
===================================================== */
CREATE TABLE IF NOT EXISTS Maternal_Record (
    maternal_record_id INTEGER PRIMARY KEY,
    appointment_id INTEGER NOT NULL UNIQUE,
    pregnant_woman_id INTEGER NOT NULL,
    visit_number INTEGER NOT NULL,
    visit_date TEXT NOT NULL,
    height REAL,
    weight REAL,
    doctor_remarks TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    systolic INTEGER,
    diastolic INTEGER,
    urine_test TEXT,
    blood_test TEXT,

    FOREIGN KEY (pregnant_woman_id)
        REFERENCES Pregnant_Woman(pregnant_woman_id)
        ON DELETE CASCADE,

    FOREIGN KEY (appointment_id)
        REFERENCES Appointment(appointment_id),

    UNIQUE (pregnant_woman_id, visit_number),

    CHECK (visit_number > 0),
    CHECK (height IS NULL OR (height > 0 AND height <= 300)),
    CHECK (weight IS NULL OR (weight > 0 AND weight <= 500))
);
