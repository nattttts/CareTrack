
const form = document.getElementById("resetPasswordForm");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const submitButton = document.getElementById("submitButton");
const messageElement = document.getElementById("message");

const resetPasswordSection = document.getElementById(
    "resetPasswordSection"
);

const resetPasswordSuccessSection = document.getElementById(
    "resetPasswordSuccessSection"
);

// Read the password reset token from the URL when the page first opens
const urlParams = new URLSearchParams(window.location.search);
const resetToken = urlParams.get("token");

// Remove the token from the address bar after reading it
// The token remains in this JavaScript variable for this page session
window.history.replaceState({}, document.title, window.location.pathname);

function showMessage(message, type) {
    messageElement.textContent = message;
    messageElement.className = type;
}

// If there is no token, the user cannot submit the form
if (!resetToken) {
    showMessage(
        "This password reset link is missing or invalid. Please request a new link.",
        "error"
    );

    submitButton.disabled = true;
}

// Toggle password visibility
document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.target);
        const icon = button.querySelector("i");

        const isPasswordHidden = input.type === "password";

        input.type = isPasswordHidden ? "text" : "password";

        button.setAttribute("aria-pressed", String(isPasswordHidden));
        button.setAttribute(
            "aria-label",
            isPasswordHidden ? "Hide password" : "Show password"
        );

        icon.classList.toggle("bi-eye", !isPasswordHidden);
        icon.classList.toggle("bi-eye-slash", isPasswordHidden);
    });
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Check that both password fields match before calling the API
    if (password !== confirmPassword) {
        showMessage("The passwords do not match.", "error");
        confirmPasswordInput.focus();
        return;
    }

    if (password.length < 12 || password.length > 128) {
        showMessage(
            "Your password must be between 12 and 128 characters.",
            "error"
        );
        passwordInput.focus();
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Resetting Password...";
    showMessage("", "");

    try {
        // Send the reset token and new password to the backend
        const response = await fetch("/api/reset-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token: resetToken,
                password,
                confirmPassword
            })
        });

        const result = await response.json();

        if (!response.ok) {
            showMessage(
                result.message || "Unable to reset your password.",
                "error"
            );
            return;
        }

        // Clear the password fields after successful submission
        form.reset();

        // Hide the form and display the success section
        resetPasswordSection.hidden = true;
        resetPasswordSuccessSection.hidden = false;

    } catch (error) {
        console.error("Password reset request failed:", error);

        showMessage(
            "Could not connect to CareTrack. Please try again.",
            "error"
        );
    } finally {
        // Re-enable the button only if the form is still visible
        if (!resetPasswordSection.hidden) {
            submitButton.disabled = false;
            submitButton.textContent = "Reset Password";
        }
    }
});