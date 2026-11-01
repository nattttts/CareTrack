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

// ================= APPOINTMENT DETAILS =================
const appointmentCard = document.getElementById("appointmentCard");
const appointmentType = document.getElementById("appointmentType");
const patientName = document.getElementById("patientName");
const appointmentDate = document.getElementById("appointmentDate");
const appointmentTime = document.getElementById("appointmentTime");
const appointmentStatus = document.getElementById("appointmentStatus");
const appointmentStatusText = document.getElementById("appointmentStatusText");
const expectedCheckInTime = document.getElementById("expectedCheckInTime");
const expectedCheckInSection = document.querySelector(".expected-check-in");

// ================= QUEUE DETAILS =================
const queueStatusBadge = document.getElementById("queueStatusBadge");
const queueNumber = document.getElementById("queueNumber");
const queuePosition = document.getElementById("queuePosition");
const waitingTime = document.getElementById("waitingTime");
const queueAppointmentTime = document.getElementById("queueAppointmentTime");

// Live queue
const queueList = document.getElementById("queueList");

// Store the live queue refresh timer
let liveQueueTimer = null;

// Store the queue position refresh timer
let queuePositionTimer = null;

// Store the current appointment ID
let currentAppointmentId = null;
let currentAppointment = null;
let checkInTimer = null;
let waitingTimeTimer = null;

// ================= GET CLINIC CLOSING TIME =================
function getClinicClosingTime(appointmentDate) {
    const [year, month, day] = appointmentDate.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCDay() === 6 ? "13:00" : "17:00";
}

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
    const now = Date.now();

    // Check whether the clinic has closed.
    const currentTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kuala_Lumpur",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).format(new Date());

    const clinicClosingTime = getClinicClosingTime(
        appointment.appointment_date
    );

    if (currentTime >= clinicClosingTime) {
        return { status: "closed" };
    }

    if (now < checkInOpensAt) {
        return {
            status: "not-open",
            opensAt: checkInOpensAt
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

    if (result.status === "closed") {
        notCheckedIn.hidden = true;
        return;
    }

    if (result.status === "not-open") {
        checkInButton.disabled = true;

        if (checkInMessage) {
            checkInMessage.hidden = true;
        }

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

            if (checkInMessage && appointment.queue_status !== "Skipped") {
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

// ================= REFRESH QUEUE POSITION =================
async function refreshQueuePosition() {
    try {
        const response = await fetch("/api/patient/queue");

        if (response.status === 401 || response.status === 403) {
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error("Failed to refresh queue position.");
        }

        const appointments = await response.json();

        if (!Array.isArray(appointments)) {
            return;
        }

        // Find the current appointment.
        const appointment = appointments.find(
            item => item.appointment_id === currentAppointmentId
        );

        if (!appointment) {
            return;
        }

        // Update the current appointment data.
        currentAppointment = appointment;

        // Update appointment status.
        if (appointmentStatusText) {
            appointmentStatusText.textContent =
                appointment.appointment_status;
        }

        // Update queue information.
        if (appointment.queue_entry_id) {

            // Handle skipped queue entries.
            if (appointment.queue_status === "Skipped") {
                displayQueueStatus(appointment);
                return;
            }

            const status = appointment.queue_status;

            queueNumber.textContent = appointment.queue_number ?? "—";

            queueStatusBadge.textContent = status;
            queueStatusBadge.className =
                `queue-status ${getQueueStatusClass(status)}`;

            queuePosition.textContent =
                appointment.queue_position ?? "—";
        }

    } catch (error) {
        console.error("Error refreshing queue position:", error);
    }
}

// ================= DISPLAY APPOINTMENT =================
function displayAppointment(appointment) {
    appointmentType.textContent = appointment.appointment_type;
    appointmentCard.hidden = false;

    // The API does not currently return the patient's full name separately.
    if (patientName) {
        patientName.textContent = "";
    }

    appointmentDate.textContent = formatDate(appointment.appointment_date);

    appointmentTime.textContent =
        `${formatTime(appointment.start_time)}`;

    // Check whether the appointment has been missed.
    const isMissed = appointment.appointment_status === "Missed";

    // Display appointment status.
    if (appointmentStatusText) {
        appointmentStatusText.textContent = isMissed
            ? "Missed"
            : appointment.appointment_status;
    }

    // Change the status badge colour.
    if (appointmentStatus) {
        appointmentStatus.classList.toggle("missed", isMissed);
    }

    // Hide expected check-in time when the appointment is missed.
    if (expectedCheckInSection) {
        expectedCheckInSection.hidden = isMissed;
    }

    // Calculate expected check-in time.
    if (!isMissed && expectedCheckInTime && appointment.start_time) {
        const [hours, minutes] = appointment.start_time
            .split(":")
            .map(Number);

        const appointmentMinutes = hours * 60 + minutes;
        const checkInMinutes = appointmentMinutes - 15;

        // Handle appointments shortly after midnight.
        const adjustedMinutes = ((checkInMinutes % 1440) + 1440) % 1440;

        const checkInHours = Math.floor(adjustedMinutes / 60);
        const checkInMinute = adjustedMinutes % 60;

        const checkInTime = `${String(checkInHours).padStart(2, "0")}:${String(checkInMinute).padStart(2, "0")}`;

        expectedCheckInTime.textContent = formatTime(checkInTime);
    }
}

// ================= SHOW CHECK-IN SECTION =================
function showCheckInSection() {
    notCheckedIn.hidden = false;
    checkInMessage.hidden = true;
    queueStatus.hidden = true;
    queueInfo.hidden = true;
    liveQueue.hidden = true;

    // Handle missed appointments without a queue entry.
    if (currentAppointment?.appointment_status === "Missed") {
        notCheckedIn.hidden = true;
        checkInButton.disabled = true;

        showMessage(
            "You Missed Your Appointment",
            "You did not check in before the clinic closed."
        );

        if (checkInTimer) {
            clearInterval(checkInTimer);
            checkInTimer = null;
        }

        return;
    }

    // Stop refreshing queue position.
    if (queuePositionTimer) {
        clearInterval(queuePositionTimer);
        queuePositionTimer = null;
    }

    if (liveQueueTimer) {
        clearInterval(liveQueueTimer);
        liveQueueTimer = null;
    }

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

    const status = appointment.queue_status || "Waiting";

    // Handle skipped appointment
    if (status === "Skipped") {
        queueStatus.hidden = true;
        queueInfo.hidden = true;
        liveQueue.hidden = true;

        // Stop refreshing the queue position.
        if (queuePositionTimer) {
            clearInterval(queuePositionTimer);
            queuePositionTimer = null;
        }

        // Stop updating the estimated waiting time
        if (waitingTimeTimer) {
            clearInterval(waitingTimeTimer);
            waitingTimeTimer = null;
        }

        // Stop refreshing the queue
        if (liveQueueTimer) {
            clearInterval(liveQueueTimer);
            liveQueueTimer = null;
        }

        checkInButton.disabled = true;

        showMessage(
            "You Missed Your Appointment",
            "You were called but did not arrive. Please contact clinic staff for assistance."
        );

        return;
    }

    // Display the normal queue status
    queueStatus.hidden = false;
    queueInfo.hidden = false;
    liveQueue.hidden = false;

    queueNumber.textContent = appointment.queue_number ?? "—";

    queueAppointmentTime.textContent =
        `${formatTime(appointment.start_time)}`;

    queueStatusBadge.textContent = status;
    queueStatusBadge.className =
        `queue-status ${getQueueStatusClass(status)}`;
    
    queuePosition.textContent = appointment.queue_position ?? "—";

    updateWaitingTime(appointment);

    if (waitingTimeTimer) {
        clearInterval(waitingTimeTimer);
    }

    waitingTimeTimer = setInterval(() => {
        if (currentAppointment) {
            updateWaitingTime(currentAppointment);
        }
    }, 30000);

    // Refresh queue position every 10 seconds.
    if (!queuePositionTimer) {
        queuePositionTimer = setInterval(() => {
            refreshQueuePosition();
        }, 10000);
    }

    checkInButton.disabled = true;

    // Load all active queues and refresh periodically.
    loadLiveQueue();

    if (liveQueueTimer) {
        clearInterval(liveQueueTimer);
    }

    liveQueueTimer = setInterval(() => {
        loadLiveQueue();
    }, 10000);
}

 // ================= LOAD LIVE QUEUE =================
async function loadLiveQueue() {
    try {
        const response = await fetch("/api/patient/live-queue");

        if (response.status === 401 || response.status === 403) {
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error("Failed to load live queue.");
        }

        const queueEntries = await response.json();

        if (!Array.isArray(queueEntries)) {
            throw new Error("Invalid live queue data.");
        }

        // Clear the previous queue list.
        queueList.replaceChildren();

        if (queueEntries.length === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.className = "queue-empty";
            emptyMessage.textContent = "No active queues at the moment.";

            queueList.appendChild(emptyMessage);
            return;
        }

        queueEntries.forEach((entry) => {

            // Check whether this is the current patient's queue.
            const isOwnQueue =
                currentAppointment &&
                Number(entry.queue_number) === Number(currentAppointment.queue_number);

            // Create the queue item.
            const item = document.createElement("div");
            item.className = isOwnQueue
                ? "queue-item your-queue"
                : "queue-item";

            // Create the queue item's HTML.
            item.innerHTML = `
                <span class="queue-number"></span>
                <span class="queue-service"></span>
                <span class="queue-item-status"></span>
            `;

            // Display queue information.
            item.querySelector(".queue-number").textContent = `${entry.queue_number}`;

            item.querySelector(".queue-service").textContent = entry.appointment_type;

            const status = item.querySelector(".queue-item-status");
            status.classList.add(getQueueStatusClass(entry.queue_status));
            status.textContent = entry.queue_status;

            // Add the queue item to the queue list.
            queueList.appendChild(item);
        });

    } catch (error) {
        console.error("Error loading live queue:", error);
    }
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

    if (queuePositionTimer) {
        clearInterval(queuePositionTimer);
        queuePositionTimer = null;
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

    if (liveQueueTimer) {
        clearInterval(liveQueueTimer);
        liveQueueTimer = null;
    }

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
        // Set the message style based on its type.
        checkInMessage.className = "checkin-message";

        if (isSuccess) {
            checkInMessage.classList.add("success");
        } else if (
            title === "You Missed Your Appointment" ||
            title === "Check-in failed" ||
            title === "Clinic Closed"
        ) {
            checkInMessage.classList.add("warning");
        } else {
            checkInMessage.classList.add("info");
        }

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