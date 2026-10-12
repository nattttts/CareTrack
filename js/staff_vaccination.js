
/* =========================================
   VACCINE DOSE OPTIONS
   Demo rules for the CareTrack assignment.
   Adjust these to match your approved schedule.
========================================= */

const vaccineDoseRules = {
    "BCG": ["Dose 1"],
    "Hepatitis B": ["Dose 1", "Dose 2", "Dose 3"],
    "DTP - IPV - Hib": ["Dose 1", "Dose 2", "Dose 3"],
    "DTP - IPV - Hib (Booster)": ["Booster Dose"],
    "MMR": ["Dose 1", "Dose 2"],
    "Varicella": ["Dose 1", "Dose 2"]
};


/* =========================================
   SAMPLE CHILDREN AND VACCINATION RECORDS
========================================= */

const children = {
    emma: {
        name: "Emma Tan",
        gender: "Female",
        dob: "2022-01-12",
        ic: "220112-14-5678",
        address: "12, CareTrack Street, Penang",

        records: [
            { vaccine: "BCG", dose: "Dose 1", status: "Completed", remarks: "-" },
            { vaccine: "Hepatitis B", dose: "Dose 1", status: "Completed", remarks: "-" },
            { vaccine: "DTP - IPV - Hib", dose: "Dose 1", status: "Completed", remarks: "-" },
            { vaccine: "DTP - IPV - Hib", dose: "Dose 2", status: "Completed", remarks: "-" },
            { vaccine: "DTP - IPV - Hib", dose: "Dose 3", status: "Completed", remarks: "-" },
            { vaccine: "DTP - IPV - Hib (Booster)", dose: "Booster Dose", status: "Upcoming", remarks: "Booster scheduled" },
            { vaccine: "MMR", dose: "Dose 1", status: "Upcoming", remarks: "-" },
            { vaccine: "Varicella", dose: "Dose 1", status: "Upcoming", remarks: "-" }
        ]
    },

    ethan: {
        name: "Ethan Tan",
        gender: "Male",
        dob: "2023-06-08",
        ic: "230608-14-6789",
        address: "25, CareTrack Street, Penang",

        records: [
            { vaccine: "BCG", dose: "Dose 1", status: "Completed", remarks: "-" },
            { vaccine: "Hepatitis B", dose: "Dose 1", status: "Completed", remarks: "-" },
            { vaccine: "DTP - IPV - Hib", dose: "Dose 1", status: "Completed", remarks: "-" },
            { vaccine: "DTP - IPV - Hib", dose: "Dose 2", status: "Completed", remarks: "-" },
            { vaccine: "DTP - IPV - Hib", dose: "Dose 3", status: "Upcoming", remarks: "-" },
            { vaccine: "MMR", dose: "Dose 1", status: "Upcoming", remarks: "-" }
        ]
    }
};


let selectedChild = null;
let selectedRecordIndex = null;


/* =========================================
   HELPER FUNCTIONS
========================================= */

function safe(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[character]));
}


function formatDate(dateString) {
    if (!dateString) return "";

    const date = new Date(dateString + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}


/* =========================================
   INITIALISE VACCINE DROPDOWNS
========================================= */

function fillVaccineSelects() {
    const vaccineOptions = Object.keys(vaccineDoseRules)
        .map(vaccine => {
            return `<option value="${safe(vaccine)}">${safe(vaccine)}</option>`;
        })
        .join("");

    document.getElementById("vaccine").innerHTML = vaccineOptions;
    document.getElementById("newVaccine").innerHTML = vaccineOptions;

    updateDoseOptions("update");
    updateDoseOptions("new");
}


/* =========================================
   FIND DOSES ALREADY RECORDED
========================================= */

function existingDoses(vaccine, exceptIndex = null) {
    if (!selectedChild) {
        return [];
    }

    return children[selectedChild].records
        .filter((record, index) => {
            return record.vaccine === vaccine && index !== exceptIndex;
        })
        .map(record => record.dose);
}


/* =========================================
   UPDATE DOSE DROPDOWN

   When adding a record:
   - Hide doses already recorded.
   - Show only remaining doses.

   When editing a record:
   - Exclude the current record from the
     duplicate check so its current dose
     can remain selected.
========================================= */

function updateDoseOptions(which) {
    const vaccineId = which === "new" ? "newVaccine" : "vaccine";
    const doseId = which === "new" ? "newDose" : "dose";

    const vaccineSelect = document.getElementById(vaccineId);
    const doseSelect = document.getElementById(doseId);

    const vaccine = vaccineSelect.value;

    const exceptIndex =
        which === "update" ? selectedRecordIndex : null;

    const alreadyRecorded = existingDoses(vaccine, exceptIndex);

    let availableDoses = (vaccineDoseRules[vaccine] || [])
        .filter(dose => !alreadyRecorded.includes(dose));

    // Keep the current dose visible while editing its own record.
    if (
        which === "update" &&
        selectedRecordIndex !== null &&
        selectedChild
    ) {
        const currentRecord =
            children[selectedChild].records[selectedRecordIndex];

        if (
            currentRecord &&
            currentRecord.vaccine === vaccine &&
            !availableDoses.includes(currentRecord.dose)
        ) {
            availableDoses.unshift(currentRecord.dose);
        }
    }

    doseSelect.innerHTML = "";

    if (availableDoses.length === 0) {
        doseSelect.add(new Option("No doses available", ""));
        doseSelect.disabled = true;
        return;
    }

    doseSelect.disabled = false;

    availableDoses.forEach(dose => {
        doseSelect.add(new Option(dose, dose));
    });
}


/* =========================================
   DISPLAY ALL CHILDREN
========================================= */

function displayChildren(filter = "") {
    const list = document.getElementById("childrenList");
    const noMessage = document.getElementById("noChildrenMessage");

    list.innerHTML = "";

    const query = filter.trim().toLowerCase();
    let count = 0;

    Object.keys(children).forEach(key => {
        const child = children[key];

        const matchesName = child.name.toLowerCase().includes(query);
        const matchesIC = child.ic.toLowerCase().includes(query);

        if (!matchesName && !matchesIC) {
            return;
        }

        count++;

        const item = document.createElement("div");
        item.className = "child-list-item";

        item.innerHTML = `
            <div class="child-list-left">
                <div class="child-list-avatar">
                    <img src="../icons/user.png" alt="">
                </div>

                <div class="child-list-information">
                    <h3>${safe(child.name)}</h3>
                    <p>${safe(child.gender)}</p>
                    <span>IC No: ${safe(child.ic)}</span>
                </div>
            </div>

            <button
                type="button"
                class="view-child-button"
                onclick="viewChild('${key}')"
            >
                View Child
            </button>
        `;

        list.appendChild(item);
    });

    noMessage.style.display = count === 0 ? "block" : "none";
}


function searchChild() {
    const searchValue = document.getElementById("searchChild").value;
    displayChildren(searchValue);
}


/* =========================================
   VIEW CHILD DETAILS
========================================= */

function viewChild(key) {
    if (!children[key]) {
        return;
    }

    selectedChild = key;
    selectedRecordIndex = null;

    const child = children[key];

    document.getElementById("childName").textContent = child.name;
    document.getElementById("childGender").textContent = child.gender;
    document.getElementById("childDOB").textContent = formatDate(child.dob);
    document.getElementById("childIC").textContent = child.ic;
    document.getElementById("childAddress").textContent = child.address;

    document.getElementById("childDetails").style.display = "block";

    cancelEditChild();
    clearRecordSelection();

    displayRecords();
    updateDoseOptions("new");

    document.getElementById("childDetails").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


/* =========================================
   DISPLAY VACCINATION RECORDS
========================================= */

function displayRecords() {
    const tableBody = document.getElementById("vaccinationTableBody");

    tableBody.innerHTML = "";

    if (!selectedChild) {
        return;
    }

    children[selectedChild].records.forEach((record, index) => {
        const row = document.createElement("tr");

        if (index === selectedRecordIndex) {
            row.classList.add("selected-row");
        }

        row.innerHTML = `
            <td>${safe(record.vaccine)}</td>
            <td>${safe(record.dose)}</td>

            <td>
                <span class="status ${safe(record.status.toLowerCase())}">
                    ${safe(record.status)}
                </span>
            </td>

            <td>${safe(record.remarks || "-")}</td>

            <td class="action-buttons">
                <button
                    type="button"
                    class="edit-record-button"
                    title="Edit record"
                    aria-label="Edit record"
                >
                    <i class="bi bi-pencil"></i>
                </button>

                <button
                    type="button"
                    class="delete-record-button"
                    title="Delete record"
                    aria-label="Delete record"
                >
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;

        row.addEventListener("click", () => {
            selectRecord(index);
        });

        row.querySelector(".edit-record-button")
            .addEventListener("click", event => {
                event.stopPropagation();
                selectRecord(index);
            });

        row.querySelector(".delete-record-button")
            .addEventListener("click", event => {
                event.stopPropagation();
                deleteRecord(index);
            });

        tableBody.appendChild(row);
    });
}


/* =========================================
   SELECT RECORD TO EDIT
========================================= */

function selectRecord(index) {
    const record = children[selectedChild]?.records[index];

    if (!record) {
        return;
    }

    selectedRecordIndex = index;

    document.getElementById("vaccine").value = record.vaccine;

    updateDoseOptions("update");

    document.getElementById("dose").value = record.dose;
    document.getElementById("status").value = record.status;

    document.getElementById("remarks").value =
        record.remarks === "-" ? "" : record.remarks;

    document.getElementById("updateHelp").textContent =
        `Editing ${record.vaccine} — ${record.dose}.`;

    displayRecords();
}


/* =========================================
   CLEAR RECORD SELECTION
========================================= */

function clearRecordSelection() {
    selectedRecordIndex = null;

    document.getElementById("remarks").value = "";
    document.getElementById("status").value = "Completed";

    document.getElementById("updateHelp").textContent =
        "Select a record from the table to edit it.";

    updateDoseOptions("update");

    if (selectedChild) {
        displayRecords();
    }
}


/* =========================================
   SAVE UPDATED VACCINATION RECORD
========================================= */

function saveRecord() {
    if (!selectedChild) {
        alert("Please select a child first.");
        return;
    }

    if (selectedRecordIndex === null) {
        alert("Please select a record from the table first.");
        return;
    }

    const vaccine = document.getElementById("vaccine").value;
    const dose = document.getElementById("dose").value;
    const status = document.getElementById("status").value;
    const remarks =
        document.getElementById("remarks").value.trim() || "-";

    if (!dose) {
        alert("Please select an available dose.");
        return;
    }

    const records = children[selectedChild].records;

    const duplicate = records.some((record, index) => {
        return (
            index !== selectedRecordIndex &&
            record.vaccine === vaccine &&
            record.dose === dose
        );
    });

    if (duplicate) {
        alert("This dose already has a record for this child.");
        return;
    }

    records[selectedRecordIndex] = {
        vaccine,
        dose,
        status,
        remarks
    };

    selectedRecordIndex = null;

    document.getElementById("remarks").value = "";

    document.getElementById("updateHelp").textContent =
        "Record updated. Select another record to edit it.";

    displayRecords();
    updateDoseOptions("update");
    updateDoseOptions("new");

    alert("Vaccination record updated successfully.");
}


/* =========================================
   EDIT CHILD DETAILS
========================================= */

function editChild() {
    if (!selectedChild) {
        alert("Please select a child first.");
        return;
    }

    const child = children[selectedChild];

    document.getElementById("editChildName").value = child.name;
    document.getElementById("editChildGender").value = child.gender;
    document.getElementById("editChildDOB").value = child.dob;
    document.getElementById("editChildIC").value = child.ic;
    document.getElementById("editChildAddress").value = child.address;

    document.getElementById("childDisplay").style.display = "none";
    document.getElementById("childEditForm").style.display = "block";
    document.getElementById("editChildButton").style.display = "none";
}


/* =========================================
   SAVE CHILD DETAILS
========================================= */

function saveChildDetails() {
    if (!selectedChild) {
        return;
    }

    const updatedChild = {
        name: document.getElementById("editChildName").value.trim(),
        gender: document.getElementById("editChildGender").value,
        dob: document.getElementById("editChildDOB").value,
        ic: document.getElementById("editChildIC").value.trim(),
        address: document.getElementById("editChildAddress").value.trim()
    };

    if (
        !updatedChild.name ||
        !updatedChild.dob ||
        !updatedChild.ic ||
        !updatedChild.address
    ) {
        alert("Please fill in all child details.");
        return;
    }

    Object.assign(children[selectedChild], updatedChild);

    document.getElementById("childName").textContent = updatedChild.name;
    document.getElementById("childGender").textContent = updatedChild.gender;
    document.getElementById("childDOB").textContent =
        formatDate(updatedChild.dob);
    document.getElementById("childIC").textContent = updatedChild.ic;
    document.getElementById("childAddress").textContent =
        updatedChild.address;

    cancelEditChild();

    displayChildren(document.getElementById("searchChild").value);

    alert("Child details updated successfully.");
}


/* =========================================
   CANCEL CHILD EDITING
========================================= */

function cancelEditChild() {
    document.getElementById("childEditForm").style.display = "none";
    document.getElementById("childDisplay").style.display = "block";
    document.getElementById("editChildButton").style.display = "inline-block";
}


/* =========================================
   DELETE VACCINATION RECORD
========================================= */

function deleteRecord(index) {
    const record = children[selectedChild]?.records[index];

    if (!record) {
        return;
    }

    const confirmed = confirm(
        `Are you sure you want to delete ${record.vaccine} — ${record.dose}?`
    );

    if (!confirmed) {
        return;
    }

    children[selectedChild].records.splice(index, 1);

    selectedRecordIndex = null;

    document.getElementById("remarks").value = "";

    document.getElementById("updateHelp").textContent =
        "Select a record from the table to edit it.";

    displayRecords();
    updateDoseOptions("update");
    updateDoseOptions("new");

    alert("Vaccination record deleted successfully.");
}


/* =========================================
   SHOW ADD RECORD FORM
========================================= */

function addRecord() {
    if (!selectedChild) {
        alert("Please select a child first.");
        return;
    }

    document.getElementById("addRecordForm").style.display = "block";
    document.getElementById("showAddRecordButton").style.display = "none";

    document.getElementById("newStatus").value = "Completed";
    document.getElementById("newRemarks").value = "";

    updateDoseOptions("new");
}


/* =========================================
   ADD NEW VACCINATION RECORD
========================================= */

function confirmAddRecord() {
    if (!selectedChild) {
        alert("Please select a child first.");
        return;
    }

    const vaccine = document.getElementById("newVaccine").value;
    const dose = document.getElementById("newDose").value;
    const status = document.getElementById("newStatus").value;
    const remarks =
        document.getElementById("newRemarks").value.trim() || "-";

    if (!dose) {
        alert("No available dose remains for this vaccine.");
        return;
    }

    const records = children[selectedChild].records;

    const duplicate = records.some(record => {
        return record.vaccine === vaccine && record.dose === dose;
    });

    if (duplicate) {
        updateDoseOptions("new");
        alert("This dose already has a record for this child.");
        return;
    }

    records.push({
        vaccine,
        dose,
        status,
        remarks
    });

    displayRecords();

    document.getElementById("newRemarks").value = "";
    document.getElementById("addRecordForm").style.display = "none";
    document.getElementById("showAddRecordButton").style.display = "inline-block";

    updateDoseOptions("new");
    updateDoseOptions("update");

    alert(`Vaccination record added for ${children[selectedChild].name}.`);
}


/* =========================================
   CANCEL ADDING RECORD
========================================= */

function cancelAddRecord() {
    document.getElementById("addRecordForm").style.display = "none";
    document.getElementById("showAddRecordButton").style.display = "inline-block";

    document.getElementById("newRemarks").value = "";

    updateDoseOptions("new");
}


/* =========================================
   PAGE INITIALISATION
========================================= */

document.addEventListener("DOMContentLoaded", function () {
    fillVaccineSelects();
    displayChildren();

    document.getElementById("childDetails").style.display = "none";
});