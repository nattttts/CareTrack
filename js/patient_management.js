// ================= SAMPLE DATA =================

let mothers = [
    {
        id: 1,
        fullName: "Jane Tan",
        icNumber: "950815-07-1122",
        dob: "1995-08-15",
        phone: "012-3456789",
        email: "janetan@gmail.com",
        address: "123, Taman Mutiara, Bayan Lepas, Pulau Pinang",
        emergencyName: "Lim Yong Ming",
        emergencyRelationship: "Husband",
        emergencyPhone: "011-7458526",
        status: "Active",
        dateCreated: "2026-10-07"
    },
    {
        id: 2,
        fullName: "Nur Aisyah",
        icNumber: "990420-07-3344",
        dob: "1999-04-20",
        phone: "017-4453756",
        email: "aisyah123@gmail.com",
        address: "Bayan Lepas, Pulau Pinang",
        emergencyName: "Ahmad Rahman",
        emergencyRelationship: "Husband",
        emergencyPhone: "016-2223344",
        status: "Inactive",
        dateCreated: "2026-09-15"
    }
];

let children = [
    {
        id: 1,
        fullName: "Alice Tan",
        myKidNumber: "260612-07-0248",
        dob: "2026-06-12",
        gender: "Female",
        guardianName: "Jane Tan",
        guardianPhone: "012-3456789",
        guardianEmail: "janetan@gmail.com",
        status: "Active",
        dateCreated: "2026-06-14"
    },
    {
        id: 2,
        fullName: "Adam Rahman",
        myKidNumber: "250315-07-0456",
        dob: "2025-03-15",
        gender: "Male",
        guardianName: "Nur Aisyah",
        guardianPhone: "017-4453756",
        guardianEmail: "aisyah123@gmail.com",
        status: "Inactive",
        dateCreated: "2025-03-20"
    }
];

// ================= HELPER FUNCTIONS =================

// Escape user-provided text before inserting it into HTML.
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function formatDate(dateString) {
    if (!dateString) return "-";

    const date = new Date(`${dateString}T00:00:00`);

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function createStatusBadge(status) {
    const active = status === "Active";

    return `
        <span class="status-badge ${active ? "active-status" : "inactive-status"}">
            <span class="status-dot"></span>
            ${escapeHTML(status)}
        </span>
    `;
}

// ================= RENDER MOTHER TABLE =================

function renderMothers() {
    const tableBody = document.getElementById("motherTableBody");

    tableBody.innerHTML = mothers.map(mother => `
        <tr class="mother-row" data-id="${mother.id}">
            <td>
                <strong class="mother-name">
                    ${escapeHTML(mother.fullName)}
                </strong>
            </td>

            <td>${escapeHTML(mother.icNumber)}</td>
            <td>${escapeHTML(mother.phone)}</td>
            <td>${createStatusBadge(mother.status)}</td>
            <td>${formatDate(mother.dateCreated)}</td>

            <td>
                <div class="action-buttons">
                    <button type="button"
                        class="action-button view-button"
                        data-action="view"
                        data-id="${mother.id}">
                        <i class="bi bi-eye"></i>
                        <span>View</span>
                    </button>

                    <button type="button"
                        class="action-button edit-button"
                        data-action="edit"
                        data-id="${mother.id}">
                        <i class="bi bi-pencil"></i>
                        <span>Edit</span>
                    </button>

                    <button type="button"
                        class="action-button ${mother.status === "Active" ? "deactivate-button" : "activate-button"}"
                        data-action="toggle-status"
                        data-id="${mother.id}">
                        <i class="bi ${mother.status === "Active" ? "bi-person-x" : "bi-person-check"}"></i>
                        <span>${mother.status === "Active" ? "Deactivate" : "Activate"}</span>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");

    filterMothers();
}

// ================= RENDER CHILD TABLE =================

function renderChildren() {
    const tableBody = document.getElementById("childTableBody");

    tableBody.innerHTML = children.map(child => `
        <tr class="child-row" data-id="${child.id}">
            <td>
                <strong class="child-name">
                    ${escapeHTML(child.fullName)}
                </strong>
            </td>

            <td>${escapeHTML(child.myKidNumber)}</td>
            <td>${escapeHTML(child.gender)}</td>
            <td>${escapeHTML(child.guardianName)}</td>
            <td>${createStatusBadge(child.status)}</td>
            <td>${formatDate(child.dateCreated)}</td>

            <td>
                <div class="action-buttons">
                    <button type="button"
                        class="action-button view-button"
                        data-action="view"
                        data-id="${child.id}">
                        <i class="bi bi-eye"></i>
                        <span>View</span>
                    </button>

                    <button type="button"
                        class="action-button edit-button"
                        data-action="edit"
                        data-id="${child.id}">
                        <i class="bi bi-pencil"></i>
                        <span>Edit</span>
                    </button>

                    <button type="button"
                        class="action-button ${child.status === "Active" ? "deactivate-button" : "activate-button"}"
                        data-action="toggle-status"
                        data-id="${child.id}">
                        <i class="bi ${child.status === "Active" ? "bi-person-x" : "bi-person-check"}"></i>
                        <span>${child.status === "Active" ? "Deactivate" : "Activate"}</span>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");

    filterChildren();
}

// ================= MOTHER SEARCH & FILTER =================

function filterMothers() {
    const keyword = document
        .getElementById("motherSearch")
        .value.toLowerCase().trim();

    const status = document.getElementById("motherStatusFilter").value;

    let visibleCount = 0;

    document.querySelectorAll("#motherTableBody .mother-row")
        .forEach(row => {
            const mother = mothers.find(
                item => item.id === Number(row.dataset.id)
            );

            if (!mother) return;

            const matchesSearch = [
                mother.fullName,
                mother.icNumber,
                mother.phone,
                mother.email
            ].some(value =>
                String(value ?? "").toLowerCase().includes(keyword)
            );

            const matchesStatus =
                status === "all" || mother.status === status;

            const visible = matchesSearch && matchesStatus;

            row.hidden = !visible;

            if (visible) visibleCount++;
        });

    // Update record count
    document.getElementById("motherCount").textContent =
        `Showing ${visibleCount} of ${mothers.length} mothers`;

    // Show or hide the no-results message
    document.getElementById("noMotherResults").hidden =
        visibleCount > 0;

    // Hide the table header when there are no matching records
    document.querySelector("#motherTableBody")
        .closest("table").querySelector("thead").hidden =
        visibleCount === 0;
}


// ================= CHILD SEARCH & FILTER =================

function filterChildren() {
    const keyword = document
        .getElementById("childSearch")
        .value.toLowerCase().trim();

    const status = document.getElementById("childStatusFilter").value;

    let visibleCount = 0;

    document.querySelectorAll("#childTableBody .child-row")
        .forEach(row => {
            const child = children.find(
                item => item.id === Number(row.dataset.id)
            );

            if (!child) return;

            const matchesSearch = [
                child.fullName,
                child.myKidNumber,
                child.gender,
                child.guardianName,
                child.guardianPhone,
                child.guardianEmail
            ].some(value =>
                String(value ?? "").toLowerCase().includes(keyword)
            );

            const matchesStatus =
                status === "all" || child.status === status;

            const visible = matchesSearch && matchesStatus;

            row.hidden = !visible;

            if (visible) visibleCount++;
        });

    // Update record count
    document.getElementById("childCount").textContent =
        `Showing ${visibleCount} of ${children.length} children`;

    // Show or hide the no-results message
    document.getElementById("noChildResults").hidden =
        visibleCount > 0;

    // Hide the table header when there are no matching records
    document.querySelector("#childTableBody")
        .closest("table").querySelector("thead").hidden =
        visibleCount === 0;
}

// ================= RESET FILTERS =================

function resetMotherFilters() {
    document.getElementById("motherSearch").value = "";
    document.getElementById("motherStatusFilter").value = "all";

    filterMothers();
}

function resetChildFilters() {
    document.getElementById("childSearch").value = "";
    document.getElementById("childStatusFilter").value = "all";

    filterChildren();
}

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
    renderMothers();
    renderChildren();
    setupTabs();
    setupActionButtons();

    document.getElementById("motherSearch")
        .addEventListener("input", filterMothers);

    document.getElementById("motherStatusFilter")
        .addEventListener("change", filterMothers);

    document.getElementById("motherResetFilters")
        .addEventListener("click", resetMotherFilters);

    document.getElementById("childSearch")
        .addEventListener("input", filterChildren);

    document.getElementById("childStatusFilter")
        .addEventListener("change", filterChildren);

    document.getElementById("childResetFilters")
        .addEventListener("click", resetChildFilters);
});

// ================= VIEW & EDIT =================

let editingMotherId = null;
let editingChildId = null;

// ================= ACTIVATE / DEACTIVATE =================
let pendingMotherId = null;
let pendingChildId = null;

// ================= VIEW MOTHER =================

function viewMother(mother) {
    const content = document.getElementById("motherViewContent");

    content.innerHTML = `
        <div class="view-profile">
            <h4>${escapeHTML(mother.fullName)}</h4>
            ${createStatusBadge(mother.status)}
        </div>

        <div class="detail-list">
            <h6>Personal Information</h6>

            <div><span>Full Name</span>
                <strong>${escapeHTML(mother.fullName)}</strong></div>

            <div><span>IC Number</span>
                <strong>${escapeHTML(mother.icNumber)}</strong></div>

            <div><span>Date of Birth</span>
                <strong>${formatDate(mother.dob)}</strong></div>

            <div><span>Phone Number</span>
                <strong>${escapeHTML(mother.phone)}</strong></div>

            <div><span>Email Address</span>
                <strong>${escapeHTML(mother.email)}</strong></div>

            <div><span>Home Address</span>
                <strong>${escapeHTML(mother.address)}</strong></div>

            <div><span>Date Created</span>
                <strong>${formatDate(mother.dateCreated)}</strong></div>

            <h6>Emergency Contact</h6>

            <div><span>Emergency Contact Name</span>
                <strong>${escapeHTML(mother.emergencyName)}</strong></div>

            <div><span>Relationship</span>
                <strong>${escapeHTML(mother.emergencyRelationship)}</strong></div>

            <div><span>Emergency Contact Phone Number</span>
                <strong>${escapeHTML(mother.emergencyPhone)}</strong></div>
        </div>
    `;

    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("viewMotherModal")
    ).show();
}

// ================= VIEW CHILD =================

function viewChild(child) {
    const content = document.getElementById("childViewContent");

    content.innerHTML = `
        <div class="view-profile">
            <h4>${escapeHTML(child.fullName)}</h4>
            ${createStatusBadge(child.status)}
        </div>

        <div class="detail-list">
            <h6>Child Information</h6>

            <div><span>Full Name</span>
                <strong>${escapeHTML(child.fullName)}</strong></div>

            <div><span>MyKid Number</span>
                <strong>${escapeHTML(child.myKidNumber)}</strong></div>

            <div><span>Date of Birth</span>
                <strong>${formatDate(child.dob)}</strong></div>

            <div><span>Gender</span>
                <strong>${escapeHTML(child.gender)}</strong></div>

            <div><span>Date Created</span>
                <strong>${formatDate(child.dateCreated)}</strong></div>

            <h6>Guardian's Contact</h6>

            <div><span>Guardian Name</span>
                <strong>${escapeHTML(child.guardianName)}</strong></div>

            <div><span>Guardian Phone Number</span>
                <strong>${escapeHTML(child.guardianPhone)}</strong></div>

            <div><span>Guardian Email</span>
                <strong>${escapeHTML(child.guardianEmail)}</strong></div>
        </div>
    `;

    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("viewChildModal")
    ).show();
}

// ================= OPEN EDIT MOTHER =================

function editMother(mother) {
    editingMotherId = mother.id;
    editingChildId = null;

    const form = document.getElementById("addMotherForm");
    const inputs = form.querySelectorAll(".modal-body input.form-control");

    // Input order: name, IC, DOB, phone, email,
    // address, emergency name, relationship, emergency phone.
    inputs[0].value = mother.fullName;
    inputs[1].value = mother.icNumber;
    inputs[2].value = mother.dob;
    inputs[3].value = mother.phone;
    inputs[4].value = mother.email;
    inputs[5].value = mother.address;
    inputs[6].value = mother.emergencyName;
    inputs[7].value = mother.emergencyRelationship;
    inputs[8].value = mother.emergencyPhone;

    document.getElementById("addMotherModalLabel").textContent =
        "Edit Mother";

    form.querySelector('[type="submit"]').textContent = "Save Changes";

    // Open modal
    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("addMotherModal")
    ).show();
}

// ================= OPEN EDIT CHILD =================

function editChild(child) {
    editingChildId = child.id;
    editingMotherId = null;

    const form = document.getElementById("addChildForm");
    const inputs = form.querySelectorAll(".modal-body input.form-control");
    const genderSelect = form.querySelector(".modal-body select.form-select");

    // Input order: name, MyKid, DOB, guardian name,
    // guardian phone, guardian email.
    inputs[0].value = child.fullName;
    inputs[1].value = child.myKidNumber;
    inputs[2].value = child.dob;
    inputs[3].value = child.guardianName;
    inputs[4].value = child.guardianPhone;
    inputs[5].value = child.guardianEmail;

    genderSelect.value = child.gender;

    document.getElementById("addChildModalLabel").textContent =
        "Edit Child";

    form.querySelector('[type="submit"]').textContent = "Save Changes";

    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("addChildModal")
    ).show();
}

// // ================= RESET FORM AFTER MODAL CLOSE =================

function resetMotherEditForm() {
    editingMotherId = null;

    const form = document.getElementById("addMotherForm");

    document.getElementById("addMotherModalLabel").textContent = "Add Mother";

    form.querySelector('[type="submit"]').textContent = "Add Mother";
    form.reset();
}

function resetChildEditForm() {
    editingChildId = null;

    const form = document.getElementById("addChildForm");

    document.getElementById("addChildModalLabel").textContent = "Add Child";

    form.querySelector('[type="submit"]').textContent = "Add Child";
    form.reset();
}

// ================= HANDLE VIEW,EDIT & DEACTIVATE BUTTONS =================

function setupActionButtons() {
    document.addEventListener("click", event => {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const action = button.dataset.action;
        const id = Number(button.dataset.id);

        // Mother actions
        if (button.closest("#motherTableBody")) {
            const mother = mothers.find(item => item.id === id);
            if (!mother) return;

            if (action === "view") {
                viewMother(mother);
            }

            if (action === "edit") {
                editMother(mother);
            }

            if (action === "toggle-status") {
                openMotherStatusModal(mother);
            }
        }

        // Child actions
        if (button.closest("#childTableBody")) {
            const child = children.find(item => item.id === id);
            if (!child) return;

            if (action === "view") {
                viewChild(child);
            }

            if (action === "edit") {
                editChild(child);
            }

            if (action === "toggle-status") {
                openChildStatusModal(child);
            }
        }
    });
}


// ================= SAVE MOTHER EDIT =================

document.getElementById("addMotherForm").addEventListener("submit", event => {
    if (editingMotherId === null) return;

    event.preventDefault();

    const form = event.currentTarget;
    const inputs = form.querySelectorAll(".modal-body input.form-control");

    const mother = mothers.find(item => item.id === editingMotherId);
    if (!mother) return;

    Object.assign(mother, {
        fullName: inputs[0].value.trim(),
        icNumber: inputs[1].value.trim(),
        dob: inputs[2].value,
        phone: inputs[3].value.trim(),
        email: inputs[4].value.trim(),
        address: inputs[5].value.trim(),
        emergencyName: inputs[6].value.trim(),
        emergencyRelationship: inputs[7].value.trim(),
        emergencyPhone: inputs[8].value.trim(),
    });

    renderMothers();

    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("addMotherModal")
    ).hide();
});

// ================= SAVE CHILD EDIT =================

document.getElementById("addChildForm").addEventListener("submit", event => {
    if (editingChildId === null) return;

    event.preventDefault();

    const form = event.currentTarget;
    const inputs = form.querySelectorAll(".modal-body input.form-control");
    const genderSelect = form.querySelector(".modal-body select.form-select");

    const child = children.find(item => item.id === editingChildId);
    if (!child) return;

    Object.assign(child, {
        fullName: inputs[0].value.trim(),
        myKidNumber: inputs[1].value.trim(),
        dob: inputs[2].value,
        gender: genderSelect.value,
        guardianName: inputs[3].value.trim(),
        guardianPhone: inputs[4].value.trim(),
        guardianEmail: inputs[5].value.trim(),
    });

    renderChildren();

    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("addChildModal")
    ).hide();
});


// Reset forms when the modal closes
document.getElementById("addMotherModal").addEventListener(
    "hidden.bs.modal",
    resetMotherEditForm
);

document.getElementById("addChildModal").addEventListener(
    "hidden.bs.modal",
    resetChildEditForm
);

// ================= OPEN MOTHER STATUS MODAL =================

function openMotherStatusModal(mother) {
    pendingMotherId = mother.id;

    const isActive = mother.status === "Active";

    document.getElementById("deactivateMotherModalLabel").textContent =
        isActive ? "Deactivate Mother Account?" : "Activate Mother Account?";

    document.getElementById("motherStatusTargetName").textContent =
        mother.fullName;

    document.getElementById("motherStatusWarning").textContent =
        isActive
            ? "The mother member will no longer be able to log in to the system."
            : "The mother member will be able to log in to the system again.";

    const confirmButton =
        document.getElementById("confirmMotherStatusButton");

    confirmButton.className = isActive
        ? "btn btn-danger"
        : "btn btn-success";

    confirmButton.innerHTML = isActive
        ? '<i class="bi bi-person-x"></i> Deactivate'
        : '<i class="bi bi-person-check"></i> Activate';

    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("deactivateMotherModal")
    ).show();
}


// ================= OPEN CHILD STATUS MODAL =================

function openChildStatusModal(child) {
    pendingChildId = child.id;

    const isActive = child.status === "Active";

    document.getElementById("deactivateChildModalLabel").textContent =
        isActive ? "Deactivate Child Account?" : "Activate Child Account?";

    document.getElementById("childStatusTargetName").textContent =
        child.fullName;

    document.getElementById("childStatusWarning").textContent =
        isActive
            ? "The child member will no longer be able to log in to the system."
            : "The child member will be able to log in to the system again.";

    const confirmButton =
        document.getElementById("confirmChildStatusButton");

    confirmButton.className = isActive
        ? "btn btn-danger"
        : "btn btn-success";

    confirmButton.innerHTML = isActive
        ? '<i class="bi bi-person-x"></i> Deactivate'
        : '<i class="bi bi-person-check"></i> Activate';

    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("deactivateChildModal")
    ).show();
}

// ================= CONFIRM MOTHER STATUS CHANGE =================

document.getElementById("confirmMotherStatusButton")
    .addEventListener("click", () => {

        const mother = mothers.find(
            item => item.id === pendingMotherId
        );

        if (!mother) return;

        mother.status = mother.status === "Active"
            ? "Inactive"
            : "Active";

        renderMothers();

        bootstrap.Modal.getOrCreateInstance(
            document.getElementById("deactivateMotherModal")
        ).hide();

        pendingMotherId = null;
    });

// ================= CONFIRM CHILD STATUS CHANGE =================

document.getElementById("confirmChildStatusButton")
    .addEventListener("click", () => {

        const child = children.find(
            item => item.id === pendingChildId
        );

        if (!child) return;

        child.status = child.status === "Active"
            ? "Inactive"
            : "Active";

        renderChildren();

        bootstrap.Modal.getOrCreateInstance(
            document.getElementById("deactivateChildModal")
        ).hide();

        pendingChildId = null;
    });