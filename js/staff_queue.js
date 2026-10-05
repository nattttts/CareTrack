// ================= ELEMENTS =================

const searchInput = document.getElementById("searchInput");
const serviceFilter = document.getElementById("serviceFilter");
const statusFilter = document.getElementById("statusFilter");
const resetButton = document.getElementById("resetFilters");

const tableBody = document.getElementById("queueTableBody");
const noResults = document.getElementById("noResults");
const queueResult = document.getElementById("queueCount");

const currentQueue = document.getElementById("currentQueue");
const currentPatient = document.getElementById("currentPatient");

const skipModalElement = document.getElementById("skipModal");
const skipPatientName = document.getElementById("skipPatientName");
const confirmSkipButton = document.getElementById("confirmSkipButton");

let selectedSkipRow = null;
let currentTab = "queue";


// ================= UPDATE SUMMARY =================

function updateSummary() {

    const rows = document.querySelectorAll("#queueTableBody tr");

    let total = 0;
    let waiting = 0;
    let called = 0;
    let inProgress = 0;
    let completed = 0;

    rows.forEach(row => {
        const status = row.dataset.status;

        total++;

        if (status === "Waiting") {
            waiting++;
        }

        if (status === "Called") {
            called++;
        }

        if (status === "In Progress") {
            inProgress++;
        }

        if (status === "Completed") {
            completed++;
        }
    });

    document.getElementById("totalCount").textContent = total;
    document.getElementById("waitingCount").textContent = waiting;
    document.getElementById("calledCount").textContent = called;
    document.getElementById("progressCount").textContent = inProgress;
    document.getElementById("completedCount").textContent = completed;
}


// ================= UPDATE CURRENTLY SERVING ================= 

function updateCurrentlyServing() {

    const rows = document.querySelectorAll("#queueTableBody tr");

    let servingRows = [];

    rows.forEach(row => {
        if (row.dataset.status === "In Progress") {
            servingRows.push(row);
        }
    });


    if (servingRows.length > 0) {

        //  Display the first active queue.
        //  Different services can be In Progress at the same time.
         
        const row = servingRows[0];

        const queueNumber = row.dataset.queue;
        const patient = row.dataset.patient;
        const service = row.dataset.service;

        currentQueue.textContent = queueNumber;

        currentPatient.textContent = `${patient} · ${service}`;

    } else {
        currentQueue.textContent = "—";
        currentPatient.textContent = "No patient is currently being served.";
    }
}


// ================= UPDATE ACTION BUTTON =================

function updateActionButton(row) {

    const actionContainer =
        row.querySelector(".action-buttons");

    if (!actionContainer) {
        return;
    }

    const status = row.dataset.status;

    actionContainer.innerHTML = "";

    // ================= WAITING =================

    if (status === "Waiting") {

        const callButton = document.createElement("button");

        callButton.type = "button";
        callButton.classList.add(
            "action-button",
            "call-button"
        );

        callButton.textContent = "Call Patient";
        callButton.dataset.action = "call";

        actionContainer.appendChild(callButton);

    }

    // ================= CALLED =================

    else if (status === "Called") {

        // Start Visit
        const startButton = document.createElement("button");

        startButton.type = "button";
        startButton.classList.add(
            "action-button",
            "start-button"
        );

        startButton.textContent = "Start Visit";
        startButton.dataset.action = "start";

        // Skip
        const skipButton = document.createElement("button");

        skipButton.type = "button";
        skipButton.classList.add("action-button", "skip-button");

        skipButton.textContent = "Skip";
        skipButton.dataset.action = "skip";


        actionContainer.appendChild(startButton);
        actionContainer.appendChild(skipButton);

    }

    // ================= IN PROGRESS =================

    else if (status === "In Progress") {

        const completeButton = document.createElement("button");

        completeButton.type = "button";
        completeButton.classList.add("action-button","complete-button");

        completeButton.textContent = "Complete";
        completeButton.dataset.action = "complete";

        actionContainer.appendChild(completeButton);

    }

    // ================= COMPLETED =================

    else if (status === "Completed") {

        const completedButton = document.createElement("button");

        completedButton.type = "button";
        completedButton.classList.add("action-button", "view-button");

        completedButton.textContent = "Completed";
        completedButton.disabled = true;

        actionContainer.appendChild(completedButton);

    }

    // ================= SKIPPED =================

    else if (status === "Skipped") {

        const skippedButton = document.createElement("button");

        skippedButton.type = "button";
        skippedButton.classList.add("action-button", "view-button");

        skippedButton.textContent = "Skipped";
        skippedButton.disabled = true;

        actionContainer.appendChild(skippedButton);
    }
}


// ================= UPDATE STATUS BADGE =================

function updateStatusBadge(row) {

    const statusCell = row.children[4];

    if (!statusCell) {
        return;
    }

    const status = row.dataset.status;

    let className = "";

    if (status === "Waiting") {
        className = "waiting";
    }

    if (status === "Called") {
        className = "called";
    }

    if (status === "In Progress") {
        className = "in-progress";
    }

    if (status === "Completed") {
        className = "completed";
    }

    if (status === "Skipped") {
        className = "skipped";
    }

    statusCell.innerHTML = `
        <span class="status-badge ${className}">
            ● ${status}
        </span>
    `;
}


// ================= CHECK SERVICE AVAILABILITY =================

function isServiceOccupied(row) {

    const service = row.dataset.service;

    const rows = document.querySelectorAll("#queueTableBody tr");

    for (const otherRow of rows) {

        if (otherRow === row) {
            continue;
        }

        // A service is occupied when another patient of the same service is Called or In Progress.

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


// ================= HANDLE ACTION =================

function handleAction(button) {

    const row = button.closest("tr");

    if (!row) {
        return;
    }

    const currentStatus = row.dataset.status;

    // ================= SKIP PATIENT =================

    if (button.dataset.action === "skip") {
        openSkipModal(row);
        return;
    }

    // ================= CALL PATIENT =================

    if (currentStatus === "Waiting") {

        const occupiedRow =
            isServiceOccupied(row);

        if (occupiedRow) {
            const service = row.dataset.service;

            const patient = occupiedRow.dataset.patient;

            const occupiedStatus = occupiedRow.dataset.status;

            alert(
                `${service} is currently occupied.\n\n` +
                `${patient} is currently ${occupiedStatus.toLowerCase()}.\n\n` +
                `Please wait until the current visit is completed.`
            );

            return;
        }
        row.dataset.status = "Called";
    }

    // ================= START VISIT =================

    else if (currentStatus === "Called") {
        row.dataset.status = "In Progress";
    }

    // ================= COMPLETE VISIT =================

    else if (currentStatus === "In Progress") {
        row.dataset.status = "Completed";
        row.dataset.tab = "completed";
    }

    else {
        return;
    }

    // ================= UPDATE UI =================

    updateStatusBadge(row);

    updateActionButton(row);

    updateSummary();

    updateCurrentlyServing();

    applyFilters();
}


// ================= OPEN SKIP MODAL ================= 

function openSkipModal(row) {

    selectedSkipRow = row;

    const patient = row.dataset.patient;

    skipPatientName.textContent = patient;

    const skipModal =
        bootstrap.Modal.getOrCreateInstance(
            skipModalElement
        );

    skipModal.show();
}


// ================= CONFIRM SKIP =================

if (confirmSkipButton) {

    confirmSkipButton.addEventListener(
        "click",
        function () {

            if (!selectedSkipRow) {
                return;
            }

            // Move patient to Skipped

            selectedSkipRow.dataset.status = "Skipped";
            selectedSkipRow.dataset.tab = "skipped";

            // Update UI

            updateStatusBadge(selectedSkipRow);

            updateActionButton(selectedSkipRow);

            updateSummary();

            updateCurrentlyServing();

            applyFilters();

            // Close modal 
            const skipModal =
                bootstrap.Modal.getInstance(
                    skipModalElement
                );

            if (skipModal) {
                skipModal.hide();
            }

            // Clear selected row 
            selectedSkipRow = null;

        }
    );

}


// ================= SEARCH & FILTER =================

function applyFilters() {

    const searchValue = searchInput.value.trim().toLowerCase();

    const selectedService = serviceFilter.value;

    const selectedStatus = statusFilter.value;

    const rows = document.querySelectorAll(
        "#queueTableBody tr"
    );

    let visibleCount = 0;

    rows.forEach(row => {

        const patient = row.dataset.patient.toLowerCase();
        const child = (row.dataset.child || "").toLowerCase();
        const queue = row.dataset.queue.toLowerCase();

        const service = row.dataset.service;
        const status = row.dataset.status;
        const rowTab = row.dataset.tab;

        const matchesTab = rowTab === currentTab;


        const matchesSearch = 
            patient.includes(searchValue) ||
            child.includes(searchValue) ||
            queue.includes(searchValue);

        const matchesService = selectedService === "all" || service === selectedService;

        const matchesStatus = selectedStatus === "all" || status === selectedStatus;


        if (
            matchesTab &&
            matchesSearch &&
            matchesService &&
            matchesStatus
        ) {

            row.style.display = "";
            visibleCount++;

        } else {
            row.style.display = "none";
        }

    });

    // ================= NO RESULTS ================= 
    if (visibleCount === 0) {
        noResults.hidden = false;
    } else {
        noResults.hidden = true;
    }

    // ================= RESULT COUNT =================
    queueResult.textContent = `Showing ${visibleCount} queue record${visibleCount === 1 ? "" : "s"}`;
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


/* ================= ACTION BUTTON EVENTS ================= */

if (tableBody) {

    tableBody.addEventListener("click",

        function (event) {

            const button = event.target.closest(".action-button");

            if (!button || button.disabled) {
                return;
            }

            handleAction(button);

        }
    );

}


// ================= INITIALIZE =================

document
    .querySelectorAll("#queueTableBody tr")
    .forEach(row => {

        updateStatusBadge(row);
        updateActionButton(row);

    });

updateSummary();

updateCurrentlyServing();

applyFilters();