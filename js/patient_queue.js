// ================= CHECK-IN FUNCTION =================
const checkInButton = document.getElementById("checkInButton");

const notCheckedIn = document.getElementById("notCheckedIn");
const checkInMessage = document.getElementById("checkInMessage");
const queueStatus = document.getElementById("queueStatus");
const liveQueue = document.getElementById("liveQueue");
const queueInfo = document.getElementById("queueInfo");

// ================= CHECK IN =================
if (
    checkInButton &&
    notCheckedIn &&
    checkInMessage &&
    queueStatus &&
    liveQueue &&
    queueInfo
) {

    checkInButton.addEventListener("click", function () {

        // Hide the check-in section
        notCheckedIn.hidden = true;

        // Show check-in success message
        checkInMessage.hidden = false;

        // Show queue status
        queueStatus.hidden = false;

        // Show live queue
        liveQueue.hidden = false;

        // Show queue information
        queueInfo.hidden = false;

        // Disable the button after successful check-in
        checkInButton.disabled = true;

    })
}