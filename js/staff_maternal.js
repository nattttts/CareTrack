import { showToast } from "./popup_message.js";

const API_BASE = "http://localhost:3000/api/maternal-records";

const $ = (id) => document.getElementById(id);

let selectedPregnantWoman = null;
let maternalRecords = [];
let visitModal = null;

/* =====================================================
   HELPER FUNCTIONS
===================================================== */
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

/* =====================================================
   TOAST NOTIFICATIONS
===================================================== */
function showToastMessage(message, type = "info") {
    // Use the existing project toast function if available.
    if (typeof showToast === "function") {
        showToast(message, type);
        return;
    }

    // Fallback if the shared toast function is unavailable.
    showMessage(message, type === "success" ? "success" : "error");
}

function showMessage(message, type = "info") {
    const element = $("maternalMessage");

    element.textContent = message;
    element.className = `maternal-message ${type}`;
    element.hidden = false;
}

function clearMessage() {
    const element = $("maternalMessage");

    element.textContent = "";
    element.className = "maternal-message";
    element.hidden = true;
}

function showFormMessage(message, type = "error") {
    const element = $("visitFormMessage");

    element.textContent = message;
    element.className = `maternal-message ${type}`;
    element.hidden = false;
}

function clearFormMessage() {
    const element = $("visitFormMessage");

    element.textContent = "";
    element.className = "maternal-message";
    element.hidden = true;
}

function getList(result, keys) {
    if (Array.isArray(result)) {
        return result;
    }

    for (const key of keys) {
        if (Array.isArray(result?.[key])) {
            return result[key];
        }
    }

    return [];
}

function getPregnantWomanId(pregnantWoman) {
    return pregnantWoman?.pregnant_woman_id ?? pregnantWoman?.user_id ?? pregnantWoman?.id;
}

function getRecordId(record) {
    return record?.maternal_record_id ??
        record?.record_id ??
        record?.id;
}

function getVisitNumber(record) {
    return record?.visit_number ?? record?.visitNumber ?? "";
}

function getVisitDate(record) {
    return record?.visit_date ?? record?.visitDate ?? "";
}

function getHeight(record) {
    return record?.height ?? record?.height_cm ?? null;
}

function getWeight(record) {
    return record?.weight ?? record?.weight_kg ?? null;
}

function getRemarks(record) {
    return record?.doctor_remarks ?? record?.remarks ?? "";
}

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

/* =====================================================
   API REQUEST
===================================================== */
async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        headers: {
            ...(options.body
                ? { "Content-Type": "application/json" }
                : {}),
            ...(options.headers || {})
        }
    });

    if (response.status === 401) {
        window.location.href = "login.html";
        throw new Error("Your session has expired. Please log in again.");
    }

    if (response.status === 403) {
        throw new Error(
            "You do not have permission to manage maternal records."
        );
    }

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            result.message || "The request could not be completed."
        );
    }

    return result;
}


/* =====================================================
   SEARCH PREGNANT WOMAN
===================================================== */
async function searchPregnantWoman() {
    clearMessage();

    const searchInput = $("pregnantWomanSearch");
    const searchButton = $("searchPregnantWomanButton");
    const keyword = searchInput.value.trim();

    if (!keyword) {
        showMessage(
            "Please enter the pregnant woman's name or IC number.",
            "error"
        );
        searchInput.focus();
        return;
    }

    searchButton.disabled = true;
    searchButton.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>Searching...';

    $("pregnantWomanDetailsCard").hidden = true;
    selectedPregnantWoman = null;
    maternalRecords = [];

    const normalize = value =>
        String(value ?? "")
            .toLowerCase()
            .replace(/[\s-]/g, "");

    try {
        const response = await apiRequest(
            `${API_BASE}/pregnant-women?search=${encodeURIComponent(keyword)}`
        );

        // Support different API response formats.
        let pregnantWomen = Array.isArray(response)
            ? response
            : response.pregnantWomen ??
              response.results ??
              response.data ??
              [];

        // If the API returns an object containing another array.
        if (!Array.isArray(pregnantWomen)) {
            pregnantWomen = pregnantWomen.pregnantWomen ?? pregnantWomen.results ?? [];
        }

        const searchName = keyword.toLowerCase();
        const searchIC = normalize(keyword);

        // Filter locally as well, so partial name and IC searches work.
        const matches = pregnantWomen.filter(pregnantWoman => {
            const name = String(
                pregnantWoman.full_name ?? pregnantWoman.name ?? ""
            ).toLowerCase();

            const ic = normalize(
                pregnantWoman.user_id ??
                pregnantWoman.ic_number ??
                pregnantWoman.ic ??
                pregnantWoman.identification_number ??
                ""
            );

            return name.includes(searchName) ||
                   ic.includes(searchIC);
        });

        if (matches.length === 0) {
            showMessage(
                "No pregnant woman found. Please check the name or IC number.",
                "error"
            );
            return;
        }

        if (matches.length > 1) {
            showMessage(
                "Multiple pregnant women found. Please enter a more specific name or IC number.",
                "error"
            );
            return;
        }

        await selectPregnantWoman(matches[0]);

    } catch (error) {
        console.error("Search pregnant woman error:", error);

        showMessage(
            error.message || "Unable to search for the pregnant woman. Please try again.",
            "error"
        );

    } finally {
        searchButton.disabled = false;
        searchButton.innerHTML =
            '<i class="bi bi-search"></i> Search';
    }
}

/* =====================================================
   SELECT PREGNANT WOMAN
===================================================== */
async function selectPregnantWoman(pregnantWoman) {
    const pregnantWomanId = getPregnantWomanId(pregnantWoman);

    if (pregnantWomanId == null) {
        showMessage(
            "The pregnant woman information returned by the server is missing an ID.",
            "error"
        );
        return;
    }

    selectedPregnantWoman = pregnantWoman;

    $("pregnantWomanName").textContent =
        pregnantWoman.full_name ?? pregnantWoman.name ?? "Pregnant Woman";

    $("pregnantWomanIC").textContent =
    `IC Number: ${pregnantWoman.user_id ?? "Not provided"}`;

    $("formPregnantWomanName").textContent =
        pregnantWoman.full_name ?? pregnantWoman.name ?? "Pregnant Woman";

    $("pregnantWomanDetailsCard").hidden = false;

    await loadMaternalRecords(pregnantWomanId);
}

/* =====================================================
   LOAD MATERNAL RECORDS
===================================================== */
async function loadMaternalRecords(pregnantWomanId) {
    const tbody = $("maternalRecordsTableBody");

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="empty-cell">
                <span class="spinner-border spinner-border-sm me-2"></span>
                Loading maternal records...
            </td>
        </tr>
    `;

    $("noMaternalRecords").hidden = true;

    try {
        const result = await apiRequest(
            `${API_BASE}/pregnant-women/${encodeURIComponent(pregnantWomanId)}/visits`
        );

        maternalRecords = getList(result, [
            "visits",
            "records",
            "data"
        ]);

        maternalRecords.sort((a, b) => {
            const numberA = Number(getVisitNumber(a)) || 0;
            const numberB = Number(getVisitNumber(b)) || 0;

            return numberA - numberB;
        });

        renderMaternalRecords();

    } catch (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-cell">
                    Unable to load maternal records.
                </td>
            </tr>
        `;

        $("recordCount").textContent = "Unavailable";
        $("maternalRecordSummary").textContent = "Unable to load records";

        showMessage(error.message, "error");
    }
}

/* =====================================================
   DISPLAY MATERNAL RECORDS
===================================================== */
function renderMaternalRecords() {
    const tbody = $("maternalRecordsTableBody");

    $("recordCount").textContent =
        `${maternalRecords.length} ${maternalRecords.length === 1 ? "Visit" : "Visits"}`;

    $("maternalRecordSummary").textContent =
        `Showing ${maternalRecords.length} maternal ${maternalRecords.length === 1 ? "record" : "records"}`;

    $("noMaternalRecords").hidden = maternalRecords.length !== 0;

    if (maternalRecords.length === 0) {
        tbody.innerHTML = "";
        return;
    }

    tbody.innerHTML = maternalRecords.map(record => {
        const recordId = getRecordId(record);

        const visitNumber = getVisitNumber(record);
        const visitDate = getVisitDate(record);
        const height = getHeight(record);
        const weight = getWeight(record);
        const remarks = getRemarks(record);

        const systolic = record.systolic;
        const diastolic = record.diastolic;

        const bloodPressure =
            systolic != null && diastolic != null
                ? `${systolic}/${diastolic} mmHg`
                : "-";

        const urineTest = record.urine_test;
        const bloodTest = record.blood_test;

        return `
            <tr>
                <td>
                    <span class="visit-label">
                        Visit ${escapeHTML(visitNumber || "-")}
                    </span>
                </td>

                <td>${formatDate(visitDate)}</td>

                <td>${escapeHTML(bloodPressure)}</td>

                <td>${escapeHTML(height ?? "-")}</td>

                <td>${escapeHTML(weight ?? "-")}</td>

                <td>${escapeHTML(urineTest || "-")}</td>

                <td>${escapeHTML(bloodTest || "-")}</td>

                <td class="remarks-cell">${escapeHTML(remarks || "-")}</td>

                <td>
                    <button
                        type="button"
                        class="edit-visit-button"
                        data-edit-id="${escapeHTML(recordId ?? "")}"
                    >
                        <i class="bi bi-pencil-square"></i>
                        Edit
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

/* =====================================================
   OPEN ADD VISIT MODAL
===================================================== */
function openAddVisitModal() {
    if (!selectedPregnantWoman) {
        showMessage("Please search for a pregnant woman first.", "error");
        return;
    }

    $("maternalVisitForm").reset();

    $("maternalVisitModalLabel").textContent = "Add Maternal Visit";
    $("visitModalSubtitle").textContent =
        "Enter the pregnant woman's visit information.";

    $("saveVisitButton").innerHTML =
        '<i class="bi bi-check-circle"></i> Save Visit';

    $("formPregnantWomanName").textContent =
        selectedPregnantWoman.full_name ?? selectedPregnantWoman.name ?? "Pregnant Woman";

    const latestVisitNumber = maternalRecords.reduce((max, record) => {
        return Math.max(max, Number(getVisitNumber(record)) || 0);
    }, 0);

    $("visitNumber").value = latestVisitNumber + 1;
    $("visitDate").value = getLocalDateString();

    clearFormMessage();

    visitModal.show();
}

/* =====================================================
   OPEN EDIT VISIT MODAL
===================================================== */
function openEditVisitModal(recordId) {
    const record = maternalRecords.find(item =>
        String(getRecordId(item)) === String(recordId)
    );

    if (!record) {
        showMessage("The selected maternal visit could not be found.", "error");
        return;
    }

    $("maternalVisitForm").reset();

    $("maternalVisitModalLabel").textContent = "Edit Maternal Visit";
    $("visitModalSubtitle").textContent =
        "Update the information for this maternal visit.";

    $("saveVisitButton").innerHTML =
        '<i class="bi bi-check-circle"></i> Save Changes';

    $("formPregnantWomanName").textContent =
        selectedPregnantWoman.full_name ?? selectedPregnantWoman.name ?? "Pregnant Woman";

    $("visitNumber").value = getVisitNumber(record);

    $("visitDate").value =
        String(getVisitDate(record)).slice(0, 10);

    $("visitHeight").value = getHeight(record) ?? "";
    $("visitWeight").value = getWeight(record) ?? "";
    $("systolic").value = record.systolic ?? "";
    $("diastolic").value = record.diastolic ?? "";
    $("urineTest").value = record.urine_test ?? "";
    $("bloodTest").value = record.blood_test ?? "";
    $("doctorRemarks").value = getRemarks(record);

    // Store the selected record ID on the form.
    $("maternalVisitForm").dataset.recordId = String(recordId);

    clearFormMessage();

    visitModal.show();
}

/* =====================================================
   LOCAL DATE
===================================================== */
function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

/* =====================================================
   VALIDATE AND SAVE VISIT
===================================================== */
async function saveMaternalVisit(event) {
    event.preventDefault();
    clearFormMessage();

    if (!selectedPregnantWoman) {
        showFormMessage("Please select a pregnant woman first.");
        return;
    }

    const pregnantWomanId = getPregnantWomanId(selectedPregnantWoman);
    const form = $("maternalVisitForm");
    const recordId = form.dataset.recordId || "";

    const visitNumber = Number($("visitNumber").value);
    const visitDate = $("visitDate").value;

    const heightInput = $("visitHeight").value.trim();
    const weightInput = $("visitWeight").value.trim();

    const height = heightInput === "" ? null : Number(heightInput);
    const weight = weightInput === "" ? null : Number(weightInput);

    if (!Number.isInteger(visitNumber) || visitNumber < 1) {
        showFormMessage("Visit number must be a positive whole number.");
        return;
    }

    if (!visitDate) {
        showFormMessage("Please select the visit date.");
        return;
    }

    if (visitDate > getLocalDateString()) {
        showFormMessage("Visit date cannot be in the future.");
        return;
    }

    if (
        height !== null &&
        (!Number.isFinite(height) || height <= 0 || height > 300)
    ) {
        showFormMessage("Please enter a valid height in centimetres.");
        return;
    }

    if (
        weight !== null &&
        (!Number.isFinite(weight) || weight <= 0 || weight > 500)
    ) {
        showFormMessage("Please enter a valid weight in kilograms.");
        return;
    }

    // Prevent duplicate visit numbers within this pregnant woman's history.
    const duplicateVisit = maternalRecords.some(record => {
        const sameNumber = Number(getVisitNumber(record)) === visitNumber;
        const sameRecord = recordId &&
            String(getRecordId(record)) === String(recordId);

        return sameNumber && !sameRecord;
    });

    if (duplicateVisit) {
        showFormMessage(
            "This visit number already exists. Please use a different visit number."
        );
        return;
    }

    const payload = {
        pregnant_woman_id: pregnantWomanId,
        visit_number: visitNumber,
        visit_date: visitDate,
        height,
        weight,

        systolic: $("systolic").value
            ? Number($("systolic").value)
            : null,

        diastolic: $("diastolic").value
            ? Number($("diastolic").value)
            : null,

        urine_test: $("urineTest").value.trim(),
        blood_test: $("bloodTest").value.trim(),

        doctor_remarks: $("doctorRemarks").value.trim()
    };

    const saveButton = $("saveVisitButton");

    saveButton.disabled = true;
    saveButton.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    try {
        const url = recordId
            ? `${API_BASE}/visits/${encodeURIComponent(recordId)}`
            : `${API_BASE}/visits`;

        await apiRequest(url, {
            method: recordId ? "PUT" : "POST",
            body: JSON.stringify(payload)
        });

        // Clear the edit ID after a successful save.
        delete form.dataset.recordId;

        visitModal.hide();

        await loadMaternalRecords(pregnantWomanId);

        showToastMessage(
            recordId
                ? "Maternal visit updated successfully."
                : "Maternal visit added successfully.",
            "success"
        );

    } catch (error) {
        showToastMessage(error.message, "error");
    } finally {
        saveButton.disabled = false;

        saveButton.innerHTML = recordId
            ? '<i class="bi bi-check-circle"></i> Save Changes'
            : '<i class="bi bi-check-circle"></i> Save Visit';
    }
}

/* =====================================================
   EVENT LISTENERS
===================================================== */
function initializeMaternalRecordPage() {
    const searchButton = $("searchPregnantWomanButton");
    const pregnantWomanSearch = $("pregnantWomanSearch");
    const form = $("maternalVisitForm");
    const recordsBody = $("maternalRecordsTableBody");
    const modalElement = $("maternalVisitModal");

    // Check that the required HTML elements exist.
    if (!recordsBody || !modalElement || !form) {
        console.error("Maternal record page: required HTML elements are missing.");
        return;
    }

    // Initialise the Bootstrap modal safely.
    if (typeof bootstrap === "undefined" || !bootstrap.Modal) {
        console.error(
            "Bootstrap JavaScript is missing. The edit modal cannot open."
        );
        return;
    }

    visitModal = bootstrap.Modal.getOrCreateInstance(modalElement);

    if (searchButton) {
        searchButton.addEventListener("click", searchPregnantWoman);
    }

    const addVisitButton = $("addVisitButton");

    if (addVisitButton) {
        addVisitButton.addEventListener("click", openAddVisitModal);
    }

    if (pregnantWomanSearch) {
        pregnantWomanSearch.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                searchPregnantWoman();
            }
        });
    }

    form.addEventListener("submit", saveMaternalVisit);

    // Handle Edit clicks, including clicks directly on the pencil icon.
    recordsBody.addEventListener("click", event => {
        const button = event.target.closest("button[data-edit-id]");

        if (!button || !recordsBody.contains(button)) {
            return;
        }

        event.preventDefault();

        const recordId = button.dataset.editId;

        if (!recordId) {
            showMessage(
                "This record is missing its ID. Please refresh the page.",
                "error"
            );
            return;
        }

        try {
            openEditVisitModal(recordId);
        } catch (error) {
            console.error("Unable to open maternal record for editing:", error);

            showMessage(
                "Unable to open the edit form. Please check the browser console.",
                "error"
            );
        }
    });

    modalElement.addEventListener("hidden.bs.modal", () => {
        delete form.dataset.recordId;
        form.reset();
        clearFormMessage();
    });

    console.log("Maternal record page event listeners initialised.");
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeMaternalRecordPage,
        { once: true }
    );
} else {
    initializeMaternalRecordPage();
}