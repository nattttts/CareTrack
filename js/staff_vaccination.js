let selectedRow = null;

document.addEventListener("DOMContentLoaded", function () {

    setupActionColumn();

});

/* =========================================================
   ADD ACTIONS COLUMN TO EXISTING TABLE
   ========================================================= */

function setupActionColumn() {

    const table =
        document.getElementById("vaccinationTable");

    if (!table) {
        return;
    }


    const headerRow =
        table.querySelector("thead tr");

    const bodyRows =
        table.querySelectorAll("tbody tr");


    /* Add Actions heading */

    if (
        headerRow &&
        !headerRow.querySelector(".actions-heading")
    ) {

        const actionHeader =
            document.createElement("th");

        actionHeader.textContent = "Actions";

        actionHeader.className =
            "actions-heading";

        headerRow.appendChild(actionHeader);
    }


    /* Add buttons to every existing row */

    bodyRows.forEach(function (row) {

        addActionButtons(row);

    });

}


/* =========================================================
   ADD EDIT + DELETE BUTTONS TO A ROW
   ========================================================= */

function addActionButtons(row) {

    if (
        row.querySelector(".action-buttons")
    ) {
        return;
    }


    const actionCell =
        document.createElement("td");

    actionCell.className =
        "action-buttons";


    /* EDIT BUTTON */

    const editButton =
        document.createElement("button");

    editButton.type = "button";

    editButton.className =
        "edit-record-button";

    editButton.innerHTML = "✏️";

    editButton.title =
        "Edit Record";


    editButton.onclick =
        function (event) {

            editRecord(event, this);

        };


    /* DELETE BUTTON */

    const deleteButton =
        document.createElement("button");

    deleteButton.type = "button";

    deleteButton.className =
        "delete-record-button";

    deleteButton.innerHTML = "🗑️";

    deleteButton.title =
        "Delete Record";


    deleteButton.onclick =
        function (event) {

            deleteRecord(event, this);

        };


    actionCell.appendChild(editButton);

    actionCell.appendChild(deleteButton);


    row.appendChild(actionCell);


    /* Make row clickable */

    row.onclick = function () {

        loadRecord(this);

    };

}

/* =========================================================
   EDIT CHILD DETAILS
   ========================================================= */

function editChild() {

    const nameElement =
        document.getElementById("childName");

    const icElement =
        document.getElementById("childIC");

    const addressElement =
        document.getElementById("childAddress");


    if (
        !nameElement ||
        !icElement ||
        !addressElement
    ) {

        alert(
            "Child information could not be found."
        );

        return;
    }


    const currentName =
        nameElement.textContent.trim();

    const currentIC =
        icElement.textContent.trim();

    const currentAddress =
        addressElement.textContent.trim();


    /* CHILD NAME */

    const newName =
        prompt(
            "Enter child's name:",
            currentName
        );


    if (newName === null) {
        return;
    }


    if (newName.trim() === "") {

        alert(
            "Child name cannot be empty."
        );

        return;
    }


    /* IC NUMBER */

    const newIC =
        prompt(
            "Enter child's IC number:",
            currentIC
        );


    if (newIC === null) {
        return;
    }


    if (newIC.trim() === "") {

        alert(
            "IC number cannot be empty."
        );

        return;
    }


    /* ADDRESS */

    const newAddress =
        prompt(
            "Enter child's address:",
            currentAddress
        );


    if (newAddress === null) {
        return;
    }


    if (newAddress.trim() === "") {

        alert(
            "Address cannot be empty."
        );

        return;
    }


    /* UPDATE PAGE */

    nameElement.textContent =
        newName.trim();

    icElement.textContent =
        newIC.trim();

    addressElement.textContent =
        newAddress.trim();


    alert(
        "Child details updated successfully!"
    );

}

/* =========================================================
   LOAD VACCINATION RECORD
   ========================================================= */

function loadRecord(row) {

    if (!row) {
        return;
    }


    selectedRow = row;


    const cells =
        row.cells;


    /* DATE */

    const date =
        cells[0].textContent.trim();


    /* VACCINE */

    const vaccine =
        cells[1].textContent.trim();


    /* STATUS */

    const status =
        cells[3].textContent.trim();


    /* REMARKS */

    const remarks =
        cells[5].textContent.trim();


    const vaccineInput =
        document.getElementById("vaccine");

    const dateInput =
        document.getElementById("date");

    const statusInput =
        document.getElementById("status");

    const remarksInput =
        document.getElementById("remarks");


    /* Put vaccine into form */

    if (vaccineInput) {

        vaccineInput.value =
            vaccine;

    }


    /* Put status into form */

    if (statusInput) {

        statusInput.value =
            status;

    }


    /* Put remarks into form */

    if (remarksInput) {

        remarksInput.value =
            remarks === "-"
                ? ""
                : remarks;

    }


    /* Convert table date to input date */

    if (dateInput) {

        const convertedDate =
            convertToInputDate(date);


        if (convertedDate !== "") {

            dateInput.value =
                convertedDate;

        }

    }


    /* Highlight selected row */

    document
        .querySelectorAll(
            "#vaccinationTable tbody tr"
        )
        .forEach(function (item) {

            item.classList.remove(
                "selected-row"
            );

        });


    row.classList.add(
        "selected-row"
    );

}


/* =========================================================
   CONVERT DATE
   ========================================================= */

function convertToInputDate(dateText) {

    if (!dateText) {
        return "";
    }


    const date =
        new Date(dateText);


    if (isNaN(date.getTime())) {

        return "";

    }


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");


    const day =
        String(
            date.getDate()
        ).padStart(2, "0");


    return (
        year +
        "-" +
        month +
        "-" +
        day
    );

}


/* =========================================================
   FORMAT DATE
   ========================================================= */

function formatDate(dateValue) {

    if (!dateValue) {
        return "-";
    }


    const date =
        new Date(
            dateValue + "T00:00:00"
        );


    if (isNaN(date.getTime())) {

        return dateValue;

    }


    return date.toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


/* =========================================================
   SAVE / UPDATE VACCINATION RECORD
   ========================================================= */

function saveRecord() {

    /* Check whether a row was selected */

    if (!selectedRow) {

        alert(
            "Please click a vaccination record first."
        );

        return;
    }


    const vaccineInput =
        document.getElementById("vaccine");

    const dateInput =
        document.getElementById("date");

    const statusInput =
        document.getElementById("status");

    const remarksInput =
        document.getElementById("remarks");


    if (
        !vaccineInput ||
        !dateInput ||
        !statusInput ||
        !remarksInput
    ) {

        alert(
            "Vaccination form could not be found."
        );

        return;
    }


    const vaccine =
        vaccineInput.value.trim();

    const date =
        dateInput.value;

    const status =
        statusInput.value;

    const remarks =
        remarksInput.value.trim();


    /* Validation */

    if (vaccine === "") {

        alert(
            "Please select a vaccine."
        );

        return;
    }


    if (date === "") {

        alert(
            "Please select the vaccination date."
        );

        return;
    }


    if (status === "") {

        alert(
            "Please select a status."
        );

        return;
    }


    /* UPDATE DATE */

    selectedRow.cells[0].textContent =
        formatDate(date);

    /* UPDATE VACCINE */

    selectedRow.cells[1].textContent =
        vaccine;

    /* UPDATE STATUS */

    selectedRow.cells[3].innerHTML =

        createStatusHTML(status);

    /* UPDATE REMARKS */

    selectedRow.cells[5].textContent =
        remarks === ""
            ? "-"
            : remarks;


    /* Highlight row */

    selectedRow.classList.add(
        "selected-row"
    );


    alert(
        "Vaccination record updated successfully!"
    );

}


/* =========================================================
   CREATE STATUS HTML
   ========================================================= */

function createStatusHTML(status) {

    let className =
        status.toLowerCase();


    return `
        <span class="status ${className}">
            ${status}
        </span>
    `;

}


/* =========================================================
   EDIT RECORD BUTTON
   ========================================================= */

function editRecord(event, button) {

    /* Prevent row onclick */

    event.stopPropagation();


    const row =
        button.closest("tr");


    if (!row) {
        return;
    }


    /* Load record into form */

    loadRecord(row);


    /* Scroll to update form */

    const updateCard =
        document.querySelector(
            ".update-card"
        );


    if (updateCard) {

        updateCard.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

    }

}


/* =========================================================
   DELETE RECORD
   ========================================================= */

function deleteRecord(event, button) {

    /* Prevent row onclick */

    event.stopPropagation();


    const row =
        button.closest("tr");


    if (!row) {
        return;
    }


    const vaccine =
        row.cells[1]
            .textContent
            .trim();


    const date =
        row.cells[0]
            .textContent
            .trim();


    const confirmed =
        confirm(
            "Are you sure you want to delete this vaccination record?\n\n" +
            "Vaccine: " +
            vaccine +
            "\nDate: " +
            date
        );


    if (!confirmed) {

        return;

    }


    /* Delete row */

    row.remove();


    /* Clear selected row */

    if (selectedRow === row) {

        selectedRow = null;

        clearForm();

    }


    alert(
        "Vaccination record deleted successfully!"
    );

}


/* =========================================================
   ADD NEW VACCINATION RECORD
   ========================================================= */

function addRecord() {

    /* Get vaccine */

    const vaccine =
        prompt(
            "Enter vaccine name:",
            "MMR"
        );


    if (
        vaccine === null ||
        vaccine.trim() === ""
    ) {

        return;

    }


    /* Get dose */

    const dose =
        prompt(
            "Enter dose:",
            "Dose 1"
        );


    if (
        dose === null ||
        dose.trim() === ""
    ) {

        return;

    }


    /* Get date */

    const date =
        prompt(
            "Enter vaccination date:",
            "15 Oct 2026"
        );


    if (
        date === null ||
        date.trim() === ""
    ) {

        return;

    }


    /* Get status */

    const status =
        prompt(
            "Enter status:\n\n" +
            "Completed\n" +
            "Upcoming\n" +
            "Overdue",
            "Upcoming"
        );


    if (
        status === null ||
        status.trim() === ""
    ) {

        return;

    }


    /* Validate status */

    const validStatuses = [
        "Completed",
        "Upcoming",
        "Overdue"
    ];


    let finalStatus =
        status.trim();


    const matchingStatus =
        validStatuses.find(
            function (item) {

                return (
                    item.toLowerCase() ===
                    finalStatus.toLowerCase()
                );

            }
        );


    if (!matchingStatus) {

        alert(
            "Please enter only:\n" +
            "Completed, Upcoming, or Overdue"
        );

        return;

    }


    finalStatus =
        matchingStatus;


    /* Get next due date */

    const nextDueDate =
        prompt(
            "Enter next due date (optional):",
            ""
        );


    /* Get remarks */

    const remarks =
        prompt(
            "Enter remarks (optional):",
            ""
        );


    /* Get table */

    const table =
        document.getElementById(
            "vaccinationTable"
        );


    if (!table) {

        alert(
            "Vaccination table could not be found."
        );

        return;

    }


    const tbody =
        table.querySelector("tbody");


    if (!tbody) {

        alert(
            "Vaccination table body could not be found."
        );

        return;

    }


    /* Create new row */

    const newRow =
        document.createElement("tr");


    newRow.innerHTML = `

        <td>
            ${escapeHTML(date.trim())}
        </td>

        <td>
            ${escapeHTML(vaccine.trim())}
        </td>

        <td>
            ${escapeHTML(dose.trim())}
        </td>

        <td>
            ${createStatusHTML(finalStatus)}
        </td>

        <td>
            ${
                nextDueDate &&
                nextDueDate.trim() !== ""
                    ? escapeHTML(
                        nextDueDate.trim()
                    )
                    : "-"
            }
        </td>

        <td>
            ${
                remarks &&
                remarks.trim() !== ""
                    ? escapeHTML(
                        remarks.trim()
                    )
                    : "-"
            }
        </td>

    `;


    /* Add row to table */

    tbody.appendChild(newRow);


    /* Add Edit + Delete */

    addActionButtons(newRow);


    alert(
        "New vaccination record added successfully!"
    );

}


/* =========================================================
   SEARCH CHILD
   ========================================================= */

function searchChild() {

    const searchInput =
        document.getElementById(
            "searchChild"
        );


    if (!searchInput) {

        return;

    }


    const searchValue =
        searchInput.value
            .trim()
            .toLowerCase();


    const childName =
        document.getElementById(
            "childName"
        );


    const childIC =
        document.getElementById(
            "childIC"
        );


    if (
        !childName ||
        !childIC
    ) {

        return;

    }


    const name =
        childName.textContent
            .trim()
            .toLowerCase();


    const ic =
        childIC.textContent
            .trim()
            .toLowerCase();


    if (searchValue === "") {

        alert(
            "Please enter a child's name or IC number."
        );

        return;

    }


    if (
        name.includes(searchValue) ||
        ic.includes(searchValue)
    ) {

        alert(
            "Child found: " +
            childName.textContent.trim()
        );


        /* Scroll to child information */

        const childCard =
            document.querySelector(
                ".child-card"
            );


        if (childCard) {

            childCard.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

        }

    } else {

        alert(
            "No child found."
        );

    }

}


/* =========================================================
   CLEAR FORM
   ========================================================= */

function clearForm() {

    const vaccine =
        document.getElementById(
            "vaccine"
        );

    const date =
        document.getElementById(
            "date"
        );

    const status =
        document.getElementById(
            "status"
        );

    const remarks =
        document.getElementById(
            "remarks"
        );


    if (vaccine) {

        vaccine.selectedIndex = 0;

    }


    if (date) {

        date.value = "";

    }


    if (status) {

        status.value =
            "Completed";

    }


    if (remarks) {

        remarks.value = "";

    }


    document
        .querySelectorAll(
            "#vaccinationTable tbody tr"
        )
        .forEach(function (row) {

            row.classList.remove(
                "selected-row"
            );

        });

}


/* =========================================================
   PREVENT HTML INJECTION
   ========================================================= */

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text;

    return div.innerHTML;

}