const API_BASE = "http://localhost:3000/api/vaccination-management";

let children = [];
let vaccines = [];
let selectedChildId = null;
let selectedRecordId = null;

const $ = id => document.getElementById(id);

// Escape database values before displaying them in HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// Send requests to the CareTrack backend
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
        // Response may not contain JSON
    }

    if (!response.ok) {
        throw new Error(
            data.message || `Request failed (${response.status}).`
        );
    }

    return data;
}

function getSelectedChild() {
    return children.find(
        child => child.user_id === selectedChildId
    ) || null;
}

// Generate vaccine dropdown options
function vaccineOptionsHTML(selectedId = "") {
    return vaccines.map(vaccine => `
        <option value="${vaccine.vaccination_id}"
            ${String(vaccine.vaccination_id) === String(selectedId)
                ? "selected"
                : ""}>
            ${escapeHTML(vaccine.vaccine_name)}
        </option>
    `).join("");
}

// Generate available doses according to the vaccine
function dosesFor(vaccineId) {
    const vaccine = vaccines.find(
        item => String(item.vaccination_id) === String(vaccineId)
    );

    if (!vaccine) {
        return ["Dose 1"];
    }

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

// Update dose options
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

// Search children by name or IC number
function searchChild() {
    displayChildren();
}

// Display the children list
function displayChildren() {
    const searchInput = $("searchChild");

    if (!$("childrenList")) return;

    const query = (searchInput?.value || "")
        .trim()
        .toLowerCase();

    const filteredChildren = children.filter(child => {
        const name = String(child.full_name || "").toLowerCase();
        const ic = String(child.user_id || "").toLowerCase();

        return name.includes(query) || ic.includes(query);
    });

    $("childrenList").innerHTML = filteredChildren.map(child => `
        <div class="child-list-item ${
            child.user_id === selectedChildId ? "active" : ""
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

    $("childrenList")
        .querySelectorAll("[data-child-id]")
        .forEach(button => {
            button.addEventListener("click", () => {
                selectChild(button.dataset.childId);
            });
        });

    if ($("noChildrenMessage")) {
        $("noChildrenMessage").style.display =
            filteredChildren.length ? "none" : "block";
    }
}

// Select a child and show their information
function selectChild(userId) {
    selectedChildId = userId;
    selectedRecordId = null;

    const child = getSelectedChild();

    if (!child) return;

    $("childDetails").style.display = "block";
    $("childEditForm").style.display = "none";
    $("childDisplay").style.display = "block";
    $("editChildButton").style.display = "inline-block";

    $("addRecordForm").style.display = "none";
    $("showAddRecordButton").style.display = "inline-block";

    clearRecordForm();
    clearRecordSelection();

    renderChildDetails(child);
    displayChildren();
}

// Display child details
function renderChildDetails(child) {
    $("childName").textContent = child.full_name || "-";
    $("childGender").textContent = child.gender || "-";
    $("childDOB").textContent = child.date_of_birth || "-";
    $("childIC").textContent = child.user_id || "-";

    // The current database does not have a child address field.
    $("childAddress").textContent = "Not stored in database";

    renderVaccinationRecords(child.records || []);
}

// Display vaccination records in the table
function renderVaccinationRecords(records) {
    const tableBody = $("vaccinationTableBody");

    if (!records || records.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4">
                    No vaccination records found for this child.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = records.map(record => `
        <tr class="${
            Number(record.child_vaccination_id) ===
            Number(selectedRecordId) ? "selected" : ""
        }">
            <td>${escapeHTML(record.vaccine_name)}</td>
            <td>${escapeHTML(record.dose)}</td>
            <td>
                <span class="status ${String(record.status).toLowerCase()}">
                    ${escapeHTML(record.status)}
                </span>
            </td>
            <td>
                <button
                    type="button"
                    class="edit-record-button"
                    data-edit-record="${record.child_vaccination_id}"
                    title="Edit">
                    <i class="bi bi-pencil"></i>
                </button>

                <button
                    type="button"
                    class="delete-record-button"
                    data-delete-record="${record.child_vaccination_id}"
                    title="Delete">
                    <i class="bi bi-trash3"></i>
                </button>
            </td>
        </tr>
    `).join("");

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

// Show child edit form
function editChild() {
    const child = getSelectedChild();

    if (!child) return;

    $("childDisplay").style.display = "none";
    $("childEditForm").style.display = "block";
    $("editChildButton").style.display = "none";

    $("editChildName").value = child.full_name || "";
    $("editChildGender").value = child.gender || "Male";
    $("editChildDOB").value = child.date_of_birth || "";
    $("editChildIC").value = child.user_id || "";
    $("editChildAddress").value = "Not stored in database";
}

// Cancel child editing
function cancelEditChild() {
    $("childEditForm").style.display = "none";
    $("childDisplay").style.display = "block";
    $("editChildButton").style.display = "inline-block";
}

// Save child information to SQLite
async function saveChildDetails() {
    const child = getSelectedChild();

    if (!child) return;

    const newUserId = $("editChildIC").value.trim();
    const fullName = $("editChildName").value.trim();
    const gender = $("editChildGender").value;
    const dob = $("editChildDOB").value;

    if (!newUserId || !fullName || !gender || !dob) {
        alert("Please complete all required child details.");
        return;
    }

    const payload = {
        user_id: newUserId,
        full_name: fullName,
        gender,
        date_of_birth: dob
    };

    try {
        const result = await apiRequest(
            `${API_BASE}/children/${encodeURIComponent(child.user_id)}`,
            {
                method: "PATCH",
                body: JSON.stringify(payload)
            }
        );

        alert(result.message || "Child details updated successfully.");

        selectedChildId = result.user_id || newUserId;

        await loadData(selectedChildId);

    } catch (error) {
        console.error("Error saving child details:", error);
        alert(error.message);
    }
}

// Select a vaccination record for editing
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
        `Editing ${record.vaccine_name} — due ${record.due_date}`;

    renderVaccinationRecords(child.records);
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

    $("newDueDate").value = new Date().toISOString().slice(0, 10);

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

// Add a new vaccination record to SQLite
async function confirmAddRecord() {
    if (!selectedChildId) {
        alert("Please select a child first.");
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

// Clear the selected record
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

// Load children, vaccination records and vaccine options from the database
async function loadData(preferredChildId = null) {
    try {
        const [childData, vaccineData] = await Promise.all([
            apiRequest(`${API_BASE}/children`),
            apiRequest(`${API_BASE}/vaccines`)
        ]);

        children = childData;
        vaccines = vaccineData;

        fillVaccineSelects();
        displayChildren();

        const nextChildId =
            preferredChildId &&
            children.some(child => child.user_id === preferredChildId)
                ? preferredChildId
                : selectedChildId &&
                  children.some(child => child.user_id === selectedChildId)
                    ? selectedChildId
                    : null;

        if (nextChildId) {
            selectChild(nextChildId);
        } else {
            selectedChildId = null;
            selectedRecordId = null;

            $("childDetails").style.display = "none";

            // Do not automatically open the first child's details.
            displayChildren();
        }

    } catch (error) {
        console.error("Failed to load vaccination data:", error);

        $("childrenList").innerHTML = `
            <p class="error-message">
                Unable to load children. Please check that the backend
                is running and the vaccination API routes are available.
            </p>
        `;

        $("noChildrenMessage").style.display = "none";

        alert(
            "Unable to load vaccination data.\n\n" +
            error.message +
            "\n\nCheck the backend terminal and browser console."
        );
    }
}

// Start the page
document.addEventListener("DOMContentLoaded", () => {
    $("searchChild").addEventListener("input", searchChild);

    $("vaccine").addEventListener("change", () => {
        updateDoseOptions("update");
    });

    $("newVaccine").addEventListener("change", () => {
        updateDoseOptions("new");
    });

    // Keep child details hidden until View Child is clicked.
    $("childDetails").style.display = "none";
    $("childEditForm").style.display = "none";
    $("addRecordForm").style.display = "none";

    loadData();
});