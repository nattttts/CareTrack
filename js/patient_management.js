import { showToast } from "./popup_message.js";

let allMother = [];
let allChild = [];

let requestedMotherStatus = null;
let requestedChildStatus = null;

// ================= LOAD MOTHER =================
async function loadMother() {
    const tableBody = document.getElementById("motherTableBody");

    try {
        const response = await fetch("http://localhost:3000/api/mothers");

        if (!response.ok) {
            throw new Error("Failed to retrieve mother records.");
        }

        const motherList = await response.json();
        
        allMother = motherList;

        // Remove old rows, but keep the "no matching mother" message
        tableBody.querySelectorAll(".mother-row").forEach(row => row.remove());

        motherList.forEach(mother => {
            const row = document.createElement("tr");
            row.classList.add("mother-row");

            row.dataset.search = [
                mother.full_name,
                mother.user_id,
                mother.email,
                mother.phone_no
            ].join(" ").toLowerCase();

            row.dataset.status = mother.account_status;

            row.innerHTML = `
                <td>
                    <strong>${mother.full_name}</strong>
                </td>

                <td>${mother.user_id}</td>
                <td>${mother.email}</td>
                <td>${mother.phone_no}</td>
                <td>
                    <span class="status-badge ${
                        mother.account_status === "Active"
                            ? "active-status"
                            : "inactive-status"
                    }">
                        <span class="status-dot"></span>
                        ${mother.account_status}
                    </span>
                </td>
                <td>${new Date(mother.created_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                })}</td>
                <td>
                    <div class="action-buttons">
                        <button type="button" class="action-button view-button">
                            <i class="bi bi-eye"></i>
                            <span>View</span>
                        </button>

                        <button type="button" class="action-button edit-button">
                            <i class="bi bi-pencil"></i>
                            <span>Edit</span>
                        </button>
                        
                        <button
                            type="button"
                            class="action-button ${
                                mother.account_status === "Active"
                                    ? "deactivate-button"
                                    : "activate-button"
                            }"
                        >
                            <i class="bi ${
                                mother.account_status === "Active"
                                    ? "bi-person-x"
                                    : "bi-person-check"
                            }"></i>
                            <span>${
                                mother.account_status === "Active"
                                    ? "Deactivate"
                                    : "Activate"
                            }</span>
                        </button>

                    </div>
                </td>
            `;

            row.dataset.motherId = mother.mother_id;

            tableBody.appendChild(row);
        });

        applyMotherFilters();

    } catch (error) {
        console.error("Error loading mothers:", error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    Unable to load mother records.
                </td>
            </tr>
        `;
    }
}

// ================= LOAD CHILD =================
async function loadChild() {
    const tableBody = document.getElementById("childTableBody");

    try {
        const response = await fetch("http://localhost:3000/api/children");

        if (!response.ok) {
            throw new Error("Failed to retrieve child records.");
        }

        const childList = await response.json();
        
        allChild = childList;

        // Remove old rows, but keep the "no matching child" message
        tableBody.querySelectorAll(".child-row").forEach(row => row.remove());

        childList.forEach(child => {
            const row = document.createElement("tr");
            row.classList.add("child-row");

            row.dataset.search = [
                child.full_name,
                child.user_id,
                child.gender,
                child.guardian_name
            ].join(" ").toLowerCase();

            row.dataset.status = child.account_status;

            row.innerHTML = `
                <td>
                    <strong>${child.full_name}</strong>
                </td>

                <td>${child.user_id}</td>
                <td>${child.gender}</td>
                <td>${child.guardian_name}</td>
                
                <td>
                    <span class="status-badge ${
                        child.account_status === "Active"
                            ? "active-status"
                            : "inactive-status"
                    }">
                        <span class="status-dot"></span>
                        ${child.account_status}
                    </span>
                </td>
                <td>${new Date(child.created_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                })}</td>
                <td>
                    <div class="action-buttons">
                        <button type="button" class="action-button view-button">
                            <i class="bi bi-eye"></i>
                            <span>View</span>
                        </button>

                        <button type="button" class="action-button edit-button">
                            <i class="bi bi-pencil"></i>
                            <span>Edit</span>
                        </button>
                        
                        <button
                            type="button"
                            class="action-button ${
                                child.account_status === "Active"
                                    ? "deactivate-button"
                                    : "activate-button"
                            }"
                        >
                            <i class="bi ${
                                child.account_status === "Active"
                                    ? "bi-person-x"
                                    : "bi-person-check"
                            }"></i>
                            <span>${
                                child.account_status === "Active"
                                    ? "Deactivate"
                                    : "Activate"
                            }</span>
                        </button>

                    </div>
                </td>
            `;

            row.dataset.childId = child.child_id;

            tableBody.appendChild(row);
        });

        applyChildFilters();

    } catch (error) {
        console.error("Error loading children:", error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    Unable to load child records.
                </td>
            </tr>
        `;
    }
}

// ================= MOTHER SEARCH & FILTER =================
function applyMotherFilters() {
    const searchInput = document
        .getElementById("motherSearch")
        .value
        .toLowerCase()
        .trim();

    const selectedStatus = document.getElementById("motherStatusFilter").value;

    const rows = document.querySelectorAll(
        "#motherTableBody .mother-row"
    );

    let visibleCount = 0;

    rows.forEach(row => {
        const matchesSearch =
            row.dataset.search.includes(searchInput);

        const matchesStatus =
            selectedStatus === "all" ||
            row.dataset.status === selectedStatus;

        const matches = matchesSearch && matchesStatus;

        row.style.display = matches ? "" : "none";

        if (matches) {
            visibleCount++;
        }
    });

    const noMotherFound = document.getElementById("noMotherFound");

    if (noMotherFound) {
        noMotherFound.hidden = visibleCount > 0;
    }

    document.getElementById("motherCount").textContent =
        `Showing ${visibleCount} of ${allMother.length} mother`;
}

// ================= CHILD SEARCH & FILTER =================
function applyChildFilters() {
    const searchInput = document
        .getElementById("childSearch")
        .value
        .toLowerCase()
        .trim();

    const selectedStatus = document.getElementById("childStatusFilter").value;

    const rows = document.querySelectorAll(
        "#childTableBody .child-row"
    );

    let visibleCount = 0;

    rows.forEach(row => {
        const matchesSearch =
            row.dataset.search.includes(searchInput);

        const matchesStatus =
            selectedStatus === "all" ||
            row.dataset.status === selectedStatus;

        const matches = matchesSearch && matchesStatus;

        row.style.display = matches ? "" : "none";

        if (matches) {
            visibleCount++;
        }
    });

    const noChildFound = document.getElementById("noChildFound");

    if (noChildFound) {
        noChildFound.hidden = visibleCount > 0;
    }

    document.getElementById("childCount").textContent =
        `Showing ${visibleCount} of ${allChild.length} child`;
}

// ================= RESET FILTERS =================
function resetMotherFilters() {
    document.getElementById("motherSearch").value = "";
    document.getElementById("motherStatusFilter").value = "all";
    applyMotherFilters();
}

function resetChildFilters() {
    document.getElementById("childSearch").value = "";
    document.getElementById("childStatusFilter").value = "all";
    applyChildFilters();
}

const motherTableBody = document.getElementById("motherTableBody");

let selectedMother = null;

// ================= HANDLE MOTHER ACTION BUTTONS =================
motherTableBody.addEventListener("click", function (event) {
    const button = event.target.closest("button");

    if (!button || !motherTableBody.contains(button)) {
        return;
    }

    const row = button.closest(".mother-row");

    if (!row) {
        return;
    }

    const mother = allMother.find(
        item => String(item.mother_id) === row.dataset.motherId
    );

    if (!mother) {
        return;
    }

    selectedMother = mother;

    // VIEW MOTHER
    if (button.classList.contains("view-button")) {
        document.getElementById("viewMotherProfileName").textContent =
            mother.full_name;
                
        document.getElementById("viewMotherName").textContent =
            mother.full_name;
        
        document.getElementById("viewMotherICNumber").textContent =
            mother.user_id;
        
        document.getElementById("viewMotherDOB").textContent =
            new Date(`${mother.date_of_birth}T00:00:00`).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });

        document.getElementById("viewMotherPhone").textContent =
            mother.phone_no || "—";

        document.getElementById("viewMotherEmail").textContent =
            mother.email;

        document.getElementById("viewMotherAddress").textContent =
            mother.address;

        document.getElementById("viewMotherContactName").textContent =
            mother.contact_name;
        
        document.getElementById("viewMotherRelationship").textContent =
            mother.relationship;
        
        document.getElementById("viewMotherContactPhone").textContent =
            mother.contact_phone_no || "—";

        document.getElementById("viewMotherDate").textContent =
            new Date(mother.created_at).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });

        const statusBadge =
            document.getElementById("viewMotherProfileStatus");

        statusBadge.classList.toggle(
            "active-status",
            mother.account_status === "Active"
        );

        statusBadge.classList.toggle(
            "inactive-status",
            mother.account_status === "Inactive"
        );

        document.getElementById("viewMotherProfileStatusText").textContent =
            mother.account_status;

        bootstrap.Modal
            .getOrCreateInstance(
                document.getElementById("viewMotherModal")
            )
            .show();
    }

    // ACTIVATE / DEACTIVATE
    else if (
        button.classList.contains("activate-button") ||
        button.classList.contains("deactivate-button")
    ) {
        const isActive = mother.account_status === "Active";
        requestedMotherStatus = isActive ? "Inactive" : "Active";

        document.getElementById("deactivateMotherModalLabel").textContent =
            isActive
                ? "Deactivate Mother Account?"
                : "Activate Mother Account?";

        document.getElementById("statusMotherName").textContent = mother.full_name;

        document.getElementById("motherStatusAction").textContent =
            isActive ? "deactivate" : "activate";

        document.getElementById("motherStatusWarning").textContent =
            isActive
                ? "The mother member will no longer be able to log in to the system."
                : "The mother member will be able to log in to the system again.";

        const confirmButton = document.getElementById(
            "confirmMotherStatusButton"
        );

        confirmButton.className = isActive
            ? "btn btn-danger"
            : "btn btn-success";

        confirmButton.innerHTML = isActive
            ? '<i class="bi bi-person-x"></i> Deactivate'
            : '<i class="bi bi-person-check"></i> Activate';

        bootstrap.Modal
            .getOrCreateInstance(
                document.getElementById("deactivateMotherModal")
            )
            .show();
    }
});

// Confirm activation or deactivation
document
    .getElementById("confirmMotherStatusButton")
    .addEventListener("click", async function () {
        if (!selectedMother || !requestedMotherStatus) {
            return;
        }

        const confirmButton = this;

        confirmButton.disabled = true;

        try {
            const response = await fetch(
                `http://localhost:3000/api/mother/${selectedMother.mother_id}/status`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        account_status: requestedMotherStatus
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Failed to update mother status."
                );
            }

            // Close the confirmation modal
            bootstrap.Modal
                .getOrCreateInstance(
                    document.getElementById("deactivateMotherModal")
                )
                .hide();

            // Refresh the table using the latest database records
            await loadMother();

            // Display a success toast
            showToast(result.message, "success");

            // Clear the selection
            selectedMother = null;
            requestedMotherStatus = null;

        } catch (error) {
            console.error("Error updating mother status:", error);
            showToast(error.message, "error");

        } finally {
            confirmButton.disabled = false;
        }
    });


// ================= HANDLE CHILD ACTION BUTTONS =================
const childTableBody = document.getElementById("childTableBody");

let selectedChild = null;

childTableBody.addEventListener("click", function (event) {
    const button = event.target.closest("button");

    if (!button || !childTableBody.contains(button)) {
        return;
    }

    const row = button.closest(".child-row");

    if (!row) {
        return;
    }

    const child = allChild.find(
        item => String(item.child_id) === row.dataset.childId
    );

    if (!child) {
        return;
    }

    selectedChild = child;

    // VIEW CHILD
    if (button.classList.contains("view-button")) {
        document.getElementById("viewChildProfileName").textContent =
            child.full_name;
                
        document.getElementById("viewChildName").textContent =
            child.full_name;
        
        document.getElementById("viewChildMyKidNumber").textContent =
            child.user_id;

        document.getElementById("viewChildDOB").textContent =
            new Date(`${child.date_of_birth}T00:00:00`).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });

        document.getElementById("viewChildGender").textContent =
            child.gender;

        document.getElementById("viewChildGuardianName").textContent =
            child.guardian_name;

        document.getElementById("viewChildGuardianPhone").textContent =
            child.phone_no || "—";

        document.getElementById("viewChildGuardianEmail").textContent =
            child.email; 

        document.getElementById("viewChildDate").textContent =
            new Date(child.created_at).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });

        const statusBadge =
            document.getElementById("viewChildProfileStatus");

        statusBadge.classList.toggle(
            "active-status",
            child.account_status === "Active"
        );

        statusBadge.classList.toggle(
            "inactive-status",
            child.account_status === "Inactive"
        );

        document.getElementById("viewChildProfileStatusText").textContent =
            child.account_status;

        bootstrap.Modal
            .getOrCreateInstance(
                document.getElementById("viewChildModal")
            )
            .show();
    }

    // ACTIVATE / DEACTIVATE
    else if (
        button.classList.contains("activate-button") ||
        button.classList.contains("deactivate-button")
    ) {
        const isActive = child.account_status === "Active";
        requestedChildStatus = isActive ? "Inactive" : "Active";

        document.getElementById("deactivateChildModalLabel").textContent =
            isActive
                ? "Deactivate Child Account?"
                : "Activate Child Account?";

        document.getElementById("statusChildName").textContent = child.full_name;

        document.getElementById("childStatusAction").textContent =
            isActive ? "deactivate" : "activate";

        document.getElementById("childStatusWarning").textContent =
            isActive
                ? "The child member will no longer be able to log in to the system."
                : "The child member will be able to log in to the system again.";

        const confirmButton = document.getElementById(
            "confirmChildStatusButton"
        );

        confirmButton.className = isActive
            ? "btn btn-danger"
            : "btn btn-success";

        confirmButton.innerHTML = isActive
            ? '<i class="bi bi-person-x"></i> Deactivate'
            : '<i class="bi bi-person-check"></i> Activate';

        bootstrap.Modal
            .getOrCreateInstance(
                document.getElementById("deactivateChildModal")
            )
            .show();
    }
});

// Confirm activation or deactivation
document
    .getElementById("confirmChildStatusButton")
    .addEventListener("click", async function () {
        if (!selectedChild || !requestedChildStatus) {
            return;
        }

        const confirmButton = this;

        confirmButton.disabled = true;

        try {
            const response = await fetch(
                `http://localhost:3000/api/child/${selectedChild.child_id}/status`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        account_status: requestedChildStatus
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Failed to update child status."
                );
            }

            // Close the confirmation modal
            bootstrap.Modal
                .getOrCreateInstance(
                    document.getElementById("deactivateChildModal")
                )
                .hide();

            // Refresh the table using the latest database records
            await loadChild();

            // Display a success toast
            showToast(result.message, "success");

            // Clear the selection
            selectedChild = null;
            requestedChildStatus = null;

        } catch (error) {
            console.error("Error updating child status:", error);
            showToast(error.message, "error");

        } finally {
            confirmButton.disabled = false;
        }
    });

// ================= TABS =================
function setupTabs() {
    const tabs = document.querySelectorAll(".patient-tab");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(item => {
                item.classList.remove("active");
                item.setAttribute("aria-selected", "false");
            });

            tab.classList.add("active");
            tab.setAttribute("aria-selected", "true");

            document.getElementById("motherPanel").hidden =
                tab.dataset.tab !== "mothers";

            document.getElementById("childPanel").hidden =
                tab.dataset.tab !== "children";
        });
    });
}

// ================= INITIALISE PAGE =================
document.addEventListener("DOMContentLoaded", () => {
    loadMother();
    loadChild();
    setupTabs();

    document.getElementById("motherSearch")
        .addEventListener("input", applyMotherFilters);

    document.getElementById("motherStatusFilter")
        .addEventListener("change", applyMotherFilters);

    document.getElementById("motherResetFilters")
        .addEventListener("click", resetMotherFilters);

    document.getElementById("childSearch")
        .addEventListener("input", applyChildFilters);

    document.getElementById("childStatusFilter")
        .addEventListener("change", applyChildFilters);

    document.getElementById("childResetFilters")
        .addEventListener("click", resetChildFilters);
});
