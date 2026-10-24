import { showToast } from "./popup_message.js";

let allMother = [];
let allChild = [];

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
                    <div class="account-status-group">
                        <span class="status-badge ${
                            mother.account_status === "Active"
                                ? "active-status"
                                : "inactive-status"
                        }">
                            <span class="status-dot"></span>
                            ${mother.account_status}
                        </span>

                        <span class="password-status ${
                            Number(mother.password_set) === 1
                                ? "password-set"
                                : "password-not-set"
                        }">
                            <i class="bi ${
                                Number(mother.password_set) === 1
                                    ? "bi-check-circle"
                                    : "bi-clock"
                            }"></i>

                            ${
                                Number(mother.password_set) === 1
                                    ? "Password set"
                                    : "Password not set"
                            }
                        </span>
                    </div>
                </td>
                <td>${new Date(mother.created_at).toLocaleDateString("en-GB", {
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

                    ${
                        Number(mother.password_set) !== 1
                            ? `
                                <button
                                    type="button"
                                    class="action-button resend-invitation-button"
                                    data-mother-id="${mother.mother_id}"
                                >
                                    <i class="bi bi-envelope"></i>
                                    <span>Resend Invitation</span>
                                </button>
                            `
                            : ""
                    }
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

// ================= RESET MOTHER FILTERS =================
function resetMotherFilters() {
    document.getElementById("motherSearch").value = "";
    document.getElementById("motherStatusFilter").value = "all";
    applyMotherFilters();
}

async function resendMotherInvitation(motherId, button) {
    const originalText = button.innerHTML;

    try {
        // Prevent repeated clicks while the request is processing
        button.disabled = true;
        button.textContent = "Sending...";

        // Ask the backend to generate a new invitation
        const response = await fetch(
            `http://localhost:3000/api/mother/${motherId}/resend-invitation`,
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

        // Refresh the mother table to reflect the latest account data
        await loadMother();

    } catch (error) {
        console.error("Error resending invitation:", error);
        showToast(error.message || "Failed to resend invitation.", "error");
    } finally {
        // The original button may have been removed by loadMother()
        // Restore it only if it is still present on the page
        if (button.isConnected) {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }
}

// ================= HANDLE MOTHER ACTION BUTTONS =================
const motherTableBody = document.getElementById("motherTableBody");

let selectedMother = null;
let requestedMotherStatus = null;

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

    // EDIT MOTHER
    else if (button.classList.contains("edit-button")) {
        document.getElementById("editMotherId").value =
            mother.mother_id;

        document.getElementById("editMotherName").value =
            mother.full_name;

        document.getElementById("editMotherICNumber").value =
            mother.user_id;

         document.getElementById("editMotherDOB").value =
            mother.date_of_birth;

         document.getElementById("editMotherPhone").value =
            mother.phone_no || "";

        document.getElementById("editMotherEmail").value =
            mother.email;

        document.getElementById("editMotherAddress").value =
            mother.address;

        document.getElementById("editMotherEmergencyName").value =
            mother.contact_name;

        document.getElementById("editMotherRelationship").value =
            mother.relationship;

        document.getElementById("editMotherEmergencyPhone").value =
            mother.contact_phone_no;

        bootstrap.Modal
            .getOrCreateInstance(
                document.getElementById("editMotherModal")
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

    // RESEND INVITATION
    else if (button.classList.contains("resend-invitation-button")) {
        resendMotherInvitation(mother.mother_id, button);
    }
});

// Add new mother
document
    .getElementById("addMotherForm")
    .addEventListener("submit", async function (event) {
        event.preventDefault();

        const submitButton = this.querySelector(
            'button[type="submit"]'
        );

        submitButton.disabled = true;
        submitButton.textContent = "Adding...";

        const motherData = {
            full_name: document.getElementById("addMotherName").value,
            user_id: document.getElementById("addMotherIC").value,
            date_of_birth: document.getElementById("addMotherDOB").value,
            phone_no: document.getElementById("addMotherPhoneNo").value,
            email: document.getElementById("addMotherEmail").value,
            address: document.getElementById("addMotherAddress").value,
            contact_name: document.getElementById("addMotherEmergencyName").value,
            relationship: document.getElementById("addMotherRelationship").value,
            contact_phone_no: document.getElementById("addMotherEmergencyPhone").value
        };

        try {
            const response = await fetch("http://localhost:3000/api/mother", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(motherData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Failed to add mother.");
            }

            // Close the modal and clear the form
            bootstrap.Modal
                .getOrCreateInstance(
                    document.getElementById("addMotherModal")
                )
                .hide();

            this.reset();

            // Refresh the mother table
            await loadMother();

            showToast("Mother added successfully!", "success");

        } catch (error) {
            console.error("Error adding mother:", error);
            showToast(error.message, "error");
            

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Add Mother";
        }
    });

// ================= UPDATE MOTHER DETAILS =================
document.getElementById("editMotherForm").addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        const form = this;
        const submitButton = form.querySelector(
            'button[type="submit"]'
        );

        const motherId = document.getElementById(
            "editMotherId"
        ).value;

        const motherData = {
            user_id: document.getElementById(
                "editMotherICNumber"
            ).value.trim(),

            full_name: document.getElementById(
                "editMotherName"
            ).value.trim(),

            date_of_birth: document.getElementById(
                "editMotherDOB"
            ).value.trim(),

            phone_no: document.getElementById(
                "editMotherPhone"
            ).value.trim(),

            email: document.getElementById(
                "editMotherEmail"
            ).value.trim(),

            address: document.getElementById(
                "editMotherAddress"
            ).value.trim(),

            contact_name: document.getElementById(
                "editMotherEmergencyName"
            ).value.trim(),

            relationship: document.getElementById(
                "editMotherRelationship"
            ).value.trim(),

            contact_phone_no: document.getElementById(
                "editMotherEmergencyPhone"
            ).value.trim(),
        };

        submitButton.disabled = true;
        submitButton.textContent = "Saving...";

        try {
            const response = await fetch(
                `http://localhost:3000/api/mother/${motherId}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(motherData)
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    "Failed to update mother details."
                );
            }

            bootstrap.Modal.getOrCreateInstance(
                document.getElementById("editMotherModal")
            ).hide();

            await loadMother();

            showToast(result.message, "success");

        } catch (error) {
            console.error("Error updating mother:", error);
            showToast(error.message, "error");

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Save Changes";
        }
    }
);

// ================= CONFIRM ACTIVATION OR DEACTIVATION FOR MOTHER =================
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

    // Disable future dates in birth date pickers
    const motherDOB = document.getElementById("addMotherDOB");
    const editMotherDOB = document.getElementById("editMotherDOB");
    const childDOB = document.getElementById("addChildDOB");
    const editChildDOB = document.getElementById("editChildDOB");

    const today = new Date().toLocaleDateString("sv-SE");

    if (motherDOB) {
        motherDOB.max = today;
    }

    if (editMotherDOB) {
        editMotherDOB.max = today;
    }

    if (childDOB) {
        childDOB.max = today;
    }

    if (editChildDOB) {
        editChildDOB.max = today;
    }

    document.getElementById("motherSearch").addEventListener("input", applyMotherFilters);
    document.getElementById("motherStatusFilter").addEventListener("change", applyMotherFilters);
    document.getElementById("motherResetFilters").addEventListener("click", resetMotherFilters);

    document.getElementById("childSearch").addEventListener("input", applyChildFilters);
    document.getElementById("childStatusFilter").addEventListener("change", applyChildFilters);
    document.getElementById("childResetFilters").addEventListener("click", resetChildFilters);
});
