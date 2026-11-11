import { showToast } from "./popup_message.js";

const loginForm = document.getElementById("loginForm");

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

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const icNumber = document.getElementById("icNumber").value.trim();
    const password = document.getElementById("password").value;
    const loginButton = loginForm.querySelector('button[type="submit"]');

    loginButton.disabled = true;

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
                icNumber,
                password
            })
        });

        const result = await response.json();

        if (!response.ok) {
            showToast(result.message || "Login failed. Please try again.", "error");
            return;
        }

        const dashboardPages = {
            admin: "staff_management.html",
            staff: "staff_dashboard.html",
            pregnant_woman: "patient_dashboard.html",
            child: "patient_dashboard.html"
        };

        const targetPage = dashboardPages[result.role];

        if (!targetPage) {
            showToast("Unable to determine your dashboard.", "error");
            return;
        }

        window.location.href = targetPage;
    } catch (error) {
        console.error("Login error:", error);
        showToast("Unable to connect to the server. Please try again.", "error");
    } finally {
        loginButton.disabled = false;
    }
});