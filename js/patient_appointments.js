// Get all tabs and appointment sections
const tabs = document.querySelectorAll(".appointment-tab");
const sections = document.querySelectorAll(".appointment-section");

// Function to show a specific section
function showSection(sectionId) {

    // Hide all sections
    sections.forEach(section => {
        section.style.display = "none";
    });

    // Remove active state from all tabs
    tabs.forEach(tab => {
        tab.classList.remove("active");
    });

    // Show selected section
    const selectedSection = document.getElementById(sectionId);

    if (selectedSection) {
        selectedSection.style.display = "block";
    }

    // Make corresponding tab active
    const selectedTab = document.querySelector(
        `.appointment-tab[href="#${sectionId}"]`
    );

    if (selectedTab) {
        selectedTab.classList.add("active");
    }
}


// Add click event to each tab
tabs.forEach(tab => {

    tab.addEventListener("click", function(event) {

        event.preventDefault();

        const sectionId = this.getAttribute("href").substring(1);

        showSection(sectionId);

    });

});


// Show Upcoming by default
showSection("upcoming");