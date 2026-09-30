const children = {

    emma: {

        name: "Emma Tan",

        gender: "Female",

        age: "3 years old",

        dob: "12 Jan 2022",

        ic: "220112-14-5678",

        address: "12, CareTrack Street, Penang",

        records: [

            {
                date: "12 Mar 2022",
                vaccine: "BCG",
                dose: "Dose 1",
                status: "Completed",
                nextDue: "-",
                remarks: "-"
            },

            {
                date: "16 Apr 2022",
                vaccine: "Hepatitis B",
                dose: "Dose 1",
                status: "Completed",
                nextDue: "-",
                remarks: "-"
            },

            {
                date: "14 May 2022",
                vaccine: "DTP - IPV - Hib",
                dose: "Dose 1",
                status: "Completed",
                nextDue: "-",
                remarks: "-"
            },

            {
                date: "11 Jun 2022",
                vaccine: "DTP - IPV - Hib",
                dose: "Dose 2",
                status: "Completed",
                nextDue: "-",
                remarks: "-"
            },

            {
                date: "09 Jul 2022",
                vaccine: "DTP - IPV - Hib",
                dose: "Dose 3",
                status: "Completed",
                nextDue: "-",
                remarks: "-"
            },

            {
                date: "15 Oct 2025",
                vaccine: "DTP - IPV - Hib (Booster)",
                dose: "Dose 4",
                status: "Upcoming",
                nextDue: "15 Oct 2026",
                remarks: "-"
            },

            {
                date: "15 Oct 2025",
                vaccine: "MMR",
                dose: "Dose 1",
                status: "Upcoming",
                nextDue: "15 Oct 2026",
                remarks: "-"
            },

            {
                date: "15 Oct 2025",
                vaccine: "Varicella",
                dose: "Dose 1",
                status: "Upcoming",
                nextDue: "15 Oct 2026",
                remarks: "-"
            }

        ]

    },

    daniel: {

        name: "Daniel Tan",

        gender: "Male",

        age: "2 years old",

        dob: "08 Jun 2023",

        ic: "230608-14-6789",

        address: "25, CareTrack Street, Penang",

        records: [

            {
                date: "08 Jun 2023",
                vaccine: "BCG",
                dose: "Dose 1",
                status: "Completed",
                nextDue: "-",
                remarks: "-"
            },

            {
                date: "08 Jul 2023",
                vaccine: "Hepatitis B",
                dose: "Dose 1",
                status: "Completed",
                nextDue: "-",
                remarks: "-"
            },

            {
                date: "08 Aug 2023",
                vaccine: "DTP - IPV - Hib",
                dose: "Dose 1",
                status: "Completed",
                nextDue: "-",
                remarks: "-"
            },

            {
                date: "08 Sep 2023",
                vaccine: "DTP - IPV - Hib",
                dose: "Dose 2",
                status: "Completed",
                nextDue: "-",
                remarks: "-"
            },

            {
                date: "08 Oct 2023",
                vaccine: "DTP - IPV - Hib",
                dose: "Dose 3",
                status: "Completed",
                nextDue: "-",
                remarks: "-"
            },

            {
                date: "20 Nov 2026",
                vaccine: "MMR",
                dose: "Dose 1",
                status: "Upcoming",
                nextDue: "20 Nov 2026",
                remarks: "-"
            }

        ]

    }

};

let selectedChild = null;

// =====================================================
// DISPLAY ALL CHILDREN
// =====================================================

function displayChildren() {

    const childrenList = document.getElementById("childrenList");

    childrenList.innerHTML = "";


    Object.keys(children).forEach(function(key) {

        const child = children[key];


        const childItem = document.createElement("div");

        childItem.className = "child-list-item";


        childItem.innerHTML = `

            <div class="child-list-left">

                <div class="child-list-avatar">

                    <img
                        src="../icons/user.png"
                        alt="Child"
                    >

                </div>


                <div class="child-list-information">

                    <h3>
                        ${child.name}
                    </h3>

                    <p>
                        ${child.gender}
                        &nbsp; • &nbsp;
                        ${child.age}
                    </p>

                    <span>
                        IC No: ${child.ic}
                    </span>

                </div>

            </div>


            <button
                class="view-child-button"
                onclick="viewChild('${key}')"
            >
                View Child
            </button>

        `;


        childrenList.appendChild(childItem);

    });

}

// =====================================================
// SEARCH CHILD
// =====================================================

function searchChild() {

    const searchInput =
        document.getElementById("searchChild");

    const searchValue =
        searchInput.value.trim().toLowerCase();


    const childrenList =
        document.getElementById("childrenList");

    const noChildrenMessage =
        document.getElementById("noChildrenMessage");


    childrenList.innerHTML = "";


    let found = false;


    Object.keys(children).forEach(function(key) {

        const child = children[key];


        const name =
            child.name.toLowerCase();

        const ic =
            child.ic.toLowerCase();


        if (
            name.includes(searchValue) ||
            ic.includes(searchValue)
        ) {

            found = true;


            const childItem =
                document.createElement("div");


            childItem.className =
                "child-list-item";


            childItem.innerHTML = `

                <div class="child-list-left">

                    <div class="child-list-avatar">

                        <img
                            src="../icons/user.png"
                            alt="Child"
                        >

                    </div>


                    <div class="child-list-information">

                        <h3>
                            ${child.name}
                        </h3>

                        <p>
                            ${child.gender}
                            &nbsp; • &nbsp;
                            ${child.age}
                        </p>

                        <span>
                            IC No: ${child.ic}
                        </span>

                    </div>

                </div>


                <button
                    class="view-child-button"
                    onclick="viewChild('${key}')"
                >
                    View Child
                </button>

            `;


            childrenList.appendChild(childItem);

        }

    });


    if (found) {

        noChildrenMessage.style.display = "none";

    } else {

        noChildrenMessage.style.display = "block";

    }

}

// =====================================================
// VIEW SELECTED CHILD
// =====================================================

function viewChild(childKey) {

    const child = children[childKey];


    if (!child) {
        return;
    }

    selectedChild = childKey;

    // ---------------------------------------------
    // Display child information
    // ---------------------------------------------

    document.getElementById("childName").textContent =
        child.name;


    document.getElementById("childGender").textContent =
        child.gender;


    document.getElementById("childAge").textContent =
        child.age;


    document.getElementById("childDOB").textContent =
        child.dob;


    document.getElementById("childIC").textContent =
        child.ic;


    document.getElementById("childAddress").textContent =
        child.address;

    // ---------------------------------------------
    // Display vaccination records
    // ---------------------------------------------

    displayRecords(child.records);

    // ---------------------------------------------
    // Show child details
    // ---------------------------------------------

    document.getElementById("childDetails").style.display =
        "block";

    // ---------------------------------------------
    // Scroll to selected child
    // ---------------------------------------------

    document.getElementById("childDetails").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}

// =====================================================
// DISPLAY VACCINATION RECORDS
// =====================================================

function displayRecords(records) {

    const tableBody =
        document.getElementById("vaccinationTableBody");


    tableBody.innerHTML = "";


    records.forEach(function(record, index) {

        const row =
            document.createElement("tr");


        row.onclick = function() {

            loadRecord(row);

        };


        let statusClass = "";


        if (record.status === "Completed") {

            statusClass = "completed";

        } else if (record.status === "Upcoming") {

            statusClass = "upcoming";

        } else if (record.status === "Overdue") {

            statusClass = "overdue";

        }


        row.innerHTML = `

            <td>
                ${record.date}
            </td>


            <td>
                ${record.vaccine}
            </td>


            <td>
                ${record.dose}
            </td>


            <td>

                <span class="status ${statusClass}">

                    ${record.status}

                </span>

            </td>


            <td>
                ${record.nextDue}
            </td>


            <td>
                ${record.remarks}
            </td>


            <td class="action-buttons">

                <button
                    class="edit-record-button"
                    onclick="editRecord(event, this)"
                    title="Edit Record"
                >
                    ✏️
                </button>


                <button
                    class="delete-record-button"
                    onclick="deleteRecord(event, this)"
                    title="Delete Record"
                >
                    🗑️
                </button>

            </td>

        `;


        tableBody.appendChild(row);

    });

}

// =====================================================
// LOAD RECORD INTO UPDATE FORM
// =====================================================

function loadRecord(row) {

    const cells = row.querySelectorAll("td");


    if (cells.length < 6) {
        return;
    }


    const vaccine =
        cells[1].textContent.trim();

    const date =
        cells[0].textContent.trim();

    const status =
        cells[3].textContent.trim();

    const remarks =
        cells[5].textContent.trim();


    document.getElementById("vaccine").value =
        vaccine;


    document.getElementById("status").value =
        status;


    document.getElementById("remarks").value =
        remarks === "-" ? "" : remarks;


    // Convert date to YYYY-MM-DD
    const dateParts = date.split(" ");


    if (dateParts.length === 3) {

        const day = dateParts[0];

        const monthName = dateParts[1];

        const year = dateParts[2];


        const months = {

            Jan: "01",
            Feb: "02",
            Mar: "03",
            Apr: "04",
            May: "05",
            Jun: "06",
            Jul: "07",
            Aug: "08",
            Sep: "09",
            Oct: "10",
            Nov: "11",
            Dec: "12"

        };


        const month =
            months[monthName];


        if (month) {

            document.getElementById("date").value =
                year + "-" + month + "-" + day.padStart(2, "0");

        }

    }

}

// =====================================================
// EDIT CHILD
// =====================================================

function editChild() {

    if (!selectedChild) {

        alert("Please select a child first.");

        return;

    }
    const child = children[selectedChild];

    document.getElementById("editChildName").value =
        child.name;

    document.getElementById("editChildGender").value =
        child.gender;

    document.getElementById("editChildAge").value =
        child.age;

    document.getElementById("editChildDOB").value =
        child.dob;

    document.getElementById("editChildIC").value =
        child.ic;

    document.getElementById("editChildAddress").value =
        child.address;

    document.getElementById("childDisplay").style.display =
        "none";

    document.getElementById("childEditForm").style.display =
        "block";

    document.getElementById("editChildButton").style.display =
        "none";

}

function saveChildDetails() {

    if (!selectedChild) {
        return;
    }

    const child = children[selectedChild];

    const newName =
        document.getElementById("editChildName").value.trim();

    const newGender =
        document.getElementById("editChildGender").value;

    const newAge =
        document.getElementById("editChildAge").value.trim();

    const newDOB =
        document.getElementById("editChildDOB").value.trim();

    const newIC =
        document.getElementById("editChildIC").value.trim();

    const newAddress =
        document.getElementById("editChildAddress").value.trim();

    if (
        !newName ||
        !newAge ||
        !newDOB ||
        !newIC ||
        !newAddress
    ) {

        alert("Please fill in all child details.");

        return;

    }

    child.name = newName;

    child.gender = newGender;

    child.age = newAge;

    child.dob = newDOB;

    child.ic = newIC;

    child.address = newAddress;

    document.getElementById("childName").textContent =
        child.name;

    document.getElementById("childGender").textContent =
        child.gender;

    document.getElementById("childAge").textContent =
        child.age;

    document.getElementById("childDOB").textContent =
        child.dob;

    document.getElementById("childIC").textContent =
        child.ic;

    document.getElementById("childAddress").textContent =
        child.address;

    document.getElementById("childEditForm").style.display =
        "none";

    document.getElementById("childDisplay").style.display =
        "block";

    document.getElementById("editChildButton").style.display =
        "block";

    searchChild();


    alert("Child details updated successfully.");

}

// =====================================================
// EDIT RECORD
// =====================================================

function editRecord(event, button) {

    event.stopPropagation();


    const row =
        button.closest("tr");


    loadRecord(row);


    alert(
        "The vaccination record has been loaded into the update form."
    );

}

// =====================================================
// DELETE RECORD
// =====================================================

function deleteRecord(event, button) {

    event.stopPropagation();


    const row =
        button.closest("tr");


    const vaccine =
        row.cells[1].textContent.trim();


    const confirmDelete =
        confirm(
            "Are you sure you want to delete the " +
            vaccine +
            " vaccination record?"
        );


    if (confirmDelete) {

        row.remove();

    }

}

// =====================================================
// SAVE RECORD
// =====================================================

function saveRecord() {

    if (!selectedChild) {

        alert("Please select a child first.");

        return;

    }


    const vaccine =
        document.getElementById("vaccine").value;

    const date =
        document.getElementById("date").value;

    const status =
        document.getElementById("status").value;

    const remarks =
        document.getElementById("remarks").value;


    if (!date) {

        alert("Please select a date.");

        return;

    }


    alert(
        "Vaccination record saved successfully.\n\n" +
        "Child: " + children[selectedChild].name + "\n" +
        "Vaccine: " + vaccine + "\n" +
        "Status: " + status
    );

}

function cancelEditChild() {

    document.getElementById("childEditForm").style.display =
        "none";


    document.getElementById("childDisplay").style.display =
        "block";


    document.getElementById("editChildButton").style.display =
        "block";

}

// =====================================================
// ADD NEW RECORD
// =====================================================

function addRecord() {

    if (!selectedChild) {

        alert("Please select a child first.");

        return;

    }

    document.getElementById("addRecordForm").style.display =
        "block";

    document.getElementById("showAddRecordButton").style.display =
        "none";

}

function confirmAddRecord() {

    if (!selectedChild) {

        alert("Please select a child first.");

        return;

    }

    const child = children[selectedChild];

    const vaccine =
        document.getElementById("newVaccine").value;

    const dose =
        document.getElementById("newDose").value.trim();

    const date =
        document.getElementById("newDate").value;

    const status =
        document.getElementById("newStatus").value;

    const nextDue =
        document.getElementById("newDueDate").value;

    const remarks =
        document.getElementById("newRemarks").value.trim();


    if (!dose || !date) {

        alert(
            "Please enter the dose and date administered."
        );

        return;

    }

    const formattedDate =
        formatDate(date);


    let formattedNextDue = "-";


    if (nextDue) {

        formattedNextDue =
            formatDate(nextDue);

    }

    const newRecord = {

        date: formattedDate,

        vaccine: vaccine,

        dose: dose,

        status: status,

        nextDue: formattedNextDue,

        remarks: remarks || "-"

    };

    child.records.push(newRecord);

    displayRecords(child.records);

    document.getElementById("newDose").value = "";

    document.getElementById("newDate").value = "";

    document.getElementById("newDueDate").value = "";

    document.getElementById("newRemarks").value = "";

    document.getElementById("addRecordForm").style.display =
        "none";

    document.getElementById("showAddRecordButton").style.display =
        "inline-block";


    alert(
        "Vaccination record added successfully for " +
        child.name + "."
    );

}

function formatDate(dateString) {

    const parts =
        dateString.split("-");


    if (parts.length !== 3) {
        return dateString;
    }

    const year = parts[0];

    const month = parts[1];

    const day = parts[2];

    const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
    ];

    return (
        day +
        " " +
        months[parseInt(month, 10) - 1] +
        " " +
        year
    );

}

function cancelAddRecord() {

    document.getElementById("addRecordForm").style.display =
        "none";


    document.getElementById("showAddRecordButton").style.display =
        "inline-block";

}

// =====================================================
// PAGE LOAD
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        displayChildren();

        document.getElementById("childDetails").style.display =
            "none";

    }
);