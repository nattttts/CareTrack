
const nodemailer = require("nodemailer");

// Format appointment time for email
function formatAppointmentTime(time) {
    const [hours, minutes] = time.split(":");
    const date = new Date();
    date.setHours(Number(hours), Number(minutes), 0, 0);

    return date.toLocaleTimeString("en-MY", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
}

// Escape user-provided text before inserting it into HTML
function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function createEmailTransporter() {
    if (!process.env.EMAIL_USER ||
        !process.env.EMAIL_APP_PASSWORD) {
        throw new Error("Email credentials are not configured.");
    }

    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD
        }
    });
}

// Send an invitation email
async function sendInvitationEmail(email, invitationUrl) {
    const transporter = createEmailTransporter();

    const info = await transporter.sendMail({
        from: `"CareTrack Notifications" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Set Up Your CareTrack Account",

        text: `Hello,

An account has been created for you on CareTrack.

Please use the link below to set your password:

${invitationUrl}

This invitation expires after 24 hours. If you did not expect
this invitation, please contact the clinic.

Regards,
CareTrack Team`,

        html: `
            <h2>Welcome to CareTrack</h2>
            <p>An account has been created for you on CareTrack.</p>
            <p>Please click the button below to set your password:</p>
            <p>
                <a href="${invitationUrl}"
                   style="
                       display: inline-block;
                       padding: 12px 20px;
                       background-color: #f9528e;
                       color: white;
                       text-decoration: none;
                       border-radius: 8px;
                   ">
                    Set Your Password
                </a>
            </p>
            <p>This invitation expires after 24 hours.</p>
            <p>If you did not expect this invitation,
               please contact the clinic.</p>
            <p>Regards,<br>CareTrack Team</p>
        `
    });

    console.log("Invitation email accepted by Gmail.");
    console.log("Message ID:", info.messageId);

    return { messageId: info.messageId };
}

// Send a password reset email
async function sendPasswordResetEmail(email, resetUrl) {
    const transporter = createEmailTransporter();

    const info = await transporter.sendMail({
        from: `"CareTrack Notifications" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Reset Your CareTrack Password",

        text: `Hello,

We received a request to reset your CareTrack account password.

Please use the link below to set your new password:

${resetUrl}

This link expires after 15 minutes and can only be used once.

If you did not request a password reset, you can ignore this email.
Your current password will remain unchanged.

Regards,
CareTrack Team`,

        html: `
            <h2>Reset Your CareTrack Password</h2>
            <p>We received a request to reset your CareTrack account password.</p>
            <p>Please click the button below to set your new password:</p>
            <p>
                <a href="${resetUrl}"
                   style="
                       display: inline-block;
                       padding: 12px 20px;
                       background-color: #f9528e;
                       color: white;
                       text-decoration: none;
                       border-radius: 8px;
                   ">
                    Reset Password
                </a>
            </p>
            <p>This link expires after 15 minutes and can only be used once.</p>
            <p>If you did not request a password reset, you can ignore this email.
               Your current password will remain unchanged.</p>
            <p>Regards,<br>CareTrack Team</p>
        `
    });

    console.log("Password reset email accepted by Gmail.");
    console.log("Message ID:", info.messageId);

    return { messageId: info.messageId };
}


async function sendAppointmentScheduledEmail(
    email,
    patientName,
    appointmentType,
    appointmentDate,
    startTime,
    endTime
) {
    const transporter = createEmailTransporter();

    const formattedStartTime = formatAppointmentTime(startTime);
    const formattedEndTime = formatAppointmentTime(endTime);
    const safeName = escapeHtml(patientName);
    const safeType = escapeHtml(appointmentType);
    const safeDate = escapeHtml(appointmentDate);

    const info = await transporter.sendMail({
        from: `"CareTrack Notifications" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your CareTrack Appointment Is Confirmed",

        text: `Hello ${patientName},

A new appointment has been scheduled for you at CareTrack.

Appointment details:
Type: ${appointmentType}
Date: ${appointmentDate}
Time: ${formattedStartTime} - ${formattedEndTime}

Please arrive on time for your appointment.

Regards,
CareTrack Team`,

        html: `
            <h2>Appointment Confirmed</h2>
            <p>Hello ${safeName},</p>
            <p>A new appointment has been scheduled for you at CareTrack.</p>
            <p><strong>Appointment details:</strong></p>
            <ul>
                <li>Type: ${safeType}</li>
                <li>Date: ${safeDate}</li>
                <li>Time: ${escapeHtml(formattedStartTime)} - ${escapeHtml(formattedEndTime)}</li>
            </ul>
            <p>Please arrive on time for your appointment.</p>
            <p>Regards,<br>CareTrack Team</p>
        `
    });

    console.log("Appointment confirmation email accepted by Gmail.");
    console.log("Message ID:", info.messageId);

    return { messageId: info.messageId };
}

async function sendAppointmentUpdatedEmail(
    email,
    patientName,
    appointmentType,
    appointmentDate,
    startTime,
    endTime
) {
    const transporter = createEmailTransporter();

    const formattedStartTime = formatAppointmentTime(startTime);
    const formattedEndTime = formatAppointmentTime(endTime);

    const safeName = escapeHtml(patientName);
    const safeType = escapeHtml(appointmentType);
    const safeDate = escapeHtml(appointmentDate);
    const safeStartTime = escapeHtml(formattedStartTime);
    const safeEndTime = escapeHtml(formattedEndTime);

    const info = await transporter.sendMail({
        from: `"CareTrack Notifications" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your CareTrack Appointment Has Been Updated",

        text: `Hello ${patientName},

The details of your CareTrack appointment have been updated.

Updated appointment details:
Type: ${appointmentType}
Date: ${appointmentDate}
Time: ${formattedStartTime} - ${formattedEndTime}

Please refer to these updated details for your appointment.

Regards,
CareTrack Team`,

        html: `
            <h2>Appointment Details Updated</h2>
            <p>Hello ${safeName},</p>
            <p>The details of your CareTrack appointment have been updated.</p>
            <p><strong>Updated appointment details:</strong></p>
            <ul>
                <li>Type: ${safeType}</li>
                <li>Date: ${safeDate}</li>
                <li>Time: ${safeStartTime} - ${safeEndTime}</li>
            </ul>
            <p>Please refer to these updated details for your appointment.</p>
            <p>Regards,<br>CareTrack Team</p>
        `
    });

    console.log("Appointment update email accepted by Gmail.");
    console.log("Message ID:", info.messageId);

    return { messageId: info.messageId };
}

// Send reschedule approval email
async function sendRescheduleApprovedEmail(
    email,
    patientName,
    appointmentDate,
    startTime,
    endTime
) {
    const transporter = createEmailTransporter();

    const formattedStartTime = formatAppointmentTime(startTime);
    const formattedEndTime = formatAppointmentTime(endTime);

    const info = await transporter.sendMail({
        from: `"CareTrack Notifications" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your CareTrack Appointment Reschedule Is Approved",

        text: `Hello ${patientName},

Your appointment reschedule request has been approved.

Your updated appointment details are:
Date: ${appointmentDate}
Time: ${formattedStartTime} - ${formattedEndTime}

Please arrive on time for your appointment.

Regards,
CareTrack Team`,

        html: `
            <h2>Appointment Reschedule Approved</h2>
            <p>Hello ${escapeHtml(patientName)},</p>
            <p>Your appointment reschedule request has been approved.</p>
            <p><strong>Your updated appointment details:</strong></p>
            <ul>
                <li>Date: ${escapeHtml(appointmentDate)}</li>
                <li>Time: ${escapeHtml(formattedStartTime)} - ${escapeHtml(formattedEndTime)}</li>
            </ul>
            <p>Please arrive on time for your appointment.</p>
            <p>Regards,<br>CareTrack Team</p>
        `
    });

    console.log("Reschedule approval email accepted by Gmail.");
    console.log("Message ID:", info.messageId);

    return { messageId: info.messageId };
}

// Send reschedule rejection email
async function sendRescheduleRejectedEmail(
    email,
    patientName,
    appointmentDate,
    startTime,
    endTime,
    rejectReason
) {
    const transporter = createEmailTransporter();

    const info = await transporter.sendMail({
        from: `"CareTrack Notifications" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your CareTrack Appointment Reschedule Request",

        text: `Hello ${patientName},

Unfortunately, your appointment reschedule request has been rejected.

Requested appointment details:
Date: ${appointmentDate}
Time: ${formatAppointmentTime(startTime)} - ${formatAppointmentTime(endTime)}

Reason:
${rejectReason}

Your original appointment remains unchanged. Please log in to CareTrack to review your appointment details.

Regards,
CareTrack Team`,

        html: `
            <h2>Appointment Reschedule Request Update</h2>
            <p>Hello ${escapeHtml(patientName)},</p>
            <p>Unfortunately, your appointment reschedule request has been rejected.</p>
            <p><strong>Requested appointment details:</strong></p>
            <ul>
                <li>Date: ${escapeHtml(appointmentDate)}</li>
                <li>Time: ${escapeHtml(formatAppointmentTime(startTime))} - ${escapeHtml(formatAppointmentTime(endTime))}</li>
            </ul>
            <p><strong>Reason:</strong></p>
            <p>${escapeHtml(rejectReason).replace(/\r?\n/g, "<br>")}</p>
            <p>Your original appointment remains unchanged. Please log in to CareTrack to review your appointment details.</p>
            <p>Regards,<br>CareTrack Team</p>
        `
    });

    console.log("Reschedule rejection email accepted by Gmail.");
    console.log("Message ID:", info.messageId);

    return { messageId: info.messageId };
}

module.exports = { sendInvitationEmail, sendPasswordResetEmail, 
    sendAppointmentScheduledEmail, sendAppointmentUpdatedEmail, 
    sendRescheduleApprovedEmail, sendRescheduleRejectedEmail };