import { showToast } from "./popup_message.js";

let allPregnantWomen = [];
let allChild = [];

// ================= LOAD PREGNANT WOMEN =================
async function loadPregnantWomen() {
    const tableBody = document.getElementById("pregnantWomanTableBody");

    try {
        const response = await fetch("http://localhost:3000/api/pregnant-women");

        if (!response.ok) {
            throw new Error("Failed to retrieve pregnant woman records.");
        }

        const pregnantWomanList = await response.json();
        
        allPregnantWomen = pregnantWomanList;

        // Remove old rows, but keep the "no matching pregnant woman" message
        tableBody.querySelectorAll(".pregnant-woman-row").forEach(row => row.remove());

        pregnantWomanList.forEach(pregnantWoman => {
            const row = document.createElement("tr");
            row.classList.add("pregnant-woman-row");

            row.dataset.search = [
                pregnantWoman.full_name,
                pregnantWoman.user_id,
                pregnantWoman.email,
                pregnantWoman.phone_no
            ].join(" ").toLowerCase();

            row.dataset.status = pregnantWoman.account_status;

            row.innerHTML = `
                <td>
                    <strong>${pregnantWoman.full_name}</strong>
                </td>

                <td>${pregnantWoman.user_id}</td>
                <td>${pregnantWoman.email}</td>
                <td>${pregnantWoman.phone_no}</td>
                <td>
                    <div class="account-status-group">
                        <span class="status-badge ${
                            pregnantWoman.account_status === "Active"
                                ? "active-status"
                                : "inactive-status"
                        }">
                            <span class="status-dot"></span>
                            ${pregnantWoman.account_status}
                        </span>

                        <span class="password-status ${
                            Number(pregnantWoman.password_set) === 1
                                ? "password-set"
                                : "password-not-set"
                        }">
                            <i class="bi ${
                                Number(pregnantWoman.password_set) === 1
                                    ? "bi-check-circle"
                                    : "bi-clock"
                            }"></i>

                            ${
                                Number(pregnantWoman.password_set) === 1
                                    ? "Password set"
                                    : "Password not set"
                            }
                        </span>
                    </div>
                </td>
                <td>${new Date(pregnantWoman.created_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                })}</td>
                <td class="patient-actions-cell">
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
                                pregnantWoman.account_status === "Active"
                                    ? "deactivate-button"
                                    : "activate-button"
                            }"
                        >
                            <i class="bi ${
                                pregnantWoman.account_status === "Active"
                                    ? "bi-person-x"
                                    : "bi-person-check"
                            }"></i>
                            <span>${
                                pregnantWoman.account_status === "Active"
                                    ? "Deactivate"
                                    : "Activate"
                            }</span>
                        </button>
                    </div>

                    ${
                        Number(pregnantWoman.password_set) !== 1
                            ? `
                                <button
                                    type="button"
                                    class="action-button resend-invitation-button"
                                    data-pregnant-woman-id="${pregnantWoman.pregnant_woman_id}"
                                >
                                    <i class="bi bi-envelope"></i>
                                    <span>Resend Invitation</span>
                                </button>
                            `
                            : ""
                    }
                </td>
            `;

            row.dataset.pregnantWomanId = pregnantWoman.pregnant_woman_id;

            tableBody.appendChild(row);
        });

        applyPregnantWomanFilters();

    } catch (error) {
        console.error("Error loading pregnant women:", error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    Unable to load pregnant woman records.
                </td>
            </tr>
        `;
    }
}

// ================= PREGNANT WOMEN SEARCH & FILTER =================
function applyPregnantWomanFilters() {
    const searchInput = document
        .getElementById("pregnantWomanSearch")
        .value
        .toLowerCase()
        .trim();

    const selectedStatus = document.getElementById("pregnantWomanStatusFilter").value;

    const rows = document.querySelectorAll(
        "#pregnantWomanTableBody .pregnant-woman-row"
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

    const noPregnantWomanFound = document.getElementById("noPregnantWomanFound");

    if (noPregnantWomanFound) {
        noPregnantWomanFound.hidden = visibleCount > 0;
    }

    document.getElementById("pregnantWomanCount").textContent =
        `Showing ${visibleCount} of ${allPregnantWomen.length} pregnant women`;
}

// ================= RESET PREGNANT WOMEN FILTERS =================
function resetPregnantWomanFilters() {
    document.getElementById("pregnantWomanSearch").value = "";
    document.getElementById("pregnantWomanStatusFilter").value = "all";
    applyPregnantWomanFilters();
}

async function resendPregnantWomanInvitation(pregnantWomanId, button) {
    const originalText = button.innerHTML;

    try {
        // Prevent repeated clicks while the request is processing
        button.disabled = true;
        button.textContent = "Sending...";

        // Ask the backend to generate a new invitation
        const response = await fetch(
            `http://localhost:3000/api/pregnant-woman/${pregnantWomanId}/resend-invitation`,
            {
                method: "POST"
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Failed to resend invitation."
            );
        }

        showToast("Invitation sent successfully.", "success");


        // Development only: show the returned invitation URL
        // if the backend provides one
        if (result.developmentInvitationUrl) {
            console.log(
                "Development invitation URL:",
                result.developmentInvitationUrl
            );
        }

        // Refresh the pregnant woman table to reflect the latest account data
        await loadPregnantWomen();

    } catch (error) {
        console.error("Error resending invitation:", error);
        showToast(error.message || "Failed to resend invitation.", "error");
    } finally {
        // The original button may have been removed by loadPregnantWomen()
        // Restore it only if it is still present on the page
        if (button.isConnected) {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }
}

// ================= HANDLE PREGNANT WOMEN ACTION BUTTONS =================
const pregnantWomanTableBody = document.getElementById("pregnantWomanTableBody");

let selectedPregnantWoman = null;
let requestedPregnantWomanStatus = null;

pregnantWomanTableBody.addEventListener("click", function (event) {
    const button = event.target.closest("button");

    if (!button || !pregnantWomanTableBody.contains(button)) {
        return;
    }

    const row = button.closest(".pregnant-woman-row");

    if (!row) {
        return;
    }

    const pregnantWoman = allPregnantWomen.find(
        item => String(item.pregnant_woman_id) === row.dataset.pregnantWomanId
    );

    if (!pregnantWoman) {
        return;
    }

    selectedPregnantWoman = pregnantWoman;

    // VIEW PREGNANT WOMEN
    if (button.classList.contains("view-button")) {
        document.getElementById("viewPregnantWomanProfileName").textContent =
            pregnantWoman.full_name;
                
        document.getElementById("viewPregnantWomanName").textContent =
            pregnantWoman.full_name;
        
        document.getElementById("viewPregnantWomanICNumber").textContent =
            pregnantWoman.user_id;
        
        document.getElementById("viewPregnantWomanDOB").textContent =
            new Date(`${pregnantWoman.date_of_birth}T00:00:00`).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });

        document.getElementById("viewPregnantWomanPhone").textContent =
            pregnantWoman.phone_no || "—";

        document.getElementById("viewPregnantWomanEmail").textContent =
            pregnantWoman.email;

        document.getElementById("viewPregnantWomanAddress").textContent =
            pregnantWoman.address;

        document.getElementById("viewPregnantWomanContactName").textContent =
            pregnantWoman.contact_name;
        
        document.getElementById("viewPregnantWomanRelationship").textContent =
            pregnantWoman.relationship;
        
        document.getElementById("viewPregnantWomanContactPhone").textContent =
            pregnantWoman.contact_phone_no || "—";

        document.getElementById("viewPregnantWomanDate").textContent =
            new Date(pregnantWoman.created_at).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });

        const statusBadge =
            document.getElementById("viewPregnantWomanProfileStatus");

        statusBadge.classList.toggle(
            "active-status",
            pregnantWoman.account_status === "Active"
        );

        statusBadge.classList.toggle(
            "inactive-status",
            pregnantWoman.account_status === "Inactive"
        );

        document.getElementById("viewPregnantWomanProfileStatusText").textContent =
            pregnantWoman.account_status;

        bootstrap.Modal
            .getOrCreateInstance(
                document.getElementById("viewPregnantWomanModal")
            )
            .show();
    }

    // EDIT PREGNANT WOMEN
    else if (button.classList.contains("edit-button")) {
        document.getElementById("editPregnantWomanId").value =
            pregnantWoman.pregnant_woman_id;

        document.getElementById("editPregnantWomanName").value =
            pregnantWoman.full_name;

        document.getElementById("editPregnantWomanICNumber").value =
            pregnantWoman.user_id;

         document.getElementById("editPregnantWomanDOB").value =
            pregnantWoman.date_of_birth;

         document.getElementById("editPregnantWomanPhone").value =
            pregnantWoman.phone_no || "";

        document.getElementById("editPregnantWomanEmail").value =
            pregnantWoman.email;

        document.getElementById("editPregnantWomanAddress").value =
            pregnantWoman.address;

        document.getElementById("editPregnantWomanEmergencyName").value =
            pregnantWoman.contact_name;

        document.getElementById("editPregnantWomanRelationship").value =
            pregnantWoman.relationship;

        document.getElementById("editPregnantWomanEmergencyPhone").value =
            pregnantWoman.contact_phone_no;

        bootstrap.Modal
            .getOrCreateInstance(
                document.getElementById("editPregnantWomanModal")
            )
            .show();
    }

    // ACTIVATE / DEACTIVATE
    else if (
        button.classList.contains("activate-button") ||
        button.classList.contains("deactivate-button")
    ) {
        const isActive = pregnantWoman.account_status === "Active";
        requestedPregnantWomanStatus = isActive ? "Inactive" : "Active";

        document.getElementById("deactivatePregnantWomanModalLabel").textContent =
            isActive
                ? "Deactivate Pregnant Woman account?"
                : "Activate Pregnant Woman account?";

        document.getElementById("statusPregnantWomanName").textContent = pregnantWoman.full_name;

        document.getElementById("pregnantWomanStatusAction").textContent =
            isActive ? "deactivate" : "activate";

        document.getElementById("pregnantWomanStatusWarning").textContent =
            isActive
                ? "The pregnant woman will no longer be able to log in to the system."
                : "The pregnant woman will be able to log in to the system again.";

        const confirmButton = document.getElementById(
            "confirmPregnantWomanStatusButton"
        );

        confirmButton.className = isActive
            ? "btn btn-danger"
            : "btn btn-success";

        confirmButton.innerHTML = isActive
            ? '<i class="bi bi-person-x"></i> Deactivate'
            : '<i class="bi bi-person-check"></i> Activate';

        bootstrap.Modal
            .getOrCreateInstance(
                document.getElementById("deactivatePregnantWomanModal")
            )
            .show();
    }

    // RESEND INVITATION
    else if (button.classList.contains("resend-invitation-button")) {
        resendPregnantWomanInvitation(pregnantWoman.pregnant_woman_id, button);
    }
});

// Add new pregnant woman
document
    .getElementById("addPregnantWomanForm")
    .addEventListener("submit", async function (event) {
        event.preventDefault();

        const submitButton = this.querySelector(
            'button[type="submit"]'
        );

        submitButton.disabled = true;
        submitButton.textContent = "Adding...";

        const pregnantWomanData = {
            full_name: document.getElementById("addPregnantWomanName").value,
            user_id: document.getElementById("addPregnantWomanIC").value,
            date_of_birth: document.getElementById("addPregnantWomanDOB").value,
            phone_no: document.getElementById("addPregnantWomanPhoneNo").value,
            email: document.getElementById("addPregnantWomanEmail").value,
            address: document.getElementById("addPregnantWomanAddress").value,
            contact_name: document.getElementById("addPregnantWomanEmergencyName").value,
            relationship: document.getElementById("addPregnantWomanRelationship").value,
            contact_phone_no: document.getElementById("addPregnantWomanEmergencyPhone").value
        };

        try {
            const response = await fetch("http://localhost:3000/api/pregnant-woman", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(pregnantWomanData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Failed to add pregnant woman.");
            }

            // Close the modal and clear the form
            bootstrap.Modal
                .getOrCreateInstance(
                    document.getElementById("addPregnantWomanModal")
                )
                .hide();

            this.reset();

            // Refresh the pregnant woman table
            await loadPregnantWomen();

            showToast("Pregnant woman added successfully!", "success");

        } catch (error) {
            console.error("Error adding pregnant woman:", error);
            showToast(error.message, "error");
            

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Add Pregnant Woman";
        }
    });

// ================= UPDATE PREGNANT WOMEN DETAILS =================
document.getElementById("editPregnantWomanForm").addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        const form = this;
        const submitButton = form.querySelector(
            'button[type="submit"]'
        );

        const pregnantWomanId = document.getElementById(
            "editPregnantWomanId"
        ).value;

        const pregnantWomanData = {
            user_id: document.getElementById(
                "editPregnantWomanICNumber"
            ).value.trim(),

            full_name: document.getElementById(
                "editPregnantWomanName"
            ).value.trim(),

            date_of_birth: document.getElementById(
                "editPregnantWomanDOB"
            ).value.trim(),

            phone_no: document.getElementById(
                "editPregnantWomanPhone"
            ).value.trim(),

            email: document.getElementById(
                "editPregnantWomanEmail"
            ).value.trim(),

            address: document.getElementById(
                "editPregnantWomanAddress"
            ).value.trim(),

            contact_name: document.getElementById(
                "editPregnantWomanEmergencyName"
            ).value.trim(),

            relationship: document.getElementById(
                "editPregnantWomanRelationship"
            ).value.trim(),

            contact_phone_no: document.getElementById(
                "editPregnantWomanEmergencyPhone"
            ).value.trim(),
        };

        submitButton.disabled = true;
        submitButton.textContent = "Saving...";

        try {
            const response = await fetch(
                `http://localhost:3000/api/pregnant-woman/${pregnantWomanId}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(pregnantWomanData)
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    "Failed to update pregnant woman details."
                );
            }

            bootstrap.Modal.getOrCreateInstance(
                document.getElementById("editPregnantWomanModal")
            ).hide();

            await loadPregnantWomen();

            showToast(result.message, "success");

        } catch (error) {
            console.error("Error updating pregnant woman:", error);
            showToast(error.message, "error");

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Save Changes";
        }
    }
);

// ================= CONFIRM ACTIVATION OR DEACTIVATION FOR PREGNANT WOMEN =================
document
    .getElementById("confirmPregnantWomanStatusButton")
    .addEventListener("click", async function () {
        if (!selectedPregnantWoman || !requestedPregnantWomanStatus) {
            return;
        }

        const confirmButton = this;

        confirmButton.disabled = true;

        try {
            const response = await fetch(
                `http://localhost:3000/api/pregnant-woman/${selectedPregnantWoman.pregnant_woman_id}/status`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        account_status: requestedPregnantWomanStatus
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Failed to update pregnant woman status."
                );
            }

            // Close the confirmation modal
            bootstrap.Modal
                .getOrCreateInstance(
                    document.getElementById("deactivatePregnantWomanModal")
                )
                .hide();

            // Refresh the table using the latest database records
            await loadPregnantWomen();

            // Display a success toast
            showToast(result.message, "success");

            // Clear the selection
            selectedPregnantWoman = null;
            requestedPregnantWomanStatus = null;

        } catch (error) {
            console.error("Error updating pregnant woman status:", error);
            showToast(error.message, "error");

        } finally {
            confirmButton.disabled = false;
        }
    });


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
                    <div class="account-status-group">
                        <span class="status-badge ${
                            child.account_status === "Active"
                                ? "active-status"
                                : "inactive-status"
                        }">
                            <span class="status-dot"></span>
                            ${child.account_status}
                        </span>

                        <span class="password-status ${
                            Number(child.password_set) === 1
                                ? "password-set"
                                : "password-not-set"
                        }">
                            <i class="bi ${
                                Number(child.password_set) === 1
                                    ? "bi-check-circle"
                                    : "bi-clock"
                            }"></i>

                            ${
                                Number(child.password_set) === 1
                                    ? "Password set"
                                    : "Password not set"
                            }
                        </span>
                    </div>
                </td>
                <td>${new Date(child.created_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                })}</td>
                <td class="patient-actions-cell">
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

                    ${
                        Number(child.password_set) !== 1
                            ? `
                                <button
                                    type="button"
                                    class="action-button resend-invitation-button"
                                    data-child-id="${child.child_id}"
                                >
                                    <i class="bi bi-envelope"></i>
                                    <span>Resend Invitation</span>
                                </button>
                            `
                            : ""
                    }
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

// ================= RESET CHILD FILTERS =================
function resetChildFilters() {
    document.getElementById("childSearch").value = "";
    document.getElementById("childStatusFilter").value = "all";
    applyChildFilters();
}

async function resendChildInvitation(childId, button) {
    const originalText = button.innerHTML;

    try {
        // Prevent repeated clicks while the request is processing
        button.disabled = true;
        button.textContent = "Sending...";

        // Ask the backend to generate a new invitation
        const response = await fetch(
            `http://localhost:3000/api/child/${childId}/resend-invitation`,
            {
                method: "POST"
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Failed to resend invitation."
            );
        }

        showToast("Invitation sent successfully.", "success");


        // Development only: show the returned invitation URL
        // if the backend provides one
        if (result.developmentInvitationUrl) {
            console.log(
                "Development invitation URL:",
                result.developmentInvitationUrl
            );
        }

        // Refresh the child table to reflect the latest account data
        await loadChild();

    } catch (error) {
        console.error("Error resending invitation:", error);
        showToast(error.message || "Failed to resend invitation.", "error");
    } finally {
        // The original button may have been removed by loadChild()
        // Restore it only if it is still present on the page
        if (button.isConnected) {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }
}

// ================= HANDLE CHILD ACTION BUTTONS =================
const childTableBody = document.getElementById("childTableBody");

let selectedChild = null;
let requestedChildStatus = null;

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

    // EDIT CHILD
    else if (button.classList.contains("edit-button")) {
        document.getElementById("editChildId").value =
            child.child_id;

        document.getElementById("editChildName").value =
            child.full_name;

        document.getElementById("editChildMyKid").value =
            child.user_id;

        document.getElementById("editChildDOB").value =
            child.date_of_birth;

        document.getElementById("editChildGender").value =
            child.gender;

        document.getElementById("editChildGuardianName").value =
            child.guardian_name;

        document.getElementById("editChildGuardianEmail").value =
            child.email;

        document.getElementById("editChildGuardianPhone").value =
            child.phone_no || "";

        bootstrap.Modal
            .getOrCreateInstance(
                document.getElementById("editChildModal")
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

    // RESEND INVITATION
    else if (button.classList.contains("resend-invitation-button")) {
        resendChildInvitation(child.child_id, button);
    }
});

// Add new child
document
    .getElementById("addChildForm")
    .addEventListener("submit", async function (event) {
        event.preventDefault();

        const submitButton = this.querySelector(
            'button[type="submit"]'
        );

        submitButton.disabled = true;
        submitButton.textContent = "Adding...";

        const childData = {
            full_name: document.getElementById("addChildName").value,
            user_id: document.getElementById("addChildMyKid").value,
            date_of_birth: document.getElementById("addChildDOB").value,
            gender: document.getElementById("addChildGender").value,
            guardian_name: document.getElementById("addChildGuardianName").value,
            phone_no: document.getElementById("addChildGuardianPhone").value,
            email: document.getElementById("addChildGuardianEmail").value
        };

        try {
            const response = await fetch("http://localhost:3000/api/child", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(childData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Failed to add child.");
            }

            // Close the modal and clear the form
            bootstrap.Modal
                .getOrCreateInstance(
                    document.getElementById("addChildModal")
                )
                .hide();

            this.reset();

            // Refresh the child table
            await loadChild();

            showToast("Child added successfully!", "success");

        } catch (error) {
            console.error("Error adding child:", error);
            showToast(error.message, "error");
            

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Add Child";
        }
    });

// ================= UPDATE CHILD DETAILS =================
document.getElementById("editChildForm").addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        const form = this;
        const submitButton = form.querySelector(
            'button[type="submit"]'
        );

        const childId = document.getElementById(
            "editChildId"
        ).value;

        const childData = {
            user_id: document.getElementById(
                "editChildMyKid"
            ).value.trim(),

            full_name: document.getElementById(
                "editChildName"
            ).value.trim(),

            date_of_birth: document.getElementById(
                "editChildDOB"
            ).value.trim(),

            gender: document.getElementById(
                "editChildGender"
            ).value,

            guardian_name: document.getElementById(
                "editChildGuardianName"
            ).value.trim(),

            phone_no: document.getElementById(
                "editChildGuardianPhone"
            ).value.trim(),

            email: document.getElementById(
                "editChildGuardianEmail"
            ).value.trim()
        };

        submitButton.disabled = true;
        submitButton.textContent = "Saving...";

        try {
            const response = await fetch(
                `http://localhost:3000/api/child/${childId}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(childData)
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    "Failed to update child details."
                );
            }

            bootstrap.Modal.getOrCreateInstance(
                document.getElementById("editChildModal")
            ).hide();

            await loadChild();

            showToast(result.message, "success");

        } catch (error) {
            console.error("Error updating child:", error);
            showToast(error.message, "error");

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Save Changes";
        }
    }
);

// ================= CONFIRM ACTIVATION OR DEACTIVATION FOR CHILD =================
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

            document.getElementById("pregnantWomanPanel").hidden =
                tab.dataset.tab !== "pregnant-women";

            document.getElementById("childPanel").hidden =
                tab.dataset.tab !== "children";
        });
    });
}

// ================= INITIALISE PAGE =================
document.addEventListener("DOMContentLoaded", () => {
    loadPregnantWomen();
    loadChild();
    setupTabs();

    // Disable future dates in birth date pickers
    const pregnantWomanDOB = document.getElementById("addPregnantWomanDOB");
    const editPregnantWomanDOB = document.getElementById("editPregnantWomanDOB");
    const childDOB = document.getElementById("addChildDOB");
    const editChildDOB = document.getElementById("editChildDOB");

    const today = new Date().toLocaleDateString("sv-SE");

    if (pregnantWomanDOB) {
        pregnantWomanDOB.max = today;
    }

    if (editPregnantWomanDOB) {
        editPregnantWomanDOB.max = today;
    }

    if (childDOB) {
        childDOB.max = today;
    }

    if (editChildDOB) {
        editChildDOB.max = today;
    }

    document.getElementById("pregnantWomanSearch").addEventListener("input", applyPregnantWomanFilters);
    document.getElementById("pregnantWomanStatusFilter").addEventListener("change", applyPregnantWomanFilters);
    document.getElementById("pregnantWomanResetFilters").addEventListener("click", resetPregnantWomanFilters);

    document.getElementById("childSearch").addEventListener("input", applyChildFilters);
    document.getElementById("childStatusFilter").addEventListener("change", applyChildFilters);
    document.getElementById("childResetFilters").addEventListener("click", resetChildFilters);
});
