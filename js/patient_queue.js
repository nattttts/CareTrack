// ================= QUEUE ELEMENTS =================
const notCheckedIn = document.getElementById("notCheckedIn");
const checkInMessage = document.getElementById("checkInMessage");
const checkInMessageIcon = document.getElementById("checkInMessageIcon");
const checkInMessageTitle = document.getElementById("checkInMessageTitle");
const checkInMessageText = document.getElementById("checkInMessageText");
const checkInButton = document.getElementById("checkInButton");
const queueStatus = document.getElementById("queueStatus");
const liveQueue = document.getElementById("liveQueue");
const queueInfo = document.getElementById("queueInfo");

// Appointment details
const appointmentCard = document.getElementById("appointmentCard");
const appointmentType = document.getElementById("appointmentType");
const patientName = document.getElementById("patientName");
const appointmentDate = document.getElementById("appointmentDate");
const appointmentTime = document.getElementById("appointmentTime");
const appointmentStatusText = document.getElementById("appointmentStatusText");
const expectedCheckInTime = document.getElementById("expectedCheckInTime");

// Queue details
const queueStatusBadge = document.getElementById("queueStatusBadge");
const queueNumber = document.getElementById("queueNumber");
const queuePosition = document.getElementById("queuePosition");
const waitingTime = document.getElementById("waitingTime");
const queueAppointmentTime = document.getElementById("queueAppointmentTime");

// Live queue
const currentlyServing = document.getElementById("currentlyServing");
const queueList = document.getElementById("queueList");

// Store the current appointment ID
let currentAppointmentId = null;
let currentAppointment = null;
let checkInTimer = null;
let waitingTimeTimer = null;

// ================= CHECK-IN TIME VALIDATION =================
function getCheckInTimeStatus(appointment) {
    const startTime = appointment.start_time?.slice(0, 5);

    if (!appointment.appointment_date || !startTime) {
        return { status: "invalid" };
    }

    // Interpret the appointment time as Malaysia time (UTC+8).
    const appointmentStart = Date.parse(
        `${appointment.appointment_date}T${startTime}:00+08:00`
    );

    if (Number.isNaN(appointmentStart)) {
        return { status: "invalid" };
    }

    const checkInOpensAt = appointmentStart - 15 * 60 * 1000;
    const checkInClosesAt = appointmentStart + 5 * 60 * 1000;
    const now = Date.now();

    if (now < checkInOpensAt) {
        return {
            status: "not-open",
            opensAt: checkInOpensAt
        };
    }

    if (now >= checkInClosesAt) {
        return {
            status: "missed",
            closesAt: checkInClosesAt
        };
    }

    return { status: "open" };
}

// ================= UPDATE CHECK-IN AVAILABILITY =================
function updateCheckInAvailability(appointment) {
    const result = getCheckInTimeStatus(appointment);

    if (result.status === "invalid") {
        checkInButton.disabled = true;

        showMessage(
            "Unable to verify appointment time",
            "Please refresh the page or contact clinic staff."
        );

        return;
    }

    if (result.status === "not-open") {
        checkInButton.disabled = true;

        const opensAt = new Date(result.opensAt).toLocaleTimeString(
            "en-MY",
            {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Kuala_Lumpur"
            }
        );

        showMessage(
            "Check-in not open yet",
            `Check-in opens at ${opensAt}. Please try again then.`
        );

        return;
    }

    if (result.status === "missed") {
        checkInButton.disabled = true;
        notCheckedIn.hidden = true;
        appointmentStatusText.textContent = "Missed";

        showMessage(
            "You Missed Your Appointment",
            "The check-in period has ended. Please contact clinic staff for assistance."
        );

        return;
    }

    // The patient is within the allowed check-in period.
    checkInButton.disabled = false;

    if (checkInMessage) {
        checkInMessage.hidden = true;
    }
}

// ================= LOAD TODAY'S APPOINTMENT =================
async function loadTodayAppointment() {
    try {
        const response = await fetch("/api/patient/queue");

        if (response.status === 401 || response.status === 403) {
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error("Failed to load today's appointment.");
        }

        const appointments = await response.json();

        if (!Array.isArray(appointments) || appointments.length === 0) {
            showNoAppointment();
            return;
        }

        // Use the first appointment for the current single-card layout.
        const appointment = appointments[0];

        currentAppointmentId = appointment.appointment_id;
        currentAppointment = appointment;
        displayAppointment(appointment);

        // Show the relevant section based on check-in status.
        if (appointment.queue_entry_id) {
            // Stop checking the time after successful check-in.
            if (checkInTimer) {
                clearInterval(checkInTimer);
                checkInTimer = null;
            }

            displayQueueStatus(appointment);

            if (checkInMessage) {
                checkInMessage.hidden = true;
            }
        } else {
            showCheckInSection();
        }

    } catch (error) {
        console.error("Error loading appointment:", error);
        showMessage(
            "Unable to load appointment",
            "Unable to load today's appointment. Please refresh the page and try again."
        );
    }
}

// ================= DISPLAY APPOINTMENT =================
function displayAppointment(appointment) {
    appointmentType.textContent = appointment.appointment_type;
    appointmentCard.hidden = false;

    // The API does not currently return the patient's full name separately.
    // Load it from /api/me if needed in a future improvement.
    if (patientName) {
        patientName.textContent = "";
    }

    appointmentDate.textContent = formatDate(appointment.appointment_date);

    appointmentTime.textContent =
        `${formatTime(appointment.start_time)} - ${formatTime(appointment.end_time)}`;

    // Calculate expected check-in time (15 minutes before appointment).
    if (expectedCheckInTime && appointment.start_time) {
        const [hours, minutes] = appointment.start_time
            .split(":")
            .map(Number);

        const appointmentMinutes = hours * 60 + minutes;
        const checkInMinutes = appointmentMinutes - 15;

        // Handle appointments shortly after midnight.
        const adjustedMinutes =
            ((checkInMinutes % 1440) + 1440) % 1440;

        const checkInHours = Math.floor(adjustedMinutes / 60);
        const checkInMinute = adjustedMinutes % 60;

        const checkInTime = 
            `${String(checkInHours).padStart(2, "0")}:${String(checkInMinute).padStart(2, "0")}`;

        expectedCheckInTime.textContent = formatTime(checkInTime);
    }

    appointmentStatusText.textContent = appointment.appointment_status;
}

// ================= SHOW CHECK-IN SECTION =================
function showCheckInSection() {
    notCheckedIn.hidden = false;
    checkInMessage.hidden = true;
    queueStatus.hidden = true;
    queueInfo.hidden = true;
    liveQueue.hidden = true;

    // Update the button based on the appointment time.
    if (currentAppointment) {
        updateCheckInAvailability(currentAppointment);

        // Recheck periodically so the button updates without refreshing.
        if (checkInTimer) {
            clearInterval(checkInTimer);
        }

        checkInTimer = setInterval(() => {
            if (currentAppointment) {
                updateCheckInAvailability(currentAppointment);
            }
        }, 10000);
    } else {
        checkInButton.disabled = true;
    }
}

// ================= CHECK IN =================
if (checkInButton) {
    checkInButton.addEventListener("click", async function () {
        if (!currentAppointmentId) {
            showMessage(
                "No appointment available",
                "There is no appointment available for check-in."
            );
            return;
        }

        checkInButton.disabled = true;
        checkInButton.textContent = "Checking in...";

        try {
            const response = await fetch(
                `/api/patient/queue/${currentAppointmentId}/check-in`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Check-in failed.");
            } 

            // Reload the appointment to get the latest queue position.
            await loadTodayAppointment();

            // Show the successful check-in message.
            showMessage("Check-in successful!", result.message, true);

        } catch (error) {
            console.error("Check-in error:", error);
            showMessage("Check-in failed", error.message || "Please try again.");

            if (currentAppointment) {
                updateCheckInAvailability(currentAppointment);
            }

        } finally {
            checkInButton.textContent = "Check In";
        }
    });
}

// ================= DISPLAY QUEUE STATUS =================
function displayQueueStatus(appointment) {
    notCheckedIn.hidden = true;  
    queueStatus.hidden = false;
    queueInfo.hidden = false;

    // Keep the live queue hidden until its API is implemented.
    liveQueue.hidden = true;

    queueNumber.textContent = appointment.queue_number ?? "—";

    queueAppointmentTime.textContent =
        `${formatTime(appointment.start_time)} - ${formatTime(appointment.end_time)}`;

    const status = appointment.queue_status || "Waiting";

    queueStatusBadge.textContent = status;
    queueStatusBadge.className = `queue-status ${getQueueStatusClass(status)}`;

    if (appointment.queue_position != null) {
        queuePosition.textContent = appointment.queue_position;
    } else {
        queuePosition.textContent = "—";
    }

    // Update the estimated waiting time.
    updateWaitingTime(appointment);

    // Automatically update the waiting time every 30 seconds.
    if (waitingTimeTimer) {
        clearInterval(waitingTimeTimer);
    }

    waitingTimeTimer = setInterval(() => {
        if (currentAppointment) {
            updateWaitingTime(currentAppointment);
        }
    }, 30000);

    checkInButton.disabled = true;
}


 // ================= UPDATE ESTIMATED WAITING TIME =================
function updateWaitingTime(appointment) {
    if (!appointment.appointment_date || !appointment.start_time) {
        waitingTime.textContent = "Not available";
        return;
    }

    // Interpret the appointment start time as Malaysia time (UTC+8).
    const startTime = appointment.start_time.slice(0, 5);

    const appointmentStart = Date.parse(
        `${appointment.appointment_date}T${startTime}:00+08:00`
    );

    if (Number.isNaN(appointmentStart)) {
        waitingTime.textContent = "Not available";
        return;
    }

    // Calculate the time remaining until the appointment starts.
    const remainingTime = appointmentStart - Date.now();

    if (remainingTime <= 0) {
        waitingTime.textContent = "Appointment time has arrived";
        return;
    }

    // Round up so that a partial minute is not displayed as zero.
    const remainingMinutes = Math.ceil(
        remainingTime / (60 * 1000)
    );

    if (remainingMinutes === 1) {
        waitingTime.textContent = "1 minute";
    } else {
        waitingTime.textContent = `${remainingMinutes} minutes`;
    }
}

// ================= GET QUEUE STATUS CLASS =================
function getQueueStatusClass(status) {
    switch (status) {
        case "Waiting":
            return "waiting";

        case "Called":
            return "called";

        case "In Progress":
            return "in-progress";

        case "Completed":
            return "completed";

        case "Skipped":
            return "skipped";

        default:
            return "waiting";
    }
}

// ================= SHOW NO APPOINTMENT =================
function showNoAppointment() {
    if (checkInTimer) {
        clearInterval(checkInTimer);
        checkInTimer = null;
    }

    if (waitingTimeTimer) {
        clearInterval(waitingTimeTimer);
        waitingTimeTimer = null;
    }

    currentAppointment = null;
    currentAppointmentId = null;

    appointmentCard.hidden = true;
    notCheckedIn.hidden = true;
    queueStatus.hidden = true;
    queueInfo.hidden = true;
    liveQueue.hidden = true;

    showMessage("No appointment today", "No appointment scheduled for today.");
}

// ================= SHOW MESSAGE =================
function showMessage(title, message, isSuccess = false) {
    if (checkInMessageTitle) {
        checkInMessageTitle.textContent = title;
    }

    if (checkInMessageText) {
        checkInMessageText.textContent = message;
    }

    if (checkInMessageIcon) {
        checkInMessageIcon.hidden = !isSuccess;
    }

    if (checkInMessage) {
        checkInMessage.hidden = false;
    }
}

// ================= FORMAT DATE =================
function formatDate(dateString) {
    if (!dateString) return "—";

    const date = new Date(`${dateString}T00:00:00`);

    return date.toLocaleDateString("en-MY", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

// ================= FORMAT TIME =================
function formatTime(timeString) {
    if (!timeString) return "—";

    const parts = timeString.split(":");
    const hours = Number(parts[0]);
    const minutes = parts[1];

    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;

    return `${displayHours}:${minutes} ${period}`;
}

// ================= INITIALISE QUEUE PAGE =================
loadTodayAppointment();