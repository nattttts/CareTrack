
document.addEventListener("DOMContentLoaded", () => {
    loadWelcomeUserName();
    loadUpcomingAppointment();
    loadDashboardQueue();
    loadDashboardNotifications();

    // Refresh queue information every 10 seconds.
    setInterval(loadDashboardQueue, 10000);
});

// Load Welcome User Name

async function loadWelcomeUserName() {

    const welcomeUserName = document.getElementById("welcomeUserName");

    if (!welcomeUserName) {
        return;
    }

    try {
        const response = await fetch("/api/me");

        if (!response.ok) {
            throw new Error("Failed to retrieve user information.");
        }

        const user = await response.json();

        welcomeUserName.textContent = user.fullName;

    } catch (error) {
        console.error("Load welcome user name error:", error);
        welcomeUserName.textContent = "User";
    }
}

async function loadUpcomingAppointment() {
    const appointmentContent = document.getElementById(
        "upcomingAppointmentContent"
    );
    const noAppointmentContent = document.getElementById(
        "noUpcomingAppointment"
    );

    try {
        const response = await fetch("/api/patient/appointments");

        if (!response.ok) {
            throw new Error("Failed to retrieve appointments.");
        }

        const appointments = await response.json();

        // Get the current local date and time
        const now = new Date();
        const today = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0")
        ].join("-");

        const currentTime = [
            String(now.getHours()).padStart(2, "0"),
            String(now.getMinutes()).padStart(2, "0")
        ].join(":");

        // Find the next confirmed appointment, regardless of its scheduled time
        const upcomingAppointment = appointments
            .filter(appointment => appointment.status === "Confirmed")
            .sort((a, b) => {
                const dateComparison = a.appointment_date.localeCompare(
                    b.appointment_date
                );

                if (dateComparison !== 0) {
                    return dateComparison;
                }

                return a.start_time.localeCompare(b.start_time);
            })[0];

        if (!upcomingAppointment) {
            appointmentContent.classList.add("d-none");
            noAppointmentContent.classList.remove("d-none");
            return;
        }

        displayUpcomingAppointment(upcomingAppointment);

    } catch (error) {
        console.error("Error loading upcoming appointment:", error);

        appointmentContent.innerHTML = `
            <div class="text-center text-danger py-4">
                Unable to load your upcoming appointment.
                Please refresh the page and try again.
            </div>
        `;
    }
}

function displayUpcomingAppointment(appointment) {
    const appointmentContent = document.getElementById(
        "upcomingAppointmentContent"
    );
    const noAppointmentContent = document.getElementById(
        "noUpcomingAppointment"
    );

    const date = new Date(
        appointment.appointment_date + "T00:00:00"
    );

    const formattedDate = date.toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });

    const formattedTime = formatAppointmentTime(
        appointment.start_time
    );

    // A pending request does not change the original appointment time
    const hasPendingRequest =
        appointment.reschedule_status === "Pending";

    const statusBadge = hasPendingRequest
        ? `<span class="badge text-bg-warning">Pending Reschedule</span>`
        : "";

    appointmentContent.innerHTML = `
        <div class="appointment-name">
            <h4>${escapeHtml(appointment.appointment_type)}</h4>
            ${statusBadge}
        </div>

        <div class="appointment-detail row g-3 mt-1">
            <div class="col-12 col-md-6">
                <div class="detail-item">
                    <img src="../icons/appointment.png" alt="Appointment">

                    <div class="detail-item-info">
                        <span class="detail-label">Date</span>
                        <strong>${formattedDate}</strong>
                    </div>
                </div>
            </div>

            <div class="col-12 col-md-6">
                <div class="detail-item">
                    <img src="../icons/clock.png" alt="Clock">

                    <div class="detail-item-info">
                        <span class="detail-label">Time</span>
                        <strong>${formattedTime}</strong>
                    </div>
                </div>
            </div>
        </div>
    `;

    appointmentContent.classList.remove("d-none");
    noAppointmentContent.classList.add("d-none");
}

function formatAppointmentTime(time) {
    const [hours, minutes] = time.split(":");

    const date = new Date();
    date.setHours(Number(hours), Number(minutes), 0, 0);

    return date.toLocaleTimeString("en-MY", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
}

// Load Dashboard Queue
let isLoadingDashboardQueue = false;

async function loadDashboardQueue() {
    if (isLoadingDashboardQueue) {
        return;
    }

    isLoadingDashboardQueue = true;

    try {
        const response = await fetch("/api/patient/queue");

        if (response.status === 401 || response.status === 403) {
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error("Failed to load queue information.");
        }

        const appointments = await response.json();

        if (!Array.isArray(appointments)) {
            throw new Error("Invalid queue data.");
        }

        if (appointments.length === 0) {
            showDashboardNoAppointment();
            return;
        }

        // Prefer a missed appointment first
        const appointment =
            appointments.find(item => item.appointment_status === "Missed") ||
            appointments.find(item => item.queue_entry_id) ||
            appointments[0];

        if (appointment.appointment_status === "Missed") {
            showDashboardMissed();
        } else if (appointment.queue_entry_id) {
            displayDashboardQueue(appointment);
        } else {
            showDashboardNotCheckedIn();
        }

    } catch (error) {
        console.error("Error loading dashboard queue:", error);
        showDashboardQueueError();

    } finally {
        isLoadingDashboardQueue = false;
    }
}

// Display dashboard queue
function displayDashboardQueue(appointment) {
    hideDashboardQueueSections();

    const queueCheckedIn = document.getElementById("queueCheckedIn");
    const queueStatus = document.getElementById("dashboardQueueStatus");
    const queueNumber = document.getElementById("dashboardQueueNumber");
    const queuePosition = document.getElementById("dashboardQueuePosition");
    const waitingTime = document.getElementById("dashboardWaitingTime");

    const status = appointment.queue_status || "Waiting";

    queueStatus.textContent = status;

    queueStatus.className = `queue-status-badge ${getDashboardQueueStatusClass(status)}`;

    queueNumber.textContent = appointment.queue_number ?? "";

    queuePosition.textContent = formatDashboardQueuePosition(
        appointment.queue_position
    );

    // Display estimated waiting time only for Waiting patients.
    if (status !== "Waiting") {
        waitingTime.textContent = "—";
    } else {
        const estimatedMinutes = appointment.estimated_waiting_time;

        if (
            estimatedMinutes === null ||
            estimatedMinutes === undefined ||
            !Number.isFinite(Number(estimatedMinutes))
        ) {
            waitingTime.textContent = "Not available";
        } else {
            const minutes = Number(estimatedMinutes);

            if (minutes === 0) {
                waitingTime.textContent = "Less than 1 minute";
            } else if (minutes === 1) {
                waitingTime.textContent = "1 minute";
            } else {
                waitingTime.textContent = `${minutes} minutes`;
            }
        }
    }

    queueCheckedIn.classList.remove("d-none");
}

// Show not checked in
function showDashboardNotCheckedIn() {
    hideDashboardQueueSections();

    const section = document.getElementById("queueNotCheckedIn");

    // Set the default message for patients who have not checked in
    section.querySelector(".queue-status-header h3").textContent = "Not Checked In";
    section.querySelector(".queue-status-header p").textContent = "You are not currently checked in for your appointment.";
    section.querySelector(".queue-message strong").textContent = "Check in at the clinic";
    section.querySelector(".queue-message p").textContent =
        "Please complete check-in at the clinic when you arrive for your appointment. Your queue information will appear here after check-in.";

    section.classList.remove("d-none");
}

// Show checked in but missed appointment on queue
function showDashboardMissed() {
    hideDashboardQueueSections();
    document.getElementById("queueMissed").classList.remove("d-none");
}

// Show no appointment on queue
function showDashboardNoAppointment() {
    hideDashboardQueueSections();

    document.getElementById(
        "queueNoAppointment"
    ).classList.remove("d-none");
}

// Show queue error
function showDashboardQueueError() {
    hideDashboardQueueSections();

    document.getElementById(
        "queueError"
    ).classList.remove("d-none");
}

// Hide queue sections
function hideDashboardQueueSections() {
    document.getElementById("queueLoading").classList.add("d-none");
    document.getElementById("queueNotCheckedIn").classList.add("d-none");
    document.getElementById("queueCheckedIn").classList.add("d-none");
    document.getElementById("queueMissed").classList.add("d-none");
    document.getElementById("queueNoAppointment").classList.add("d-none");
    document.getElementById("queueError").classList.add("d-none");
}

// Format queue position
function formatDashboardQueuePosition(position) {
    if (
        position === null ||
        position === undefined ||
        position === ""
    ) {
        return "—";
    }

    const number = Number(position);

    if (!Number.isInteger(number) || number < 1) {
        return "—";
    }

    return number;
}

// Get queue status class
function getDashboardQueueStatusClass(status) {
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

// Load Dashboard Notifications
async function loadDashboardNotifications() {

    const notificationList = document.getElementById(
        "dashboardNotificationList"
    );

    const noNotifications = document.getElementById(
        "noDashboardNotifications"
    );

    if (!notificationList || !noNotifications) {
        return;
    }

    try {
        const response = await fetch(
            "/api/patient/dashboard/notifications"
        );

        if (response.status === 401 || response.status === 403) {
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error("Failed to load dashboard notifications.");
        }

        const notifications = await response.json();

        if (!Array.isArray(notifications)) {
            throw new Error("Invalid notification data.");
        }

        if (notifications.length === 0) {
            notificationList.classList.add("d-none");
            noNotifications.classList.remove("d-none");
            return;
        }

        notificationList.innerHTML = notifications
            .map(notification => {

                const style = getDashboardNotificationStyle(
                    notification.type
                );

                return `
                    <div class="notification-item">

                        <div class="notification-item-icon ${style.iconClass}">
                            ${style.icon}
                        </div>

                        <div class="notification-content">

                            <div class="notification-title-row">
                                <h3>${escapeHtml(notification.title)}</h3>
                                <span>${getDashboardNotificationTime(notification.created_at)}</span>
                            </div>

                            <p>${escapeHtml(notification.message)}</p>

                        </div>

                    </div>
                `;
            })
            .join("");

        notificationList.classList.remove("d-none");
        noNotifications.classList.add("d-none");

    } catch (error) {
        console.error("Error loading dashboard notifications:", error);

        notificationList.innerHTML = `
            <div class="text-center text-danger py-4">
                Unable to load notifications.
                Please refresh the page and try again.
            </div>
        `;

        notificationList.classList.remove("d-none");
        noNotifications.classList.add("d-none");
    }
}

// Get Dashboard Notification Style
function getDashboardNotificationStyle(type) {

    const styles = {
        appointment: {
            icon: `<img src="../icons/appointment.png" alt="Appointment">`,
            iconClass: "appointment"
        },

        confirmed: {
            icon: `<img src="../icons/appointment.png" alt="Appointment">`,
            iconClass: "appointment"
        },

        vaccination: {
            icon: `<img src="../icons/blue_syringe.png" alt="Vaccination">`,
            iconClass: "vaccination"
        },

        completed: {
            icon: `<i class="bi bi-shield-check"></i>`,
            iconClass: "update"
        },

        maintenance: {
            icon: `<i class="bi bi-gear"></i>`,
            iconClass: "update"
        },

        general: {
            icon: `<i class="bi bi-bell"></i>`,
            iconClass: "called"
        }
    };

    return styles[String(type ?? "").toLowerCase()] || styles.general;
}

// Format Dashboard Notification Time
function getDashboardNotificationTime(createdAt) {

    if (!createdAt) {
        return "";
    }

    let dateString = String(createdAt);

    // Convert SQLite datetime format to JavaScript date format
    if (!dateString.includes("T")) {
        dateString = dateString.replace(" ", "T") + "Z";
    }

    const notificationDate = new Date(dateString);

    if (Number.isNaN(notificationDate.getTime())) {
        return "";
    }

    const now = new Date();

    const difference = Math.floor(
        (now - notificationDate) / 1000
    );

    if (difference < 60) {
        return "Just now";
    }

    if (difference < 3600) {
        return `${Math.floor(difference / 60)} minutes ago`;
    }

    if (difference < 86400) {
        return `${Math.floor(difference / 3600)} hours ago`;
    }

    if (difference < 604800) {
        return `${Math.floor(difference / 86400)} days ago`;
    }

    return notificationDate.toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}
