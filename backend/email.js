
const nodemailer = require("nodemailer");

// Create a temporary Ethereal test account and email transporter
async function createTestTransporter() {
    const testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass
        }
    });

    return { transporter, testAccount };
}

// Send a staff invitation email
async function sendInvitationEmail(email, invitationUrl) {
    const { transporter, testAccount } =
        await createTestTransporter();

    const info = await transporter.sendMail({
        from: `"CareTrack" <${testAccount.user}>`,
        to: email,
        subject: "Set Up Your CareTrack Account",

        text: `Hello,

An account has been created for you on CareTrack.

Please use the link below to set your password:

${invitationUrl}

This invitation expires after 24 hours. If you did not expect
this invitation, please contact the clinic administrator.

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
               please contact the clinic administrator.</p>
            <p>Regards,<br>CareTrack Team</p>
        `
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    console.log("Invitation email sent to Ethereal.");
    console.log("Message ID:", info.messageId);
    console.log("Preview email:", previewUrl);

    return {
        messageId: info.messageId,
        previewUrl
    };
}

module.exports = {
    sendInvitationEmail
};
