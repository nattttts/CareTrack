// PATIENT DATA
// Temporary mock data for UI prototype
// Later this data can be replaced with database data


const patients = [

    // ================= 1. Pregnant + No Children =================
    {
        id: 1,
        name: "Nurul Syazwani",
        ic: "960315-07-1234",
        dob: "15 March 1996",
        phone: "012-345 6789",
        email: "nurul.syazwani@example.com",
        address: "3-20-5, Elit Height, Jalan Mayang Pasir 5, 11950 Bayan Lepas, Pulau Pinang.",

        pregnant: true,

        children: [],

        history: [
            {
                date: "15 Sep 2026",
                type: "Maternal Follow-up",
                child:"-",
                status: "Completed"
            },
            {
                date: "29 Sep 2026",
                type: "Maternal Follow-up",
                child:"-",
                status: "Completed"
            },
            {
                date: "15 Oct 2026",
                type: "Maternal Follow-up",
                child:"-",
                status: "Upcoming"
            }
        ]
    },

    // ================= 2. Pregnant + Has Children =================
    {
        id: 2,
        name: "Siti Aminah",
        ic: "951007-07-0178",
        dob: "7 October 1995",
        phone: "013-456 7890",
        email: "siti.aminah@example.com",
        address: "123, Lorong Damar 2, Taman Mutiara, Jalan Besar 2, 11900 Bayan Lepas, Pulau Pinang.",

        pregnant: true,

        children: [
            {
                name: "Ammar",
                mykid: "240617-07-1429",
                dob: "17 June 2024",
                age: "2 years old",
                gender: "Male"
            }
        ],

        history: [
            {
                date: "24 August 2024",
                type: "Child Vaccination",
                child: "Ammar",
                status: "Completed"
            },
            {
                date: "14 October 2024",
                type: "Child Vaccination",
                child: "Ammar",
                status: "Completed"
            },
            {
                date: "14 Sep 2026",
                type: "Maternal Follow-up",
                child:"-",
                status: "Completed"
            },
            {
                date: "16 Oct 2026",
                type: "Maternal Follow-up",
                child:"-",
                status: "Upcoming"
            }
        ]
    },

    // ================= 3. Not Pregnant + Has Children =================
    {
        id: 3,
        name: "Aisyah Hamid",
        ic: "930210-07-3458",
        dob: "10 February 1993",
        phone: "016-789 0123",
        email: "aisyah.hamid@example.com",
        address: "8, Taman Maju 2, Jalan Tengah, 11900 Bayan Lepas, Pulau Pinang.",

        pregnant: false,

        children: [
            {
                name: "Zaleha",
                mykid: "251224-07-5678",
                dob: "24 December 2025",
                age: "1 year old",
                gender: "Female"
            }
        ],

        history: [
            {
                date: "25 May 2025",
                type: "Maternal Follow-up",
                child:"-",
                status: "Completed"
            },
             {
                date: "14 June 2025",
                type: "Maternal Follow-up",
                child:"-",
                status: "Completed"
            },
            {
                date: "18 Sep 2026",
                type: "Child Vaccination",
                child: "Zaleha",
                status: "Completed"
            },
            {
                date: "18 Oct 2026",
                type: "Child Vaccination",
                child: "Zaleha",
                status: "Upcoming"
            }
        ]
    }

];


// ================= ELEMENTS =================

const patientTableBody = document.getElementById("motherTableBody");

const patientSearch = document.getElementById("patientSearch");

const patientCount = document.getElementById("patientCount");

const noResults = document.getElementById("noResults");

const searchSection = document.getElementById("searchSection");

const patientListSection = document.getElementById("patientListSection");

const patientDetailsSection = document.getElementById("patientDetailsSection");

const noChildrenMessage = document.getElementById("noChildrenMessage");

const childrenTableContainer = document.getElementById("childrenTableContainer");

const childTableBody = document.getElementById("childTableBody");

const backToPatients = document.getElementById("backToPatients");


// ================= RENDER PATIENT LIST =================

function renderPatients(patientList) {

    patientTableBody.innerHTML = "";

    patientCount.textContent =
        `Showing ${patientList.length} ${
            patientList.length === 1 ? "patient" : "patients"
        }`;

    // No results
    if (patientList.length === 0) {

        noResults.hidden = false;

        return;
    }

    noResults.hidden = true;

    // Render patients
    patientList.forEach(patient => {

        const row = document.createElement("tr");

        // Pregnancy
        let pregnancyHTML;

        if (patient.pregnant) {

            pregnancyHTML = `
                <p class="pregnancy-status pregnant">
                    Pregnant
                </p>
            `;

        } else {

            pregnancyHTML = `
                <p class="pregnancy-status not-pregnant">
                    Not Pregnant
                </p>
            `;
        }

        // Children Count
        const childrenCount = patient.children.length;

        const childrenHTML = `
            <p class="children-count">
                ${childrenCount}
            </p>
        `;

        // Row
        row.innerHTML = `

            <td>
                <p class="mother-name">${patient.name}</p>
            </td>

            <td>
                <p>${patient.ic}</p>
            </td>

            <td>
                <p>${patient.phone}</p>
            </td>

            <td class="pregnancy-column">
                ${pregnancyHTML}
            </td>

            <td>
                ${childrenHTML}
            </td>

            <td class="actions-column">

                <button
                    type="button"
                    class="view-button"
                    data-patient-id="${patient.id}"
                >
                    View Profile
                </button>

            </td>
        `;

        patientTableBody.appendChild(row);

    });

    // View Profile buttons
    document.querySelectorAll(".view-button")
        .forEach(button => {

            button.addEventListener("click", function () {

                const patientId = Number(this.dataset.patientId);

                showPatientDetails(patientId);

            });

        });

}


// ================= SEARCH PATIENTS =================

function searchPatients() {

    const keyword = patientSearch.value.trim().toLowerCase();

    // Empty search
    if (keyword === "") {
        renderPatients(patients);
        return;
    }

    // Search patient + child
    const filteredPatients =
        patients.filter(patient => {

            const patientMatch =

                patient.name
                    .toLowerCase()
                    .includes(keyword)

                ||

                patient.ic
                    .toLowerCase()
                    .includes(keyword)

                ||

                patient.phone
                    .toLowerCase()
                    .includes(keyword);


            const childMatch =
                patient.children.some(child =>
                    child.name.toLowerCase().includes(keyword)
                );

            return patientMatch || childMatch;

        });

    renderPatients(filteredPatients);

}


// ================= SHOW PATIENT DETAILS =================

function showPatientDetails(patientId) {

    const patient =
        patients.find(patient =>
            patient.id === patientId
        );


    if (!patient) {
        return;
    }


    // Basic Patient Information
    document.getElementById("detailPatientName").textContent = patient.name;

    document.getElementById("detailName").textContent = patient.name;

    document.getElementById("detailIC").textContent = patient.ic;

    document.getElementById("detailDOB").textContent = patient.dob;

    document.getElementById("detailPhone").textContent = patient.phone;

    document.getElementById("detailEmail").textContent = patient.email;

    document.getElementById("detailAddress").textContent = patient.address;

    document.getElementById("detailPatientType").textContent = "Mother";


    // Pregnancy Badge
    const pregnancyBadge =
        document.getElementById("detailPregnancyBadge");

    if (patient.pregnant) {

        pregnancyBadge.innerHTML = `
            <p class="detail-pregnancy-badge pregnant">Pregnant</p>
        `;

    } else {

        pregnancyBadge.innerHTML = `
            <p class="detail-pregnancy-badge not-pregnant">Not Pregnant</p>
        `;
    }

    // Healthcare History
    renderHealthcareHistory(patient.history);

    // Registered Children
    renderChildren(patient.children);
  
    // Switch to Details Page
    searchSection.hidden = true;
    patientListSection.hidden = true;
    patientDetailsSection.hidden = false;

    // Scroll to top
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


// ================= RENDER HEALTHCARE HISTORY =================

function renderHealthcareHistory(history) {

    const historyTableBody = document.getElementById("historyTableBody");
 
    historyTableBody.innerHTML = "";

    // No history
    if (history.length === 0) {

        historyTableBody.innerHTML = `
            <tr>
                <td colspan="4">
                    No healthcare history available.
                </td>
            </tr>
        `;

        return;
    }

    history.forEach(record => {

        const row = document.createElement("tr");

        let statusClass = "completed";

        if (record.status === "Upcoming") {
            statusClass = "upcoming";
        }

        row.innerHTML = `

            <td>
                <p>${record.date}</p>
            </td>

            <td>
                <p>${record.type}</p>
            </td>

            <td>
                <p>${record.child}</p>
            </td>

            <td>
                <p class="status-badge ${statusClass}">${record.status}</p>
            </td>

        `;

        historyTableBody.appendChild(row);

    });

}


// ================= RENDER REGISTERED CHILDREN =================

function renderChildren(children) {

    childTableBody.innerHTML = "";

    // No Children
    if (children.length === 0) {
        noChildrenMessage.style.display = "block";
        childrenTableContainer.style.display = "none";
        return;
    }

    noChildrenMessage.style.display = "none";
    childrenTableContainer.style.display = "block";

    // Has Children
    children.forEach(child => {

        const row = document.createElement("tr");

        row.innerHTML = `

            <td>
                <p class="child-name">${child.name}</p>
            </td>

            <td>
                <p>${child.mykid}</p>
            </td>

            <td>
                <p>${child.dob}</p>
            </td>

            <td>
                <p>${child.age}</p>
            </td>

            <td>
                <p>${child.gender}</p>
            </td>

        `;

        childTableBody.appendChild(row);

    });

}


// ================= BACK TO PATIENT LIST =================

backToPatients.addEventListener("click", function () {

    patientDetailsSection.hidden = true;

    searchSection.hidden = false;

    patientListSection.hidden = false;

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

});


// ================= SEARCH EVENT =================

patientSearch.addEventListener("input", searchPatients);


// ================= INITIAL LOAD =================

renderPatients(patients);