import nodemailer from "nodemailer";
import { reloadEnv } from "../../env.js";

let transporter = null;
let isTestingMock = false;
let cachedConfigKey = "";

/**
 * Validates whether an email string follows RFC 5322 format.
 */
export const validateEmailAddress = (email) => {
    if (!email || typeof email !== "string") return false;
    const trimmed = email.trim();
    return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(trimmed);
};

/**
 * Detects whether a string contains an unconfigured placeholder or template value.
 */
export const isPlaceholderValue = (val) => {
    if (!val || typeof val !== "string") return false;
    const lower = val.trim().toLowerCase();
    const placeholders = [
        "your_email",
        "your_app_password",
        "your_password",
        "your_cloudinary",
        "placeholder",
        "changeme",
        "example.com",
        "user@example.com",
        "xxxx",
        "****",
        "dummy"
    ];
    return (
        placeholders.some((p) => lower.includes(p)) ||
        lower.startsWith("<") ||
        lower.endsWith(">")
    );
};

/**
 * Detects whether an HTTPS-based email delivery provider (Resend API) is configured.
 * HTTPS APIs communicate over port 443 and bypass all cloud SMTP firewall blocks.
 */
export const isResendConfigured = () => {
    const key = (process.env.RESEND_API_KEY || "").trim();
    return Boolean(key && !isPlaceholderValue(key));
};

/**
 * Safe SMTP / Email configuration status (never leaks passwords or secrets).
 */
export const getSmtpConfigStatus = () => {
    const resendActive = isResendConfigured();
    if (resendActive) {
        return {
            configured: true,
            hasUser: true,
            hasPass: true,
            isPlaceholder: false,
            host: "api.resend.com (HTTPS API / Port 443)",
            port: 443,
            secure: true,
            sender: getSenderAddress(),
            missing: [],
            isHttpApi: true
        };
    }

    const emailUser = (process.env.EMAIL_USER || process.env.SMTP_USER || "").trim();
    const emailPass = (process.env.EMAIL_PASS || process.env.SMTP_PASS || "").trim();
    const smtpHost = (process.env.SMTP_HOST || "smtp.gmail.com").trim();

    const rawPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null;
    const hasExplicitPort = Number.isInteger(rawPort) && rawPort > 0 && rawPort <= 65535;
    const smtpPort = hasExplicitPort
        ? rawPort
        : smtpHost.includes("gmail.com")
            ? 465
            : process.env.SMTP_SECURE === "true" ? 465 : 587;
    const isSecure = smtpPort === 465 || process.env.SMTP_SECURE === "true";

    const hasUser = Boolean(emailUser);
    const hasPass = Boolean(emailPass);
    const isPlaceholder = isPlaceholderValue(emailUser) || isPlaceholderValue(emailPass);

    const missing = [];
    if (!hasUser) missing.push("EMAIL_USER/SMTP_USER");
    if (!hasPass) missing.push("EMAIL_PASS/SMTP_PASS");

    return {
        configured: Boolean(hasUser && hasPass && !isPlaceholder),
        hasUser,
        hasPass,
        isPlaceholder,
        host: smtpHost,
        port: smtpPort,
        secure: isSecure,
        sender: getSenderAddress(),
        missing
    };
};

/**
 * Checks whether SMTP credentials are fully present and not placeholder values.
 */
export const isSmtpConfigured = () => {
    if (isResendConfigured()) return true;
    const status = getSmtpConfigStatus();
    return status.configured;
};

/**
 * Returns safe sender identity adhering to RFC 5322 format.
 */
export const getSenderAddress = () => {
    if (process.env.EMAIL_FROM && process.env.EMAIL_FROM.trim()) {
        return process.env.EMAIL_FROM.trim();
    }
    if (isResendConfigured()) {
        return "CampusFlow Notifications <onboarding@resend.dev>";
    }
    const user = (process.env.EMAIL_USER || process.env.SMTP_USER || "no-reply@campusflow.edu").trim();
    return `"Training & Placement Cell" <${user}>`;
};

/**
 * Builds or returns cached Nodemailer transporter with connection timeouts.
 * Supports overridePort for automatic SSL fallback (e.g., port 465 when 587 times out).
 */
export const getTransporter = (forceRefresh = false, overridePort = null) => {
    if (isTestingMock && transporter) return transporter;

    const emailUser = (process.env.EMAIL_USER || process.env.SMTP_USER || "").trim();
    const emailPass = (process.env.EMAIL_PASS || process.env.SMTP_PASS || "").trim();
    const smtpHost = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
    const status = getSmtpConfigStatus();
    const smtpPort = overridePort || status.port;
    const isSecure = smtpPort === 465 || (overridePort === 465) || status.secure;

    const configKey = `${emailUser}:${emailPass}:${smtpHost}:${smtpPort}:${isSecure}`;

    if (transporter && !forceRefresh && cachedConfigKey === configKey) {
        return transporter;
    }

    cachedConfigKey = configKey;

    if (isSmtpConfigured()) {
        transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: isSecure,
            auth: {
                user: emailUser,
                pass: emailPass,
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
        });
    } else {
        transporter = null;
    }

    return transporter;
};

/**
 * Force reconfiguration of transporter (useful on configuration refresh or test cleanup).
 */
export const reconfigureTransporter = () => {
    try {
        reloadEnv();
    } catch {
        // Fallback for isolated test runners
    }
    transporter = null;
    cachedConfigKey = "";
    return getTransporter(true);
};

/**
 * Reset transporter for mock injection in test suites.
 */
export const resetTransporterForTesting = (mock = null) => {
    transporter = mock;
    isTestingMock = mock !== null;
    if (!mock) {
        cachedConfigKey = "";
    }
};

/**
 * Sanitizes Nodemailer/Provider error messages to eliminate credentials, tokens or stack traces.
 */
export const sanitizeSmtpError = (err) => {
    if (!err) return { category: "UNKNOWN_ERROR", message: "Unknown delivery error" };

    const rawMessage = err.message || String(err);
    const code = err.code || "";

    if (code === "EAUTH" || rawMessage.includes("535") || rawMessage.toLowerCase().includes("badcredentials") || rawMessage.toLowerCase().includes("username and password not accepted")) {
        return {
            category: "AUTH_FAILED",
            message: "SMTP authentication rejected by mail server (invalid username or app password)."
        };
    }
    if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT") {
        const isRender = Boolean(process.env.RENDER);
        return {
            category: "CONNECTION_TIMEOUT",
            message: isRender
                ? "Outbound SMTP blocked by Render free tier firewall. To send real emails from Render, add RESEND_API_KEY to your Render environment variables or upgrade your Render plan."
                : "Connection to SMTP server timed out (check host and port connectivity)."
        };
    }
    if (code === "ECONNREFUSED") {
        return {
            category: "CONNECTION_REFUSED",
            message: "Connection refused by SMTP host on the specified port."
        };
    }
    if (code === "ENOTFOUND") {
        return {
            category: "INVALID_HOST",
            message: "SMTP host address could not be resolved by DNS."
        };
    }
    if (code === "EPROTOCOL" || rawMessage.includes("certificate") || rawMessage.includes("TLS") || rawMessage.includes("SSL")) {
        return {
            category: "TLS_ERROR",
            message: "TLS / SSL handshake error occurred during secure SMTP connection."
        };
    }

    return {
        category: "DELIVERY_FAILED",
        message: "Email provider rejected or failed to process the message."
    };
};

/**
 * Verifies live SMTP connection and authentication with provider without exposing credentials.
 * If Resend HTTPS API key is configured, verifies directly via port 443 (immune to firewall blocks).
 */
export const verifySmtpConnection = async () => {
    if (isResendConfigured() && !isTestingMock) {
        try {
            const res = await fetch("https://api.resend.com/api-keys", {
                headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}` }
            });
            if (res.ok) {
                return {
                    verified: true,
                    category: "VERIFIED",
                    message: "Email delivery verified successfully via Resend HTTPS API (Port 443 - zero firewall blocks)."
                };
            }
            return {
                verified: false,
                category: "AUTH_FAILED",
                message: "Resend API key was rejected by provider (invalid API key)."
            };
        } catch (fetchErr) {
            return {
                verified: false,
                category: "CONNECTION_FAILED",
                message: `Failed to connect to Resend API: ${fetchErr.message}`
            };
        }
    }

    const configStatus = getSmtpConfigStatus();

    if (!configStatus.hasUser || !configStatus.hasPass) {
        return {
            verified: false,
            category: "NOT_CONFIGURED",
            message: "SMTP server credentials (EMAIL_USER / EMAIL_PASS) are not configured."
        };
    }

    if (configStatus.isPlaceholder) {
        return {
            verified: false,
            category: "PLACEHOLDER_CREDENTIALS",
            message: "SMTP server credentials contain default placeholder values. Real credentials are required."
        };
    }

    const mailer = getTransporter(true);
    if (!mailer) {
        return {
            verified: false,
            category: "TRANSPORTER_CREATION_FAILED",
            message: "Could not initialize SMTP transport with current settings."
        };
    }

    try {
        await mailer.verify();
        return {
            verified: true,
            category: "VERIFIED",
            message: "SMTP connection and authentication verified successfully with mail provider."
        };
    } catch (err) {
        // If port 587 timed out on cloud environment, attempt fallback to port 465 (SSL/TLS)
        if ((err.code === "ETIMEDOUT" || err.code === "ESOCKETTIMEDOUT" || err.code === "ECONNREFUSED") && configStatus.port !== 465 && !isTestingMock) {
            try {
                const fallbackMailer = getTransporter(true, 465);
                if (fallbackMailer) {
                    await fallbackMailer.verify();
                    return {
                        verified: true,
                        category: "VERIFIED",
                        message: "SMTP connection and authentication verified successfully with mail provider (via port 465 SSL fallback)."
                    };
                }
            } catch (fallbackErr) {
                // fall through to sanitize original error
            }
        }
        const sanitized = sanitizeSmtpError(err);
        return {
            verified: false,
            category: sanitized.category,
            message: sanitized.message
        };
    }
};

/**
 * Safely dispatches an email using the active transporter or HTTPS API.
 * 1. If RESEND_API_KEY is present, sends via standard HTTPS (Port 443), bypassing Render SMTP blocks.
 * 2. If SMTP is used and a timeout occurs on port 587, automatically retries via port 465 SSL.
 */
export const dispatchMailWithFallback = async (mailOptions) => {
    if (isResendConfigured() && !isTestingMock) {
        try {
            const recipient = Array.isArray(mailOptions.to) ? mailOptions.to[0] : mailOptions.to;
            const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.RESEND_API_KEY.trim()}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    from: getSenderAddress(),
                    to: [recipient.trim()],
                    subject: mailOptions.subject,
                    html: mailOptions.html,
                    text: mailOptions.text
                })
            });
            const data = await res.json();
            if (res.ok) {
                return { accepted: true, messageId: data.id };
            }
            return {
                accepted: false,
                category: "DELIVERY_FAILED",
                error: data.message || "Resend API rejected message dispatch"
            };
        } catch (fetchErr) {
            return {
                accepted: false,
                category: "CONNECTION_FAILED",
                error: `Resend HTTPS API connection failed: ${fetchErr.message}`
            };
        }
    }

    let mailer = getTransporter();
    if (!mailer) {
        return { accepted: false, category: "NOT_CONFIGURED", error: "SMTP server is not configured in system environment variables." };
    }

    try {
        const info = await mailer.sendMail(mailOptions);
        return { accepted: true, messageId: info.messageId };
    } catch (err) {
        const configStatus = getSmtpConfigStatus();
        if ((err.code === "ETIMEDOUT" || err.code === "ESOCKETTIMEDOUT" || err.code === "ECONNREFUSED") && configStatus.port !== 465 && !isTestingMock) {
            try {
                const fallbackMailer = getTransporter(true, 465);
                if (fallbackMailer) {
                    const fallbackInfo = await fallbackMailer.sendMail(mailOptions);
                    return { accepted: true, messageId: fallbackInfo.messageId };
                }
            } catch (fallbackErr) {
                err = fallbackErr;
            }
        }
        const sanitized = sanitizeSmtpError(err);
        return { accepted: false, category: sanitized.category, error: sanitized.message };
    }
};

/**
 * Sends a controlled test email to an explicitly verified recipient.
 */
export const sendTestEmail = async (testEmail) => {
    if (!validateEmailAddress(testEmail)) {
        return {
            accepted: false,
            category: "INVALID_RECIPIENT",
            error: "The provided test recipient email address is invalid."
        };
    }

    if (!isSmtpConfigured()) {
        return {
            accepted: false,
            category: "NOT_CONFIGURED",
            error: "SMTP server is not configured in system environment variables."
        };
    }

    const subject = `[CampusFlow Diagnostic] SMTP Email Delivery Test (${new Date().toLocaleTimeString()})`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
        .header { background: #0f172a; color: #ffffff; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 18px; font-weight: 800; }
        .content { padding: 24px; }
        .box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 16px 0; color: #166534; font-size: 14px; }
        .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>CampusFlow SMTP Delivery Verification</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <div class="box">
            <strong>✅ Test Email Accepted by Mail Server</strong><br/>
            This controlled diagnostic test email confirms that your placement portal's Nodemailer transporter successfully connected and authenticated with your configured SMTP server.
          </div>
          <p style="font-size: 13px; color: #64748b;">
            <strong>Important note:</strong> Provider acceptance confirms that your credentials and connection settings were accepted by the mail server. It does not guarantee delivery to all student inboxes (which depends on recipient domain filters and reputation).
          </p>
          <p style="font-size: 13px; color: #64748b;">
            Timestamp: ${new Date().toISOString()}<br/>
            Sender: ${getSenderAddress()}<br/>
            Recipient: ${testEmail}
          </p>
        </div>
        <div class="footer">
          Automated diagnostic notification from CampusFlow.
        </div>
      </div>
    </body>
    </html>
    `;

    const result = await dispatchMailWithFallback({
        from: getSenderAddress(),
        to: testEmail.trim(),
        subject,
        html: htmlContent,
        text: `[CampusFlow Diagnostic] SMTP delivery test successful. Recipient: ${testEmail}. Provider acceptance does not guarantee inbox delivery.`
    });

    if (result.accepted) {
        return {
            accepted: true,
            messageId: result.messageId,
            recipient: testEmail.trim(),
            category: "TEST_EMAIL_ACCEPTED",
            note: "Provider accepted the test email for delivery. Provider acceptance does not guarantee inbox delivery."
        };
    }

    return result;
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
 * 1. Application Status Transition Email (supports both studentEmail and to)
 */
export const sendApplicationStatusEmail = async ({
    studentEmail,
    to,
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
        const recipient = (studentEmail || to || "").trim();
        if (!validateEmailAddress(recipient)) {
            return { accepted: false, error: "Invalid recipient email address" };
        }

        const badge = getStatusBadgeColor(status);
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const subject = `[Placement Cell] Update: ${companyName} - ${badge.label}`;
        const formattedInterviewDate = interviewDate
            ? new Date(interviewDate).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true
            })
            : null;

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
                ${formattedInterviewDate ? `<div class="info-row"><span>Date/Time</span><span>${formattedInterviewDate}</span></div>` : ""}
                ${interviewLocation ? `<div class="info-row"><span>Location / Link</span><span>${interviewLocation}</span></div>` : ""}
              </div>
              ${remarks ? `<div style="background:#fffbeb;border:1px solid #fde68a;padding:14px;border-radius:10px;color:#92400e;margin:16px 0;"><strong>Officer Remarks:</strong><br/>${remarks}</div>` : ""}
              <div style="text-align:center;margin-top:20px;">
                <a href="${frontendUrl}/my-applications" class="btn">View in Placement Portal</a>
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

        return await dispatchMailWithFallback({
            from: getSenderAddress(),
            to: recipient,
            subject,
            html: htmlContent,
            text: `Hello ${studentName || "Student"}, your application with ${companyName} (${jobTitle}) status is updated to ${badge.label}. View details: ${frontendUrl}/my-applications`
        });
    } catch (err) {
        const sanitized = sanitizeSmtpError(err);
        return { accepted: false, category: sanitized.category, error: sanitized.message };
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
        if (!validateEmailAddress(studentEmail)) {
            return { accepted: false, error: "Invalid recipient email address" };
        }

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const formattedDeadline = new Date(deadline).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
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

        return await dispatchMailWithFallback({
            from: getSenderAddress(),
            to: studentEmail.trim(),
            subject,
            html: htmlContent,
            text: `Dear ${studentName || "Candidate"}, the application deadline for ${companyName} (${jobTitle}) closes in ${offsetHours} hours (${formattedDeadline}). Submit your application before the deadline: ${frontendUrl}/placement-drives`
        });
    } catch (err) {
        const sanitized = sanitizeSmtpError(err);
        return { accepted: false, category: sanitized.category, error: sanitized.message };
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
        if (!validateEmailAddress(studentEmail)) {
            return { accepted: false, error: "Invalid recipient email address" };
        }

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const subject = priority === "urgent" ? `[URGENT Placement Alert] ${title}` : `[Placement Office Notice] ${title}`;

        const formattedDate = new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });

        const isUrgent = priority === "urgent";

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px 12px; color: #1e293b; -webkit-font-smoothing: antialiased; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .header { background: ${isUrgent ? "linear-gradient(135deg, #881337 0%, #4c0519 100%)" : "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)"}; color: #ffffff; padding: 32px 28px; }
            .header-tag { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: ${isUrgent ? "#fecdd3" : "#a5b4fc"}; margin-bottom: 6px; }
            .header h1 { margin: 0; font-size: 20px; font-weight: 800; line-height: 1.3; }
            .content { padding: 28px; }
            .meta-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #f1f5f9; }
            .badge { display: inline-block; padding: 5px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
            .badge-urgent { background: #ffe4e6; color: #9f1239; border: 1px solid #fecdd3; }
            .badge-notice { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
            .timestamp { font-size: 12px; color: #64748b; font-weight: 600; }
            .greeting { font-size: 15px; color: #334155; margin-bottom: 16px; }
            .title-box { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 16px; line-height: 1.35; }
            .announcement-box { background: ${isUrgent ? "#fff1f2" : "#f8fafc"}; border: 1px solid ${isUrgent ? "#ffe4e6" : "#e2e8f0"}; border-left: 4px solid ${isUrgent ? "#e11d48" : "#3b82f6"}; border-radius: 12px; padding: 20px; font-size: 14px; line-height: 1.65; color: #1e293b; }
            .announcement-box p { margin: 0 0 10px 0; }
            .announcement-box p:last-child { margin-bottom: 0; }
            .cta-wrapper { text-align: center; margin: 28px 0 12px 0; }
            .btn { display: inline-block; background: ${isUrgent ? "#e11d48" : "#2563eb"}; color: #ffffff !important; text-decoration: none; padding: 13px 30px; border-radius: 12px; font-size: 14px; font-weight: 700; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .footer { padding: 24px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5; }
            .footer-disclaimer { font-size: 11px; color: #94a3b8; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="header-tag">Official Recruitment Bulletin</div>
              <h1>Training & Placement Directorate</h1>
            </div>
            <div class="content">
              <div class="meta-bar">
                <span class="badge ${isUrgent ? "badge-urgent" : "badge-notice"}">
                  ${isUrgent ? "🚨 Urgent Placement Alert" : "📢 TPO Announcement"}
                </span>
                <span class="timestamp">${formattedDate}</span>
              </div>
              <div class="greeting">Dear <strong>${studentName || "Candidate"}</strong>,</div>
              <div class="title-box">${title}</div>
              <div class="announcement-box">
                ${message.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br/>")}
              </div>
              <div class="cta-wrapper">
                <a href="${frontendUrl}/notifications" class="btn">Open Notification Center</a>
              </div>
            </div>
            <div class="footer">
              <div><strong>CampusFlow Placement Office</strong> • Direct Student Communications</div>
              <div class="footer-disclaimer">This official broadcast was sent to your registered student email address. Please visit your student portal to review full details.</div>
            </div>
          </div>
        </body>
        </html>
        `;

        const mailer = getTransporter();
        if (!mailer) {
            return { accepted: false, reason: "SMTP not configured" };
        }

        return await dispatchMailWithFallback({
            from: getSenderAddress(),
            to: studentEmail.trim(),
            subject,
            html: htmlContent,
            text: `Dear ${studentName || "Candidate"},\n\n[${title}]\n\nDate: ${formattedDate}\n\n${message}\n\nView details on your student portal: ${frontendUrl}/notifications`
        });
    } catch (err) {
        const sanitized = sanitizeSmtpError(err);
        return { accepted: false, category: sanitized.category, error: sanitized.message };
    }
};

/**
 * 4. Password Recovery OTP Email
 * Dispatches a single-use 6-digit verification code with 5-minute TTL.
 */
export const sendPasswordResetOtpEmail = async ({
    to,
    recipientName = "CampusFlow User",
    otp,
    expiryMinutes = 5
}) => {
    try {
        const recipient = (to || "").trim();
        if (!validateEmailAddress(recipient)) {
            return { accepted: false, category: "INVALID_RECIPIENT", error: "Invalid recipient email address" };
        }

        if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp.trim())) {
            return { accepted: false, category: "INVALID_OTP", error: "Valid 6-digit numeric OTP required" };
        }

        const mailer = getTransporter();
        if (!mailer) {
            return { accepted: false, category: "NOT_CONFIGURED", error: "SMTP server is not configured in system environment variables." };
        }

        const cleanOtp = otp.trim();
        const subject = `[CampusFlow] ${cleanOtp} is your Password Reset Verification Code`;

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
            .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .header { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
            .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
            .header p { margin: 0; font-size: 13px; color: #94a3b8; }
            .content { padding: 32px 28px; }
            .greeting { font-size: 15px; color: #334155; margin-bottom: 16px; }
            .intro-text { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
            .otp-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 14px; padding: 24px; text-align: center; margin: 24px 0; }
            .otp-code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #0f172a; margin: 0; }
            .otp-expiry { font-size: 12px; font-weight: 700; color: #dc2626; margin-top: 10px; display: inline-block; background: #fef2f2; border: 1px solid #fee2e2; padding: 4px 12px; rounded: 9999px; border-radius: 9999px; }
            .warning-box { background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 14px 16px; margin: 24px 0 16px 0; font-size: 12px; color: #92400e; line-height: 1.5; }
            .footer { padding: 20px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>CampusFlow Account Security</h1>
              <p>Placement & Career Management System</p>
            </div>
            <div class="content">
              <div class="greeting">Hello <strong>${recipientName}</strong>,</div>
              <p class="intro-text">
                We received a request to reset the password for your CampusFlow account associated with <strong>${recipient}</strong>. Use the following verification code to proceed:
              </p>
              
              <div class="otp-box">
                <div class="otp-code">${cleanOtp}</div>
                <div class="otp-expiry">⏳ Expires in ${expiryMinutes} minutes</div>
              </div>

              <div class="warning-box">
                <strong>🔒 Security Notice:</strong> Never share this verification code with anyone, including college staff or recruiters. CampusFlow administrators will never ask for your code.
              </div>

              <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
                If you did not request a password reset, you can safely ignore this email. Your existing password will remain unchanged and your account is secure.
              </p>
            </div>
            <div class="footer">
              <div><strong>CampusFlow Authentication Security</strong></div>
              <div>This is an automated system notification dispatched to your registered address.</div>
            </div>
          </div>
        </body>
        </html>
        `;

        const textContent = `CampusFlow Account Security\n\nHello ${recipientName},\n\nYour password reset verification code is: ${cleanOtp}\n\nThis code expires in ${expiryMinutes} minutes.\n\nSecurity Notice: Never share this code with anyone. If you did not request a password reset, please ignore this email.`;

        return await dispatchMailWithFallback({
            from: getSenderAddress(),
            to: recipient,
            subject,
            html: htmlContent,
            text: textContent,
            priority: "high",
            headers: {
                "X-Priority": "1 (Highest)",
                "X-MSMail-Priority": "High",
                "Importance": "High"
            }
        });
    } catch (err) {
        const sanitized = sanitizeSmtpError(err);
        return { accepted: false, category: sanitized.category, error: sanitized.message };
    }
};
