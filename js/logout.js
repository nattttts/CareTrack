document.getElementById("logoutButton").addEventListener("click", async (event) => {
    event.preventDefault();

    try {
        const response = await fetch("/api/logout", {
            method: "POST"
        });

        if (!response.ok) {
            throw new Error("Logout failed.");
        }

        window.location.replace("/login.html");

    } catch (error) {
        console.error("Logout error:", error);
        alert("Unable to log out. Please try again.");
    }
});
