
const API_BASE = "http://localhost:3000/api/vaccination-management";

let children = [];
let vaccines = [];
let selectedChildId = null;
let selectedRecordId = null;

const $ = id => document.getElementById(id);

// Escape values before inserting them into HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// Format YYYY-MM-DD as DD/MM/YYYY without timezone conversion
function formatDate(dateValue) {
    if (!dateValue) return "-";

    const datePart = String(dateValue).slice(0, 10);
    const parts = datePart.split("-");

    if (parts.length !== 3) {
        return escapeHTML(dateValue);
    }

    const [year, month, day] = parts;

    if (!year || !month || !day) {
        return escapeHTML(dateValue);
    }

    return `${day}/${month}/${year}`;
}

// Send requests to the backend
async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    let data = {};

    try {
        data = await response.json();
    } catch (error) {
        // The response may not contain JSON.
    }

    if (!response.ok) {
        throw new Error(
            data.message || `Request failed (${response.status}).`
        );
    }

    return data;
}

// Get the selected child
function getSelectedChild() {
    return children.find(
        child => String(child.user_id) === String(selectedChildId)
    ) || null;
}

// Generate vaccine dropdown options
function vaccineOptionsHTML(selectedId = "") {
    return vaccines.map(vaccine => `
        <option
            value="${escapeHTML(vaccine.vaccination_id)}"
            ${String(vaccine.vaccination_id) === String(selectedId)
                ? "selected"
                : ""}>
            ${escapeHTML(vaccine.vaccine_name)}
        </option>
    `).join("");
}

// Generate doses based on the selected vaccine
function dosesFor(vaccineId) {
    const vaccine = vaccines.find(
        item => String(item.vaccination_id) === String(vaccineId)
    );

    if (!vaccine) return ["Dose 1"];

    const quantity = Math.max(
        1,
        Number(vaccine.dose_quantity) || 1
    );

    const doses = Array.from(
        { length: quantity },
        (_, index) => `Dose ${index + 1}`
    );

    if (Number(vaccine.booster) === 1) {
        doses.push("Booster Dose");
    }

    return [...new Set(doses)];
}

// Update the available dose options
function updateDoseOptions(type) {
    const vaccineSelect = $(
        type === "new" ? "newVaccine" : "vaccine"
    );

    const doseSelect = $(
        type === "new" ? "newDose" : "dose"
    );

    if (!vaccineSelect || !doseSelect) return;

    const previousDose = doseSelect.value;
    const doses = dosesFor(vaccineSelect.value);

    doseSelect.innerHTML = doses.map(dose => `
        <option value="${escapeHTML(dose)}">
            ${escapeHTML(dose)}
        </option>
    `).join("");

    if (doses.includes(previousDose)) {
        doseSelect.value = previousDose;
    }
}

// Populate vaccine dropdowns
function fillVaccineSelects() {
    $("vaccine").innerHTML = vaccineOptionsHTML();
    $("newVaccine").innerHTML = vaccineOptionsHTML();

    updateDoseOptions("update");
    updateDoseOptions("new");
}

// Search by child's name or IC number
function searchChild() {
    displayChildren();
}

// Display the list of children
function displayChildren() {
    const list = $("childrenList");

    if (!list) return;

    const query = ($("searchChild")?.value || "")
        .trim()
        .toLowerCase();

    const filteredChildren = children.filter(child => {
        const name = String(child.full_name || "").toLowerCase();
        const ic = String(child.user_id || "").toLowerCase();

        return name.includes(query) || ic.includes(query);
    });

    list.innerHTML = filteredChildren.map(child => `
        <div class="child-list-item ${
            String(child.user_id) === String(selectedChildId)
                ? "active"
                : ""
        }">
            <div class="child-list-left">
                <div class="child-list-avatar">
                    <img src="../icons/user.png" alt="">
                </div>

                <div class="child-list-information">
                    <h3>${escapeHTML(child.full_name)}</h3>
                    <p>${escapeHTML(child.gender)}</p>
                    <span>IC No: ${escapeHTML(child.user_id)}</span>
                </div>
            </div>

            <button
                type="button"
                class="view-child-button"
                data-child-id="${escapeHTML(child.user_id)}">
                View Child
            </button>
        </div>
    `).join("");

    list.querySelectorAll("[data-child-id]").forEach(button => {
        button.addEventListener("click", () => {
            selectChild(button.dataset.childId);
        });
    });

    if ($("noChildrenMessage")) {
        $("noChildrenMessage").style.display =
            filteredChildren.length ? "none" : "block";
    }
}

// Select a child and display their vaccination records
function selectChild(userId) {
    selectedChildId = String(userId);
    selectedRecordId = null;

    const child = getSelectedChild();

    if (!child) {
        console.error("Child not found:", userId, children);
        return;
    }

    $("childDetails").style.display = "block";
    $("addRecordForm").style.display = "none";
    $("showAddRecordButton").style.display = "inline-block";

    clearRecordForm();
    renderChildDetails(child);
    clearRecordSelection();
    displayChildren();

    $("childDetails").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// Display selected child's information and records
function renderChildDetails(child) {
    $("childName").textContent = child.full_name || "-";
    $("childGender").textContent = child.gender || "-";
    $("childDOB").textContent = formatDate(child.date_of_birth);
    $("childIC").textContent = child.user_id || "-";

    renderVaccinationRecords(child.records || []);
}

// Display vaccination records
function renderVaccinationRecords(records) {
    const tableBody = $("vaccinationTableBody");

    if (!tableBody) return;

    if (!records || records.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    No vaccination records found for this child.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = records.map(record => {
        const statusClass = String(record.status || "")
            .toLowerCase()
            .replace(/[^a-z]/g, "");

        return `
            <tr class="${
                Number(record.child_vaccination_id) ===
                Number(selectedRecordId) ? "selected-row" : ""
            }">
                <td>${escapeHTML(record.vaccine_name)}</td>
                <td>${escapeHTML(record.dose)}</td>

                <td class="vaccination-date">
                    ${formatDate(record.due_date)}
                </td>

                <td>
                    <span class="status ${statusClass}">
                        ${escapeHTML(record.status)}
                    </span>
                </td>

                <td class="action-buttons">
                    <button
                        type="button"
                        class="edit-record-button"
                        data-edit-record="${escapeHTML(record.child_vaccination_id)}"
                        title="Edit vaccination record"
                        aria-label="Edit vaccination record">
                        <i class="bi bi-pencil"></i>
                    </button>

                    <button
                        type="button"
                        class="delete-record-button"
                        data-delete-record="${escapeHTML(record.child_vaccination_id)}"
                        title="Delete vaccination record"
                        aria-label="Delete vaccination record">
                        <i class="bi bi-trash3"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    tableBody.querySelectorAll("[data-edit-record]")
        .forEach(button => {
            button.addEventListener("click", () => {
                editRecord(Number(button.dataset.editRecord));
            });
        });

    tableBody.querySelectorAll("[data-delete-record]")
        .forEach(button => {
            button.addEventListener("click", () => {
                deleteRecord(Number(button.dataset.deleteRecord));
            });
        });
}

// Select a vaccination record to edit
function editRecord(recordId) {
    const child = getSelectedChild();

    const record = child?.records.find(
        item => Number(item.child_vaccination_id) === recordId
    );

    if (!record) return;

    selectedRecordId = recordId;

    $("vaccine").innerHTML = vaccineOptionsHTML(
        record.vaccination_id
    );

    $("vaccine").value = String(record.vaccination_id);

    updateDoseOptions("update");

    $("dose").value = record.dose;
    $("status").value = record.status;

    $("updateHelp").textContent =
        `Editing ${record.vaccine_name} — due ${formatDate(record.due_date)}`;

    renderVaccinationRecords(child.records || []);

    $("updateHelp").scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

// Save changes to an existing vaccination record
async function saveRecord() {
    if (!selectedChildId) {
        alert("Please select a child first.");
        return;
    }

    if (!selectedRecordId) {
        alert("Please select a vaccination record from the table first.");
        return;
    }

    const payload = {
        vaccination_id: Number($("vaccine").value),
        dose: $("dose").value,
        status: $("status").value
    };

    try {
        const result = await apiRequest(
            `${API_BASE}/records/${selectedRecordId}`,
            {
                method: "PATCH",
                body: JSON.stringify(payload)
            }
        );

        alert(result.message || "Vaccination record updated.");

        await loadData(selectedChildId);
    } catch (error) {
        console.error("Error updating vaccination record:", error);
        alert(error.message);
    }
}

// Delete a vaccination record
async function deleteRecord(recordId) {
    const confirmed = confirm(
        "Delete this vaccination record? This cannot be undone."
    );

    if (!confirmed) return;

    try {
        const result = await apiRequest(
            `${API_BASE}/records/${recordId}`,
            { method: "DELETE" }
        );

        alert(result.message || "Vaccination record deleted.");

        selectedRecordId = null;

        await loadData(selectedChildId);
    } catch (error) {
        console.error("Error deleting vaccination record:", error);
        alert(error.message);
    }
}

// Show the add-record form
function addRecord() {
    if (!selectedChildId) {
        alert("Please select a child first.");
        return;
    }

    $("addRecordForm").style.display = "block";
    $("showAddRecordButton").style.display = "none";

    // Use the local date to avoid UTC date differences.
    const today = new Date();

    const localToday = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0")
    ].join("-");

    $("newDueDate").value = localToday;

    updateDoseOptions("new");
}

// Hide the add-record form
function cancelAddRecord() {
    $("addRecordForm").style.display = "none";
    $("showAddRecordButton").style.display = "inline-block";

    clearRecordForm();
}

// Reset the add-record form
function clearRecordForm() {
    if ($("newVaccine") && $("newVaccine").options.length) {
        $("newVaccine").selectedIndex = 0;
    }

    if ($("newStatus")) {
        $("newStatus").value = "Upcoming";
    }

    if ($("newDueDate")) {
        $("newDueDate").value = "";
    }

    updateDoseOptions("new");
}

// Add a vaccination record
async function confirmAddRecord() {
    if (!selectedChildId) {
        alert("Please select a child first.");
        return;
    }

    if (!$("newVaccine").value) {
        alert("Please select a vaccine.");
        return;
    }

    const dueDate = $("newDueDate").value;

    if (!dueDate) {
        alert("Please select a due date.");
        return;
    }

    const payload = {
        vaccination_id: Number($("newVaccine").value),
        dose: $("newDose").value,
        status: $("newStatus").value,
        due_date: dueDate
    };

    try {
        const result = await apiRequest(
            `${API_BASE}/children/${encodeURIComponent(selectedChildId)}/records`,
            {
                method: "POST",
                body: JSON.stringify(payload)
            }
        );

        alert(result.message || "Vaccination record added successfully.");

        $("addRecordForm").style.display = "none";
        $("showAddRecordButton").style.display = "inline-block";

        clearRecordForm();

        await loadData(selectedChildId);
    } catch (error) {
        console.error("Error adding vaccination record:", error);
        alert(error.message);
    }
}

// Clear the selected vaccination record
function clearRecordSelection() {
    selectedRecordId = null;

    if ($("updateHelp")) {
        $("updateHelp").textContent =
            "Select a record from the table to edit it.";
    }

    const child = getSelectedChild();

    if (child) {
        renderVaccinationRecords(child.records || []);
    }
}

// Load children and vaccine options from SQLite
async function loadData(preferredChildId = null) {
    try {
        const [childData, vaccineData] = await Promise.all([
            apiRequest(`${API_BASE}/children`),
            apiRequest(`${API_BASE}/vaccines`)
        ]);

        if (!Array.isArray(childData)) {
            throw new Error("Children API did not return an array.");
        }

        if (!Array.isArray(vaccineData)) {
            throw new Error("Vaccines API did not return an array.");
        }

        children = childData;
        vaccines = vaccineData;

        fillVaccineSelects();
        displayChildren();

        const nextChildId =
            preferredChildId &&
            children.some(
                child => String(child.user_id) === String(preferredChildId)
            )
                ? String(preferredChildId)
                : selectedChildId &&
                  children.some(
                      child => String(child.user_id) === String(selectedChildId)
                  )
                    ? String(selectedChildId)
                    : null;

        if (nextChildId !== null) {
            selectChild(nextChildId);
        } else {
            selectedChildId = null;
            selectedRecordId = null;
            $("childDetails").style.display = "none";
            displayChildren();
        }
    } catch (error) {
        console.error("Failed to load vaccination data:", error);

        const list = $("childrenList");

        if (list) {
            list.innerHTML = `
                <p class="error-message">
                    Unable to load vaccination data:
                    ${escapeHTML(error.message)}
                </p>
            `;
        }

        if ($("noChildrenMessage")) {
            $("noChildrenMessage").style.display = "none";
        }
    }
}

// Initialise the page
document.addEventListener("DOMContentLoaded", () => {
    const searchInput = $("searchChild");
    const vaccineSelect = $("vaccine");
    const newVaccineSelect = $("newVaccine");

    if (!searchInput || !vaccineSelect || !newVaccineSelect) {
        console.error("Missing required HTML elements.", {
            searchChild: !!searchInput,
            vaccine: !!vaccineSelect,
            newVaccine: !!newVaccineSelect
        });
        return;
    }

    searchInput.addEventListener("input", searchChild);

    vaccineSelect.addEventListener("change", () => {
        updateDoseOptions("update");
    });

    newVaccineSelect.addEventListener("change", () => {
        updateDoseOptions("new");
    });

    $("childDetails").style.display = "none";
    $("addRecordForm").style.display = "none";

    loadData();
});