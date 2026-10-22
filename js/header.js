async function loadUserInfo() {
    const userName = document.getElementById("userName");
    const welcomeMessage = document.getElementById("welcomeMessage");

    // Stop if this page does not use the shared header.
    if (!userName && !welcomeMessage) {
        return;
    }

    try {
        const response = await fetch("/api/me");

        if (!response.ok) {
            throw new Error("Failed to retrieve user information.");
        }

        const user = await response.json();

        if (userName) {
            userName.textContent = user.fullName;
        }

        if (welcomeMessage) {
            if (user.role === "mother" || user.role === "child") {
                welcomeMessage.textContent =
                    `Welcome back, ${user.fullName}. Here's an overview of your healthcare activities.`;
            } else {
                welcomeMessage.textContent =
                    `Welcome back, ${user.fullName}. Here's your clinic overview for today.`;
            }
        }

    } catch (error) {
        console.error("Load user information error:", error);

        if (userName) {
            userName.textContent = "User";
        }
    }
}

loadUserInfo();
