const API_BASE = "/api";

const $ = (id) => document.getElementById(id);


/* ================= ESCAPE HTML ================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}


/* ================= FORMAT DATE ================= */

function formatDate(value) {
    if (!value) return "-";

    const dateText = String(value).slice(0, 10);
    const date = new Date(`${dateText}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return escapeHTML(value);
    }

    return date.toLocaleDateString("en-MY", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}


/* ================= SHOW MESSAGE ================= */

function showMessage(message, type = "") {
    const messageBox = $("maternalMessage");

    messageBox.textContent = message;
    messageBox.className = `maternal-message ${type}`;
    messageBox.hidden = false;
}


/* ================= API REQUEST ================= */

async function apiRequest(url) {
    const response = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        headers: {
            "Accept": "application/json"
        }
    });

    if (response.status === 401) {
        window.location.href = "login.html";
        throw new Error("Please log in again.");
    }

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            result.message || "Unable to load your records."
        );
    }

    return result;
}


/* ================= LOAD USER PROFILE ================= */

async function loadPregnantWomanProfile() {
    const user = await apiRequest(`${API_BASE}/me`);

    if (user.role !== "pregnant_woman") {
        if (user.role === "child") {
            window.location.replace("child_vaccination.html");
        } else if (user.role === "staff") {
            window.location.replace("staff_dashboard.html");
        } else if (user.role === "admin") {
            window.location.replace("staff_management.html");
        } else {
            window.location.replace("login.html");
        }

        return false;
    }

    $("headerProfileName").textContent =
        user.fullName || "Pregnant Woman";

    return true;
}


/* ================= DISPLAY VISIT HISTORY ================= */
function renderMaternalRecords(records) {
    const tbody = $("maternalRecordsBody");

    if (!Array.isArray(records) || records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    No maternal visit records are available yet.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = records.map(record => {
        const bloodPressure =
            record.systolic != null && record.diastolic != null
                ? `${record.systolic}/${record.diastolic} mmHg`
                : "-";

        return `
            <tr>
                <td>${escapeHTML(record.visit_number ?? "-")}</td>

                <td>${formatDate(record.visit_date)}</td>

                <td>${escapeHTML(bloodPressure)}</td>

                <td>${escapeHTML(record.height ?? "-")}</td>

                <td>${escapeHTML(record.weight ?? "-")}</td>

                <td>${escapeHTML(record.urine_test || "-")}</td>

                <td>${escapeHTML(record.blood_test || "-")}</td>

                <td>${escapeHTML(
                    record.doctor_remarks || "No remarks recorded"
                )}</td>
            </tr>
        `;
    }).join("");
}

/* ================= LOAD MATERNAL RECORDS ================= */

async function loadMaternalRecords() {
    const tbody = $("maternalRecordsBody");
    const refreshButton = $("refreshRecords");
    const messageBox = $("maternalMessage");

    messageBox.hidden = true;

    tbody.innerHTML = `
        <tr>
            <td colspan="5" class="empty-state">
                Loading your records...
            </td>
        </tr>
    `;

    refreshButton.disabled = true;

    try {
        const isPregnantWoman = await loadPregnantWomanProfile();

        if (!isPregnantWoman) return;

        // The server identifies the pregnant woman using the login session.
        const result = await apiRequest(
            `${API_BASE}/maternal-records/my-visits`
        );

        renderMaternalRecords(result.visits);

    } catch (error) {
        if (error.message !== "Please log in again.") {
            showMessage(
                error.message || "Unable to load your maternal records.",
                "error"
            );

            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        Unable to display your records.
                    </td>
                </tr>
            `;
        }
    } finally {
        refreshButton.disabled = false;
    }
}


/* ================= LOG OUT ================= */

async function logout() {
    try {
        await fetch(`${API_BASE}/logout`, {
            method: "POST",
            credentials: "same-origin"
        });
    } finally {
        window.location.href = "login.html";
    }
}


/* ================= EVENT LISTENERS ================= */

$("refreshRecords").addEventListener(
    "click",
    loadMaternalRecords
);

$("logoutButton").addEventListener("click", async (event) => {
    event.preventDefault();
    await logout();
});


/* ================= INITIAL LOAD ================= */

loadMaternalRecords();