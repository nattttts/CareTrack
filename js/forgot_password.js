
const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const userIdInput = document.getElementById("userId");
const submitButton = document.getElementById("submitButton");
const message = document.getElementById("message");

const forgotPasswordSection = document.getElementById("forgotPasswordSection");
const confirmationSection = document.getElementById("confirmationSection");

// Handle the forgot password form submission
forgotPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Get the IC Number or MyKid Number
    const userId = userIdInput.value.trim();

    if (!userId) {
        message.textContent = "Please enter your IC Number or MyKid Number.";
        return;
    }

    // Prevent repeated submissions
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
    message.textContent = "";

    try {
        const response = await fetch("/api/forgot-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ userId })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Unable to process your request. Please try again."
            );
        }

        // Show the same confirmation message regardless of whether
        // the account exists, to protect account privacy.
        forgotPasswordSection.hidden = true;
        confirmationSection.hidden = false;

    } catch (error) {
        console.error("Forgot password error:", error);

        message.textContent =
            "Unable to process your request right now. Please try again.";

        submitButton.disabled = false;
        submitButton.textContent = "Send Reset Link";
    }
});