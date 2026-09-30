const children = {
    emma: {
        name: "Emma Tan",
        gender: "Female",
        age: "3 years old",
        dob: "12 Jan 2022",
        ic: "220112-14-5678",
        nextVaccine: "DTP - IPV - Hib (Booster)",
        nextDate: "15 Oct 2026"
    },

    daniel: {
        name: "Daniel Tan",
        gender: "Male",
        age: "2 years old",
        dob: "08 Jun 2023",
        ic: "230608-14-6789",
        nextVaccine: "MMR",
        nextDate: "20 Nov 2026"
    }
};


/* =========================
   CHANGE CHILD
========================= */

function changeChild() {

    const select = document.getElementById("childSelect");

    const selectedChild = select.value;

    const child = children[selectedChild];

    if (!child) {
        return;
    }

    document.getElementById("childName").textContent = child.name;

    document.getElementById("childGender").textContent = child.gender;

    document.getElementById("childAge").textContent = child.age;

    document.getElementById("childDOB").textContent = child.dob;

    document.getElementById("childIC").textContent = child.ic;

    document.getElementById("nextVaccine").textContent =
        child.nextVaccine;

    document.getElementById("nextDate").textContent =
        child.nextDate;

    // Reset filter
    document.getElementById("statusFilter").value = "all";

    filterRecords();
}


/* =========================
   FILTER RECORDS
========================= */

function filterRecords() {

    const filter =
        document.getElementById("statusFilter").value;

    const rows =
        document.querySelectorAll("#vaccinationTable tbody tr");

    rows.forEach(function(row) {

        const status = row.getAttribute("data-status");

        if (filter === "all") {

            row.style.display = "";

        } else if (status === filter) {

            row.style.display = "";

        } else {

            row.style.display = "none";

        }

    });
}


/* =========================
   VIEW APPOINTMENT
========================= */

function viewAppointment() {

    const select =
        document.getElementById("childSelect");

    const child =
        children[select.value];

    if (!child) {
        return;
    }

    alert(
        "Next Vaccination Appointment\n\n" +
        "Child: " + child.name + "\n" +
        "Vaccine: " + child.nextVaccine + "\n" +
        "Due Date: " + child.nextDate
    );
}


/* =========================
   PAGE LOAD
========================= */

document.addEventListener("DOMContentLoaded", function () {

    // Show ALL records when page opens
    document.getElementById("statusFilter").value = "all";

    filterRecords();

});