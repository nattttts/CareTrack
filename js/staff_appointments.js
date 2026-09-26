/* =====================================================
   CARETRACK HEALTHCARE APPOINTMENTS
===================================================== */


/* =====================================================
   APPOINTMENT TABS
===================================================== */

const appointmentTabs =
    document.querySelectorAll(".appointment-tab");

const appointmentRows =
    document.querySelectorAll(
        "#appointmentTableBody tr"
    );


let currentPeriod = "today";


appointmentTabs.forEach(tab => {

    tab.addEventListener("click", function () {

        appointmentTabs.forEach(item => {
            item.classList.remove("active");
        });

        this.classList.add("active");

        currentPeriod =
            this.getAttribute("data-tab");

        applyAppointmentFilters();

    });

});



/* =====================================================
   APPOINTMENT FILTERS
===================================================== */

const searchInput =
    document.getElementById("searchInput");

const dateFilter =
    document.getElementById("dateFilter");

const typeFilter =
    document.getElementById("typeFilter");

const statusFilter =
    document.getElementById("statusFilter");

const resetFilters =
    document.getElementById("resetFilters");

const noAppointments =
    document.getElementById("noAppointments");

const appointmentCount =
    document.getElementById("appointmentCount");



function applyAppointmentFilters() {

    const search =
        searchInput.value.toLowerCase().trim();

    const selectedDate =
        dateFilter.value;

    const selectedType =
        typeFilter.value;

    const selectedStatus =
        statusFilter.value;


    let visibleCount = 0;


    appointmentRows.forEach(row => {

        const period =
            row.dataset.period;

        const date =
            row.dataset.date;

        const type =
            row.dataset.type;

        const status =
            row.dataset.status;


        const rowText =
            row.innerText.toLowerCase();


        const matchesPeriod =
            period === currentPeriod;


        const matchesSearch =
            search === "" ||
            rowText.includes(search);


        const matchesDate =
            selectedDate === "" ||
            date === selectedDate;


        const matchesType =
            selectedType === "all" ||
            type === selectedType;


        const matchesStatus =
            selectedStatus === "all" ||
            status === selectedStatus;


        const shouldShow =
            matchesPeriod &&
            matchesSearch &&
            matchesDate &&
            matchesType &&
            matchesStatus;


        if (shouldShow) {

            row.style.display = "";

            visibleCount++;

        } else {

            row.style.display = "none";

        }

    });


    if (visibleCount === 0) {

        noAppointments.style.display = "block";

    } else {

        noAppointments.style.display = "none";

    }


    appointmentCount.textContent =
        `Showing ${visibleCount} appointment${visibleCount === 1 ? "" : "s"}`;

}



searchInput.addEventListener(
    "input",
    applyAppointmentFilters
);


dateFilter.addEventListener(
    "change",
    applyAppointmentFilters
);


typeFilter.addEventListener(
    "change",
    applyAppointmentFilters
);


statusFilter.addEventListener(
    "change",
    applyAppointmentFilters
);



resetFilters.addEventListener(
    "click",
    function () {

        searchInput.value = "";

        dateFilter.value = "";

        typeFilter.value = "all";

        statusFilter.value = "all";

        currentPeriod = "today";


        appointmentTabs.forEach(tab => {

            tab.classList.remove("active");

        });


        document
            .querySelector('[data-tab="today"]')
            .classList.add("active");


        applyAppointmentFilters();

    }
);



/* =====================================================
   SLOT FILTERS
===================================================== */

const slotDateFrom =
    document.getElementById("slotDateFrom");

const slotDateTo =
    document.getElementById("slotDateTo");

const slotTypeFilter =
    document.getElementById("slotTypeFilter");

const slotStatusFilter =
    document.getElementById("slotStatusFilter");

const filterSlots =
    document.getElementById("filterSlots");

const slotRows =
    document.querySelectorAll(
        "#slotsTableBody tr"
    );



function applySlotFilters() {

    const fromDate =
        slotDateFrom.value;

    const toDate =
        slotDateTo.value;

    const selectedType =
        slotTypeFilter.value;

    const selectedStatus =
        slotStatusFilter.value;


    slotRows.forEach(row => {

        const date =
            row.dataset.slotDate;

        const type =
            row.dataset.slotType;

        const status =
            row.dataset.slotStatus;


        const matchesFromDate =
            fromDate === "" ||
            date >= fromDate;


        const matchesToDate =
            toDate === "" ||
            date <= toDate;


        const matchesType =
            selectedType === "all" ||
            type === selectedType;


        const matchesStatus =
            selectedStatus === "all" ||
            status === selectedStatus;


        if (
            matchesFromDate &&
            matchesToDate &&
            matchesType &&
            matchesStatus
        ) {

            row.style.display = "";

        } else {

            row.style.display = "none";

        }

    });

}


filterSlots.addEventListener(
    "click",
    applySlotFilters
);



/* =====================================================
   ADD NEW SLOT
===================================================== */

const addSlotForm =
    document.getElementById("addSlotForm");


addSlotForm.addEventListener(
    "submit",
    function (event) {

        event.preventDefault();


        const date =
            document.getElementById("newSlotDate").value;

        const type =
            document.getElementById("newSlotType").value;

        const start =
            document.getElementById("newSlotStart").value;

        const end =
            document.getElementById("newSlotEnd").value;


        if (!date || !type || !start || !end) {

            return;

        }


        /*
         * This is currently only a front-end demonstration.
         * A backend/database will eventually save the slot.
         */


        const formattedDate =
            new Date(date + "T00:00:00")
                .toLocaleDateString(
                    "en-GB",
                    {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                    }
                );


        const formattedStart =
            formatTime(start);

        const formattedEnd =
            formatTime(end);


        const tableBody =
            document.getElementById(
                "slotsTableBody"
            );


        const newRow =
            document.createElement("tr");


        newRow.dataset.slotDate = date;
        newRow.dataset.slotType = type;
        newRow.dataset.slotStatus = "Available";


        newRow.innerHTML = `

            <td>
                ${formattedDate}
            </td>

            <td>
                ${formattedStart} – ${formattedEnd}
            </td>

            <td>

                <strong>
                    ${type}
                </strong>

                <span class="appointment-subtype">
                    Available appointment slot
                </span>

            </td>

            <td>

                <span class="slot-status available">
                    Available
                </span>

            </td>

            <td>
                —
            </td>

            <td>

                <div class="slot-actions">

                    <button
                        class="slot-action edit-slot"
                        type="button"
                        data-bs-toggle="modal"
                        data-bs-target="#editSlotModal"
                    >
                        <i class="bi bi-pencil"></i>
                    </button>

                    <button
                        class="slot-action delete-slot"
                        type="button"
                        data-bs-toggle="modal"
                        data-bs-target="#deleteSlotModal"
                    >
                        <i class="bi bi-trash3"></i>
                    </button>

                </div>

            </td>

        `;


        tableBody.appendChild(newRow);


        /*
         * Clear form.
         */

        addSlotForm.reset();


        /*
         * Close Bootstrap modal.
         */

        const modalElement =
            document.getElementById(
                "addSlotModal"
            );


        const modal =
            bootstrap.Modal.getInstance(
                modalElement
            );


        if (modal) {

            modal.hide();

        }

    }
);



/* =====================================================
   TIME FORMATTER
===================================================== */

function formatTime(time) {

    const [hours, minutes] =
        time.split(":");

    let hour =
        parseInt(hours);

    const period =
        hour >= 12 ? "PM" : "AM";


    hour =
        hour % 12 || 12;


    return `${hour}:${minutes} ${period}`;

}



/* =====================================================
   START VISIT
===================================================== */

const startVisitButtons =
    document.querySelectorAll(
        ".start-button"
    );


startVisitButtons.forEach(button => {

    button.addEventListener(
        "click",
        function () {

            /*
             * For now this is only a placeholder.
             *
             * Later this can navigate to the
             * appropriate visit page.
             */

            alert(
                "Start Visit functionality will be connected to the visit page later."
            );

        }
    );

});



/* =====================================================
   INITIAL LOAD
===================================================== */

applyAppointmentFilters();