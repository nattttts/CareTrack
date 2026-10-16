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
                    <span class="status-badge ${
                        staff.account_status === "Active"
                            ? "active-status"
                            : "inactive-status"
                    }">
                        <span class="status-dot"></span>
                        ${staff.account_status}
                    </span>
                </td>
                <td>${new Date(staff.created_at).toLocaleDateString("en-GB", {
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
                <td colspan="6" class="text-center">
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


const staffTableBody = document.getElementById("staffTableBody");

let selectedStaff = null;

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
});

// ADD STAFF
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


        } catch (error) {
            console.error("Error adding staff:", error);
            

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Add Staff";
        }
    });


document.getElementById("staffSearch").addEventListener("input", applyStaffFilters);
document.getElementById("statusFilter").addEventListener("change", applyStaffFilters);

document.addEventListener("DOMContentLoaded", loadStaff);
