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

            if (displayStatus === "Pending Reschedule") {
                actionButtons += `
                    <button
                        type="button"
                        class="action-button reschedule-request-button"
                        data-appointment-id="${escapeHtml(appointment.appointment_id)}"
                    >
                        <i class="bi bi-person-check"></i>
                        Approve / Reject
                    </button>
                `;
            } else if (displayStatus === "Completed") {
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
            } else if (period === "upcoming" && displayStatus === "Confirmed") {
                actionButtons += `
                    <button
                        type="button"
                        class="action-button edit-button"
                        data-appointment-id="${escapeHtml(appointment.appointment_id)}"
                    >
                        <i class="bi bi-pencil"></i>
                        Edit
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
                    -
                    ${escapeHtml(formatTime(appointment.end_time))}
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
        `${formatTime(appointment.start_time)} - ${formatTime(appointment.end_time)}`;
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
                        patient.role === "mother" ? "Mother" : "Child"
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
        `Role: ${patient.role === "mother" ? "Mother" : "Child"}`;

    appointmentTypeInput.value =
        patient.role === "child"
            ? "Child Vaccination"
            : "Maternal Follow-up";

    selectedPatientDetails.hidden = false;
    patientSearchResults.replaceChildren();
    patientSearchMessage.textContent = "Patient selected.";
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
const appointmentEndTimeInput = document.getElementById("appointmentEndTime");
const appointmentDateMessage = document.getElementById("appointmentDateMessage");
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

// Validate the selected appointment date and times
function validateAppointmentSchedule() {
    const appointmentDate = appointmentDateInput.value;
    const startTime = appointmentStartTimeInput.value;
    const endTime = appointmentEndTimeInput.value;

    // Reset previous validation messages
    appointmentDateInput.setCustomValidity("");
    appointmentStartTimeInput.setCustomValidity("");
    appointmentEndTimeInput.setCustomValidity("");

    appointmentDateInput.classList.remove("is-invalid");
    appointmentStartTimeInput.classList.remove("is-invalid");
    appointmentEndTimeInput.classList.remove("is-invalid");

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

    // Require a date
    if (!appointmentDate) {
        errorMessage = "Please select an appointment date.";
        invalidInput = appointmentDateInput;
    }

    // Prevent appointments in the past
    else if (appointmentDate < getTodayDate()) {
        errorMessage = "The appointment date cannot be in the past.";
        invalidInput = appointmentDateInput;
    }

    // Check the clinic's operating day and hours
    else {
        // Interpret YYYY-MM-DD as a local calendar date
        const [year, month, day] = appointmentDate
            .split("-")
            .map(Number);

        const selectedDate = new Date(year, month - 1, day);
        const dayOfWeek = selectedDate.getDay();

        let openingTime;
        let closingTime;

        if (dayOfWeek === 0) {
            errorMessage = "The clinic is closed on Sundays.";
            invalidInput = appointmentDateInput;
        } else if (dayOfWeek === 6) {
            openingTime = "09:00";
            closingTime = "13:00";
        } else {
            openingTime = "08:30";
            closingTime = "17:00";
        }

        // Continue only if the selected day is permitted
        if (!errorMessage) {
            if (!startTime) {
                errorMessage = "Please select a start time.";
                invalidInput = appointmentStartTimeInput;
            } else if (!endTime) {
                errorMessage = "Please select an end time.";
                invalidInput = appointmentEndTimeInput;
            } else if (
                startTime < openingTime ||
                startTime >= closingTime
            ) {
                errorMessage =
                    `Start time must be between ${openingTime} and ${closingTime}.`;
                invalidInput = appointmentStartTimeInput;
            } else if (
                endTime <= startTime ||
                endTime > closingTime
            ) {
                errorMessage =
                    "End time must be after the start time and no later than closing time.";
                invalidInput = appointmentEndTimeInput;
            } else {
                // Prevent a start time in the past today
                if (appointmentDate === getTodayDate()) {
                    const now = new Date();

                    const currentTime =
                        `${String(now.getHours()).padStart(2, "0")}:` +
                        `${String(now.getMinutes()).padStart(2, "0")}`;

                    if (startTime <= currentTime) {
                        errorMessage =
                            "The start time must be later than the current time.";
                        invalidInput = appointmentStartTimeInput;
                    }
                }
            }
        }
    }

    // Display validation errors
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


// Validate again whenever a field changes
[
    appointmentDateInput,
    appointmentStartTimeInput,
    appointmentEndTimeInput
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
                start_time: appointmentStartTimeInput.value,
                end_time: appointmentEndTimeInput.value
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
        appointmentStartTimeInput,
        appointmentEndTimeInput
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
const editAppointmentEndTime = document.getElementById("editAppointmentEndTime");
const editAppointmentMessage = document.getElementById("editAppointmentMessage");
const saveAppointmentChangesButton = document.getElementById("saveAppointmentChangesButton");

let editingAppointmentId = null;

// Open the Edit Appointment modal when Edit is clicked
document.addEventListener("click", function (event) {
    const editButton = event.target.closest(".edit-button");

    if (!editButton) return;

    const appointmentId = editButton.dataset.appointmentId;

    const appointment = appointmentsData.find(
        item => String(item.appointment_id) === String(appointmentId)
    );

    if (!appointment) {
        showToast("Unable to find this appointment. Please refresh the page.", "error");
        return;
    }

    // Only allow editing upcoming confirmed appointments
    const today = getLocalDateString();

    if (
        appointment.appointment_date <= today ||
        appointment.status !== "Confirmed"
    ) {
        showToast("Only upcoming confirmed appointments can be edited.", "error");
        return;
    }

    editingAppointmentId = appointment.appointment_id;

    editPatientName.value = appointment.patient_name;
    editAppointmentType.value = appointment.appointment_type;
    editAppointmentDate.value = appointment.appointment_date;
    editAppointmentStartTime.value = appointment.start_time;
    editAppointmentEndTime.value = appointment.end_time;

    editAppointmentMessage.hidden = true;
    editAppointmentMessage.textContent = "";
    editAppointmentMessage.className = "mt-3";

    // Remove old validation styling
    [
        editAppointmentDate,
        editAppointmentStartTime,
        editAppointmentEndTime
    ].forEach(input => {
        input.classList.remove("is-invalid");
        input.setCustomValidity("");
    });

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
    const endTime = editAppointmentEndTime.value;

    // Clear previous validation styling
    [
        editAppointmentDate,
        editAppointmentStartTime,
        editAppointmentEndTime
    ].forEach(input => {
        input.classList.remove("is-invalid");
        input.setCustomValidity("");
    });

    editAppointmentMessage.hidden = true;
    editAppointmentMessage.textContent = "";

    let hasError = false;

    // Prevent selecting a past date
    if (appointmentDate < getLocalDateString()) {
        editAppointmentDate.classList.add("is-invalid");
        showEditAppointmentMessage(
            "The appointment date cannot be in the past."
        );
        hasError = true;
    }

    // Ensure the end time is later than the start time
    if (startTime && endTime && endTime <= startTime) {
        editAppointmentEndTime.classList.add("is-invalid");
        showEditAppointmentMessage(
            "The end time must be later than the start time."
        );
        hasError = true;
    }

    if (hasError) return;

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
                    start_time: startTime,
                    end_time: endTime
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            showToast(result.message || "Unable to update the appointment.", "error");
            return;
        }

        // Refresh the table using the updated database records
        await loadAppointments();

        bootstrap.Modal.getOrCreateInstance(editAppointmentModal).hide();

        if (result.changed) {
            showToast("Appointment successfully rescheduled.", "success");
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
        editAppointmentStartTime,
        editAppointmentEndTime
    ].forEach(input => {
        input.classList.remove("is-invalid");
        input.setCustomValidity("");
    });
});


function showRescheduleRequestMessage(message, type = "danger") {
    rescheduleRequestMessage.textContent = message;
    rescheduleRequestMessage.className = `alert alert-${type} mt-3`;
    rescheduleRequestMessage.hidden = false;
}

function clearRescheduleRequestMessage() {
    rescheduleRequestMessage.textContent = "";
    rescheduleRequestMessage.className = "mt-3";
    rescheduleRequestMessage.hidden = true;
}

const rescheduleRequestModal = document.getElementById("rescheduleRequestModal");
const rescheduleRequestMessage = document.getElementById("rescheduleRequestMessage");
const rescheduleRejectionSection = document.getElementById("rescheduleRejectionSection");
const rescheduleRejectReason = document.getElementById("rescheduleRejectReason");

const approveRescheduleRequestButton = document.getElementById(
    "approveRescheduleRequestButton"
);

const rejectRescheduleRequestButton = document.getElementById(
    "rejectRescheduleRequestButton"
);

const confirmRejectRescheduleButton = document.getElementById(
    "confirmRejectRescheduleButton"
);

let currentRescheduleRequest = null;

// Open the modal from the Approve / Reject button
document.addEventListener("click", async function (event) {
    const manageButton = event.target.closest(".reschedule-request-button");

    if (!manageButton) return;

    const appointmentId = manageButton.dataset.appointmentId;

    currentRescheduleRequest = null;

    clearRescheduleRequestMessage();
    rescheduleRejectReason.value = "";

    // Reset the modal to its initial state
    rescheduleRejectionSection.hidden = true;
    approveRescheduleRequestButton.hidden = false;
    rejectRescheduleRequestButton.hidden = false;
    approveRescheduleRequestButton.disabled = true;
    rejectRescheduleRequestButton.disabled = true;

    document.getElementById("reschedulePatientName").textContent = "Loading...";
    document.getElementById("reschedulePatientIC").textContent = "";
    document.getElementById("rescheduleAppointmentType").textContent = "";
    document.getElementById("rescheduleOriginalDate").textContent = "";
    document.getElementById("rescheduleOriginalTime").textContent = "";
    document.getElementById("rescheduleProposedDate").textContent = "";
    document.getElementById("rescheduleProposedTime").textContent = "";

    const modalInstance =
        bootstrap.Modal.getOrCreateInstance(rescheduleRequestModal);

    modalInstance.show();

    try {
        const response = await fetch("/api/staff/reschedule-requests");
        const requests = await response.json();

        if (!response.ok) {
            showToast(requests.message || "Failed to load reschedule requests.", "error");
            throw new Error(
                requests.message || "Failed to load reschedule requests."
            );
        }

        currentRescheduleRequest = requests.find(request =>
            String(request.appointment_id) === String(appointmentId) &&
            request.request_status === "Pending"
        );

        if (!currentRescheduleRequest) {
            showToast("This reschedule request is no longer pending. Please refresh the appointment list.", "error");
            throw new Error(
                "This reschedule request is no longer pending. Please refresh the appointment list."
            );
        }

        const request = currentRescheduleRequest;

        document.getElementById("reschedulePatientName").textContent =
            request.patient_name;

        document.getElementById("reschedulePatientIC").textContent =
            request.user_id;

        document.getElementById("rescheduleAppointmentType").textContent =
            request.appointment_type;

        document.getElementById("rescheduleOriginalDate").textContent =
            formatDate(request.original_date);

        document.getElementById("rescheduleOriginalTime").textContent =
            `${formatTime(request.original_start_time)} – ${formatTime(request.original_end_time)}`;

        document.getElementById("rescheduleProposedDate").textContent =
            formatDate(request.proposed_date);

        document.getElementById("rescheduleProposedTime").textContent =
            `${formatTime(request.proposed_start_time)} – ${formatTime(request.proposed_end_time)}`;

        // Enable the decision buttons once the request has loaded
        approveRescheduleRequestButton.disabled = false;
        rejectRescheduleRequestButton.disabled = false;

    } catch (error) {
        console.error("Error loading reschedule request:", error);

        showRescheduleRequestMessage(error.message);

        // Prevent decisions when request details fail to load
        approveRescheduleRequestButton.disabled = true;
        rejectRescheduleRequestButton.disabled = true;
    }
});


async function submitRescheduleDecision(action) {
    if (!currentRescheduleRequest) {
        showRescheduleRequestMessage(
            "No reschedule request is selected."
        );
        return;
    }

    const requestId = currentRescheduleRequest.reschedule_request_id;

    const actionButton = action === "approve"
        ? approveRescheduleRequestButton
        : confirmRejectRescheduleButton;

    const otherButton = action === "approve"
        ? rejectRescheduleRequestButton
        : approveRescheduleRequestButton;

    const originalButtonHTML = actionButton.innerHTML;

    actionButton.disabled = true;
    otherButton.disabled = true;

    actionButton.innerHTML = `
        <span
            class="spinner-border spinner-border-sm me-1"
            aria-hidden="true"
        ></span>
        Processing...
    `;

    clearRescheduleRequestMessage();

    try {
        const body = action === "reject"
            ? { reject_reason: rescheduleRejectReason.value.trim() }
            : {};

        const response = await fetch(
            `/api/staff/reschedule-requests/${encodeURIComponent(requestId)}/${action}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            }
        );

        const result = await response.json();

        if (!response.ok) {
            showRescheduleRequestMessage(
                result.message || `Failed to ${action} the request.`
            );
            return;
        }

        // Refresh the table so the pending status and buttons update
        await loadAppointments();

        // Close after a successful decision
        bootstrap.Modal.getOrCreateInstance(rescheduleRequestModal).hide();

        showToast(result.message || "Reschedule request processed successfully.", "success");
    } catch (error) {
        console.error(`Error trying to ${action} reschedule request:`, error);
        showToast("A server error occurred. Please try again.", "error");
    } finally {
        actionButton.disabled = false;
        otherButton.disabled = false;

        actionButton.innerHTML = originalButtonHTML;
    }
}

approveRescheduleRequestButton.addEventListener("click", () => {
    submitRescheduleDecision("approve");
});

rejectRescheduleRequestButton.addEventListener("click", () => {
    // Reveal the rejection reason and confirmation button
    rescheduleRejectionSection.hidden = false;

    // Hide the original reject button to avoid confusion
    rejectRescheduleRequestButton.hidden = true;
});

confirmRejectRescheduleButton.addEventListener("click", () => {
    const rejectReason = rescheduleRejectReason.value.trim();

    if (!rejectReason) {
        rescheduleRejectReason.classList.add("is-invalid");
        rescheduleRejectReason.focus();
        showRescheduleRequestMessage(
            "Please enter a reason for rejecting this reschedule request."
        );
        return;
    }

    rescheduleRejectReason.classList.remove("is-invalid");
    submitRescheduleDecision("reject");
});

rescheduleRejectReason.addEventListener("input", () => {
    if (rescheduleRejectReason.value.trim()) {
        rescheduleRejectReason.classList.remove("is-invalid");
        clearRescheduleRequestMessage();
    }
});

// Reset reschedule request modal state when it closes
rescheduleRequestModal.addEventListener("hidden.bs.modal", () => {
    currentRescheduleRequest = null;
    rescheduleAction = null;

    rescheduleRejectReason.value = "";

    rescheduleRejectionSection.hidden = true;
    confirmRejectRescheduleButton.disabled = false;
    confirmRejectRescheduleButton.textContent = "Confirm Rejection";

    approveRescheduleRequestButton.hidden = false;
    rejectRescheduleRequestButton.hidden = false;

    approveRescheduleRequestButton.disabled = false;
    rejectRescheduleRequestButton.disabled = false;

    approveRescheduleRequestButton.innerHTML =
        '<i class="bi bi-check-circle"></i> Approve';

    rejectRescheduleRequestButton.innerHTML =
        '<i class="bi bi-x-circle"></i> Reject';

    clearRescheduleRequestMessage();
});


// Initial Load
loadAppointments();