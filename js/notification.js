document.addEventListener("DOMContentLoaded", function () {

    const inboxList = document.getElementById("inboxList");
    const items = Array.from(inboxList.querySelectorAll(".inbox-item"));

    const filter = document.getElementById("notificationFilter");
    const selectAll = document.getElementById("selectAll");
    const markSelectedRead = document.getElementById("markSelectedRead");

    const inboxEmpty = document.getElementById("inboxEmpty");
    const totalCount = document.getElementById("totalCount");
    const inboxSubtitle = document.getElementById("inboxSubtitle");

    const detailPanel = document.getElementById("detailPanel");
    const detailStatus = document.getElementById("detailStatus");
    const detailIcon = document.getElementById("detailIcon");
    const detailCategory = document.getElementById("detailCategory");
    const detailTitle = document.getElementById("detailTitle");
    const detailDate = document.getElementById("detailDate");
    const detailMessage = document.getElementById("detailMessage");
    const detailExtra = document.getElementById("detailExtra");
    const extraDate = document.getElementById("extraDate");
    const extraTime = document.getElementById("extraTime");
    const detailNote = document.getElementById("detailNote");

    const markOneRead = document.getElementById("markOneRead");
    const closeDetail = document.getElementById("closeDetail");

    let selectedItem = null;


    // Notification information
    const notificationDetails = {
        "1": {
            title: "Appointment Reminder",
            category: "Appointment",
            categoryClass: "appointment-tag",
            icon: "bi-calendar-event",
            iconClass: "pink-icon",
            date: "Today · 2 hours ago",
            message:
                "Dear Jane Smith,\n\n" +
                "This is a reminder that your appointment with " +
                "Dr. Tan Wei Ling is scheduled for 26 April 2026 " +
                "at 10:00 AM.\n\n" +
                "Please arrive 15 minutes early and bring your " +
                "relevant healthcare records.",
            extra: true,
            appointmentDate: "26 April 2026",
            appointmentTime: "10:00 AM",
            note: "Please arrive 15 minutes before your appointment."
        },

        "2": {
            title: "Vaccination Due",
            category: "Vaccination",
            categoryClass: "vaccination-tag",
            icon: "bi-eyedropper",
            iconClass: "blue-icon",
            date: "Yesterday · 1 day ago",
            message:
                "Dear Jane Smith,\n\n" +
                "Your child, Ethan Lee, is due for a scheduled " +
                "vaccination.\n\n" +
                "Please check Ethan's vaccination schedule and " +
                "contact your healthcare clinic to arrange a visit.",
            extra: false,
            note: "Please check your child's vaccination schedule."
        },

        "3": {
            title: "System Maintenance",
            category: "System",
            categoryClass: "system-tag",
            icon: "bi-gear",
            iconClass: "purple-icon",
            date: "2 days ago",
            message:
                "Dear CareTrack User,\n\n" +
                "CareTrack may be temporarily unavailable during " +
                "scheduled maintenance on 28 April 2026.\n\n" +
                "We apologise for any inconvenience.",
            extra: false,
            note: "Thank you for your patience."
        },

        "4": {
            title: "Appointment Confirmed",
            category: "Appointment",
            categoryClass: "appointment-tag",
            icon: "bi-calendar-check",
            iconClass: "pink-icon",
            date: "3 days ago",
            message:
                "Dear Jane Smith,\n\n" +
                "Your appointment with Dr. Tan Wei Ling on " +
                "20 April 2026 at 2:00 PM has been confirmed.\n\n" +
                "Please review your appointment details.",
            extra: true,
            appointmentDate: "20 April 2026",
            appointmentTime: "2:00 PM",
            note: "Please arrive on time for your appointment."
        },

        "5": {
            title: "Vaccination Completed",
            category: "Vaccination",
            categoryClass: "vaccination-tag",
            icon: "bi-shield-check",
            iconClass: "green-icon",
            date: "5 days ago",
            message:
                "Dear Jane Smith,\n\n" +
                "Ethan Lee's vaccination record has been updated " +
                "to reflect his completed vaccination.\n\n" +
                "Please review his record for the next scheduled dose.",
            extra: false,
            note: "Keep your child's vaccination record for future visits."
        }
    };


    function getCheckbox(item) {
        return item.querySelector(".notification-checkbox");
    }

    // Refresh the status in the detail panel
    function updateDetailStatus() {

        if (!selectedItem) return;

        const unread = selectedItem.classList.contains("unread");

        detailStatus.textContent = unread ? "Unread" : "Read";

        detailStatus.classList.toggle("unread-badge", unread);
        detailStatus.classList.toggle("read-badge", !unread);

        markOneRead.disabled = !unread;

        markOneRead.innerHTML = unread
            ? '<i class="bi bi-check2-circle"></i> Mark as Read'
            : '<i class="bi bi-check2-circle"></i> Already Read';
    }

    // Mark a notification as read
    function markAsRead(item) {

        item.classList.remove("unread");

        // The CSS will now display the read card in grey.
        const dot = item.querySelector(".unread-dot");

        if (dot) {
            dot.style.display = "none";
        }

        if (item === selectedItem) {
            updateDetailStatus();
        }

        updateCounts();
    }

    // Open a notification WITHOUT automatically marking it read
    function openNotification(item) {

        selectedItem = item;

        items.forEach(function (otherItem) {

            const active = otherItem === item;

            otherItem.classList.toggle("active", active);
            otherItem.setAttribute("aria-pressed", String(active));

        });

        const data = notificationDetails[item.dataset.id];

        if (!data) return;

        detailTitle.textContent = data.title;
        detailCategory.textContent = data.category;
        detailCategory.className =
            "detail-category " + data.categoryClass;

        detailIcon.className = "detail-icon " + data.iconClass;
        detailIcon.innerHTML = '<i class="bi ' + data.icon + '"></i>';

        detailDate.textContent = data.date;
        detailMessage.textContent = data.message;

        detailExtra.hidden = !data.extra;

        if (data.extra) {
            extraDate.textContent = data.appointmentDate;
            extraTime.textContent = data.appointmentTime;
        }

        detailNote.querySelector("p").textContent = data.note;

        updateDetailStatus();
    }

    // Counts always reflect the ENTIRE inbox, not just the filter
    function updateCounts() {

        const unreadTotal = items.filter(function (item) {
            return item.classList.contains("unread");
        }).length;

        const visibleItems = items.filter(function (item) {
            return !item.hidden;
        });

        totalCount.textContent = items.length;

        inboxSubtitle.textContent =
            unreadTotal + " unread · " + items.length + " notifications";

        inboxEmpty.hidden = visibleItems.length !== 0;

        const visibleCheckboxes = visibleItems.map(getCheckbox);

        const checkedCount = visibleCheckboxes.filter(function (checkbox) {
            return checkbox.checked;
        }).length;

        selectAll.checked =
            visibleCheckboxes.length > 0 &&
            checkedCount === visibleCheckboxes.length;

        selectAll.indeterminate =
            checkedCount > 0 &&
            checkedCount < visibleCheckboxes.length;

        const anySelected = items.some(function (item) {
            return getCheckbox(item).checked;
        });

        markSelectedRead.disabled = !anySelected;
    }

    // Apply category filter
    function filterNotifications() {

        const category = filter.value;

        items.forEach(function (item) {

            const categories = item.dataset.category.split(" ");

            item.hidden =
                category !== "all" &&
                !categories.includes(category);

        });

        updateCounts();
    }

    // Clicking the notification opens its full details
    items.forEach(function (item) {

        item.addEventListener("click", function (event) {

            if (event.target.closest(".notification-checkbox")) {
                return;
            }

            openNotification(item);
        });

        item.addEventListener("keydown", function (event) {

            if (event.target !== item) return;

            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openNotification(item);
            }
        });
    });

    selectAll.addEventListener("change", function () {

        items.forEach(function (item) {
            if (!item.hidden) {
                getCheckbox(item).checked = selectAll.checked;
            }
        });

        updateCounts();
    });

    items.forEach(function (item) {

        getCheckbox(item).addEventListener("change", updateCounts);
    });

    // Mark selected notifications as read
    markSelectedRead.addEventListener("click", function () {

        items.forEach(function (item) {

            if (getCheckbox(item).checked) {
                markAsRead(item);
            }

        });

        // Clear the selection after processing.
        items.forEach(function (item) {
            getCheckbox(item).checked = false;
        });

        updateCounts();
    });

    // Mark the currently open notification as read
    markOneRead.addEventListener("click", function () {

        if (selectedItem) {
            markAsRead(selectedItem);
        }

    });

    //  mark as read and close the current details
    closeDetail.addEventListener("click", function () {

        if (selectedItem) {
            markAsRead(selectedItem);

            selectedItem.classList.remove("active");
            selectedItem.setAttribute("aria-pressed", "false");
            selectedItem = null;
        }

        // Reset the detail panel to its empty state.
        detailTitle.textContent = "Notification completed";
        detailCategory.textContent = "Done";
        detailCategory.className = "detail-category system-tag";

        detailIcon.className = "detail-icon green-icon";
        detailIcon.innerHTML = '<i class="bi bi-check-circle"></i>';

        detailDate.textContent = "You have finished viewing this message.";

        detailMessage.textContent =
            "Select another notification from your inbox to read its details.";

        detailExtra.hidden = true;
        detailNote.hidden = true;

        detailStatus.textContent = "Completed";
        detailStatus.className = "detail-status read-badge";

        markOneRead.disabled = true;
        markOneRead.innerHTML =
            '<i class="bi bi-check2-circle"></i> Mark as Read';

        updateCounts();
    });

    // Filter notifications
    filter.addEventListener("change", filterNotifications);

    filterNotifications();

    // Open the first notification, but leave its status unchanged.
    if (items.length > 0) {
        openNotification(items[0]);
    }

});