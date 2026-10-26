document.addEventListener("DOMContentLoaded", async function () {
    // Use the same server that serves the current page.
    const API_BASE = "/api/notifications";

    const $ = id => document.getElementById(id);

    const inboxList = $("inboxList");
    const inboxEmpty = $("inboxEmpty");
    const totalCount = $("totalCount");
    const inboxSubtitle = $("inboxSubtitle");

    const detailStatus = $("detailStatus");
    const detailIcon = $("detailIcon");
    const detailTitle = $("detailTitle");
    const detailDate = $("detailDate");
    const detailMessage = $("detailMessage");

    const detailExtra = $("detailExtra");
    const extraDate = $("extraDate");
    const extraTime = $("extraTime");

    const detailNote = $("detailNote");
    const detailNoteText = $("detailNoteText");

    const markOneRead = $("markOneRead");
    const closeDetail = $("closeDetail");

    let notifications = [];
    let selectedId = null;

    // Check that the HTML contains all required elements.
    const requiredElements = [
        inboxList,
        inboxEmpty,
        totalCount,
        inboxSubtitle,
        detailStatus,
        detailIcon,
        detailTitle,
        detailDate,
        detailMessage,
        detailExtra,
        extraDate,
        extraTime,
        detailNote,
        detailNoteText,
        markOneRead,
        closeDetail
    ];

    if (requiredElements.some(element => !element)) {
        console.error(
            "Notification page is missing required HTML elements. " +
            "Check the element IDs in notification.html."
        );
        return;
    }

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
        return typeStyles[
            String(type || "general").trim().toLowerCase()
        ] || typeStyles.general;
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
            notification =>
                Number(notification.notification_id) === Number(id)
        );
    }

    async function readJSONResponse(response) {
        const text = await response.text();

        let result;

        try {
            result = JSON.parse(text);
        } catch {
            if (response.status === 401) {
                throw new Error("Your session has expired. Please log in again.");
            }

            if (response.status === 403) {
                throw new Error("You do not have permission to view notifications.");
            }

            throw new Error(
                `The server returned an invalid response (HTTP ${response.status}). ` +
                "Check the backend URL and server console."
            );
        }

        if (!response.ok) {
            throw new Error(
                result.message || `Request failed (HTTP ${response.status}).`
            );
        }

        return result;
    }

    function formatDate(value) {
        if (!value) return "Date unavailable";

        const rawValue = String(value);
        const normalizedValue = rawValue.includes("T")
            ? rawValue
            : rawValue.replace(" ", "T") + "Z";

        const date = new Date(normalizedValue);

        if (Number.isNaN(date.getTime())) {
            return rawValue;
        }

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

        const rawValue = String(value);
        const normalizedValue = rawValue.includes("T")
            ? rawValue
            : rawValue.replace(" ", "T") + "Z";

        const date = new Date(normalizedValue);

        if (Number.isNaN(date.getTime())) return "";

        const seconds = Math.max(
            0,
            Math.floor((Date.now() - date.getTime()) / 1000)
        );

        if (seconds < 60) return "Just now";

        if (seconds < 3600) {
            return `${Math.floor(seconds / 60)} minutes ago`;
        }

        if (seconds < 86400) {
            return `${Math.floor(seconds / 3600)} hours ago`;
        }

        if (seconds < 604800) {
            return `${Math.floor(seconds / 86400)} days ago`;
        }

        return date.toLocaleDateString("en-MY", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function updateCounts() {
        const unreadCount = notifications.filter(
            notification => Number(notification.is_read) === 0
        ).length;

        totalCount.textContent = notifications.length;

        inboxSubtitle.textContent =
            `${unreadCount} unread · ${notifications.length} notifications`;

        inboxEmpty.hidden = notifications.length !== 0;

        if (notifications.length === 0) {
            inboxEmpty.querySelector("p").textContent =
                "No notifications available.";
        }
    }

    function updateDetailStatus() {
        const notification = getNotification(selectedId);

        if (!notification) {
            detailStatus.textContent = "No selection";
            detailStatus.className = "detail-status read-badge";
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
        if (notifications.length === 0) {
            inboxList.innerHTML = "";
            updateCounts();
            return;
        }

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
                            <span
                                class="unread-dot"
                                style="display:${unread ? "inline-block" : "none"}"
                                aria-label="Unread">
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

        detailTitle.textContent = notification.title || "Notification";
        detailIcon.className = "detail-icon " + style.iconClass;
        detailIcon.innerHTML = `<i class="bi ${style.icon}"></i>`;

        detailDate.textContent = formatDate(notification.created_at);

        detailMessage.textContent =
            notification.message || "No message available.";

        const hasAppointment =
            Boolean(notification.appointment_date) ||
            Boolean(notification.appointment_time);

        detailExtra.hidden = !hasAppointment;

        extraDate.textContent =
            notification.appointment_date || "Not specified";

        extraTime.textContent =
            notification.appointment_time || "Not specified";

        detailNote.hidden = !notification.note;
        detailNoteText.textContent = notification.note || "";

        renderList();
        updateDetailStatus();
    }

    function showLoadError(message) {
        notifications = [];
        selectedId = null;

        inboxList.innerHTML = "";
        inboxEmpty.hidden = false;
        inboxEmpty.querySelector("p").textContent = message;

        totalCount.textContent = "0";
        inboxSubtitle.textContent = "Notifications unavailable";

        detailTitle.textContent = "Unable to load notifications";
        detailDate.textContent = "";
        detailMessage.textContent = message;

        detailExtra.hidden = true;
        detailNote.hidden = true;

        detailStatus.textContent = "Unavailable";
        detailStatus.className = "detail-status read-badge";

        markOneRead.disabled = true;
    }

    async function loadNotifications() {
        inboxList.innerHTML = "<p>Loading notifications...</p>";
        inboxEmpty.hidden = true;

        try {
            const response = await fetch(API_BASE, {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    Accept: "application/json"
                }
            });

            const result = await readJSONResponse(response);

            if (!Array.isArray(result)) {
                throw new Error(
                    "The notification API did not return a list. Check server.js."
                );
            }

            notifications = result;

            // Ensure each database record has a usable ID.
            notifications = notifications.filter(notification =>
                Number.isSafeInteger(Number(notification.notification_id)) &&
                Number(notification.notification_id) > 0
            );

            renderList();

            if (notifications.length > 0) {
                openNotification(notifications[0].notification_id);
            } else {
                resetDetails();
            }
        } catch (error) {
            console.error("Loading notifications failed:", error);

            showLoadError(
                error.message || "Unable to load notifications. Please try again."
            );
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
                    credentials: "same-origin",
                    headers: {
                        Accept: "application/json"
                    }
                }
            );

            await readJSONResponse(response);

            notification.is_read = 1;

            renderList();
            updateDetailStatus();
        } catch (error) {
            console.error("Mark as read failed:", error);

            alert(
                error.message ||
                "Unable to mark the notification as read."
            );

            updateDetailStatus();
        }
    }

    // Select a notification from the list.
    inboxList.addEventListener("click", function (event) {
        const item = event.target.closest(".inbox-item");

        if (item) {
            openNotification(item.dataset.id);
        }
    });

    // Support keyboard selection.
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

    // Done closes the details without marking the notification as read.
    closeDetail.addEventListener("click", resetDetails);

    await loadNotifications();
});