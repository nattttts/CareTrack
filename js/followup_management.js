document.addEventListener("DOMContentLoaded", function () {

    const tabs = document.querySelectorAll(".followup-tab");
    const rows = document.querySelectorAll("#followupTableBody tr");

    const searchInput = document.getElementById("searchInput");
    const typeFilter = document.getElementById("typeFilter");
    const statusFilter = document.getElementById("statusFilter");
    const resetButton = document.getElementById("resetButton");
    const recordCount = document.getElementById("recordCount");


    let currentTab = "all";


    /* =====================================================
       FILTER RECORDS
       ===================================================== */

    function filterRecords() {

        const searchText = searchInput.value.toLowerCase().trim();
        const selectedType = typeFilter.value;
        const selectedStatus = statusFilter.value;

        let visibleCount = 0;

        rows.forEach(function (row) {

            const rowType = row.dataset.type;
            const rowStatus = row.dataset.status;

            const rowText = row.textContent.toLowerCase();

            const matchesTab =
                currentTab === "all" ||
                rowType === currentTab;

            const matchesType =
                selectedType === "all" ||
                rowType === selectedType;

            const matchesStatus =
                selectedStatus === "all" ||
                rowStatus === selectedStatus;

            const matchesSearch =
                searchText === "" ||
                rowText.includes(searchText);


            if (
                matchesTab &&
                matchesType &&
                matchesStatus &&
                matchesSearch
            ) {

                row.style.display = "";
                visibleCount++;

            } else {

                row.style.display = "none";

            }

        });


        recordCount.textContent =
            `Showing ${visibleCount} of ${rows.length} records`;
    }


    /* =====================================================
       TAB BUTTONS
       ===================================================== */

    tabs.forEach(function (tab) {

        tab.addEventListener("click", function () {

            tabs.forEach(function (item) {
                item.classList.remove("active");
            });

            this.classList.add("active");

            currentTab = this.dataset.filter;

            filterRecords();

        });

    });


    /* =====================================================
       SEARCH
       ===================================================== */

    searchInput.addEventListener("input", function () {
        filterRecords();
    });


    /* =====================================================
       TYPE FILTER
       ===================================================== */

    typeFilter.addEventListener("change", function () {
        filterRecords();
    });


    /* =====================================================
       STATUS FILTER
       ===================================================== */

    statusFilter.addEventListener("change", function () {
        filterRecords();
    });


    /* =====================================================
       RESET
       ===================================================== */

    resetButton.addEventListener("click", function () {

        searchInput.value = "";
        typeFilter.value = "all";
        statusFilter.value = "all";

        currentTab = "all";

        tabs.forEach(function (tab) {
            tab.classList.remove("active");
        });

        tabs[0].classList.add("active");

        filterRecords();

    });


    /* =====================================================
       INITIAL FILTER
       ===================================================== */

    filterRecords();

});