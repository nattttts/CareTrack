
document.addEventListener("DOMContentLoaded", loadUpcomingAppointment);

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

        // Find the next confirmed appointment that hasn't started yet
        const upcomingAppointment = appointments
            .filter(appointment => {
                if (appointment.status !== "Confirmed") {
                    return false;
                }

                if (appointment.appointment_date < today) {
                    return false;
                }

                if (
                    appointment.appointment_date === today &&
                    appointment.start_time < currentTime
                ) {
                    return false;
                }

                return true;
            })
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

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}
