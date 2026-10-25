import { showToast } from "./popup_message.js";

// Get all tabs and appointment sections
const tabs = document.querySelectorAll(".appointment-tab");
const sections = document.querySelectorAll(".appointment-section");


// Format appointment time
function formatTime(time) {
    const [hours, minutes] = time.split(":");
    const date = new Date();
    date.setHours(Number(hours), Number(minutes), 0, 0);

    return date.toLocaleTimeString("en-MY", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
}


// Function to show a specific section
function showSection(sectionId) {

    // Hide all sections
    sections.forEach(section => {
        section.style.display = "none";
    });

    // Remove active state from all tabs
    tabs.forEach(tab => {
        tab.classList.remove("active");
    });

    // Show selected section
    const selectedSection = document.getElementById(sectionId);

    if (selectedSection) {
        selectedSection.style.display = "block";
    }

    // Make corresponding tab active
    const selectedTab = document.querySelector(
        `.appointment-tab[href="#${sectionId}"]`
    );

    if (selectedTab) {
        selectedTab.classList.add("active");
    }
}


// Add click event to each tab
tabs.forEach(tab => {

    tab.addEventListener("click", function(event) {

        event.preventDefault();

        const sectionId = this.getAttribute("href").substring(1);

        showSection(sectionId);

    });

});


// Show Upcoming by default
showSection("upcoming");


function createAppointmentCard(appointment) {
    const card = document.createElement("div");
    card.className = "appointment-card";

    // Format appointment date
    const appointmentDate = new Date(
        `${appointment.appointment_date}T00:00:00`
    );

    const formattedDate = appointmentDate.toLocaleDateString("en-MY", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    const isReschedulePending = appointment.reschedule_status === "Pending";

    // Set status styling
    const statusClass = {
        Confirmed: "confirmed",
        Completed: "completed",
        Missed: "missed"
    };

    const statusClassName = isReschedulePending
    ? "pending"
    : (statusClass[appointment.status] || "");

    const displayStatus = isReschedulePending
        ? "Pending Reschedule"
        : appointment.status;
        
    card.innerHTML = `
        <!-- Service -->
        <div class="appointment-service">
            <div>
                <h4>${appointment.appointment_type}</h4>
                <p>Appointment</p>
            </div>
        </div>

        <!-- Date and Time -->
        <div class="appointment-date">
            <p>
                <img src="../icons/appointment.png" alt="">
                ${formattedDate}
            </p>

            <p>
                <img src="../icons/clock.png" alt="">
                ${formatTime(appointment.start_time)}
                - ${formatTime(appointment.end_time)}
            </p>
        </div>

        <!-- Status -->
        <div class="appointment-status">
            <span class="status ${statusClassName}">
                <span></span>
                ${displayStatus}
            </span>
        </div>

        <!-- Actions -->
        <div class="appointment-actions">
            <button
                type="button"
                class="details-button"
                data-appointment-id="${appointment.appointment_id}"
            >
                <i class="bi bi-eye"></i>
                View Details
            </button>

            ${
                appointment.status === "Confirmed" &&
                appointment.reschedule_status !== "Pending"
                    ? `
                        <button
                            type="button"
                            class="reschedule-button"
                            data-appointment-id="${appointment.appointment_id}"
                        >
                            <i class="bi bi-calendar"></i>
                            Request Reschedule
                        </button>
                    `
                    : ""
            }
        </div>

    `;

    return card;
}


function renderAppointments() {
    const categories = [
        {
            status: "Confirmed",
            containerId: "upcomingAppointments",
            emptyId: "upcomingEmpty",
            countId: "upcomingCount"
        },
        {
            status: "Completed",
            containerId: "pastAppointments",
            emptyId: "pastEmpty",
            countId: "pastCount"
        },
        {
            status: "Missed",
            containerId: "missedAppointments",
            emptyId: "missedEmpty",
            countId: "missedCount"
        }
    ];

    categories.forEach(category => {
        const container = document.getElementById(category.containerId);
        const emptyMessage = document.getElementById(category.emptyId);
        const count = document.getElementById(category.countId);

        const matchingAppointments = appointmentsData.filter(
            appointment => appointment.status === category.status
        );

        container.replaceChildren();

        matchingAppointments.forEach(appointment => {
            container.appendChild(createAppointmentCard(appointment));
        });

        emptyMessage.hidden = matchingAppointments.length > 0;
        count.textContent = matchingAppointments.length;
    });
}


document.addEventListener("click", function (event) {
    const button = event.target.closest(".details-button");

    if (!button) return;

    const appointmentId = Number(button.dataset.appointmentId);

    const appointment = appointmentsData.find(
        item => item.appointment_id === appointmentId
    );

    if (!appointment) {
        console.error("Appointment not found:", appointmentId);
        return;
    }

    // Format date
    const appointmentDate = new Date(
        `${appointment.appointment_date}T00:00:00`
    );

    const formattedDate = appointmentDate.toLocaleDateString("en-MY", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    // Populate modal information
    document.getElementById("modalAppointmentType").textContent =
        appointment.appointment_type;

    document.getElementById("modalDetailType").textContent =
        appointment.appointment_type;

    document.getElementById("modalAppointmentDate").textContent =
        formattedDate;

    document.getElementById("modalAppointmentTime").textContent =
        `${formatTime(appointment.start_time)} - ${formatTime(appointment.end_time)}`;
    

    // Update status badge and its styling
    const statusBadge = document.getElementById("modalAppointmentStatus");

    const isReschedulePending =
        appointment.reschedule_status === "Pending";

    const displayStatus = isReschedulePending
        ? "Pending Reschedule"
        : appointment.status;

    const statusClass = isReschedulePending
        ? "pending"
        : appointment.status.toLowerCase();

    statusBadge.className = `status ${statusClass}`;
    statusBadge.innerHTML = `<span></span>${displayStatus}`;

    // Display reschedule request details, if a request exists
    const requestDetails = document.getElementById(
        "rescheduleRequestDetails"
    );

    const requestStatus = document.getElementById(
        "modalRescheduleStatus"
    );

    const proposedDate = document.getElementById(
        "modalProposedDate"
    );

    const proposedTime = document.getElementById(
        "modalProposedTime"
    );

    const rejectReasonRow = document.getElementById(
        "rescheduleRejectReasonRow"
    );

    const rejectReason = document.getElementById(
        "modalRescheduleRejectReason"
    );

    if (appointment.reschedule_request_id) {
        requestDetails.hidden = false;

        requestStatus.textContent = appointment.reschedule_status;

        const proposedDateObject = new Date(
            `${appointment.proposed_date}T00:00:00`
        );

        proposedDate.textContent = proposedDateObject.toLocaleDateString(
            "en-MY",
            {
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );

        proposedTime.textContent =
            `${formatTime(appointment.proposed_start_time)} - ` +
            `${formatTime(appointment.proposed_end_time)}`;

        if (
            appointment.reschedule_status === "Rejected" &&
            appointment.reschedule_reject_reason
        ) {
            rejectReasonRow.hidden = false;
            rejectReason.textContent =
                appointment.reschedule_reject_reason;
        } else {
            rejectReasonRow.hidden = true;
            rejectReason.textContent = "";
        }
    } else {
        requestDetails.hidden = true;
        rejectReasonRow.hidden = true;
    }

    // Open modal
    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("viewAppointmentModal")
    ).show();
});


// Open request reschedule modal
document.addEventListener("click", function (event) {
    const button = event.target.closest(".reschedule-button");

    if (!button) return;

    const appointmentId = Number(button.dataset.appointmentId);

    const appointment = appointmentsData.find(
        item => item.appointment_id === appointmentId
    );

    if (!appointment) {
        console.error("Appointment not found:", appointmentId);
        return;
    }

    // Reset the form
    document.getElementById("rescheduleRequestForm").reset();

    document.getElementById("rescheduleAppointmentId").value =
        appointment.appointment_id;

    // Prevent selecting a date before today
    const today = new Date();
    const localToday = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0")
    ].join("-");

    document.getElementById("rescheduleDate").min = localToday;

    // Clear any previous error
    document.getElementById("rescheduleError").hidden = true;
    document.getElementById("rescheduleError").textContent = "";

    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("requestRescheduleModal")
    ).show();
});

// Submit a reschedule request
document.getElementById("rescheduleRequestForm")
    .addEventListener("submit", async function (event) {
        event.preventDefault();

        const appointmentId =
            document.getElementById("rescheduleAppointmentId").value;

        const appointmentDate =
            document.getElementById("rescheduleDate").value;

        const startTime =
            document.getElementById("rescheduleStartTime").value;

        const endTime =
            document.getElementById("rescheduleEndTime").value;

        const errorMessage = document.getElementById("rescheduleError");
        const submitButton = document.getElementById("submitRescheduleRequest");

        errorMessage.hidden = true;
        errorMessage.textContent = "";

        // Basic client-side time validation
        if (endTime <= startTime) {
            errorMessage.textContent =
                "The end time must be later than the start time.";
            errorMessage.hidden = false;
            return;
        }

        submitButton.disabled = true;

        try {
            const response = await fetch(
                `/api/patient/appointments/${appointmentId}/reschedule-requests`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        appointment_date: appointmentDate,
                        start_time: startTime,
                        end_time: endTime
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Failed to submit reschedule request."
                );
            }

            // Close the modal
            bootstrap.Modal.getOrCreateInstance(
                document.getElementById("requestRescheduleModal")
            ).hide();

            // Refresh the appointment cards and pending-request button
            await loadAppointments();

            showToast(result.message, "success");

        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.hidden = false;
        } finally {
            submitButton.disabled = false;
        }
    }
);

let appointmentsData = [];

// Load the logged-in patient's appointments
async function loadAppointments() {
    try {
        const response = await fetch("/api/patient/appointments");

        if (!response.ok) {
            throw new Error("Failed to retrieve appointments.");
        }

        appointmentsData = await response.json();

        renderAppointments();

    } catch (error) {
        console.error("Error loading appointments:", error);
    }
}

// Load appointments when the page opens
document.addEventListener("DOMContentLoaded", loadAppointments);
