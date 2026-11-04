/* ========================================
   SHOW TOAST NOTIFICATION
======================================== */
function showProfileToast(message, type = "success") {
    const toastElement = document.getElementById("profileToast");
    const messageElement = document.getElementById("profileToastMessage");

    if (!toastElement || !messageElement) {
        console.warn("Toast element not found:", message);
        return;
    }

    messageElement.textContent = message;

    toastElement.classList.toggle("toast-error", type === "error");

    const toast = bootstrap.Toast.getOrCreateInstance(toastElement, {
        delay: 3000,
        autohide: true
    });

    toast.show();
}

/* ========================================
   LOAD LOGGED-IN ACCOUNT
======================================== */
async function loadLoggedInProfile() {
    try {
        const response = await fetch("/api/me", {
            method: "GET",
            credentials: "same-origin",
            headers: {
                Accept: "application/json"
            }
        });

        if (response.status === 401) {
            window.location.href = "login.html";
            return;
        }

        const user = await response.json();

        if (!response.ok) {
            throw new Error(user.message || "Unable to load profile.");
        }

        const role = String(user.role || "")
            .trim()
            .toLowerCase();

        const isChild = role === "child";
        const isMother = role === "mother";

        if (!isChild && !isMother) {
            throw new Error("Unsupported account role.");
        }

        const fullName =
            user.fullName ?? user.full_name ?? user.name ?? "";

        const userId =
            user.userId ?? user.user_id ?? user.icNo ?? user.ic_no ?? "";

        const phone =
            user.phoneNo ?? user.phone_no ?? user.phone ?? "";

        const email = user.email ?? "";

        const dob =
            user.dateOfBirth ?? user.date_of_birth ?? user.dob ?? "";

        const gender =
            user.gender ?? user.sex ?? "";

        const address =
            user.address ?? user.homeAddress ?? user.home_address ?? "";

        /* ========================================
           PROFILE HEADER
        ======================================== */
        const headerName = document.getElementById("userName");
        const profileName = document.getElementById("profileName");
        const roleLabel = document.getElementById("userRole");

        if (headerName) headerName.textContent = fullName;
        if (profileName) profileName.textContent = fullName;

        if (roleLabel) {
            roleLabel.textContent =
                role.charAt(0).toUpperCase() + role.slice(1);
        }

        /* ========================================
           PERSONAL INFORMATION
        ======================================== */
        setProfileField("nameText", "nameInput", fullName);
        setProfileField("nricText", "nricInput", userId);
        setProfileField("phoneText", "phoneInput", phone);
        setProfileField("emailText", "emailInput", email);
        setProfileField("dobText", "dobInput", dob);

        const dobText = document.getElementById("dobText");

        if (dobText) {
            dobText.textContent = dob
                ? formatProfileDate(dob)
                : "Not available";
        }

        // Hide the personal phone number for child accounts.
        // The mother's phone number is displayed in Emergency Contact.
        const phoneItem = document.getElementById("phoneItem");

        if (phoneItem) {
            phoneItem.style.display = isChild ? "none" : "";
        }

        /* ========================================
           ADDRESS / GENDER
        ======================================== */
        const addressItem = document.getElementById("addressItem");
        const addressLabel = document.getElementById("addressLabel");
        const addressText = document.getElementById("addressText");
        const addressInput = document.getElementById("addressInput");
        const addressGenderIcon =
            document.getElementById("addressGenderIcon");

        if (addressItem) {
            addressItem.style.display = "";
        }

        if (isChild) {
            // Child profile displays Gender instead of Address.
            if (addressLabel) {
                addressLabel.textContent = "Gender";
            }

            if (addressText) {
                addressText.textContent = gender || "Not available";
            }

            if (addressGenderIcon) {
                addressGenderIcon.src = "../icons/gender.png";
                addressGenderIcon.alt = "Gender";
            }

            if (addressInput) {
                addressInput.value = gender;
                addressInput.style.display = "none";
                addressInput.readOnly = true;
            }

            const editButton = document.getElementById("editButton");
            const resetPasswordButton =
                document.getElementById("resetPassword");

            // Children cannot edit their personal information,
            // but they can reset their own password.
            if (editButton) {
                editButton.style.display = "none";
            }

            if (resetPasswordButton) {
                resetPasswordButton.style.display = "";
            }
        } else {
            // Mother profile displays Address instead of Gender.
            if (addressLabel) {
                addressLabel.textContent = "Address";
            }

            if (addressText) {
                addressText.textContent = address || "Not available";
            }

            if (addressGenderIcon) {
                addressGenderIcon.src = "../icons/location.png";
                addressGenderIcon.alt = "Address";
            }

            if (addressInput) {
                addressInput.value = address;
                addressInput.style.display = "";
                addressInput.readOnly = false;
            }

            const editButton = document.getElementById("editButton");
            const resetPasswordButton =
                document.getElementById("resetPassword");

            if (editButton) editButton.style.display = "";
            if (resetPasswordButton) {
                resetPasswordButton.style.display = "";
            }
        }

        /* ========================================
           EMERGENCY CONTACT
        ======================================== */
        const emergencyCard =
            document.getElementById("emergencyContactCard");

        const emergencyEditButton =
            document.getElementById("emergencyEditButton");

        const emergencyDescription =
            document.getElementById("emergencyContactDescription");

        const relationshipItem =
            document.getElementById("relationshipItem");

        const emergencyEmailItem =
            document.getElementById("emergencyEmailItem");

        const emergencyNameLabel =
            document.getElementById("emergencyNameLabel");

        // Explicitly display the card for both supported roles.
        if (emergencyCard) {
            emergencyCard.style.display = "block";
        }

        if (isMother) {
            if (emergencyDescription) {
                emergencyDescription.textContent =
                    "Person to contact in case of emergency";
            }

            // Keep the mother's existing emergency contact fields.
            if (relationshipItem) relationshipItem.style.display = "";
            if (emergencyEmailItem) emergencyEmailItem.style.display = "none";

            if (emergencyNameLabel) {
                emergencyNameLabel.textContent = "Name";
            }

            setProfileField(
                "emergencyNameText",
                "emergencyNameInput",
                user.contactName ??
                user.contact_name ??
                user.emergencyName ??
                user.emergency_name
            );

            setProfileField(
                "relationshipText",
                "relationshipInput",
                user.relationship ??
                user.contactRelationship ??
                user.contact_relationship
            );

            setProfileField(
                "emergencyPhoneText",
                "emergencyPhoneInput",
                user.contactPhoneNo ??
                user.contact_phone_no ??
                user.contactPhone ??
                user.contact_phone ??
                user.emergencyPhone ??
                user.emergency_phone
            );

            if (emergencyEditButton) {
                emergencyEditButton.style.display = "";
            }

            setEmergencyInputsReadOnly(false);

        } else {
            // Child sees the linked mother's contact details.
            if (emergencyDescription) {
                emergencyDescription.textContent =
                    "Your registered guardian's contact details"
            }

            if (emergencyEditButton) {
                emergencyEditButton.style.display = "none";
            }

            // Child sees the mother's name, phone number and email only.
            if (relationshipItem) relationshipItem.style.display = "none";
            if (emergencyEmailItem) emergencyEmailItem.style.display = "";

            if (emergencyNameLabel) {
                emergencyNameLabel.textContent = "Guardian Name";
            }

            setEmergencyInputsReadOnly(true);

            setProfileField(
                "emergencyNameText",
                "emergencyNameInput",
                "Loading..."
            );

            setProfileField(
                "relationshipText",
                "relationshipInput",
                "Mother"
            );

            setProfileField(
                "emergencyPhoneText",
                "emergencyPhoneInput",
                "Loading..."
            );

            await loadChildEmergencyContact();
        }

    } catch (error) {
        console.error("Profile loading error:", error);
        alert("Unable to load your profile. Please try again.");
    }
}

/* ========================================
   LOAD CHILD'S MOTHER EMERGENCY CONTACT
======================================== */
async function loadChildEmergencyContact() {
    try {
        const response = await fetch(
            "/api/patient/emergency-contact",
            {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    Accept: "application/json"
                }
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Unable to load guardian details."
            );
        }

        // Backend returns the information under "mother".
        const guardian = result.mother || {};

        setProfileField(
            "emergencyNameText",
            "emergencyNameInput",
            guardian.fullName
        );

        setProfileField(
            "emergencyPhoneText",
            "emergencyPhoneInput",
            guardian.phoneNo
        );

        setProfileField(
            "emergencyEmailText",
            "emergencyEmailInput",
            guardian.email
        );

        setEmergencyInputsReadOnly(true);

    } catch (error) {
        console.error("Child guardian contact error:", error);

        setProfileField(
            "emergencyNameText",
            "emergencyNameInput",
            "Not available"
        );

        setProfileField(
            "emergencyPhoneText",
            "emergencyPhoneInput",
            "Not available"
        );

        setProfileField(
            "emergencyEmailText",
            "emergencyEmailInput",
            "Not available"
        );

        setEmergencyInputsReadOnly(true);
    }
}

/* ========================================
   HELPER: EMERGENCY INPUT PERMISSIONS
======================================== */
function setEmergencyInputsReadOnly(readOnly) {
    [
        "emergencyNameInput",
        "relationshipInput",
        "emergencyPhoneInput",
        "emergencyEmailInput"
    ].forEach(id => {
        const input = document.getElementById(id);

        if (input) {
            input.readOnly = readOnly;
        }
    });
}

/* ========================================
   HELPER: SET PROFILE FIELD
======================================== */
function setProfileField(textId, inputId, value) {
    const textElement = document.getElementById(textId);
    const inputElement = document.getElementById(inputId);

    const hasValue =
        value !== null &&
        value !== undefined &&
        String(value).trim() !== "";

    const displayValue = hasValue
        ? String(value)
        : "Not available";

    if (textElement) {
        textElement.textContent = displayValue;
    }

    if (inputElement) {
        inputElement.value = hasValue ? String(value) : "";
    }
}

/* ========================================
   HELPER: FORMAT DATE
======================================== */
function formatProfileDate(dateValue) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
        String(dateValue || "")
    );

    if (match) {
        const [, year, month, day] = match;

        return new Date(
            Number(year),
            Number(month) - 1,
            Number(day)
        ).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });
    }

    return dateValue;
}

/* ========================================
   PAGE LOAD
======================================== */
document.addEventListener("DOMContentLoaded", loadLoggedInProfile);

/* ========================================
   RESET PASSWORD BUTTON
======================================== */
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
    } if (newPassword.length < 8) {
        alert("Your New Password MUST Contain At Least 8 CHARACTERS.");
        return;
    }if (currentPassword === newPassword) {
        alert("Your New Password MUST Be Different From Your Current Password.");
        return;
    }
    // Confirm the new password
    const confirmPassword = prompt("Please Confirm Your New Password:"); 

    if (confirmPassword === null) {
        return;
    }if (newPassword !== confirmPassword) {
        alert("The New Passwords DO NOT MATCH. Please Try Again.");
        return;
    }
    
    // Confirm the action
    const confirmReset = confirm("Are You Sure You Want To Reset Your Password?");

    if (!confirmReset) {
        return;
    }
    showProfileToast("Password reset successful!!!");
}

async function editProfile() {
    const card = document.getElementById("personalInformationCard");
    const button = document.getElementById("editButton");

    if (!card || !button) {
        console.error("Profile card or Edit button not found.");
        return;
    }

    // Enter edit mode.
    if (!card.classList.contains("editing")) {
        card.classList.add("editing");
        button.textContent = "✓ Save Changes";
        return;
    }

    const name = document.getElementById("nameInput").value.trim();
    const phone = document.getElementById("phoneInput").value.trim();
    const email = document.getElementById("emailInput").value.trim();
    const dob = document.getElementById("dobInput").value;
    const address = document.getElementById("addressInput").value.trim();

    if (!name || !phone || !email) {
        alert("Please fill in your name, phone number, and email.");
        return;
    }

    if (!document.getElementById("emailInput").checkValidity()) {
        alert("Please enter a valid email address.");
        return;
    }

    try {
        button.disabled = true;
        button.textContent = "Saving...";

        const response = await fetch("http://localhost:3000/api/me", {
            method: "PUT",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                fullName: name,
                phoneNo: phone,
                email: email,
                dateOfBirth: dob,
                address: address
            })
        });

        // Read response safely, even if the server returns HTML.
        const responseText = await response.text();
        let result;

        try {
            result = JSON.parse(responseText);
        } catch {
            console.error("Non-JSON response:", responseText);

            throw new Error(
                `Backend returned HTML or invalid JSON (HTTP ${response.status}). ` +
                `Check whether PUT /api/me exists in server.js.`
            );
        }

        if (!response.ok) {
            throw new Error(result.message || `HTTP ${response.status}`);
        }

        document.getElementById("profileName").textContent = name;
        document.getElementById("userName").textContent = name;
        document.getElementById("nameText").textContent = name;
        document.getElementById("phoneText").textContent = phone;
        document.getElementById("emailText").textContent = email;
        document.getElementById("dobText").textContent =
            dob ? formatProfileDate(dob) : "Not available";
        document.getElementById("addressText").textContent =
            address || "Not available";

        card.classList.remove("editing");
        button.textContent = "✎ Edit Profile";

        showProfileToast("Profile updated successfully!!");

    } catch (error) {
        console.error("Profile save error:", error);
        showProfileToast(
            error.message || "Unable to save your profile.",
            "error"
        );
        button.textContent = "✓ Save Changes";
    } finally {
        button.disabled = false;
    }
}

async function editEmergency() {
    const card = document.getElementById("emergencyContactCard");
    const button = document.getElementById("emergencyEditButton");

    if (!card || !button) {
        console.error("Emergency contact card or button not found.");
        return;
    }

    // First click: enter edit mode.
    if (!card.classList.contains("editing")) {
        card.classList.add("editing");
        button.textContent = "✓ Save Changes";
        return;
    }

    const contactName =
        document.getElementById("emergencyNameInput").value.trim();

    const relationship =
        document.getElementById("relationshipInput").value.trim();

    const contactPhone =
        document.getElementById("emergencyPhoneInput").value.trim();

    if (!contactName || !relationship || !contactPhone) {
        alert("Please fill in all emergency contact fields.");
        return;
    }

    try {
        button.disabled = true;
        button.textContent = "Saving...";
        
        const response = await fetch("/api/mother/emergency-contact", {
            method: "PUT",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                contactName: document.getElementById("emergencyNameInput").value.trim(),
                relationship: document.getElementById("relationshipInput").value.trim(),
                contactPhone: document.getElementById("emergencyPhoneInput").value.trim()
            })
        });

        const responseText = await response.text();
            let result;

            try {
                result = JSON.parse(responseText);
            } catch {
                throw new Error(
                    `Invalid server response (HTTP ${response.status}). Check server.js.`
                );
            }

            if (!response.ok) {
                throw new Error(
                    result.message || "Unable to save emergency contact."
                );
            }

        setProfileField(
            "emergencyNameText",
            "emergencyNameInput",
            contactName
        );

        setProfileField(
            "relationshipText",
            "relationshipInput",
            relationship
        );

        setProfileField(
            "emergencyPhoneText",
            "emergencyPhoneInput",
            contactPhone
        );

        card.classList.remove("editing");
        button.textContent = "✎ Edit";

        showProfileToast("Emergency contact saved successfully!!");

    } catch (error) {
        console.error("Emergency contact save error:", error);
        showProfileToast(
            error.message || "Unable to save emergency contact.",
            "error"
        );

        button.textContent = "✓ Save Changes";
    } finally {
        button.disabled = false;
    }
}