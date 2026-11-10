
const form = document.getElementById("setPasswordForm");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const submitButton = document.getElementById("submitButton");
const messageElement = document.getElementById("message");

const passwordSetupSection = document.getElementById(
    "passwordSetupSection"
);

const passwordSuccessSection = document.getElementById(
    "passwordSuccessSection"
);

// Read the invitation token from the URL when the page first opens
const urlParams = new URLSearchParams(window.location.search);
const invitationToken = urlParams.get("token");

// Remove the token from the address bar after reading it
// The token remains in this JavaScript variable for this page session
window.history.replaceState({}, document.title, window.location.pathname);

function showMessage(message, type) {
    messageElement.textContent = message;
    messageElement.className = type;
}

// If there is no token, the user cannot submit the form
if (!invitationToken) {
    showMessage(
        "This invitation link is missing or invalid. Please request a new invitation.",
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
    submitButton.textContent = "Setting Password...";
    showMessage("", "");

    try {
        // Send the invitation token and password to the backend
        const response = await fetch("/api/set-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token: invitationToken,
                password,
                confirmPassword
            })
        });

        const result = await response.json();

        if (!response.ok) {
            showMessage(
                result.message || "Unable to set your password.",
                "error"
            );
            return;
        }

        // Clear the password fields after successful submission
        form.reset();

        // Hide the form and display the success section
        passwordSetupSection.hidden = true;
        passwordSuccessSection.hidden = false;

    } catch (error) {
        console.error("Password setup request failed:", error);

        showMessage(
            "Could not connect to CareTrack. Please try again.",
            "error"
        );
    } finally {
        // Re-enable the button only if the form is still visible
        if (!passwordSetupSection.hidden) {
            submitButton.disabled = false;
            submitButton.textContent = "Set Password";
        }
    }
});
