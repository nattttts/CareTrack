import { showToast } from "./popup_message.js";

let allStaff = [];

async function loadStaff() {
    const tableBody = document.getElementById("staffTableBody");

    try {
        const response = await fetch("http://localhost:3000/api/staff");

        if (!response.ok) {
            throw new Error("Failed to retrieve staff records.");
        }

        const staffList = await response.json();
        
        allStaff = staffList;

        // Remove old rows, but keep the "no matching staff" message
        tableBody.querySelectorAll(".staff-row").forEach(row => row.remove());

        staffList.forEach(staff => {
            const row = document.createElement("tr");
            row.classList.add("staff-row");

            row.dataset.search = [
                staff.full_name,
                staff.email,
                staff.position
            ].join(" ").toLowerCase();

            row.dataset.status = staff.account_status;

            row.innerHTML = `
                <td>
                    <strong>${staff.full_name}</strong>
                </td>

                <td>${staff.user_id}</td>
                <td>${staff.email}</td>
                <td>${staff.position}</td>
                <td>
                    <div class="account-status-group">
                        <span class="status-badge ${
                            staff.account_status === "Active"
                                ? "active-status"
                                : "inactive-status"
                        }">
                            <span class="status-dot"></span>
                            ${staff.account_status}
                        </span>

                        <span class="password-status ${
                            Number(staff.password_set) === 1
                                ? "password-set"
                                : "password-not-set"
                        }">
                            <i class="bi ${
                                Number(staff.password_set) === 1
                                    ? "bi-check-circle"
                                    : "bi-clock"
                            }"></i>

                            ${
                                Number(staff.password_set) === 1
                                    ? "Password set"
                                    : "Password not set"
                            }
                        </span>
                    </div>
                </td>
                <td>${new Date(staff.created_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                })}</td>
                <td class="staff-actions-cell">
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
                                staff.account_status === "Active"
                                    ? "deactivate-button"
                                    : "activate-button"
                            }"
                        >
                            <i class="bi ${
                                staff.account_status === "Active"
                                    ? "bi-person-x"
                                    : "bi-person-check"
                            }"></i>

                            <span>${
                                staff.account_status === "Active"
                                    ? "Deactivate"
                                    : "Activate"
                            }</span>
                        </button>
                    </div>

                    ${
                        Number(staff.password_set) !== 1
                            ? `
                                <button
                                    type="button"
                                    class="action-button resend-invitation-button"
                                    data-staff-id="${staff.staff_id}"
                                >
                                    <i class="bi bi-envelope"></i>
                                    <span>Resend Invitation</span>
                                </button>
                            `
                            : ""
                    }
                </td>
            `;

            row.dataset.staffId = staff.staff_id;

            tableBody.appendChild(row);
        });

        applyStaffFilters();

    } catch (error) {
        console.error("Error loading staff:", error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    Unable to load staff records.
                </td>
            </tr>
        `;
    }
}


function applyStaffFilters() {
    const searchInput = document
        .getElementById("staffSearch")
        .value
        .toLowerCase()
        .trim();

    const selectedStatus = document.getElementById("statusFilter").value;

    const rows = document.querySelectorAll(
        "#staffTableBody .staff-row"
    );

    let visibleCount = 0;

    rows.forEach(row => {
        const matchesSearch =
            row.dataset.search.includes(searchInput);

        const matchesStatus =
            selectedStatus === "" ||
            row.dataset.status === selectedStatus;

        const matches = matchesSearch && matchesStatus;

        row.style.display = matches ? "" : "none";

        if (matches) {
            visibleCount++;
        }
    });

    const noStaffFound = document.getElementById("noStaffFound");

    if (noStaffFound) {
        noStaffFound.hidden = visibleCount > 0;
    }

    document.getElementById("staffCount").textContent =
        `Showing ${visibleCount} of ${allStaff.length} staff`;
}


async function resendInvitation(staffId, button) {
    const originalText = button.innerHTML;

    try {
        // Prevent repeated clicks while the request is processing
        button.disabled = true;
        button.textContent = "Sending...";

        // Ask the backend to generate a new invitation
        const response = await fetch(
            `http://localhost:3000/api/staff/${staffId}/resend-invitation`,
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

        alert(result.message);


        // Development only: show the returned invitation URL
        // if the backend provides one
        if (result.developmentInvitationUrl) {
            console.log(
                "Development invitation URL:",
                result.developmentInvitationUrl
            );
        }

        // Refresh the staff table to reflect the latest account data
        await loadStaff();

    } catch (error) {
        console.error("Error resending invitation:", error);
        alert(error.message || "Failed to resend invitation.");
    } finally {
        // The original button may have been removed by loadStaff()
        // Restore it only if it is still present on the page
        if (button.isConnected) {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }
}

const staffTableBody = document.getElementById("staffTableBody");

let selectedStaff = null;
let requestedStatus = null;

// Handle action buttons
staffTableBody.addEventListener("click", function (event) {
    const button = event.target.closest("button");

    if (!button || !staffTableBody.contains(button)) {
        return;
    }

    const row = button.closest(".staff-row");

    if (!row) {
        return;
    }

    const staff = allStaff.find(
        item => String(item.staff_id) === row.dataset.staffId
    );

    if (!staff) {
        return;
    }

    selectedStaff = staff;

    // VIEW STAFF
    if (button.classList.contains("view-button")) {
        document.getElementById("viewStaffProfileName").textContent =
            staff.full_name;

        document.getElementById("viewStaffName").textContent =
            staff.full_name;
        
        document.getElementById("viewStaffICNumber").textContent =
            staff.user_id;

        document.getElementById("viewStaffEmail").textContent =
            staff.email;

        document.getElementById("viewStaffPhone").textContent =
            staff.phone_no || "—";

        document.getElementById("viewStaffPosition").textContent =
            staff.position;
        
        document.getElementById("viewStaffDate").textContent =
            new Date(staff.created_at).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });

        const statusBadge =
            document.getElementById("viewStaffProfileStatus");

        statusBadge.classList.toggle(
            "active-status",
            staff.account_status === "Active"
        );

        statusBadge.classList.toggle(
            "inactive-status",
            staff.account_status === "Inactive"
        );

        document.getElementById("viewStaffProfileStatusText").textContent =
            staff.account_status;

        bootstrap.Modal
            .getOrCreateInstance(
                document.getElementById("viewStaffModal")
            )
            .show();
    }

    // EDIT STAFF
    else if (button.classList.contains("edit-button")) {
        document.getElementById("editStaffId").value =
            staff.staff_id;

        document.getElementById("editStaffName").value =
            staff.full_name;

        document.getElementById("editStaffICNumber").value =
            staff.user_id;

        document.getElementById("editStaffEmail").value =
            staff.email;

        document.getElementById("editStaffPhone").value =
            staff.phone_no || "";

        document.getElementById("editStaffPosition").value =
            staff.position;

        bootstrap.Modal
            .getOrCreateInstance(
                document.getElementById("editStaffModal")
            )
            .show();
    }

    // ACTIVATE / DEACTIVATE
    else if (
        button.classList.contains("activate-button") ||
        button.classList.contains("deactivate-button")
    ) {
        const isActive = staff.account_status === "Active";
        requestedStatus = isActive ? "Inactive" : "Active";

        document.getElementById("deactivateModalLabel").textContent =
            isActive
                ? "Deactivate Staff Account?"
                : "Activate Staff Account?";

        document.getElementById("statusStaffName").textContent = staff.full_name;

        document.getElementById("statusAction").textContent =
            isActive ? "deactivate" : "activate";

        document.getElementById("statusWarningText").textContent =
            isActive
                ? "The staff member will no longer be able to log in to the system."
                : "The staff member will be able to log in to the system again.";

        const confirmButton = document.getElementById(
            "confirmStaffStatusButton"
        );

        confirmButton.className = isActive
            ? "btn btn-danger"
            : "btn btn-success";

        confirmButton.innerHTML = isActive
            ? '<i class="bi bi-person-x"></i> Deactivate'
            : '<i class="bi bi-person-check"></i> Activate';

        bootstrap.Modal
            .getOrCreateInstance(
                document.getElementById("deactivateModal")
            )
            .show();
    }
    
    // RESEND INVITATION
    else if (button.classList.contains("resend-invitation-button")) {
        resendInvitation(staff.staff_id, button);
    }

});

// Add new staff
document
    .getElementById("addStaffForm")
    .addEventListener("submit", async function (event) {
        event.preventDefault();

        const submitButton = this.querySelector(
            'button[type="submit"]'
        );

        submitButton.disabled = true;
        submitButton.textContent = "Adding...";

        const staffData = {
            full_name: document.getElementById("addStaffName").value,
            user_id: document.getElementById("addStaffIC").value,
            email: document.getElementById("addStaffEmail").value,
            phone_no: document.getElementById("addStaffPhoneNo").value,
            position: document.getElementById("addStaffPosition").value
        };

        try {
            const response = await fetch("http://localhost:3000/api/staff", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(staffData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Failed to add staff.");
            }

            // Close the modal and clear the form
            bootstrap.Modal
                .getOrCreateInstance(
                    document.getElementById("addStaffModal")
                )
                .hide();

            this.reset();

            // Refresh the staff table
            await loadStaff();

            showToast("Staff added successfully!", "success");

        } catch (error) {
            console.error("Error adding staff:", error);
            showToast(error.message, "error");
            

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Add Staff";
        }
    });

// Update staff details
document.getElementById("editStaffForm").addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        const form = this;
        const submitButton = form.querySelector(
            'button[type="submit"]'
        );

        const staffId = document.getElementById(
            "editStaffId"
        ).value;

        const staffData = {
            user_id: document.getElementById(
                "editStaffICNumber"
            ).value.trim(),

            full_name: document.getElementById(
                "editStaffName"
            ).value.trim(),

            email: document.getElementById(
                "editStaffEmail"
            ).value.trim(),

            phone_no: document.getElementById(
                "editStaffPhone"
            ).value.trim(),

            position: document.getElementById(
                "editStaffPosition"
            ).value
        };

        submitButton.disabled = true;
        submitButton.textContent = "Saving...";

        try {
            const response = await fetch(
                `http://localhost:3000/api/staff/${staffId}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(staffData)
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    "Failed to update staff details."
                );
            }

            bootstrap.Modal.getOrCreateInstance(
                document.getElementById("editStaffModal")
            ).hide();

            await loadStaff();

            showToast(result.message, "success");

        } catch (error) {
            console.error("Error updating staff:", error);
            showToast(error.message, "error");

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Save Changes";
        }
    }
);

// Confirm activation or deactivation
document
    .getElementById("confirmStaffStatusButton")
    .addEventListener("click", async function () {
        if (!selectedStaff || !requestedStatus) {
            return;
        }

        const confirmButton = this;

        confirmButton.disabled = true;

        try {
            const response = await fetch(
                `http://localhost:3000/api/staff/${selectedStaff.staff_id}/status`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        account_status: requestedStatus
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Failed to update staff status."
                );
            }

            // Close the confirmation modal
            bootstrap.Modal
                .getOrCreateInstance(
                    document.getElementById("deactivateModal")
                )
                .hide();

            // Refresh the table using the latest database records
            await loadStaff();

            // Display a success toast
            showToast(result.message, "success");

            // Clear the selection
            selectedStaff = null;
            requestedStatus = null;

        } catch (error) {
            console.error("Error updating staff status:", error);
            showToast(error.message, "error");

        } finally {
            confirmButton.disabled = false;
        }
    });

document.getElementById("staffSearch").addEventListener("input", applyStaffFilters);
document.getElementById("statusFilter").addEventListener("change", applyStaffFilters);

document.addEventListener("DOMContentLoaded", loadStaff);
