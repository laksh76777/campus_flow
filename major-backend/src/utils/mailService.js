import nodemailer from "nodemailer";

let transporter = null;

export const isSmtpConfigured = () => {
    const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
    const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
    return Boolean(emailUser && emailUser.trim() && emailPass && emailPass.trim());
};

export const getSenderAddress = () => {
    if (process.env.EMAIL_FROM && process.env.EMAIL_FROM.trim()) {
        return process.env.EMAIL_FROM.trim();
    }
    const user = (process.env.EMAIL_USER || process.env.SMTP_USER || "no-reply@campusflow.edu").trim();
    return `"Training & Placement Cell" <${user}>`;
};

const getTransporter = () => {
    if (transporter) return transporter;

    const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
    const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = process.env.SMTP_PORT || 587;

    if (isSmtpConfigured()) {
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

// Export reset for test suites
export const resetTransporterForTesting = (mock = null) => {
    transporter = mock;
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

/**
 * 1. Application Status Transition Email
 */
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
            return { accepted: false, error: "No recipient email provided" };
        }

        const badge = getStatusBadgeColor(status);
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const subject = `[Placement Cell] Update: ${companyName} - ${badge.label}`;

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }
            .header { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); color: #ffffff; padding: 32px 28px; }
            .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; }
            .header p { margin: 0; font-size: 13px; color: #94a3b8; }
            .content { padding: 28px; }
            .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 700; background: ${badge.bg}; color: ${badge.text}; border: 1px solid ${badge.border}; margin: 12px 0 20px 0; }
            .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
            .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; }
            .footer { padding: 20px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Campus Placement Cell</h1>
              <p>Placement & Training Department</p>
            </div>
            <div class="content">
              <p>Hello <strong>${studentName || "Student"}</strong>,</p>
              <p>Your application status with <strong>${companyName}</strong> has been updated:</p>
              <div><span class="badge">${badge.label}</span></div>
              <div class="info-box">
                <div class="info-row"><span>Company</span><span><strong>${companyName}</strong></span></div>
                <div class="info-row"><span>Role</span><span><strong>${jobTitle || "Campus Drive"}</strong></span></div>
                ${offeredPackage ? `<div class="info-row"><span>CTC</span><span style="color:#059669"><strong>₹${offeredPackage} LPA</strong></span></div>` : ""}
                ${interviewRound ? `<div class="info-row"><span>Round</span><span>${interviewRound}</span></div>` : ""}
                ${interviewDate ? `<div class="info-row"><span>Date/Time</span><span>${new Date(interviewDate).toLocaleString()}</span></div>` : ""}
                ${interviewLocation ? `<div class="info-row"><span>Location / Link</span><span>${interviewLocation}</span></div>` : ""}
              </div>
              ${remarks ? `<div style="background:#fffbeb;border:1px solid #fde68a;padding:14px;border-radius:10px;color:#92400e;margin:16px 0;"><strong>Officer Remarks:</strong><br/>${remarks}</div>` : ""}
              <div style="text-align:center;margin-top:20px;">
                <a href="${frontendUrl}/student-dashboard?tab=applications" class="btn">View in Placement Portal</a>
              </div>
            </div>
            <div class="footer"><p>This is an automated notification from CampusFlow.</p></div>
          </div>
        </body>
        </html>
        `;

        const mailer = getTransporter();
        if (!mailer) {
            return { accepted: false, simulated: true, reason: "SMTP not configured" };
        }

        const info = await mailer.sendMail({
            from: getSenderAddress(),
            to: studentEmail,
            subject,
            html: htmlContent,
            text: `Hello ${studentName || "Student"}, your application with ${companyName} (${jobTitle}) status is updated to ${badge.label}. View details: ${frontendUrl}/student-dashboard?tab=applications`
        });

        return { accepted: true, messageId: info.messageId };
    } catch (err) {
        console.error("[MailService Error] Failed to send status email:", err.message);
        return { accepted: false, error: err.message };
    }
};

/**
 * 2. Placement Drive Application Deadline Reminder Email
 */
export const sendDeadlineReminderEmail = async ({
    studentEmail,
    studentName,
    companyName,
    jobTitle,
    deadline,
    offsetHours,
    packageLPA,
}) => {
    try {
        if (!studentEmail) {
            return { accepted: false, error: "No recipient email provided" };
        }

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const formattedDeadline = new Date(deadline).toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

        const subject = `[Urgent Reminder] ${companyName} (${jobTitle}) - Application Closes in ${offsetHours} Hours`;

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }
            .header { background: linear-gradient(135deg, #0f172a 0%, #312e81 100%); color: #ffffff; padding: 28px; }
            .header h1 { margin: 0; font-size: 19px; font-weight: 800; }
            .content { padding: 28px; }
            .alert-banner { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin-bottom: 20px; color: #991b1b; }
            .alert-title { font-weight: 800; font-size: 15px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
            .details-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 18px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
            .row:last-child { margin-bottom: 0; }
            .label { color: #64748b; font-weight: 500; }
            .val { color: #0f172a; font-weight: 700; text-align: right; }
            .btn { display: inline-block; background: #dc2626; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 700; }
            .footer { padding: 20px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Training & Placement Cell</h1>
              <p style="margin: 4px 0 0 0; color: #cbd5e1; font-size: 13px;">Campus Recruitment Deadline Alert</p>
            </div>
            <div class="content">
              <p>Dear <strong>${studentName || "Candidate"}</strong>,</p>
              
              <div class="alert-banner">
                <div class="alert-title">⏰ Application Window Closing Soon</div>
                <div>The registration deadline for <strong>${companyName}</strong> expires in <strong>${offsetHours} hours</strong>.</div>
              </div>

              <div class="details-card">
                <div class="row"><span class="label">Hiring Partner</span><span class="val">${companyName}</span></div>
                <div class="row"><span class="label">Job Profile</span><span class="val">${jobTitle}</span></div>
                ${packageLPA ? `<div class="row"><span class="label">Offered Package</span><span class="val" style="color: #059669;">₹${packageLPA} LPA</span></div>` : ""}
                <div class="row"><span class="label">Hard Deadline</span><span class="val" style="color: #dc2626;">${formattedDeadline}</span></div>
              </div>

              <p style="font-size: 14px; color: #475569;">
                Our records indicate that you are eligible for this recruitment opportunity and have not yet submitted your application. Profiles submitted after the deadline cannot be processed.
              </p>

              <div style="text-align: center; margin: 24px 0 10px 0;">
                <a href="${frontendUrl}/placement-drives" class="btn">Apply Now on Portal</a>
              </div>
            </div>
            <div class="footer">
              <p style="margin: 0;">Automated deadline reminder issued by CampusFlow. Do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
        `;

        const mailer = getTransporter();
        if (!mailer) {
            return { accepted: false, simulated: true, reason: "SMTP not configured" };
        }

        const info = await mailer.sendMail({
            from: getSenderAddress(),
            to: studentEmail,
            subject,
            html: htmlContent,
            text: `Dear ${studentName || "Candidate"}, the application deadline for ${companyName} (${jobTitle}) closes in ${offsetHours} hours (${formattedDeadline}). Submit your application before the deadline: ${frontendUrl}/placement-drives`
        });

        return { accepted: true, messageId: info.messageId };
    } catch (err) {
        console.error("[MailService Error] Failed to send reminder email:", err.message);
        return { accepted: false, error: err.message };
    }
};

/**
 * 3. Administrator Broadcast Announcement Email
 */
export const sendBroadcastAnnouncementEmail = async ({
    studentEmail,
    studentName,
    title,
    message,
    priority = "announcement",
}) => {
    try {
        if (!studentEmail) {
            return { accepted: false, error: "No recipient email provided" };
        }

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const subject = priority === "urgent" ? `[URGENT Placement Alert] ${title}` : `[Placement Office Notice] ${title}`;

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }
            .header { background: ${priority === "urgent" ? "linear-gradient(135deg, #7f1d1d 0%, #1e1b4b 100%)" : "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)"}; color: #ffffff; padding: 28px; }
            .header h1 { margin: 0; font-size: 19px; font-weight: 800; }
            .content { padding: 28px; }
            .announcement-box { background: ${priority === "urgent" ? "#fef2f2" : "#f8fafc"}; border: 1px solid ${priority === "urgent" ? "#fecaca" : "#e2e8f0"}; border-radius: 12px; padding: 20px; margin: 18px 0; font-size: 14px; line-height: 1.6; color: #1e293b; }
            .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; }
            .footer { padding: 20px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Training & Placement Directorate</h1>
              <p style="margin: 4px 0 0 0; color: #cbd5e1; font-size: 13px;">Official Candidate Broadcast</p>
            </div>
            <div class="content">
              <p>Dear <strong>${studentName || "Student"}</strong>,</p>
              <h2 style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 16px 0 8px 0;">${title}</h2>
              <div class="announcement-box">
                ${message.replace(/\n/g, "<br/>")}
              </div>
              <div style="text-align: center; margin-top: 24px;">
                <a href="${frontendUrl}/student-dashboard" class="btn">Open Student Portal</a>
              </div>
            </div>
            <div class="footer"><p>Sent by CampusFlow Training & Placement Office.</p></div>
          </div>
        </body>
        </html>
        `;

        const mailer = getTransporter();
        if (!mailer) {
            return { accepted: false, reason: "SMTP not configured" };
        }

        const info = await mailer.sendMail({
            from: getSenderAddress(),
            to: studentEmail,
            subject,
            html: htmlContent,
            text: `Dear ${studentName || "Student"},\n\n[${title}]\n\n${message}\n\nView portal: ${frontendUrl}/student-dashboard`
        });

        return { accepted: true, messageId: info.messageId };
    } catch (err) {
        console.error("[MailService Error] Failed to send announcement email:", err.message);
        return { accepted: false, error: err.message };
    }
};
