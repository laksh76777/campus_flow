import nodemailer from "nodemailer";

let transporter = null;

const getTransporter = () => {
    if (transporter) return transporter;

    const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
    const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = process.env.SMTP_PORT || 587;

    if (emailUser && emailPass) {
        transporter = nodemailer.createTransport({
            host: smtpHost,
            port: Number(smtpPort),
            secure: Number(smtpPort) === 465,
            auth: {
                user: emailUser,
                pass: emailPass,
            },
        });
    }

    return transporter;
};

const getStatusBadgeColor = (status) => {
    switch (status) {
        case "selected":
            return { bg: "#ecfdf5", border: "#10b981", text: "#065f46", label: "Selected / Offered" };
        case "interview":
            return { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af", label: "Interview Scheduled" };
        case "shortlisted":
            return { bg: "#f5f3ff", border: "#8b5cf6", text: "#5b21b6", label: "Shortlisted" };
        case "rejected":
            return { bg: "#fef2f2", border: "#ef4444", text: "#991b1b", label: "Not Selected" };
        default:
            return { bg: "#f1f5f9", border: "#64748b", text: "#334155", label: status?.toUpperCase() || "Status Update" };
    }
};

export const sendApplicationStatusEmail = async ({
    studentEmail,
    studentName,
    companyName,
    jobTitle,
    status,
    remarks,
    interviewDate,
    interviewRound,
    interviewLocation,
    offeredPackage,
}) => {
    try {
        if (!studentEmail) {
            console.warn("[MailService] No recipient email provided. Skipping email.");
            return false;
        }

        const badge = getStatusBadgeColor(status);
        const frontendUrl = process.env.FRONTEND_URL || "https://placement-management-system-qeuu.vercel.app";

        const subject = `[Placement Cell] Update: ${companyName} - ${badge.label}`;

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .header { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); color: #ffffff; padding: 32px 28px; text-align: left; }
            .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
            .header p { margin: 0; font-size: 13px; color: #94a3b8; }
            .content { padding: 28px; }
            .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: ${badge.bg}; color: ${badge.text}; border: 1px solid ${badge.border}; margin: 12px 0 20px 0; }
            .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
            .info-row:last-child { margin-bottom: 0; }
            .info-label { color: #64748b; font-weight: 500; }
            .info-value { color: #0f172a; font-weight: 600; text-align: right; }
            .remarks-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin: 20px 0; color: #92400e; font-size: 14px; line-height: 1.5; }
            .remarks-title { font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
            .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; text-align: center; margin-top: 10px; }
            .footer { padding: 20px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Campus Placement Cell</h1>
              <p>Placement & Training Department Notification</p>
            </div>
            <div class="content">
              <p style="font-size: 16px; margin-top: 0;">Hello <strong>${studentName || "Student"}</strong>,</p>
              <p style="font-size: 14px; color: #475569; margin-bottom: 14px;">
                An update has been made by the Placement Administration regarding your application with <strong>${companyName}</strong>.
              </p>

              <div>
                <span class="badge">${badge.label}</span>
              </div>

              <div class="info-box">
                <div class="info-row">
                  <span class="info-label">Company</span>
                  <span class="info-value">${companyName}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Role</span>
                  <span class="info-value">${jobTitle || "Campus Drive"}</span>
                </div>
                ${offeredPackage ? `
                <div class="info-row">
                  <span class="info-label">Offered CTC</span>
                  <span class="info-value" style="color: #059669; font-weight: 700;">₹${offeredPackage} LPA</span>
                </div>` : ""}
                ${interviewRound ? `
                <div class="info-row">
                  <span class="info-label">Interview Round</span>
                  <span class="info-value">${interviewRound}</span>
                </div>` : ""}
                ${interviewDate ? `
                <div class="info-row">
                  <span class="info-label">Scheduled Date/Time</span>
                  <span class="info-value">${new Date(interviewDate).toLocaleString()}</span>
                </div>` : ""}
                ${interviewLocation ? `
                <div class="info-row">
                  <span class="info-label">Location / Link</span>
                  <span class="info-value">${interviewLocation}</span>
                </div>` : ""}
              </div>

              ${remarks ? `
              <div class="remarks-box">
                <div class="remarks-title">📢 Instructions / Message from Placement Officer:</div>
                <div>${remarks.replace(/\n/g, "<br/>")}</div>
              </div>` : ""}

              <div style="text-align: center; margin-top: 24px;">
                <a href="${frontendUrl}/student-dashboard?tab=applications" class="btn">View in Placement Portal</a>
              </div>
            </div>
            <div class="footer">
              <p style="margin: 0;">This is an automated notification from the Campus Placement & Recruitment Management System.</p>
            </div>
          </div>
        </body>
        </html>
        `;

        const mailer = getTransporter();
        if (!mailer) {
            console.log("----------------------------------------------------------------");
            console.log(`[MailService SIMULATION] Recipient: ${studentEmail}`);
            console.log(`Subject: ${subject}`);
            console.log(`Status: ${status} | Remarks: "${remarks}"`);
            console.log("Tip: Set EMAIL_USER & EMAIL_PASS in major-backend/.env for real SMTP delivery.");
            console.log("----------------------------------------------------------------");
            return true;
        }

        const info = await mailer.sendMail({
            from: `"Campus Placement Cell" <${process.env.EMAIL_USER || "no-reply@placement.edu"}>`,
            to: studentEmail,
            subject,
            html: htmlContent,
        });

        console.log(`[MailService] Email sent successfully to ${studentEmail} (Msg ID: ${info.messageId})`);
        return true;
    } catch (err) {
        console.error("[MailService Error] Failed to send email:", err.message);
        return false;
    }
};
