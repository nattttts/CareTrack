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

            row.innerHTML = `
                <td>
                    <div class="staff-info">
                        <img
                            src="../icons/user.png"
                            alt=""
                            class="staff-avatar"
                        >
                        <div>
                            <strong>${staff.full_name}</strong>
                            <span>${staff.position}</span>
                        </div>
                    </div>
                </td>

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
                        <!-- We'll connect the action buttons later -->
                        <button type="button" class="action-button view-button">
                            <i class="bi bi-eye"></i>
                            <span>View</span>
                        </button>

                        <button type="button" class="action-button edit-button">
                            <i class="bi bi-pencil"></i>
                            <span>Edit</span>
                        </button>

                        <button type="button" class="action-button deactivate-button">
                            <i class="bi bi-person-x"></i>
                            <span>Deactivate</span>
                        </button>
                    </div>
                </td>
            `;

            tableBody.appendChild(row);
        });

        searchStaff();

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


function searchStaff() {
    const searchInput = document
        .getElementById("staffSearch")
        .value
        .toLowerCase()
        .trim();

    const rows = document.querySelectorAll(
        "#staffTableBody .staff-row"
    );

    let visibleCount = 0;

    rows.forEach(row => {
        // Read the staff data stored on this row
        const searchableText = row.textContent.toLowerCase();

        const matches = searchableText.includes(searchInput);

        row.style.display = matches ? "" : "none";

        if (matches) {
            visibleCount++;
        }
    });

    // Show the message when there are no matching rows
    const noStaffFound = document.getElementById("noStaffFound");
    noStaffFound.hidden = visibleCount > 0;

    // Update the footer
    const staffCount = document.getElementById("staffCount");
    staffCount.textContent =
        `Showing ${visibleCount} of ${allStaff.length} staff`;
}


document.getElementById("staffSearch").addEventListener("input", searchStaff);

document.addEventListener("DOMContentLoaded", loadStaff);
