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
            status: "Missed",
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
            .filter(appointment => appointment.status === category.status)
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
            `${formatTime(appointment.proposed_start_time)}`;

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



const rescheduleModal = document.getElementById("requestRescheduleModal");
const rescheduleForm = document.getElementById("rescheduleRequestForm");
const rescheduleAppointmentId = document.getElementById("rescheduleAppointmentId");
const rescheduleDate = document.getElementById("rescheduleDate");
const rescheduleStartTime = document.getElementById("rescheduleStartTime");
const rescheduleTimeMessage = document.getElementById("rescheduleTimeMessage");
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

function resetRescheduleSlots(message = "Available slots will appear after you select a date.") {
    rescheduleStartTime.innerHTML = '<option value="">Select a date first</option>';
    rescheduleStartTime.disabled = true;
    rescheduleTimeMessage.textContent = message;
}

// Load available slots when the patient selects a date.
async function loadRescheduleSlots() {
    clearRescheduleError();

    const appointmentId = rescheduleAppointmentId.value;
    const date = rescheduleDate.value;

    if (!appointmentId || !date) {
        resetRescheduleSlots();
        return;
    }

    rescheduleStartTime.disabled = true;
    rescheduleStartTime.innerHTML = '<option value="">Loading slots...</option>';
    rescheduleTimeMessage.textContent = "Checking available slots...";

    try {
        const response = await fetch(
            `/api/patient/appointments/${appointmentId}/available-reschedule-slots?date=${encodeURIComponent(date)}`
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Unable to load available slots."
            );
        }

        rescheduleStartTime.innerHTML = "";

        if (result.slots.length === 0) {
            rescheduleStartTime.innerHTML =
                '<option value="">No slots available</option>';

            rescheduleTimeMessage.textContent =
                "No available slots for this date. Please choose another date.";

            return;
        }

        rescheduleStartTime.add(new Option("Select a time slot", ""));

        result.slots.forEach(slot => {
            const [hour, minute] = slot.split(":").map(Number);
            const period = hour >= 12 ? "PM" : "AM";
            const displayHour = hour % 12 || 12;

            rescheduleStartTime.add(
                new Option(
                    `${displayHour}:${String(minute).padStart(2, "0")} ${period}`,
                    slot
                )
            );
        });

        rescheduleStartTime.disabled = false;
        rescheduleTimeMessage.textContent =
            "Select one of the available time slots.";

    } catch (error) {
        resetRescheduleSlots("Unable to load available slots.");

        showRescheduleError(error.message);
    }
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
    resetRescheduleSlots();

    rescheduleAppointmentId.value = appointment.appointment_id;

    // Use Malaysia's local date to set the earliest selectable date
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kuala_Lumpur",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const dateParts = Object.fromEntries(
        parts.map(part => [part.type, part.value])
    );

    const today =
        `${dateParts.year}-${dateParts.month}-${dateParts.day}`;

    rescheduleDate.min = today;

    bootstrap.Modal.getOrCreateInstance(rescheduleModal).show();
});

// Load slots whenever the date changes
rescheduleDate.addEventListener("change", loadRescheduleSlots);

// Submit a reschedule request
rescheduleForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    clearRescheduleError();

    const appointmentId = rescheduleAppointmentId.value;
    const appointmentDate = rescheduleDate.value;
    const startTime = rescheduleStartTime.value;

    const originalAppointment = appointmentsData.find(
        item => item.appointment_id === Number(appointmentId)
    );

    if (
        originalAppointment &&
        originalAppointment.appointment_date === appointmentDate &&
        originalAppointment.start_time === startTime
    ) {
        showRescheduleError(
            "The selected date and time are the same as your current appointment. Please choose a different slot."
        );
        return;
    }

    if (!appointmentDate || !startTime) {
        showRescheduleError("Please select an appointment date and time slot.");
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
                body: JSON.stringify({
                    appointment_date: appointmentDate,
                    start_time: startTime
                })
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
