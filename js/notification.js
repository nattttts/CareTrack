document.addEventListener("DOMContentLoaded", async function () {
    const API_BASE = "http://localhost:3000/api/notifications";

    const inboxList = document.getElementById("inboxList");
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

    let notifications = [];
    let selectedId = null;

    const typeStyles = {
        appointment: {
            icon: "bi-calendar-event",
            iconClass: "pink-icon"
        },
        confirmed: {
            icon: "bi-calendar-check",
            iconClass: "pink-icon"
        },
        vaccination: {
            icon: "bi-eyedropper",
            iconClass: "blue-icon"
        },
        completed: {
            icon: "bi-shield-check",
            iconClass: "green-icon"
        },
        maintenance: {
            icon: "bi-gear",
            iconClass: "purple-icon"
        },
        general: {
            icon: "bi-bell",
            iconClass: "pink-icon"
        }
    };

    function getStyle(type) {
        return typeStyles[String(type || "general").toLowerCase()]
            || typeStyles.general;
    }

    function formatDate(value) {
        if (!value) return "Date unavailable";

        const date = new Date(
            value.includes("T") ? value : value.replace(" ", "T") + "Z"
        );

        if (Number.isNaN(date.getTime())) return value;

        return date.toLocaleString("en-MY", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function timeAgo(value) {
        if (!value) return "";

        const date = new Date(
            value.includes("T") ? value : value.replace(" ", "T") + "Z"
        );

        if (Number.isNaN(date.getTime())) return "";

        const seconds = Math.max(
            0,
            Math.floor((Date.now() - date.getTime()) / 1000)
        );

        if (seconds < 60) return "Just now";
        if (seconds < 3600) {
            return Math.floor(seconds / 60) + " minutes ago";
        }
        if (seconds < 86400) {
            return Math.floor(seconds / 3600) + " hours ago";
        }
        if (seconds < 604800) {
            return Math.floor(seconds / 86400) + " days ago";
        }

        return date.toLocaleDateString("en-MY", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function getNotification(id) {
        return notifications.find(
            notification => Number(notification.notification_id) === Number(id)
        );
    }

    function updateCounts() {
        const unreadCount = notifications.filter(
            notification => Number(notification.is_read) === 0
        ).length;

        totalCount.textContent = notifications.length;

        inboxSubtitle.textContent =
            `${unreadCount} unread · ${notifications.length} notifications`;

        inboxEmpty.hidden = notifications.length !== 0;
    }

    function updateDetailStatus() {
        const notification = getNotification(selectedId);

        if (!notification) {
            markOneRead.disabled = true;
            return;
        }

        const unread = Number(notification.is_read) === 0;

        detailStatus.textContent = unread ? "Unread" : "Read";
        detailStatus.className =
            "detail-status " + (unread ? "unread-badge" : "read-badge");

        markOneRead.disabled = !unread;
        markOneRead.innerHTML = unread
            ? '<i class="bi bi-check2-circle"></i> Mark as Read'
            : '<i class="bi bi-check2-circle"></i> Already Read';
    }

    function renderList() {
        inboxList.innerHTML = notifications.map(notification => {
            const style = getStyle(notification.type);
            const unread = Number(notification.is_read) === 0;
            const active =
                Number(notification.notification_id) === Number(selectedId);

            return `
                <article
                    class="inbox-item ${unread ? "unread" : ""} ${active ? "active" : ""}"
                    data-id="${Number(notification.notification_id)}"
                    tabindex="0"
                    role="button"
                    aria-pressed="${active}"
                >
                    <div class="item-icon ${style.iconClass}">
                        <i class="bi ${style.icon}"></i>
                    </div>

                    <div class="item-info">
                        <div class="item-title-row">
                            <h4>${escapeHTML(notification.title)}</h4>
                            <span class="unread-dot"
                                style="display:${unread ? "inline-block" : "none"}">
                            </span>
                        </div>

                        <p>${escapeHTML(notification.message)}</p>

                        <div class="item-bottom">
                            <span class="item-time">
                                ${escapeHTML(timeAgo(notification.created_at))}
                            </span>
                        </div>
                    </div>
                </article>
            `;
        }).join("");

        updateCounts();
    }

    function resetDetails() {
        selectedId = null;

        detailTitle.textContent = "Select a notification";
        detailIcon.className = "detail-icon green-icon";
        detailIcon.innerHTML = '<i class="bi bi-bell"></i>';
        detailDate.textContent = "No notification selected";

        detailMessage.textContent =
            "Select a notification from the list to read its details.";

        detailExtra.hidden = true;
        detailNote.hidden = true;

        detailStatus.textContent = "No selection";
        detailStatus.className = "detail-status read-badge";

        markOneRead.disabled = true;
        markOneRead.innerHTML =
            '<i class="bi bi-check2-circle"></i> Mark as Read';

        renderList();
    }

    function openNotification(id) {
        const notification = getNotification(id);

        if (!notification) return;

        selectedId = Number(notification.notification_id);

        const style = getStyle(notification.type);

        detailTitle.textContent = notification.title;
        detailIcon.className = "detail-icon " + style.iconClass;
        detailIcon.innerHTML = `<i class="bi ${style.icon}"></i>`;

        detailDate.textContent = formatDate(notification.created_at);
        detailMessage.textContent = notification.message || "No message available.";

        const hasAppointment =
            Boolean(notification.appointment_date) ||
            Boolean(notification.appointment_time);

        detailExtra.hidden = !hasAppointment;

        extraDate.textContent = notification.appointment_date || "Not specified";
        extraTime.textContent = notification.appointment_time || "Not specified";

        detailNote.hidden = !notification.note;
        detailNoteText.textContent = notification.note || "";

        renderList();
        updateDetailStatus();
    }

    async function loadNotifications() {
        inboxList.innerHTML = "<p>Loading notifications...</p>";

        try {
            const response = await fetch(API_BASE, {
                method: "GET",
                credentials: "include"
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Unable to load notifications.");
            }

            notifications = Array.isArray(result) ? result : [];

            renderList();

            if (notifications.length > 0) {
                openNotification(notifications[0].notification_id);
            } else {
                resetDetails();
            }
        } catch (error) {
            console.error("Loading notifications failed:", error);

            inboxList.innerHTML = "";
            inboxEmpty.hidden = false;
            inboxEmpty.querySelector("p").textContent =
                "Unable to load notifications. Please log in and try again.";

            totalCount.textContent = "0";
            inboxSubtitle.textContent = "Notifications unavailable";

            resetDetails();
        }
    }

    async function markAsRead() {
        if (selectedId === null) return;

        const notification = getNotification(selectedId);

        if (!notification || Number(notification.is_read) === 1) return;

        markOneRead.disabled = true;

        try {
            const response = await fetch(
                `${API_BASE}/${encodeURIComponent(selectedId)}/read`,
                {
                    method: "PATCH",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Unable to update notification.");
            }

            notification.is_read = 1;

            renderList();
            updateDetailStatus();
        } catch (error) {
            console.error("Mark as read failed:", error);
            alert(error.message || "Unable to mark the notification as read.");
            updateDetailStatus();
        }
    }

    // Event delegation also works after the list is rebuilt.
    inboxList.addEventListener("click", function (event) {
        const item = event.target.closest(".inbox-item");

        if (item) {
            openNotification(item.dataset.id);
        }
    });

    inboxList.addEventListener("keydown", function (event) {
        const item = event.target.closest(".inbox-item");

        if (
            item &&
            (event.key === "Enter" || event.key === " ")
        ) {
            event.preventDefault();
            openNotification(item.dataset.id);
        }
    });

    markOneRead.addEventListener("click", markAsRead);

    // Done closes the details panel without changing read status.
    closeDetail.addEventListener("click", resetDetails);

    await loadNotifications();
});