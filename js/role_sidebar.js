async function setupRoleSidebar() {
    try {
        const response = await fetch("/api/me", {
            credentials: "same-origin"
        });

        if (response.status === 401) {
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to check user role.");
        }

        const user = await response.json();

        const vaccinationLink =
            document.getElementById("childVaccinationLink");

        const maternalLink =
            document.getElementById("maternalRecordsLink");

        // Only child accounts can see Vaccinations
        if (vaccinationLink) {
            vaccinationLink.hidden = user.role !== "child";
        }

        // Only mother accounts can see Maternal Records
        if (maternalLink) {
            maternalLink.hidden = user.role !== "mother";
        }

    } catch (error) {
        console.error("Sidebar error:", error);
    }
}

setupRoleSidebar();