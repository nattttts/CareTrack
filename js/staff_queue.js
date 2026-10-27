// ================= ELEMENTS =================
const searchInput = document.getElementById("searchInput");
const serviceFilter = document.getElementById("serviceFilter");
const statusFilter = document.getElementById("statusFilter");
const resetButton = document.getElementById("resetFilters");

const tableBody = document.getElementById("queueTableBody");
const noResults = document.getElementById("noResults");
const queueResult = document.getElementById("queueCount");

const callModalElement = document.getElementById("callModal");
const callPatientName = document.getElementById("callPatientName");
const callQueueNumber = document.getElementById("callQueueNumber");
const confirmCallButton = document.getElementById("confirmCallButton");

// Start Visit Modal
const startVisitModalElement = document.getElementById("startVisitModal");
const startVisitPatientName = document.getElementById("startVisitPatientName");
const startVisitQueueNumber = document.getElementById("startVisitQueueNumber");
const confirmStartVisitButton = document.getElementById("confirmStartVisitButton");

// Complete Modal
const completeModalElement = document.getElementById("completeModal");
const completePatientName = document.getElementById("completePatientName");
const completeQueueNumber = document.getElementById("completeQueueNumber");
const confirmCompleteButton = document.getElementById("confirmCompleteButton");

const skipModalElement = document.getElementById("skipModal");
const skipPatientName = document.getElementById("skipPatientName");
const confirmSkipButton = document.getElementById("confirmSkipButton");


const selectedCallState = { row: null };
const selectedStartVisitState = { row: null };
const selectedCompleteState = { row: null };
const selectedSkipState = { row: null };

let currentTab = "queue";
let queueData = [];
let isLoading = false;
let queueLoadError = false;

// Format appointment time, e.g. 10:30 AM.
function formatAppointmentTime(time) {

    if (!time) {
        return "—";
    }

    const parts = time.split(":");
    const hour = Number(parts[0]);
    const minute = parts[1] || "00";

    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
        return time;
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

    if (status === "Skipped") {
        return "skipped";
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
        row.dataset.appointmentId = entry.appointment_id;
        row.dataset.patient = patientName;
        row.dataset.queue = String(queueNumber);
        row.dataset.service = service;
        row.dataset.status = status;
        row.dataset.startTime = entry.start_time;
        row.dataset.tab = getQueueTab(status);
        row.dataset.role = entry.patient_role || "";

        // Queue number.
        const queueCell = document.createElement("td");

        const queueNumberElement = document.createElement("strong");
        queueNumberElement.classList.add("queue-number");
        queueNumberElement.textContent = queueNumber;

        queueCell.appendChild(queueNumberElement);

        // Patient name
        const patientCell = document.createElement("td");

        const patientCellContainer = document.createElement("div");
        patientCellContainer.classList.add("patient-cell");

        const patientNameElement = document.createElement("h6");
        patientNameElement.textContent = patientName;

        patientCellContainer.appendChild(patientNameElement);
        patientCell.appendChild(patientCellContainer);

        // Service.
        const serviceCell = document.createElement("td");

        const serviceElement = document.createElement("p");
        serviceElement.classList.add("service-name");
        serviceElement.textContent = service;

        serviceCell.appendChild(serviceElement);

        // Appointment time.
        const appointmentCell = document.createElement("td");

        const appointmentTimeElement = document.createElement("p");
        appointmentTimeElement.classList.add("appointment-time");
        appointmentTimeElement.textContent = appointmentTime;

        appointmentCell.appendChild(appointmentTimeElement);

        // Status.
        const statusCell = document.createElement("td");
        statusCell.classList.add("status-column");

        // Actions.
        const actionCell = document.createElement("td");
        actionCell.classList.add("actions-column");

        const actionContainer = document.createElement("div");
        actionContainer.classList.add("action-buttons");

        actionCell.appendChild(actionContainer);

        row.append(
            queueCell,
            patientCell,
            serviceCell,
            appointmentCell,
            statusCell,
            actionCell
        );

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
    let inProgress = 0;
    let completed = 0;

    queueData.forEach(entry => {

        total++;

        if (entry.queue_status === "Waiting") {
            waiting++;
        } else if (entry.queue_status === "Called") {
            called++;
        } else if (entry.queue_status === "In Progress") {
            inProgress++;
        } else if (entry.queue_status === "Completed") {
            completed++;
        }
    });

    document.getElementById("totalCount").textContent = total;
    document.getElementById("waitingCount").textContent = waiting;
    document.getElementById("calledCount").textContent = called;
    document.getElementById("progressCount").textContent = inProgress;
    document.getElementById("completedCount").textContent = completed;
}

// ================= UPDATE ACTION BUTTON =================
function updateActionButton(row) {

    const actionContainer = row.querySelector(".action-buttons");

    if (!actionContainer) {
        return;
    }

    const status = row.dataset.status;

    actionContainer.innerHTML = "";

    function createActionButton(label, action, className, disabled = false) {

        const button = document.createElement("button");

        button.type = "button";
        button.classList.add("action-button", className);
        button.textContent = label;
        button.dataset.action = action;
        button.disabled = disabled;

        return button;
    }

    if (status === "Waiting") {

        actionContainer.appendChild(
            createActionButton(
                "Call Patient",
                "call",
                "call-button"
            )
        );

    } else if (status === "Called") {

        actionContainer.append(
            createActionButton(
                "Start Visit",
                "start",
                "start-button"
            ),
            createActionButton(
                "Skip",
                "skip",
                "skip-button"
            )
        );

    } else if (status === "In Progress") {

        actionContainer.appendChild(
            createActionButton(
                "Complete",
                "complete",
                "complete-button"
            )
        );

    } else if (status === "Completed") {

        actionContainer.appendChild(
            createActionButton(
                "Completed",
                "view",
                "view-button",
                true
            )
        );

    } else if (status === "Skipped") {

        actionContainer.appendChild(
            createActionButton(
                "Skipped",
                "view",
                "view-button",
                true
            )
        );
    }
}

// ================= UPDATE STATUS BADGE =================
function updateStatusBadge(row) {

    const statusCell = row.children[4];

    if (!statusCell) {
        return;
    }

    const status = row.dataset.status;

    const classNames = {
        "Waiting": "waiting",
        "Called": "called",
        "In Progress": "in-progress",
        "Completed": "completed",
        "Skipped": "skipped"
    };

    const className = classNames[status] || "";

    // Create the status badge.
    const statusBadge = document.createElement("span");
    statusBadge.classList.add("status-badge");

    if (className) {
        statusBadge.classList.add(className);
    }

    // Add the status indicator.
    statusBadge.textContent = `● ${status}`;

    // Replace the existing status badge.
    statusCell.replaceChildren(statusBadge);
}

// ================= CHECK SERVICE AVAILABILITY =================
function isServiceOccupied(row) {

    const service = row.dataset.service;

    const rows = tableBody.querySelectorAll("tr");

    for (const otherRow of rows) {

        if (otherRow === row) {
            continue;
        }

        if (
            otherRow.dataset.service === service &&
            (
                otherRow.dataset.status === "Called" ||
                otherRow.dataset.status === "In Progress"
            )
        ) {
            return otherRow;
        }
    }

    return null;
}

// ================= UPDATE STATUS THROUGH API =================
async function updateQueueStatus(row, newStatus) {

    if (!row || !row.dataset.id) {
        alert("Queue entry ID is missing.");
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
        alert(error.message || "Failed to update queue status.");

        // Restore the latest saved state after an unsuccessful update.
        await loadQueue();

        return false;
    }
}

// ================= CHECK APPOINTMENT START TIME =================
function hasAppointmentStarted(row) {
    const appointmentStartTime = row.dataset.startTime;

    if (!appointmentStartTime) {
        return false;
    }

    const currentTime = new Date().toLocaleTimeString("en-GB", {
        timeZone: "Asia/Kuala_Lumpur",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    // Compare the current time with the appointment start time.
    return currentTime >= appointmentStartTime;
}

// ================= HANDLE ACTION =================
function handleAction(button) {

    const row = button.closest("tr");

    if (!row) {
        return;
    }

    const action = button.dataset.action;
    const currentStatus = row.dataset.status;

    if (action === "skip") {
        openSkipModal(row);
        return;
    }

    if (action === "call" && currentStatus === "Waiting") {
        // Check appointment start time first.
        if (!hasAppointmentStarted(row)) {
            alert(
                "The appointment has not started yet. " +
                "Please wait until the appointment start time."
            );
            return;
        }

        // Check whether the same service is occupied.
        const occupiedRow = isServiceOccupied(row);

        if (occupiedRow) {
            alert(
                `${row.dataset.service} is currently occupied.\n\n` +
                `${occupiedRow.dataset.patient} is currently ` +
                `${occupiedRow.dataset.status.toLowerCase()}.\n\n` +
                "Please wait until the current visit is completed."
            );
            return;
        }

        // Open the confirmation modal only when calling is allowed.
        openCallModal(row);
        return;
    }

    if (action === "start" && currentStatus === "Called") {
        openStartVisitModal(row);
        return;
    }

    if (action === "complete" && currentStatus === "In Progress") {
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

// ================= OPEN START VISIT MODAL =================
function openStartVisitModal(row) {

    selectedStartVisitState.row = row;

    startVisitPatientName.textContent = row.dataset.patient;
    startVisitQueueNumber.textContent = row.dataset.queue;

    const startVisitModal = bootstrap.Modal.getOrCreateInstance(
        startVisitModalElement
    );

    startVisitModal.show();
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

// ================= CONFIRM START VISIT =================
if (confirmStartVisitButton) {

    confirmStartVisitButton.addEventListener("click", async function () {

        const row = selectedStartVisitState.row;

        if (!row) {
            return;
        }

        confirmStartVisitButton.disabled = true;

        try {

            const success = await updateQueueStatus(row, "In Progress");

            if (!success) {
                return;
            }

            const startVisitModal = bootstrap.Modal.getInstance(
                startVisitModalElement
            );

            if (startVisitModal) {
                startVisitModal.hide();
            }

            selectedStartVisitState.row = null;

        } finally {
            confirmStartVisitButton.disabled = false;
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