
export function showToast(message, type = "success") {
    const toastElement = document.getElementById("appToast");
    const toastMessage = document.getElementById("appToastMessage");

    if (!toastElement || !toastMessage) {
        console.error("Toast elements were not found on this page.");
        return;
    }

    toastMessage.textContent = message;

    toastElement.classList.remove(
        "text-bg-success",
        "text-bg-danger",
        "text-bg-info"
    );

    const toastClass = {
        success: "text-bg-success",
        error: "text-bg-danger",
        info: "text-bg-info"
    };

    toastElement.classList.add(
        toastClass[type] || "text-bg-danger");

    bootstrap.Toast.getOrCreateInstance(toastElement, {
        delay: 5000,
        autohide: true
    }).show();
}
