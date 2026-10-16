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