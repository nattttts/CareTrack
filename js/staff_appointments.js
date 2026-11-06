import { showToast } from "./popup_message.js";

let appointmentsData = [];

// Appointment Tabs
const appointmentTabs = document.querySelectorAll(".appointment-tab");

let currentPeriod = "today";


appointmentTabs.forEach(tab => {

    tab.addEventListener("click", function () {

        appointmentTabs.forEach(item => {
            item.classList.remove("active");
        });

        this.classList.add("active");

        currentPeriod = this.getAttribute("data-tab");

        applyAppointmentFilters();

    });

});


// Appointment filters
const searchInput = document.getElementById("searchInput");
const dateFilter = document.getElementById("dateFilter");
const typeFilter = document.getElementById("typeFilter");
const statusFilter = document.getElementById("statusFilter");
const resetFilters = document.getElementById("resetFilters");
const noAppointments = document.getElementById("noAppointments");
const appointmentCount = document.getElementById("appointmentCount");


function applyAppointmentFilters() {
    const appointmentRows = document.querySelectorAll(
        "#appointmentTableBody tr[data-appointment-id]"
    );

    // Sort past appointments from latest to oldest
    if (currentPeriod === "past") {
        const tableBody = document.getElementById("appointmentTableBody");

        const pastRows = Array.from(appointmentRows)
            .filter(row => row.dataset.period === "past")
            .sort((a, b) => {
                const dateComparison =
                    b.dataset.date.localeCompare(a.dataset.date);

                if (dateComparison !== 0) {
                    return dateComparison;
                }

                return b.dataset.startTime.localeCompare(
                    a.dataset.startTime
                );
            });

        pastRows.forEach(row => tableBody.appendChild(row));
    }

    const search = searchInput.value.toLowerCase().trim();
    const selectedDate = dateFilter.value;
    const selectedType = typeFilter.value;
    const selectedStatus = statusFilter.value;

    let visibleCount = 0;

    appointmentRows.forEach(row => {
        const period = row.dataset.period;
        const date = row.dataset.date;
        const type = row.dataset.type;
        const status = row.dataset.status;

        const rowText = row.innerText.toLowerCase();
        const matchesPeriod = period === currentPeriod;
        const matchesSearch = search === "" || rowText.includes(search);
        const matchesDate = selectedDate === "" || date === selectedDate;
        const matchesType = selectedType === "all" || type === selectedType;
        const matchesStatus = selectedStatus === "all" || status === selectedStatus;

        const shouldShow = matchesPeriod && matchesSearch &&
            matchesDate && matchesType && matchesStatus;

        if (shouldShow) {
            row.style.display = "";
            visibleCount++;
        } else {
            row.style.display = "none";
        }

    });


    if (visibleCount === 0) {
        noAppointments.style.display = "block";
    } else {
        noAppointments.style.display = "none";
    }

    appointmentCount.textContent =
        `Showing ${visibleCount} appointment${visibleCount === 1 ? "" : "s"}`;

}


searchInput.addEventListener("input", applyAppointmentFilters);

dateFilter.addEventListener("change", applyAppointmentFilters);
typeFilter.addEventListener("change", applyAppointmentFilters);
statusFilter.addEventListener("change", applyAppointmentFilters);

resetFilters.addEventListener("click", function () {
    searchInput.value = "";
    dateFilter.value = "";
    typeFilter.value = "all";
    statusFilter.value = "all";
    currentPeriod = "today";

    appointmentTabs.forEach(tab => {
        tab.classList.remove("active");
    });

    document.querySelector('[data-tab="today"]').classList.add("active");

    applyAppointmentFilters();

    }
);

// Time Formatter
function formatTime(time) {
    const [hours, minutes] = time.split(":");

    let hour = parseInt(hours);
    const period = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;

    return `${hour}:${minutes} ${period}`;
}

function formatDate(dateString) {
    const [year, month, day] = dateString.split("-");

    const date = new Date(
        Number(year),
        Number(month) - 1,
        Number(day)
    );

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function getLocalDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
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

// Load and display appointments
async function loadAppointments() {
    const tableBody = document.getElementById("appointmentTableBody");

    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center">
                Loading appointments...
            </td>
        </tr>
    `;

    try {
        const response = await fetch("/api/staff/appointments");

        if (!response.ok) {
            throw new Error("Failed to fetch appointments.");
        }

        appointmentsData = await response.json();
        const today = getLocalDateString();

        tableBody.innerHTML = "";

        appointmentsData.forEach(appointment => {
            const appointmentDate = appointment.appointment_date;

            const period = appointmentDate === today
                ? "today"
                : appointmentDate > today
                    ? "upcoming"
                    : "past";

            // A pending reschedule takes priority in the displayed status
            const displayStatus =
                appointment.has_pending_reschedule
                    ? "Pending Reschedule"
                    : appointment.status;

            let actionButtons = `
                <button
                    type="button"
                    class="action-button view-button"
                    data-bs-toggle="modal"
                    data-bs-target="#viewAppointmentModal"
                    data-appointment-id="${escapeHtml(appointment.appointment_id)}"
                >
                    <i class="bi bi-eye"></i>
                    View
                </button>
            `;

            // Show reschedule request actions only when a request is pending
            if (appointment.has_pending_reschedule) {
                actionButtons += `
                    <button
                        type="button"
                        class="action-button reschedule-request-button"
                        data-appointment-id="${escapeHtml(appointment.appointment_id)}"
                    >
                        <i class="bi bi-eye"></i>
                        View Reschedule Request
                    </button>

                    <button
                        type="button"
                        class="action-button edit-button"
                        data-appointment-id="${escapeHtml(appointment.appointment_id)}"
                    >
                        <i class="bi bi-pencil"></i>
                        Edit
                    </button>
                `;
            } else if (displayStatus === "Completed" && appointment.role === "pregnant_woman") {
                if (appointment.account_status === "Active") {
                    actionButtons += `
                        <button
                            type="button"
                            class="action-button follow-up-button"
                            data-bs-toggle="modal"
                            data-bs-target="#scheduleFollowUpModal"
                            data-appointment-id="${escapeHtml(appointment.appointment_id)}"
                            data-user-id="${escapeHtml(appointment.user_id)}"
                        >
                            <i class="bi bi-calendar-plus"></i>
                            Schedule Follow-up
                        </button>
                    `;
                }
            } else if (displayStatus === "Missed") {
                actionButtons += `
                    <button
                        type="button"
                        class="action-button reschedule-appointment-button"
                        data-user-id="${escapeHtml(appointment.user_id)}"
                    >
                        <i class="bi bi-calendar-plus"></i>
                        Reschedule Appointment
                    </button>
                `;
            } 

            const row = document.createElement("tr");

            row.dataset.appointmentId = appointment.appointment_id;
            row.dataset.period = period;
            row.dataset.date = appointmentDate;
            row.dataset.startTime = appointment.start_time;
            row.dataset.type = appointment.appointment_type;
            row.dataset.status = displayStatus;

            row.innerHTML = `
                <td>${escapeHtml(appointment.patient_name)}</td>
                <td>${escapeHtml(appointment.appointment_type)}</td>
                <td>${escapeHtml(formatDate(appointmentDate))}</td>
                <td>
                    ${escapeHtml(formatTime(appointment.start_time))}
                </td>
                <td>
                    <span class="status-badge ${displayStatus.toLowerCase().replace(/\s+/g, '-')}">
                        <span></span>
                        ${escapeHtml(displayStatus)}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        ${actionButtons}
                    </div>
                </td>
            `;

            tableBody.appendChild(row);
        });

        applyAppointmentFilters();

    } catch (error) {
        console.error("Error loading appointments:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger">
                    Unable to load appointments. Please try again.
                </td>
            </tr>
        `;

        document.getElementById("appointmentCount").textContent =
            "Unable to load appointments";

        document.getElementById("noAppointments").style.display = "none";
    }
}

const scheduleAppointmentModal = document.getElementById("scheduleAppointmentModal");
const viewAppointmentModal = document.getElementById("viewAppointmentModal");

viewAppointmentModal.addEventListener("show.bs.modal", event => {
    const button = event.relatedTarget;
    const appointmentId = button.dataset.appointmentId;

    const appointment = appointmentsData.find(
        item => String(item.appointment_id) === String(appointmentId)
    );

    if (!appointment) {
        console.error("Appointment not found:", appointmentId);
        return;
    }

    const displayStatus =
        appointment.has_pending_reschedule
            ? "Pending Reschedule"
            : appointment.status;

    const statusClass = {
        "Confirmed": "confirmed",
        "Pending Reschedule": "pending-reschedule",
        "Completed": "completed",
        "Missed": "missed"
    };

    document.getElementById("modalAppointmentType").textContent =
        appointment.appointment_type;

    document.getElementById("modalAppointmentStatus").className =
        `status-badge ${statusClass[displayStatus] || "pending-reschedule"}`;

    document.getElementById("modalAppointmentStatus").innerHTML =
        `<span></span>`;

    document.getElementById("modalAppointmentStatus").append(
        document.createTextNode(displayStatus)
    );

    document.getElementById("modalPatientName").textContent =
        appointment.patient_name;

    document.getElementById("modalDetailType").textContent =
        appointment.appointment_type;

    document.getElementById("modalAppointmentDate").textContent =
        formatDate(appointment.appointment_date);

    document.getElementById("modalAppointmentTime").textContent =
        `${formatTime(appointment.start_time)}`;
});


// Patient search and selection
let selectedPatient = null;
let patientSearchTimeout;
let patientSearchRequestId = 0;

const patientSearchInput = document.getElementById("patientSearch");
const patientSearchResults = document.getElementById("patientSearchResults");
const patientSearchMessage = document.getElementById("patientSearchMessage");
const selectedPatientDetails = document.getElementById("selectedPatientDetails");
const appointmentTypeInput = document.getElementById("appointmentType");

// Search when staff types
patientSearchInput.addEventListener("input", () => {
    clearTimeout(patientSearchTimeout);

    // Typing a new query invalidates the previous selection
    selectedPatient = null;
    selectedPatientDetails.hidden = true;
    appointmentTypeInput.value = "";
    patientSearchResults.replaceChildren();

    const searchTerm = patientSearchInput.value.trim();

    // Invalidate any earlier request
    const requestId = ++patientSearchRequestId;

    if (searchTerm.length < 2) {
        patientSearchMessage.textContent =
            "Enter at least 2 characters to search.";
        return;
    }

    patientSearchMessage.textContent = "Searching...";

    // Wait briefly before searching to avoid a request for every keystroke
    patientSearchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(
                `/api/staff/patients/search?q=${encodeURIComponent(searchTerm)}`
            );

            const patients = await response.json();

            // Ignore results from an outdated search
            if (requestId !== patientSearchRequestId) return;

            if (!response.ok) {
                throw new Error(
                    patients.message || "Failed to search patients."
                );
            }

            patientSearchResults.replaceChildren();

            if (patients.length === 0) {
                patientSearchMessage.textContent = "No patients found.";
                return;
            }

            patientSearchMessage.textContent =
                `${patients.length} patient(s) found. Select the correct patient.`;

            patients.forEach(patient => {
                const resultButton = document.createElement("button");

                resultButton.type = "button";
                resultButton.className = "list-group-item list-group-item-action";

                // Use textContent to safely display database values
                const name = document.createElement("strong");
                name.textContent = patient.full_name;

                const details = document.createElement("div");
                details.className = "small text-muted";
                details.textContent =
                    `IC: ${patient.user_id} | Role: ${
                        patient.role === "pregnant_woman" ? "Pregnant Woman" : "Child"
                    }`;

                resultButton.append(name, details);

                resultButton.addEventListener("click", () => {
                    selectPatient(patient);
                });

                patientSearchResults.appendChild(resultButton);
            });

        } catch (error) {
            if (requestId !== patientSearchRequestId) return;

            console.error("Patient search error:", error);
            patientSearchMessage.textContent =
                error.message || "Unable to search patients. Please try again.";
        }
    }, 300);
});

// Select a patient from the search results
function selectPatient(patient) {
    selectedPatient = patient;

    document.getElementById("selectedPatientName").textContent =
        patient.full_name;

    document.getElementById("selectedPatientIC").textContent =
        `IC Number: ${patient.user_id}`;

    document.getElementById("selectedPatientRole").textContent =
        `Role: ${patient.role === "pregnant_woman" ? "Pregnant Woman" : "Child"}`;

    appointmentTypeInput.value =
        patient.role === "child"
            ? "Child Vaccination"
            : "Maternal Follow-up";

    selectedPatientDetails.hidden = false;
    patientSearchResults.replaceChildren();
    patientSearchMessage.textContent = "Patient selected.";

    loadAvailableTimeSlots();
}

// Allow staff to change their selection
document.getElementById("changePatientButton").addEventListener("click", () => {
    selectedPatient = null;

    selectedPatientDetails.hidden = true;
    appointmentTypeInput.value = "";
    patientSearchInput.value = "";
    patientSearchResults.replaceChildren();

    patientSearchMessage.textContent =
        "Search using the patient's IC number or name.";

    patientSearchInput.focus();
});


// Appointment date and time validation
const appointmentDateInput = document.getElementById("appointmentDate");
const appointmentStartTimeInput = document.getElementById("appointmentStartTime");
const scheduleAppointmentMessage = document.getElementById("scheduleAppointmentMessage");
const scheduleAppointmentForm = document.getElementById("scheduleAppointmentForm");

// Get today's date in local time as YYYY-MM-DD
function getTodayDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// Set the earliest selectable date to today
appointmentDateInput.min = getTodayDate();

// Validate the selected appointment date and time slot
function validateAppointmentSchedule() {
    const appointmentDate = appointmentDateInput.value;
    const startTime = appointmentStartTimeInput.value;

    appointmentDateInput.setCustomValidity("");
    appointmentStartTimeInput.setCustomValidity("");

    appointmentDateInput.classList.remove("is-invalid");
    appointmentStartTimeInput.classList.remove("is-invalid");

    scheduleAppointmentMessage.hidden = true;
    scheduleAppointmentMessage.textContent = "";
    scheduleAppointmentMessage.classList.remove(
        "alert",
        "alert-danger",
        "alert-success",
        "mt-2"
    );

    let errorMessage = "";
    let invalidInput = null;

    if (!appointmentDate) {
        errorMessage = "Please select an appointment date.";
        invalidInput = appointmentDateInput;
    } else if (appointmentDate < getTodayDate()) {
        errorMessage = "The appointment date cannot be in the past.";
        invalidInput = appointmentDateInput;
    } else if (!startTime) {
        errorMessage = "Please select an available appointment time slot.";
        invalidInput = appointmentStartTimeInput;
    } else if (
        appointmentDate === getTodayDate()
    ) {
        const now = new Date();

        const currentTime =
            `${String(now.getHours()).padStart(2, "0")}:` +
            `${String(now.getMinutes()).padStart(2, "0")}`;

        if (startTime <= currentTime) {
            errorMessage =
                "Please select a time slot that has not started yet.";
            invalidInput = appointmentStartTimeInput;
        }
    }

    if (errorMessage) {
        scheduleAppointmentMessage.textContent = errorMessage;
        scheduleAppointmentMessage.classList.add(
            "alert",
            "alert-danger",
            "mt-2"
        );
        scheduleAppointmentMessage.hidden = false;

        if (invalidInput) {
            invalidInput.classList.add("is-invalid");
            invalidInput.setCustomValidity(errorMessage);
        }

        return false;
    }

    return true;
}


async function loadAvailableTimeSlots() {
    const timeSlotSelect = appointmentStartTimeInput;
    const timeMessage = document.getElementById("appointmentTimeMessage");

    timeSlotSelect.innerHTML =
        '<option value="">Loading available slots...</option>';
    timeSlotSelect.disabled = true;
    timeMessage.textContent = "";

    if (!selectedPatient || !appointmentDateInput.value) {
        timeSlotSelect.innerHTML =
            '<option value="">Select a patient and date first</option>';
        timeMessage.textContent =
            "Available slots will appear after you select a patient and date.";
        return;
    }

    try {
        const params = new URLSearchParams({
            user_id: selectedPatient.user_id,
            date: appointmentDateInput.value
        });

        const response = await fetch(
            `/api/staff/available-slots?${params}`
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to load available slots.");
        }

        timeSlotSelect.innerHTML = "";

        if (result.slots.length === 0) {
            timeSlotSelect.innerHTML =
                '<option value="">No available slots</option>';
            timeMessage.textContent =
                "There are no available slots for this patient on the selected date.";
            return;
        }

        timeSlotSelect.add(new Option("Select a time slot", ""));

        result.slots.forEach(slot => {
            const [hour, minute] = slot.split(":").map(Number);
            const period = hour >= 12 ? "PM" : "AM";
            const displayHour = hour % 12 || 12;
            const label = `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;

            timeSlotSelect.add(new Option(label, slot));
        });

        timeSlotSelect.disabled = false;
        timeMessage.textContent =
            "Each time slot accommodates up to 4 appointments of the same type.";

    } catch (error) {
        console.error("Failed to load available time slots:", error);

        timeSlotSelect.innerHTML =
            '<option value="">Unable to load slots</option>';
        timeMessage.textContent = error.message;
    }
}

appointmentDateInput.addEventListener("change", () => {
    loadAvailableTimeSlots();
});

// Validate again whenever a field changes
[
    appointmentDateInput,
    appointmentStartTimeInput
].forEach(input => {
    input.addEventListener("change", validateAppointmentSchedule);
});

// Schedule new appointment
scheduleAppointmentForm.addEventListener("submit", async event => {
    event.preventDefault();

    // Ensure a patient has been selected
    if (!selectedPatient) {
        scheduleAppointmentMessage.textContent =
            "Please search for and select a patient first.";

        scheduleAppointmentMessage.className = "alert alert-danger mt-2";

        scheduleAppointmentMessage.hidden = false;
        patientSearchInput.focus();
        return;
    }

    // Validate the date and time before sending the request
    if (!validateAppointmentSchedule()) {
        const invalidInput = scheduleAppointmentForm.querySelector(
            ".is-invalid"
        );

        invalidInput?.reportValidity();
        return;
    }

    const submitButton = document.getElementById(
        "submitAppointmentButton"
    );

    const originalButtonText = submitButton.textContent;

    try {
        // Prevent duplicate submissions while saving
        submitButton.disabled = true;
        submitButton.textContent = "Scheduling...";

        scheduleAppointmentMessage.hidden = true;

        // Send the appointment details to the backend
        const response = await fetch("/api/staff/appointments", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user_id: selectedPatient.user_id,
                appointment_date: appointmentDateInput.value,
                start_time: appointmentStartTimeInput.value
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Failed to schedule the appointment."
            );
        }

        // Refresh the appointments table
        await loadAppointments();

        // Close the modal
        const modalInstance =
            bootstrap.Modal.getOrCreateInstance(scheduleAppointmentModal);

        modalInstance.hide();

        showToast("Appointment successfully scheduled.", "success");

    } catch (error) {
        console.error("Create appointment error:", error);

        scheduleAppointmentMessage.textContent =
            error.message || "Unable to schedule the appointment.";

        scheduleAppointmentMessage.className = "alert alert-danger mt-2";
        scheduleAppointmentMessage.hidden = false;

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
});


scheduleAppointmentModal.addEventListener("hidden.bs.modal", () => {
    // Clear all form fields
    scheduleAppointmentForm.reset();

    // Clear the selected patient
    selectedPatient = null;
    selectedPatientDetails.hidden = true;

    // Clear patient search results and messages
    patientSearchResults.replaceChildren();
    patientSearchMessage.textContent =
        "Search using the patient's IC number or name.";

    // Clear appointment type
    appointmentTypeInput.value = "";

    // Clear validation styling and custom error messages
    [
        appointmentDateInput,
        appointmentStartTimeInput
    ].forEach(input => {
        input.setCustomValidity("");
        input.classList.remove("is-invalid");
    });

    // Clear any previous form message
    scheduleAppointmentMessage.hidden = true;
    scheduleAppointmentMessage.textContent = "";
    scheduleAppointmentMessage.classList.remove(
        "alert",
        "alert-danger",
        "alert-success",
        "mt-2"
    );
});


// Schedule next appointment
document.addEventListener("click", event => {
    const button = event.target.closest(".follow-up-button, .reschedule-appointment-button");

    if (!button) return;

    const userId = button.dataset.userId;

    if (!userId) {
        console.error("No patient ID found for this follow-up.");
        return;
    }

    // Find the patient in the currently loaded appointment data
    const patient = appointmentsData.find(
        appointment => String(appointment.user_id) === String(userId)
    );

    if (!patient) {
        console.error("Patient not found:", userId);
        return;
    }

    // Open the existing Schedule Appointment modal
    const modalElement = document.getElementById(
        "scheduleAppointmentModal"
    );

    bootstrap.Modal.getOrCreateInstance(modalElement).show();

    // Select the patient after the modal opens
    selectPatient({
        user_id: patient.user_id,
        full_name: patient.patient_name,
        role: patient.role
    });
});

const editAppointmentModal = document.getElementById("editAppointmentModal");
const editAppointmentForm = document.getElementById("editAppointmentForm");
const editPatientName = document.getElementById("editPatientName");
const editAppointmentType = document.getElementById("editAppointmentType");
const editAppointmentDate = document.getElementById("editAppointmentDate");
const editAppointmentStartTime = document.getElementById("editAppointmentStartTime");
const editAppointmentTimeMessage = document.getElementById("editAppointmentTimeMessage");
const editAppointmentMessage = document.getElementById("editAppointmentMessage");
const saveAppointmentChangesButton = document.getElementById("saveAppointmentChangesButton");

let editingAppointmentId = null;
let editingAppointmentUserId = null;


async function loadEditAvailableTimeSlots(preferredTime = "") {
    editAppointmentStartTime.disabled = true;
    editAppointmentStartTime.innerHTML =
        '<option value="">Loading available slots...</option>';
    editAppointmentTimeMessage.textContent = "";

    if (!editingAppointmentId || !editingAppointmentUserId ||
        !editAppointmentDate.value) {
        editAppointmentStartTime.innerHTML =
            '<option value="">Select a date first</option>';
        editAppointmentTimeMessage.textContent =
            "Available slots will appear after you select a date.";
        return;
    }

    try {
        const params = new URLSearchParams({
            user_id: editingAppointmentUserId,
            date: editAppointmentDate.value,
            appointment_id: editingAppointmentId
        });

        const response = await fetch(
            `/api/staff/available-slots?${params}`
        );
        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Failed to load available slots."
            );
        }

        editAppointmentStartTime.innerHTML = "";
        editAppointmentStartTime.add(
            new Option("Select a time slot", "")
        );

        if (result.slots.length === 0) {
            editAppointmentStartTime.innerHTML =
                '<option value="">No available slots</option>';
            editAppointmentTimeMessage.textContent =
                "No time slots are available on this date.";
            return;
        }

        result.slots.forEach(slot => {
            const [hour, minute] = slot.split(":").map(Number);
            const period = hour >= 12 ? "PM" : "AM";
            const displayHour = hour % 12 || 12;
            const label =
                `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;

            editAppointmentStartTime.add(new Option(label, slot));
        });

        if (result.slots.includes(preferredTime)) {
            editAppointmentStartTime.value = preferredTime;
        }

        editAppointmentStartTime.disabled = false;
        editAppointmentTimeMessage.textContent =
            "Each time slot accommodates up to 4 appointments of the same type.";

    } catch (error) {
        console.error("Failed to load edit appointment slots:", error);

        editAppointmentStartTime.innerHTML =
            '<option value="">Unable to load slots</option>';
        editAppointmentTimeMessage.textContent = error.message;
    }
}

// Refresh available slots whenever the date changes
editAppointmentDate.addEventListener("change", () => {
    loadEditAvailableTimeSlots();
});


// Open the Edit Appointment modal when Edit is clicked
document.addEventListener("click", function (event) {
    const editButton = event.target.closest(".edit-button");

    if (!editButton) return;

    const appointmentId = editButton.dataset.appointmentId;

    const appointment = appointmentsData.find(
        item => String(item.appointment_id) === String(appointmentId)
    );

    if (!appointment) {
        showToast(
            "Unable to find this appointment. Please refresh the page.",
            "error"
        );
        return;
    }

    const today = getLocalDateString();

    if (
        appointment.appointment_date <= today ||
        appointment.status !== "Confirmed"
    ) {
        showToast(
            "Only upcoming confirmed appointments can be edited.",
            "error"
        );
        return;
    }

    editingAppointmentId = appointment.appointment_id;
    editingAppointmentUserId = appointment.user_id;

    editPatientName.value = appointment.patient_name;
    editAppointmentType.value = appointment.appointment_type;
    editAppointmentDate.value = appointment.appointment_date;

    editAppointmentMessage.hidden = true;
    editAppointmentMessage.textContent = "";
    editAppointmentMessage.className = "mt-3";

    [
        editAppointmentDate,
        editAppointmentStartTime
    ].forEach(input => {
        input.classList.remove("is-invalid");
        input.setCustomValidity("");
    });

    // Load available slots and preselect the appointment's current time
    loadEditAvailableTimeSlots(appointment.start_time);

    bootstrap.Modal.getOrCreateInstance(editAppointmentModal).show();
});


function showEditAppointmentMessage(message) {
    editAppointmentMessage.textContent = message;
    editAppointmentMessage.className = "alert alert-danger mt-3";
    editAppointmentMessage.hidden = false;
}

// Save edited appointment details
editAppointmentForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (editingAppointmentId === null) {
        showEditAppointmentMessage(
            "No appointment selected. Please close the modal and try again."
        );
        return;
    }

    const appointmentDate = editAppointmentDate.value;
    const startTime = editAppointmentStartTime.value;

    [
        editAppointmentDate,
        editAppointmentStartTime
    ].forEach(input => {
        input.classList.remove("is-invalid");
        input.setCustomValidity("");
    });

    editAppointmentMessage.hidden = true;
    editAppointmentMessage.textContent = "";

    if (!appointmentDate || appointmentDate <= getLocalDateString()) {
        editAppointmentDate.classList.add("is-invalid");
        showEditAppointmentMessage(
            "Please select a future appointment date."
        );
        return;
    }

    if (!startTime) {
        editAppointmentStartTime.classList.add("is-invalid");
        showEditAppointmentMessage(
            "Please select an available appointment time slot."
        );
        return;
    }

    saveAppointmentChangesButton.disabled = true;
    saveAppointmentChangesButton.innerHTML = `
        <span
            class="spinner-border spinner-border-sm me-1"
            aria-hidden="true"
        ></span>
        Saving...
    `;

    try {
        const response = await fetch(
            `/api/staff/appointments/${encodeURIComponent(
                editingAppointmentId
            )}`,
            {
                method: "PATCH",
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
            showEditAppointmentMessage(
                result.message || "Unable to update the appointment."
            );
            return;
        }

        await loadAppointments();

        bootstrap.Modal.getOrCreateInstance(editAppointmentModal).hide();

        if (result.changed) {
            showToast("Appointment successfully updated.", "success");
        } else {
            showToast("No changes were made to the appointment.", "info");
        }

    } catch (error) {
        console.error("Error updating appointment:", error);
        showToast("A server error occurred. Please try again.", "error");

    } finally {
        saveAppointmentChangesButton.disabled = false;
        saveAppointmentChangesButton.innerHTML = `
            <i class="bi bi-check-circle"></i>
            Save Changes
        `;
    }
});


editAppointmentModal.addEventListener("hidden.bs.modal", function () {
    editAppointmentForm.reset();

    editingAppointmentId = null;

    editAppointmentMessage.hidden = true;
    editAppointmentMessage.textContent = "";
    editAppointmentMessage.className = "mt-3";

    [
        editAppointmentDate,
        editAppointmentStartTime
    ].forEach(input => {
        input.classList.remove("is-invalid");
        input.setCustomValidity("");
    });
});


const rescheduleRequestModal = document.getElementById("rescheduleRequestModal");

function formatRescheduleRequestDateTime(dateTime) {
    if (!dateTime) return "Not available";

    // SQLite CURRENT_TIMESTAMP uses UTC.
    const date = new Date(dateTime.replace(" ", "T") + "Z");

    if (Number.isNaN(date.getTime())) {
        return dateTime;
    }

    return new Intl.DateTimeFormat("en-MY", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kuala_Lumpur"
    }).format(date);
}

// Open the View Reschedule Request modal
document.addEventListener("click", async function (event) {
    const viewButton = event.target.closest(".reschedule-request-button");

    if (!viewButton) return;

    const appointmentId = viewButton.dataset.appointmentId;

    const modalInstance =
        bootstrap.Modal.getOrCreateInstance(rescheduleRequestModal);

    const requestDetails =
        document.getElementById("rescheduleRequestDetails");

    const requestMessage =
        document.getElementById("rescheduleRequestMessage");

    // Reset modal content
    requestDetails.hidden = true;

    requestMessage.hidden = false;
    requestMessage.className = "mt-3 text-muted";
    requestMessage.textContent = "Loading reschedule request...";

    document.getElementById("reschedulePatientName").textContent = "";
    document.getElementById("reschedulePatientIC").textContent = "";
    document.getElementById("rescheduleAppointmentType").textContent = "";
    document.getElementById("rescheduleOriginalDate").textContent = "";
    document.getElementById("rescheduleOriginalTime").textContent = "";
    document.getElementById("rescheduleReason").textContent = "";
    document.getElementById("rescheduleRequestCreatedAt").textContent = "";

    modalInstance.show();

    try {
        const response = await fetch("/api/staff/reschedule-requests");
        const requests = await response.json();

        if (!response.ok) {
            throw new Error(
                requests.message || "Failed to load reschedule requests."
            );
        }

        const request = requests.find(item =>
            String(item.appointment_id) === String(appointmentId) &&
            item.request_status === "Pending"
        );

        if (!request) {
            throw new Error(
                "This reschedule request is no longer pending. Please refresh the appointment list."
            );
        }

        // Display patient information
        document.getElementById("reschedulePatientName").textContent =
            request.patient_name;

        document.getElementById("reschedulePatientIC").textContent =
            request.user_id;

        document.getElementById("rescheduleAppointmentType").textContent =
            request.appointment_type;

        // Display current appointment details
        document.getElementById("rescheduleOriginalDate").textContent =
            formatDate(request.original_date);

        document.getElementById("rescheduleOriginalTime").textContent =
            formatTime(request.original_start_time);

        // Display patient's reason
        document.getElementById("rescheduleReason").textContent =
            request.reason;

        // Display request submission date and time
        document.getElementById("rescheduleRequestCreatedAt").textContent =
            formatRescheduleRequestDateTime(request.created_at);

        requestDetails.hidden = false;
        requestMessage.hidden = true;

    } catch (error) {
        console.error("Error loading reschedule request:", error);

        requestMessage.hidden = false;
        requestMessage.className = "mt-3 text-danger";
        requestMessage.textContent = error.message;
    }
});


// Initial Load
loadAppointments();