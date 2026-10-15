document.addEventListener("DOMContentLoaded", function () {

    const inboxList = document.getElementById("inboxList");
    const items = Array.from(inboxList.querySelectorAll(".inbox-item"));

    const inboxEmpty = document.getElementById("inboxEmpty");
    const totalCount = document.getElementById("totalCount");
    const inboxSubtitle = document.getElementById("inboxSubtitle");

    const detailStatus = document.getElementById("detailStatus");
    const detailIcon = document.getElementById("detailIcon");
    const detailTitle = document.getElementById("detailTitle");
    const detailDate = document.getElementById("detailDate");
    const detailMessage = document.getElementById("detailMessage");

    const detailExtra = document.getElementById("detailExtra");
    const extraDate = document.getElementById("extraDate");
    const extraTime = document.getElementById("extraTime");

    const detailNote = document.getElementById("detailNote");
    const detailNoteText = document.getElementById("detailNoteText");

    const markOneRead = document.getElementById("markOneRead");
    const closeDetail = document.getElementById("closeDetail");

    let selectedItem = null;

    // Notification content
    const notificationDetails = {
        "1": {
            title: "Appointment Reminder",
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

    // Update the notification count and unread count.
    function updateCounts() {
        const unreadTotal = items.filter(function (item) {
            return item.classList.contains("unread");
        }).length;

        totalCount.textContent = items.length;

        inboxSubtitle.textContent =
            unreadTotal + " unread · " + items.length + " notifications";

        inboxEmpty.hidden = items.length !== 0;
    }

    // Update the opened notification's read status.
    function updateDetailStatus() {
        if (!selectedItem) {
            return;
        }

        const unread = selectedItem.classList.contains("unread");

        detailStatus.textContent = unread ? "Unread" : "Read";

        detailStatus.className =
            "detail-status " +
            (unread ? "unread-badge" : "read-badge");

        markOneRead.disabled = !unread;

        markOneRead.innerHTML = unread
            ? '<i class="bi bi-check2-circle"></i> Mark as Read'
            : '<i class="bi bi-check2-circle"></i> Already Read';
    }

    // Mark a notification as read.
    function markAsRead(item) {
        item.classList.remove("unread");

        const dot = item.querySelector(".unread-dot");

        if (dot) {
            dot.style.display = "none";
        }

        if (item === selectedItem) {
            updateDetailStatus();
        }

        updateCounts();
    }

    // Display a notification's full details.
    function openNotification(item) {
        const data = notificationDetails[item.dataset.id];

        if (!data) {
            console.error(
                "Notification details not found for ID:",
                item.dataset.id
            );
            return;
        }

        selectedItem = item;

        // Highlight the selected notification.
        items.forEach(function (otherItem) {
            const active = otherItem === item;

            otherItem.classList.toggle("active", active);
            otherItem.setAttribute("aria-pressed", String(active));
        });

        // Notification heading and icon.
        detailTitle.textContent = data.title;

        detailIcon.className = "detail-icon " + data.iconClass;

        detailIcon.innerHTML =
            '<i class="bi ' + data.icon + '"></i>';

        // Date and full message.
        detailDate.textContent = data.date;

        detailMessage.textContent =
            data.message || "No message available.";

        // Appointment information.
        detailExtra.hidden = !data.extra;

        if (data.extra) {
            extraDate.textContent = data.appointmentDate || "";
            extraTime.textContent = data.appointmentTime || "";
        }

        // Additional information note.
        detailNote.hidden = !data.note;

        detailNoteText.textContent = data.note || "";

        // Update read/unread status.
        updateDetailStatus();
    }

    // Open notifications when clicked or activated by keyboard.
    items.forEach(function (item) {

        item.addEventListener("click", function () {
            openNotification(item);
        });

        item.addEventListener("keydown", function (event) {
            if (event.target !== item) {
                return;
            }

            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openNotification(item);
            }
        });

    });

    // Mark the selected notification as read.
    markOneRead.addEventListener("click", function () {
        if (!selectedItem) {
            return;
        }

        markAsRead(selectedItem);
    });

    // Done marks the notification as read and resets the details panel.
    closeDetail.addEventListener("click", function () {

        if (selectedItem) {
            markAsRead(selectedItem);

            selectedItem.classList.remove("active");
            selectedItem.setAttribute("aria-pressed", "false");

            selectedItem = null;
        }

        // Reset the details panel.
        detailTitle.textContent = "You're all caught up!";

        detailIcon.className = "detail-icon green-icon";

        detailIcon.innerHTML =
            '<i class="bi bi-check-circle"></i>';

        detailDate.textContent = "Notification completed";

        detailMessage.textContent =
            "Select another notification from the list to read its details.";

        detailExtra.hidden = true;
        detailNote.hidden = true;

        detailStatus.textContent = "Completed";
        detailStatus.className = "detail-status read-badge";

        markOneRead.disabled = true;

        markOneRead.innerHTML =
            '<i class="bi bi-check2-circle"></i> Mark as Read';

        items.forEach(function (item) {
            item.classList.remove("active");
            item.setAttribute("aria-pressed", "false");
        });

        updateCounts();
    });

    // Initialise the page.
    updateCounts();

    // Open the first notification without marking it as read.
    if (items.length > 0) {
        openNotification(items[0]);
    }

});