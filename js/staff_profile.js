function showProfileToast(message, type = "success") {
    const toastElement = document.getElementById("profileToast");
    const messageElement = document.getElementById("profileToastMessage");

    if (!toastElement || !messageElement) {
        console.error("Toast HTML elements not found.");
        return;
    }

    if (typeof bootstrap === "undefined" || !bootstrap.Toast) {
        console.error("Bootstrap JavaScript is not loaded.");
        alert(message);
        return;
    }

    messageElement.textContent = message;

    toastElement.classList.remove("text-bg-success", "text-bg-danger");
    toastElement.classList.add(
        type === "error" ? "text-bg-danger" : "text-bg-success"
    );

    bootstrap.Toast.getOrCreateInstance(toastElement, {
        delay: 3000,
        autohide: true
    }).show();
}

const API_BASE = "http://localhost:3000/api";

document.addEventListener("DOMContentLoaded", () => {
    loadStaffProfile();
});

/* =========================
   LOAD STAFF PROFILE
========================= */
async function loadStaffProfile() {

    try {
        const response = await fetch(`${API_BASE}/me`, {
            method: "GET",
            credentials: "same-origin"
        });

        if (response.status === 401) {
            window.location.href = "login.html";
            return;
        }

        const user = await response.json();

        console.log("Logged-in staff profile:", user);

        if (!response.ok) {
            throw new Error(user.message || "Unable to load staff profile.");
        }

        if (user.role !== "staff") {
            alert("You are not authorised to view this profile.");
            window.location.href = "login.html";
            return;
        }

        // Header name
        setText("userName", user.fullName);
        setText("profileName", user.fullName);

        // Professional information
        setText("nameText", user.fullName);
        setText("roleText", "Healthcare Staff");

        // Display the logged-in staff member's IC number
        const staffIC = user.user_id ?? user.userId ?? user.staffId;

        setText("staffIdText", staffIC || "Not available");
        setValue("staffIdInput", staffIC || "");

        setText("phoneText", user.phoneNo);
        setText("emailText", user.email);

        // Populate inputs
        setValue("nameInput", user.fullName);
        setValue("roleInput", "Healthcare Staff");
        setValue("phoneInput", user.phoneNo);
        setValue("emailInput", user.email);

        // Account information
        const statusElement = document.querySelector(".account-status");

        if (statusElement) {
            statusElement.textContent = user.accountStatus || "Unknown";
        }

        const accountRows = document.querySelectorAll(
            ".account-information .account-row"
        );

        // Member Since
        if (accountRows[1]) {
            const memberSince = accountRows[1].querySelector("strong");

            if (memberSince) {
                memberSince.textContent = formatDate(user.createdAt);
            }
        }

        // Last Updated: no updated_at field is returned by /api/me.
        // Do not display a fabricated update date.
        if (accountRows[2]) {
            const lastUpdated = accountRows[2].querySelector("strong");

            if (lastUpdated) {
                lastUpdated.textContent = "Not available";
            }
        }

    } catch (error) {
        console.error("Error loading staff profile:", error);
        alert(error.message || "Unable to load staff profile.");
    }
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value ?? "";
    }
}

function setValue(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.value = value ?? "";
    }
}

function formatDate(value) {
    if (!value) return "Not available";

    // Handle SQLite date/time strings
    const date = new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? `${value}T00:00:00`
            : value
    );

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });
}

/* =========================
   RESET PASSWORD
========================= */
async function resetPassword() {
    const currentPassword = prompt("Please enter your current password:");
    if (currentPassword === null) return;

    if (!currentPassword.trim()) {
        showProfileToast("Please enter your current password.", "error");
        return;
    }

    const newPassword = prompt("Please enter your new password:");
    if (newPassword === null) return;

    if (newPassword.length < 8) {
        showProfileToast(
            "Your new password must contain at least 8 characters.",
            "error"
        );
        return;
    }

    if (currentPassword === newPassword) {
        showProfileToast(
            "Your new password must differ from your current password.",
            "error"
        );
        return;
    }

    const confirmPassword = prompt("Please confirm your new password:");
    if (confirmPassword === null) return;

    if (newPassword !== confirmPassword) {
        showProfileToast("The new passwords do not match.", "error");
        return;
    }

    if (!confirm("Are you sure you want to reset your password?")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/me/change-password`, {
            method: "PATCH",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                currentPassword,
                newPassword,
                confirmPassword
            })
        });

        const responseText = await response.text();
        let result;

        try {
            result = JSON.parse(responseText);
        } catch {
            console.error("Server returned HTML instead of JSON:", responseText);
            showProfileToast(
                "Unable to reach the password API. Check your server route.",
                "error"
            );
            return;
        }

        if (response.status === 401) {
            showProfileToast("Your session has expired. Please log in again.", "error");
            setTimeout(() => {
                window.location.href = "login.html";
            }, 1500);
            return;
        }

        if (!response.ok) {
            showProfileToast(
                result.message || "Unable to reset your password.",
                "error"
            );
            return;
        }

        showProfileToast(
            result.message || "Your password has been changed successfully!"
        );

    } catch (error) {
        console.error("Password reset error:", error);
        showProfileToast(
            "Cannot connect to the server. Please try again.",
            "error"
        );
    }
}