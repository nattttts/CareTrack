async function loadUserInfo() {
    const userName = document.getElementById("userName");

    // Stop if this page does not use the shared header.
    if (!userName) {
        return;
    }

    try {
        const response = await fetch("/api/me");

        if (!response.ok) {
            throw new Error("Failed to retrieve user information.");
        }

        const user = await response.json();

        userName.textContent = user.fullName;

    } catch (error) {
        console.error("Load user information error:", error);
        userName.textContent = "User";
    }
}

loadUserInfo();
