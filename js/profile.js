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