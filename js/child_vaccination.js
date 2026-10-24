const API_BASE = "http://localhost:3000/api";

const $ = (id) => document.getElementById(id);

let currentUser = null;
let children = [];
let vaccinationRecords = [];
let selectedChildId = null;
let isLoadingRecords = false;

document.addEventListener("DOMContentLoaded", initialisePage);

// =====================================================
// INITIALISE PAGE
// =====================================================
async function initialisePage() {
    const tableBody = $("vaccinationTableBody");
    const statusFilter = $("statusFilter");

    if (!tableBody || !statusFilter || !$("pageMessage")) {
        console.error("Required vaccination page elements are missing.");
        return;
    }

    tableBody.innerHTML = loadingRow();

    // Register the status filter once.
    statusFilter.addEventListener("change", renderRecords);

    // Register the child dropdown if it exists in the HTML.
    const childSelect = $("childSelect");

    if (childSelect) {
        childSelect.addEventListener("change", async (event) => {
            const childId = event.target.value;

            if (!childId) {
                selectedChildId = null;
                vaccinationRecords = [];
                renderRecords();
                return;
            }

            selectedChildId = childId;
            await loadVaccinationRecords(childId);
        });
    }

    try {
        // Get the logged-in user from the session.
        currentUser = await apiRequest(`${API_BASE}/me`);

        if (!currentUser || !currentUser.userId) {
            setChildSelectorVisible(false);

            showMessage("Please log in to view vaccination records.");
            tableBody.innerHTML = emptyRow(
                "Please log in to continue."
            );
            return;
        }

        // Display the logged-in user's name.
        const userName = $("userName");

        if (userName) {
            userName.textContent =
                currentUser.fullName ||
                currentUser.full_name ||
                "User";
        }

        // Normalise the role to avoid case or whitespace problems.
        const role = String(currentUser.role || "")
            .trim()
            .toLowerCase();

        if (role === "child") {
            // Child accounts do not need a child selector.
            setChildSelectorVisible(false);

            // Load records for the logged-in child only.
            selectedChildId = String(currentUser.userId);

            await loadVaccinationRecords(selectedChildId);

        } else if (role === "mother") {
            // Mother accounts can select one of their children.
            await loadMotherChildren();

        } else {
            setChildSelectorVisible(false);

            showMessage(
                "This page is available to mother and child accounts only."
            );

            tableBody.innerHTML = emptyRow(
                "You do not have permission to view these records."
            );
        }

    } catch (error) {
        console.error("Unable to initialise vaccination page:", error);

        showMessage(
            error.message || "Unable to load vaccination records."
        );

        tableBody.innerHTML = emptyRow(
            "Unable to load vaccination records. Please try again."
        );
    }
}

// =====================================================
// API REQUEST
// =====================================================
async function apiRequest(url) {
    const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
            Accept: "application/json"
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            `Request failed (${response.status}).`
        );
    }

    return data;
}

// =====================================================
// CHILD SELECTOR VISIBILITY
// =====================================================
function setChildSelectorVisible(visible) {
    const selectorCard = $("childSelectorCard");

    if (selectorCard) {
        selectorCard.hidden = !visible;
    }
}

// =====================================================
// LOAD CHILDREN FOR MOTHER ACCOUNT
// =====================================================
async function loadMotherChildren() {
    const selectorCard = $("childSelectorCard");
    const selector = $("childSelect");

    if (!selectorCard || !selector) {
        throw new Error(
            "The child selector is missing from the HTML."
        );
    }

    // Hide the selector while loading children.
    selectorCard.hidden = true;
    selector.innerHTML = '<option value="">Loading children...</option>';

    const result = await apiRequest(
        `${API_BASE}/patient/vaccination-children`
    );

    children = Array.isArray(result)
        ? result
        : Array.isArray(result.children)
            ? result.children
            : [];

    if (children.length === 0) {
        selector.innerHTML = '<option value="">No children found</option>';

        selectedChildId = null;
        vaccinationRecords = [];

        renderRecords();
        showMessage("No children are linked to your account.");
        return;
    }

    // Only show the selector for a mother account.
    selector.innerHTML = children.map((child) => {
        const childId = escapeHTML(child.user_id);
        const childName = escapeHTML(child.full_name || "Child");

        return `<option value="${childId}">${childName}</option>`;
    }).join("");

    selectorCard.hidden = false;

    // Select the first child by default.
    selectedChildId = String(children[0].user_id);
    selector.value = selectedChildId;

    await loadVaccinationRecords(selectedChildId);
}

// =====================================================
// LOAD VACCINATION RECORDS
// =====================================================
async function loadVaccinationRecords(childId) {
    isLoadingRecords = true;
    renderRecords();

    try {
        const result = await apiRequest(
            `${API_BASE}/patient/vaccinations/${encodeURIComponent(childId)}`
        );

        vaccinationRecords = Array.isArray(result)
            ? result
            : result.records || [];
    } catch (error) {
        console.error("Error loading vaccination records:", error);
        vaccinationRecords = [];
    } finally {
        isLoadingRecords = false;
        renderRecords();
    }
}

// =====================================================
// DETERMINE DISPLAY STATUS
// =====================================================
function getDisplayStatus(record) {
    const status = String(record.status || "")
        .trim()
        .toLowerCase();

    if (status === "completed") {
        return "Completed";
    }

    if (status === "overdue") {
        return "Overdue";
    }

    if (
        (status === "upcoming" || status === "pending") &&
        isPastDate(record.due_date)
    ) {
        return "Overdue";
    }

    if (status === "upcoming" || status === "pending") {
        return "Upcoming";
    }

    return record.status || "—";
}

// =====================================================
// CHECK WHETHER DUE DATE HAS PASSED
// =====================================================
function isPastDate(dateValue) {
    if (!dateValue) {
        return false;
    }

    const match = String(dateValue).match(
        /^(\d{4})-(\d{2})-(\d{2})/
    );

    if (!match) {
        return false;
    }

    const dueDate = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return dueDate < today;
}

// =====================================================
// FILTER AND DISPLAY RECORDS
// =====================================================
function renderRecords() {
    const tableBody = $("vaccinationTableBody");
    const statusFilter = $("statusFilter");

    if (!tableBody || !statusFilter) {
        return;
    }

    if (isLoadingRecords) {
        tableBody.innerHTML = loadingRow();
        return;
    }

    const filter = statusFilter.value;

    const filteredRecords = vaccinationRecords.filter((record) => {
        const status = getDisplayStatus(record);

        return filter === "All" ||
            filter.toLowerCase() === "all" ||
            status.toLowerCase() === filter.toLowerCase();
    });

    if (filteredRecords.length === 0) {
        tableBody.innerHTML = emptyRow(
            filter === "All"
                ? "No vaccination records found."
                : `No ${filter.toLowerCase()} vaccination records found.`
        );
        return;
    }

    tableBody.innerHTML = filteredRecords.map((record) => {
        const status = getDisplayStatus(record);

        const vaccineName = escapeHTML(
            record.vaccine_name || "—"
        );

        const dose = escapeHTML(
            record.dose || "—"
        );

        const statusClass = getStatusClass(status);

        // Display the due date for ALL statuses.
        const dueDate = escapeHTML(
            formatDate(record.due_date)
        );

        // Remarks are not stored in the current database.
        const remarks = "—";

        return `
            <tr>
                <td>${vaccineName}</td>
                <td>${dose}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${escapeHTML(status)}
                    </span>
                </td>
                <td>${dueDate}</td>
                <td>${remarks}</td>
            </tr>
        `;
    }).join("");
}

// =====================================================
// STATUS CSS CLASS
// =====================================================
function getStatusClass(status) {
    switch (status) {
        case "Completed":
            return "status-complete";

        case "Upcoming":
            return "status-upcoming";

        case "Overdue":
            return "status-overdue";

        default:
            return "";
    }
}

// =====================================================
// FORMAT DATE
// =====================================================
function formatDate(value) {
    if (!value) {
        return "—";
    }

    // Format YYYY-MM-DD without timezone changes.
    const match = String(value).match(
        /^(\d{4})-(\d{2})-(\d{2})/
    );

    if (match) {
        return `${match[3]}/${match[2]}/${match[1]}`;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return String(value);
    }

    return parsed.toLocaleDateString("en-GB");
}

// =====================================================
// TABLE MESSAGES
// =====================================================
function loadingRow() {
    return `
        <tr>
            <td colspan="5" class="text-center">
                Loading vaccination records...
            </td>
        </tr>
    `;
}

function emptyRow(message) {
    return `
        <tr>
            <td colspan="5" class="text-center">
                ${escapeHTML(message)}
            </td>
        </tr>
    `;
}

function showMessage(message) {
    const messageElement = $("pageMessage");

    if (messageElement) {
        messageElement.textContent = message || "";
    }
}

// =====================================================
// ESCAPE HTML
// =====================================================
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}