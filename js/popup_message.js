
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
        "text-bg-danger"
    );

    toastElement.classList.add(
        type === "success" ? "text-bg-success" : "text-bg-danger"
    );

    bootstrap.Toast.getOrCreateInstance(toastElement, {
        delay: 4000,
        autohide: true
    }).show();
}
