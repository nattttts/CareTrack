import { showToast } from "./popup_message.js";

// ================= ELEMENTS =================
const searchInput = document.getElementById("searchInput");
const serviceFilter = document.getElementById("serviceFilter");
const statusFilter = document.getElementById("statusFilter");
const resetButton = document.getElementById("resetFilters");

const tableBody = document.getElementById("queueTableBody");
const noResults = document.getElementById("noResults");
const queueResult = document.getElementById("queueCount");

// Call Modal
const callModalElement = document.getElementById("callModal");
const callPatientName = document.getElementById("callPatientName");
const callQueueNumber = document.getElementById("callQueueNumber");
const confirmCallButton = document.getElementById("confirmCallButton");

// Complete Modal
const completeModalElement = document.getElementById("completeModal");
const completePatientName = document.getElementById("completePatientName");
const completeQueueNumber = document.getElementById("completeQueueNumber");
const confirmCompleteButton = document.getElementById("confirmCompleteButton");

// Skip Modal
const skipModalElement = document.getElementById("skipModal");
const skipPatientName = document.getElementById("skipPatientName");
const confirmSkipButton = document.getElementById("confirmSkipButton");

const selectedCallState = { row: null };
const selectedCompleteState = { row: null };
const selectedSkipState = { row: null };

let currentTab = "queue";
let queueData = [];
let isLoading = false;
let queueLoadError = false;

// ================= HTML ESCAPING =================
function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, character => {

        const characters = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return characters[character];
    });
}

// ================= FORMAT APPOINTMENT TIME =================
function formatAppointmentTime(time) {

    if (!time) {
        return "—";
    }

    const parts = String(time).split(":");
    const hour = Number(parts[0]);
    const minute = parts[1] || "00";

    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
        return String(time);
    }

    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minute} ${period}`;
}

// Format the date displayed above the queue table.
function updateQueueDate() {

    const dateElement = document.querySelector(".queue-date");

    if (!dateElement) {
        return;
    }

    const today = new Intl.DateTimeFormat("en-MY", {
        timeZone: "Asia/Kuala_Lumpur",
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(new Date());

    dateElement.textContent = today;
}

// Determine which tab a queue entry belongs to.
function getQueueTab(status) {

    if (status === "Completed") {
        return "completed";
    }

    return "queue";
}

// ================= LOAD QUEUE FROM DATABASE =================
async function loadQueue() {

    if (isLoading) {
        return;
    }

    isLoading = true;

    try {

        const response = await fetch("/api/staff/queue", {
            method: "GET",
            credentials: "same-origin"
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Failed to load today's queue."
            );
        }

        if (!Array.isArray(data)) {
            throw new Error("Invalid queue data received from server.");
        }

        queueLoadError = false;
        queueData = data;
        renderQueue();

    } catch (error) {

        console.error("Error loading queue:", error);

        queueLoadError = true;
        queueData = [];
        tableBody.innerHTML = "";

        updateSummary();

        noResults.hidden = false;

        noResults.querySelector("h5").textContent =
            "Unable to load queue";

        noResults.querySelector("p").textContent =
            error.message || "Please refresh the page and try again.";

        queueResult.textContent = "Queue records could not be loaded.";

    } finally {
        isLoading = false;
    }
}

// ================= RENDER QUEUE TABLE =================
function renderQueue() {

    tableBody.innerHTML = "";

    queueData.forEach(entry => {

        const row = document.createElement("tr");
        const patientName = entry.patient_name || "Unknown Patient";
        const service = entry.appointment_type || "";
        const status = entry.queue_status || "";
        const queueNumber = entry.queue_number;
        const appointmentTime = formatAppointmentTime(entry.start_time);

        row.dataset.id = entry.queue_entry_id;
        row.dataset.patient = patientName;
        row.dataset.queue = String(queueNumber ?? "");
        row.dataset.service = service;
        row.dataset.status = status;
        row.dataset.tab = getQueueTab(status);

        row.innerHTML = `
            <td>
                <strong class="queue-number">
                    ${escapeHTML(queueNumber)}
                </strong>
            </td>

            <td>
                <div class="patient-cell">
                    <h6>${escapeHTML(patientName)}</h6>
                </div>
            </td>

            <td>
                <p class="service-name">
                    ${escapeHTML(service)}
                </p>
            </td>

            <td>
                <p class="appointment-time">
                    ${escapeHTML(appointmentTime)}
                </p>
            </td>

            <td class="status-column"></td>

            <td class="actions-column">
                <div class="action-buttons"></div>
            </td>
        `;

        tableBody.appendChild(row);

        updateStatusBadge(row);
        updateActionButton(row);
    });

    updateQueueDate();
    updateSummary();
    applyFilters();
}

// ================= UPDATE SUMMARY =================
function updateSummary() {

    let total = 0;
    let waiting = 0;
    let called = 0;
    let completed = 0;

    queueData.forEach(entry => {

        total++;

        if (entry.queue_status === "Waiting") {
            waiting++;
        } else if (entry.queue_status === "Called") {
            called++;
        } else if (entry.queue_status === "Completed") {
            completed++;
        }
    });

    document.getElementById("totalCount").textContent = total;
    document.getElementById("waitingCount").textContent = waiting;
    document.getElementById("calledCount").textContent = called;
    document.getElementById("completedCount").textContent = completed;
}

// ================= UPDATE ACTION BUTTON =================
function updateActionButton(row) {

    const actionContainer = row.querySelector(".action-buttons");

    if (!actionContainer) {
        return;
    }

    const status = row.dataset.status;

    if (status === "Waiting") {

        actionContainer.innerHTML = `
            <button
                type="button"
                class="action-button call-button"
                data-action="call"
            >
                Call Patient
            </button>
        `;

    } else if (status === "Called") {

        actionContainer.innerHTML = `
            <button
                type="button"
                class="action-button complete-button"
                data-action="complete"
            >
                Complete
            </button>

            <button
                type="button"
                class="action-button skip-button"
                data-action="skip"
            >
                Skip
            </button>
        `;

    } else {

        actionContainer.innerHTML = "";
    }
}

// ================= UPDATE STATUS BADGE =================
function updateStatusBadge(row) {

    const statusCell = row.querySelector(".status-column");

    if (!statusCell) {
        return;
    }

    const status = row.dataset.status;

    const classNames = {
        "Waiting": "waiting",
        "Called": "called",
        "Completed": "completed",
        "Skipped": "skipped"
    };

    const className = classNames[status] || "";

    statusCell.innerHTML = `
        <span class="status-badge ${className}">
            ● ${escapeHTML(status)}
        </span>
    `;
}

// ================= UPDATE STATUS THROUGH API =================
async function updateQueueStatus(row, newStatus) {

    if (!row || !row.dataset.id) {
        showToast("Queue entry ID is missing.", "error");
        return false;
    }

    const buttons = row.querySelectorAll("button");

    buttons.forEach(button => {
        button.disabled = true;
    });

    try {

        const response = await fetch(
            `/api/staff/queue/${encodeURIComponent(row.dataset.id)}/status`,
            {
                method: "PATCH",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    status: newStatus
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Failed to update queue status."
            );
        }

        // Reload saved data from the database.
        await loadQueue();
        return true;

    } catch (error) {

        console.error("Error updating queue:", error);

        showToast(
            error.message || "Failed to update queue status.",
            "error"
        );

        // Restore the latest saved state after an unsuccessful update.
        await loadQueue();
        return false;
    }
}

// ================= HANDLE ACTION =================
function handleAction(button) {

    const row = button.closest("tr");

    if (!row) {
        return;
    }

    const action = button.dataset.action;
    const currentStatus = row.dataset.status;

    if (action === "skip" && currentStatus === "Called") {
        openSkipModal(row);
        return;
    }

    if (action === "call" && currentStatus === "Waiting") {
        openCallModal(row);
        return;
    }

    if (action === "complete" && currentStatus === "Called") {
        openCompleteModal(row);
        return;
    }
}

// ================= OPEN CALL MODAL =================
function openCallModal(row) {

    selectedCallState.row = row;

    callPatientName.textContent = row.dataset.patient;
    callQueueNumber.textContent = row.dataset.queue;

    const callModal = bootstrap.Modal.getOrCreateInstance(
        callModalElement
    );

    callModal.show();
}

// ================= OPEN COMPLETE MODAL =================
function openCompleteModal(row) {
    selectedCompleteState.row = row;

    completePatientName.textContent = row.dataset.patient;
    completeQueueNumber.textContent = row.dataset.queue;

    const completeModal = bootstrap.Modal.getOrCreateInstance(
        completeModalElement
    );

    completeModal.show();
}

// ================= OPEN SKIP MODAL =================
function openSkipModal(row) {

    selectedSkipState.row = row;
    skipPatientName.textContent = row.dataset.patient;

    const skipModal = bootstrap.Modal.getOrCreateInstance(
        skipModalElement
    );

    skipModal.show();
}

// ================= CONFIRM CALL =================
if (confirmCallButton) {

    confirmCallButton.addEventListener("click", async function () {

        const row = selectedCallState.row;

        if (!row) {
            return;
        }

        confirmCallButton.disabled = true;

        try {

            const success = await updateQueueStatus(row, "Called");

            if (!success) {
                return;
            }

            const callModal = bootstrap.Modal.getInstance(
                callModalElement
            );

            if (callModal) {
                callModal.hide();
            }

            selectedCallState.row = null;

        } finally {
            confirmCallButton.disabled = false;
        }
    });
}

// ================= CONFIRM COMPLETE =================
if (confirmCompleteButton) {
    confirmCompleteButton.addEventListener("click", async function () {
        const row = selectedCompleteState.row;

        if (!row) {
            return;
        }

        confirmCompleteButton.disabled = true;

        try {
            
            const success = await updateQueueStatus(row, "Completed");

            if (!success) {
                return;
            }

            const completeModal = bootstrap.Modal.getInstance(
                completeModalElement
            );

            if (completeModal) {
                completeModal.hide();
            }

            selectedCompleteState.row = null;

        } finally {
            confirmCompleteButton.disabled = false;
        }
    });
}

// ================= CONFIRM SKIP =================
if (confirmSkipButton) {

    confirmSkipButton.addEventListener("click", async function () {

        const row = selectedSkipState.row;

        if (!row) {
            return;
        }

        confirmSkipButton.disabled = true;

        try {

            const success = await updateQueueStatus(row, "Skipped");

            if (!success) {
                return;
            }

            const skipModal = bootstrap.Modal.getInstance(
                skipModalElement
            );

            if (skipModal) {
                skipModal.hide();
            }

            selectedSkipState.row = null;

        } finally {
            confirmSkipButton.disabled = false;
        }
    });
}


// ================= SEARCH & FILTER =================
function applyFilters() {
    if (queueLoadError) {
        return;
    }

    const searchValue = searchInput.value.trim().toLowerCase();
    const selectedService = serviceFilter.value;
    const selectedStatus = statusFilter.value;

    const rows = tableBody.querySelectorAll("tr");

    let visibleCount = 0;

    rows.forEach(row => {

        const patient = (row.dataset.patient || "").toLowerCase();
        const queue = (row.dataset.queue || "").toLowerCase();

        const service = row.dataset.service;
        const status = row.dataset.status;
        const rowTab = row.dataset.tab;

        const matchesTab = rowTab === currentTab;

        const matchesSearch = patient.includes(searchValue) || queue.includes(searchValue);

        const matchesService = selectedService === "all" || service === selectedService;

        const matchesStatus = selectedStatus === "all" || status === selectedStatus;

        const isVisible =
            matchesTab &&
            matchesSearch &&
            matchesService &&
            matchesStatus;

        row.style.display = isVisible ? "" : "none";

        if (isVisible) {
            visibleCount++;
        }
    });

    noResults.hidden = visibleCount !== 0;

    const heading = noResults.querySelector("h5");
    const description = noResults.querySelector("p");

    if (heading) {
        heading.textContent = "No queue records found";
    }

    if (description) {
        description.textContent =
            "Try changing your search or filter options.";
    }

    queueResult.textContent =
        `Showing ${visibleCount} queue record${visibleCount === 1 ? "" : "s"}`;
}

// ================= RESET FILTERS =================
function resetFilters() {
    searchInput.value = "";
    serviceFilter.value = "all";
    statusFilter.value = "all";

    applyFilters();
}

// ================= EVENT LISTENERS =================
if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
}

if (serviceFilter) {
    serviceFilter.addEventListener("change", applyFilters);
}

if (statusFilter) {
    statusFilter.addEventListener("change", applyFilters);
}

if (resetButton) {
    resetButton.addEventListener("click", resetFilters);
}

// ================= QUEUE TABS =================
const queueTabs = document.querySelectorAll(".queue-tab");

queueTabs.forEach(tab => {

    tab.addEventListener("click", function () {

        queueTabs.forEach(item => {
            item.classList.remove("active");
        });

        this.classList.add("active");

        currentTab = this.dataset.tab;

        applyFilters();
    });
});

// ================= ACTION BUTTON EVENTS =================
if (tableBody) {

    tableBody.addEventListener("click", function (event) {

        const button = event.target.closest(".action-button");

        if (!button || button.disabled) {
            return;
        }

        handleAction(button);
    });
}

// ================= INITIALIZE =================
updateQueueDate();
loadQueue();