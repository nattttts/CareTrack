function editProfile() {

    const card = document.querySelector(".profile-card");

    const button = document.getElementById("editButton");

    if (card.classList.contains("editing")) {

        // Get values from input boxes
        const name =
            document.getElementById("nameInput").value;

        const nric =
            document.getElementById("nricInput").value;

        const dobInput =
            document.getElementById("dobInput").value;

        const phone =
            document.getElementById("phoneInput").value;

        const email =
            document.getElementById("emailInput").value;

        const address =
            document.getElementById("addressInput").value;

        // Convert date into readable format
        let dob = dobInput;

        if (dobInput !== "") {

            const date = new Date(dobInput);

            dob = date.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "long",
                year: "numeric"
            });

        }

        // Update displayed information
        document.getElementById("profileName").textContent = name;

        document.getElementById("headerProfileName").textContent = name;

        document.getElementById("nameText").textContent = name;

        document.getElementById("nricText").textContent = nric;

        document.getElementById("dobText").textContent = dob;

        document.getElementById("phoneText").textContent = phone;

        document.getElementById("emailText").textContent = email;

        document.getElementById("addressText").textContent = address;


        // Leave edit mode
        card.classList.remove("editing");

        button.innerHTML = "✎ Edit Profile";

    }

    else {

        // Enter edit mode
        card.classList.add("editing");

        button.innerHTML = "✓ Save Changes";

    }

}

function editEmergency() {

    const emergencyCard =
        document.querySelectorAll(".profile-card")[1];

    const button =
        document.getElementById("emergencyEditButton");


    if (emergencyCard.classList.contains("editing")) {

        const name =
            document.getElementById("emergencyNameInput").value;

        const relationship =
            document.getElementById("relationshipInput").value;

        const phone =
            document.getElementById("emergencyPhoneInput").value;

        // Update displayed information
        document.getElementById("emergencyNameText")
            .textContent = name;

        document.getElementById("relationshipText")
            .textContent = relationship;

        document.getElementById("emergencyPhoneText")
            .textContent = phone;


        // Leave edit mode

        emergencyCard.classList.remove("editing");

        button.innerHTML = "✎ Edit";

    }

    else {
        // Enter edit mode
        emergencyCard.classList.add("editing");

        button.innerHTML = "✓ Save";

    }

}

function resetPassword() {

    // Ask for the current password
    const currentPassword = prompt("Please Enter Your Current Password: ");

    // User clicked Cancel
    if (currentPassword === null) {
        return;
    }

    if (currentPassword.trim() === "") {
        alert("Please Enter Your Current Password: ");
        return;
    }

    // Ask for the new password
    const newPassword = prompt("Please Enter Your New Password: ");

    if (newPassword === null) {
        return;
    }

    if (newPassword.length < 8) {
        alert("Your New Password MUST Contain At Least 8 CHARACTERS.");
        return;
    }

    // Confirm the new password
    const confirmPassword = prompt("Please Confirm Your New Password:");

    if (confirmPassword === null) {
        return;
    }

    if (newPassword !== confirmPassword) {
        alert("The New Passwords DO NOT MATCH. Please Try Again.");
        return;
    }

    if (currentPassword === newPassword) {
        alert("Your New Password MUST Be Different From Your Current Password.");
        return;
    }

    // Confirm the action
    const confirmReset = confirm("Are You Sure You Want To Reset Your Password?");

    if (!confirmReset) {
        return;
    }

    alert("Password Validation Successful !!!");

}