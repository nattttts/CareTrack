
document.addEventListener("DOMContentLoaded", loadStaffDashboard);

// Load all dashboard data
async function loadStaffDashboard() {
    const appointmentsCount = document.getElementById(
        "todayAppointmentsCount"
    );
    const needsAttentionCount = document.getElementById(
        "needsAttentionCount"
    );
    const appointmentsList = document.getElementById(
        "todayAppointmentsList"
    );

    try {
        const [appointmentsResponse, requestsResponse] = await Promise.all([
            fetch("/api/staff/appointments"),
            fetch("/api/staff/reschedule-requests")
        ]);

        if (!appointmentsResponse.ok || !requestsResponse.ok) {
            throw new Error("Failed to retrieve dashboard data.");
        }

        const appointments = await appointmentsResponse.json();
        const pendingRequests = await requestsResponse.json();

        // Get today's date using the user's local date
        const today = getLocalDateString();

        // Filter appointments scheduled for today
        const todayAppointments = appointments
            .filter(appointment =>
                appointment.appointment_date === today
            )
            .sort((a, b) =>
                a.start_time.localeCompare(b.start_time)
            );

        // Count appointments marked as Missed
        const missedCount = appointments.filter(
            appointment => appointment.status === "Missed"
        ).length;

        // Count missed appointments and pending reschedule requests
        // These are attention items, not necessarily unique appointments
        const attentionCount = missedCount + pendingRequests.length;

        // Update the overview cards
        appointmentsCount.textContent = todayAppointments.length;
        needsAttentionCount.textContent = attentionCount;

        // Display today's appointments
        displayTodayAppointments(todayAppointments);

    } catch (error) {
        console.error("Error loading staff dashboard:", error);

        appointmentsList.innerHTML = `
            <div class="text-center text-danger py-4">
                Unable to load today's appointments.
                Please refresh the page and try again.
            </div>
        `;
    }
}


// Get today's date in local YYYY-MM-DD format
function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// Convert HH:mm to a 12-hour display format
function formatAppointmentTime(time) {
    const [hours, minutes] = time.split(":");
    const date = new Date();
    date.setHours(Number(hours), Number(minutes), 0, 0);

    return date.toLocaleTimeString("en-MY", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}


// Escape database values before inserting them into HTML
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}


// Display today's appointments in chronological order
function displayTodayAppointments(appointments) {
    const appointmentsList = document.getElementById(
        "todayAppointmentsList"
    );

    if (appointments.length === 0) {
        appointmentsList.innerHTML = `
            <div class="text-center text-muted py-4">
                No appointments scheduled for today.
            </div>
        `;
        return;
    }

    appointmentsList.innerHTML = appointments.map(appointment => {
        // A pending request takes priority in the displayed status
        const displayStatus = appointment.has_pending_reschedule
            ? "Pending Reschedule"
            : appointment.status;

        const statusClasses = {
            "Confirmed": "status-confirmed",
            "Pending Reschedule": "status-pending",
            "Completed": "status-completed",
            "Missed": "status-missed"
        };

        const statusClass =
            statusClasses[displayStatus] || "status-pending";

        return `
            <div class="appointment-item">
                <div class="appointment-info">
                    <strong class="appointment-time">
                        ${escapeHtml(
                            formatAppointmentTime(appointment.start_time)
                        )}
                    </strong>

                    <div class="appointment-details">
                        <h6 class="patient-name">
                            ${escapeHtml(appointment.patient_name)}
                        </h6>
                        <p>${escapeHtml(appointment.appointment_type)}</p>
                    </div>
                </div>

                <span class="status-badge ${statusClass}">
                    ${escapeHtml(displayStatus)}
                </span>
            </div>
        `;
    }).join("");
}
