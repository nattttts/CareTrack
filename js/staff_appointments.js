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