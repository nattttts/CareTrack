document.addEventListener("DOMContentLoaded", function () {

    // Sample information for each child
    const children = {
        emma: {
            name: "Emma Tan",
            gender: "Female",
            age: "3 years old",
            dob: "12 Jan 2022",
            ic: "220112-14-5678",
            motherName: "Jane Tan",
            motherContact: "0123456789",
            address: ""
        },

        ethan: {
            name: "Ethan Tan",
            gender: "Male",
            age: "2 years old",
            dob: "08 Jun 2023",
            ic: "230608-14-6789",
            motherName: "Jane Tan",
            motherContact: "0123456789",
            address: ""
        }
    };

    // Get HTML elements
    const childSelector = document.getElementById("childSelector");
    const profileName = document.getElementById("profileName");
    const form = document.getElementById("childProfileForm");
    const editButton = document.getElementById("editButton");
    const cancelButton = document.getElementById("cancelButton");
    const profileActions = document.getElementById("profileActions");
    const saveMessage = document.getElementById("saveMessage");

    const fields = {
        name: document.getElementById("childName"),
        gender: document.getElementById("childGender"),
        dob: document.getElementById("childDOB"),
        ic: document.getElementById("childIC"),
        motherName: document.getElementById("motherName"),
        motherContact: document.getElementById("motherContact"),
        address: document.getElementById("childAddress")
    };

    // Check that all required HTML elements exist
    if (
        !childSelector ||
        !profileName ||
        !form ||
        !editButton ||
        !cancelButton ||
        !profileActions ||
        !saveMessage ||
        Object.values(fields).some(field => !field)
    ) {
        console.error("Child Profile: HTML element IDs do not match child.js.");
        return;
    }

    let currentChildId = "";
    let originalChildData = null;
    let isEditing = false;
    let messageTimer;

    // Get the selected child
    function getCurrentChild() {
        return children[currentChildId];
    }

    // Display the child's information
    function fillForm(child) {
        if (!child) return;

        fields.name.value = child.name;
        fields.gender.value = child.gender;
        fields.dob.value = child.dob;
        fields.ic.value = child.ic;
        fields.motherName.value = child.motherName;
        fields.motherContact.value = child.motherContact;
        fields.address.value = child.address;

        profileName.textContent = child.name;
    }

    // Enable or disable editing
    function setEditing(editing) {
        isEditing = editing;

        fields.name.readOnly = !editing;
        fields.gender.disabled = !editing;
        fields.dob.readOnly = !editing;
        fields.ic.readOnly = !editing;
        fields.motherName.readOnly = !editing;
        fields.motherContact.readOnly = !editing;
        fields.address.readOnly = !editing;

        editButton.hidden = editing;
        profileActions.hidden = !editing;
        childSelector.disabled = editing;
    }

    // Show a message
    function showMessage(text, type = "success") {
        clearTimeout(messageTimer);

        saveMessage.textContent = text;
        saveMessage.className = "save-message";

        if (type === "error") {
            saveMessage.classList.add("error");
        }

        saveMessage.hidden = false;

        messageTimer = setTimeout(function () {
            saveMessage.hidden = true;
        }, 3000);
    }

    // Clear the message
    function clearMessage() {
        clearTimeout(messageTimer);
        saveMessage.hidden = true;
        saveMessage.textContent = "";
        saveMessage.className = "save-message";
    }

    // Load the selected child
    function loadSelectedChild() {
        currentChildId = childSelector.value;

        const child = getCurrentChild();

        if (!child) {
            console.error("Child information not found:", currentChildId);
            return;
        }

        fillForm(child);
        setEditing(false);
        clearMessage();
    }

    // Edit Profile button
    editButton.addEventListener("click", function () {
        originalChildData = { ...getCurrentChild() };

        clearMessage();
        setEditing(true);
        fields.name.focus();
    });

    // Save Changes button
    form.addEventListener("submit", function (event) {
        event.preventDefault();

        if (!isEditing) return;

        if (!form.reportValidity()) return;

        const updatedChild = {
            name: fields.name.value.trim(),
            gender: fields.gender.value,
            dob: fields.dob.value,
            ic: fields.ic.value.trim(),
            motherName: fields.motherName.value.trim(),
            motherContact: fields.motherContact.value.trim(),
            address: fields.address.value.trim()
        };

        if (!updatedChild.name) {
            showMessage("Please enter the child's name.", "error");
            fields.name.focus();
            return;
        }

        // Save changes to the selected child's sample data
        children[currentChildId] = updatedChild;

        // Update the dropdown name
        childSelector.options[
            childSelector.selectedIndex
        ].textContent = updatedChild.name;

        // Update the heading
        profileName.textContent = updatedChild.name;

        originalChildData = { ...updatedChild };

        setEditing(false);
        showMessage("Child information saved successfully.");
    });

    // Cancel editing and restore the original information
    cancelButton.addEventListener("click", function () {
        if (originalChildData) {
            children[currentChildId] = { ...originalChildData };
        }

        fillForm(getCurrentChild());
        setEditing(false);
        showMessage("Changes cancelled.");
    });

    // Change child when the dropdown selection changes
    childSelector.addEventListener("change", function () {
        loadSelectedChild();
    });

    // Initialize the page
    loadSelectedChild();

});