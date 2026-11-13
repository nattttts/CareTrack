import { showToast } from "./popup_message.js";

let appointmentsData = [];
const appointmentsPerPage = 5;

let pastCurrentPage = 1;
let missedCurrentPage = 1;


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
        Missed: "missed",
        Rebooked: "rebooked"
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


function renderPagination(appointments, container, currentPage, onPageChange) {
    const totalPages = Math.ceil(
        appointments.length / appointmentsPerPage
    );

    container.replaceChildren();

    if (totalPages <= 1) {
        return;
    }

    const previousButton = document.createElement("button");
    previousButton.type = "button";
    previousButton.textContent = "Previous";
    previousButton.disabled = currentPage === 1;

    previousButton.addEventListener("click", () => {
        onPageChange(currentPage - 1);
    });

    container.appendChild(previousButton);

    for (let page = 1; page <= totalPages; page++) {
        const pageButton = document.createElement("button");
        pageButton.type = "button";
        pageButton.textContent = page;

        if (page === currentPage) {
            pageButton.classList.add("active");
            pageButton.setAttribute("aria-current", "page");
        }

        pageButton.addEventListener("click", () => {
            onPageChange(page);
        });

        container.appendChild(pageButton);
    }

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.textContent = "Next";
    nextButton.disabled = currentPage === totalPages;

    nextButton.addEventListener("click", () => {
        onPageChange(currentPage + 1);
    });

    container.appendChild(nextButton);
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
            countId: "pastCount",
            paginationId: "pastPagination",
            getPage: () => pastCurrentPage,
            setPage: page => {
                pastCurrentPage = page;
                renderAppointments();
            }
        },
        {
            status: ["Missed", "Rebooked"],
            containerId: "missedAppointments",
            emptyId: "missedEmpty",
            countId: "missedCount",
            paginationId: "missedPagination",
            getPage: () => missedCurrentPage,
            setPage: page => {
                missedCurrentPage = page;
                renderAppointments();
            }
        }
    ];

    categories.forEach(category => {
        const container = document.getElementById(category.containerId);
        const emptyMessage = document.getElementById(category.emptyId);
        const count = document.getElementById(category.countId);

        const matchingAppointments = appointmentsData
            .filter(appointment =>
                Array.isArray(category.status)
                    ? category.status.includes(appointment.status)
                    : appointment.status === category.status
            )
            .sort((a, b) => {
                // Upcoming appointments remain in their original order
                if (category.status === "Confirmed") {
                    return 0;
                }

                // Past and Missed: newest date and time first
                const dateTimeA = `${a.appointment_date}T${a.start_time}`;
                const dateTimeB = `${b.appointment_date}T${b.start_time}`;

                return dateTimeB.localeCompare(dateTimeA);
            });

        container.replaceChildren();

        count.textContent = matchingAppointments.length;
        emptyMessage.hidden = matchingAppointments.length > 0;

        if (!category.paginationId) {
            // Upcoming: display every matching appointment
            matchingAppointments.forEach(appointment => {
                container.appendChild(createAppointmentCard(appointment));
            });

            return;
        }

        const paginationContainer = document.getElementById(
            category.paginationId
        );

        const totalPages = Math.ceil(
            matchingAppointments.length / appointmentsPerPage
        );

        // Keep the current page within the valid range
        const currentPage = Math.min(
            category.getPage(),
            Math.max(totalPages, 1)
        );

        if (currentPage !== category.getPage()) {
            if (category.status === "Completed") {
                pastCurrentPage = currentPage;
            } else {
                missedCurrentPage = currentPage;
            }
        }

        const startIndex = (currentPage - 1) * appointmentsPerPage;

        const pageAppointments = matchingAppointments.slice(
            startIndex,
            startIndex + appointmentsPerPage
        );

        pageAppointments.forEach(appointment => {
            container.appendChild(createAppointmentCard(appointment));
        });

        renderPagination(
            matchingAppointments,
            paginationContainer,
            currentPage,
            category.setPage
        );
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
        `${formatTime(appointment.start_time)}`;
    

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

    const requestReason = document.getElementById(
        "modalRescheduleReason"
    );

    if (appointment.reschedule_request_id) {
        requestDetails.hidden = false;

        requestStatus.textContent = appointment.reschedule_status;

        requestReason.textContent = appointment.reschedule_reason;
    } else {
        requestDetails.hidden = true;

        requestStatus.textContent = "";
        requestReason.textContent = "";
    }

    // Open modal
    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("viewAppointmentModal")
    ).show();
});


const rescheduleModal = document.getElementById("requestRescheduleModal");
const rescheduleForm = document.getElementById("rescheduleRequestForm");
const rescheduleAppointmentId = document.getElementById("rescheduleAppointmentId");
const rescheduleReason = document.getElementById("rescheduleReason");
const rescheduleError = document.getElementById("rescheduleError");
const submitRescheduleRequest = document.getElementById("submitRescheduleRequest");

function showRescheduleError(message) {
    rescheduleError.textContent = message;
    rescheduleError.hidden = false;
}

function clearRescheduleError() {
    rescheduleError.textContent = "";
    rescheduleError.hidden = true;
}


// Open the request reschedule modal
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

    rescheduleForm.reset();
    clearRescheduleError();

    rescheduleAppointmentId.value = appointment.appointment_id;

    bootstrap.Modal.getOrCreateInstance(rescheduleModal).show();
});


// Submit a reschedule request
rescheduleForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    clearRescheduleError();

    const appointmentId = rescheduleAppointmentId.value;
    const reason = rescheduleReason.value.trim();

    if (!reason) {
        showRescheduleError("Please provide a reason for rescheduling.");
        return;
    }

    submitRescheduleRequest.disabled = true;

    try {
        const response = await fetch(
            `/api/patient/appointments/${appointmentId}/reschedule-requests`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ reason })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Failed to submit reschedule request."
            );
        }

        bootstrap.Modal.getOrCreateInstance(rescheduleModal).hide();

        await loadAppointments();

        showToast(result.message, "success");

    } catch (error) {
        showRescheduleError(error.message);
    } finally {
        submitRescheduleRequest.disabled = false;
    }
});


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
