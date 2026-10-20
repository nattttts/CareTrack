
const nodemailer = require("nodemailer");

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

module.exports = { sendInvitationEmail };