import assert from "node:assert/strict";
import { test } from "node:test";
import {
    validateEmailAddress,
    isPlaceholderValue,
    getSmtpConfigStatus,
    verifySmtpConnection,
    sendTestEmail,
    sendApplicationStatusEmail,
    sendDeadlineReminderEmail,
    sendBroadcastAnnouncementEmail,
    resetTransporterForTesting,
    getSenderAddress
} from "../src/utils/mailService.js";

test("1. Missing SMTP credentials reports NOT_CONFIGURED without leaking secrets", async () => {
    const origUser = process.env.EMAIL_USER;
    const origPass = process.env.EMAIL_PASS;
    const origSmtpUser = process.env.SMTP_USER;
    const origSmtpPass = process.env.SMTP_PASS;

    try {
        delete process.env.EMAIL_USER;
        delete process.env.EMAIL_PASS;
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASS;

        const config = getSmtpConfigStatus();
        assert.equal(config.configured, false);
        assert.equal(config.hasUser, false);
        assert.equal(config.hasPass, false);
        assert.ok(config.missing.length > 0);

        // Verification must report NOT_CONFIGURED safely
        const verif = await verifySmtpConnection();
        assert.equal(verif.verified, false);
        assert.equal(verif.category, "NOT_CONFIGURED");
        assert.ok(verif.message.includes("not configured"));
    } finally {
        process.env.EMAIL_USER = origUser;
        process.env.EMAIL_PASS = origPass;
        process.env.SMTP_USER = origSmtpUser;
        process.env.SMTP_PASS = origSmtpPass;
    }
});

test("2. Placeholder credentials detected without displaying secrets", async () => {
    const origUser = process.env.EMAIL_USER;
    const origPass = process.env.EMAIL_PASS;

    try {
        process.env.EMAIL_USER = "your_email@gmail.com";
        process.env.EMAIL_PASS = "your_app_password";

        assert.equal(isPlaceholderValue("your_email@gmail.com"), true);
        assert.equal(isPlaceholderValue("your_app_password"), true);
        assert.equal(isPlaceholderValue("realuser@college.edu"), false);

        const config = getSmtpConfigStatus();
        assert.equal(config.configured, false);
        assert.equal(config.isPlaceholder, true);

        const verif = await verifySmtpConnection();
        assert.equal(verif.verified, false);
        assert.equal(verif.category, "PLACEHOLDER_CREDENTIALS");
        assert.ok(!verif.message.includes("your_app_password"), "Must never leak placeholder password");
    } finally {
        process.env.EMAIL_USER = origUser;
        process.env.EMAIL_PASS = origPass;
    }
});

test("3. Invalid SMTP authentication sanitizes error to AUTH_FAILED without leaking tokens", async () => {
    resetTransporterForTesting({
        verify: async () => {
            const err = new Error("535 5.7.8 Username and Password not accepted secretToken12345");
            err.code = "EAUTH";
            throw err;
        }
    });

    const verif = await verifySmtpConnection();
    assert.equal(verif.verified, false);
    assert.equal(verif.category, "AUTH_FAILED");
    assert.ok(!verif.message.includes("secretToken12345"), "Must not leak internal provider token");
    assert.match(verif.message, /authentication rejected/i);

    resetTransporterForTesting(null);
});

test("4. SMTP connection verification failure maps to sanitized category", async () => {
    resetTransporterForTesting({
        verify: async () => {
            const err = new Error("Connection timed out to smtp.host.internal:587");
            err.code = "ETIMEDOUT";
            throw err;
        }
    });

    const verif = await verifySmtpConnection();
    assert.equal(verif.verified, false);
    assert.equal(verif.category, "CONNECTION_TIMEOUT");

    resetTransporterForTesting(null);
});

test("5. Mocked successful message acceptance returns TEST_EMAIL_ACCEPTED", async () => {
    let captured = null;
    resetTransporterForTesting({
        sendMail: async (opts) => {
            captured = opts;
            return { messageId: "<test-msg-999@campusflow.edu>" };
        }
    });

    const res = await sendTestEmail("admin.test@campusflow.edu");
    assert.equal(res.accepted, true);
    assert.equal(res.category, "TEST_EMAIL_ACCEPTED");
    assert.equal(res.messageId, "<test-msg-999@campusflow.edu>");
    assert.equal(captured.to, "admin.test@campusflow.edu");
    assert.match(captured.subject, /SMTP Email Delivery Test/);
    assert.ok(res.note.includes("does not guarantee inbox delivery"));

    resetTransporterForTesting(null);
});

test("6. Mocked rejected/failed email sending returns sanitized delivery failure", async () => {
    resetTransporterForTesting({
        sendMail: async () => {
            const err = new Error("535 5.7.8 BadCredentials");
            err.code = "EAUTH";
            throw err;
        }
    });

    const res = await sendTestEmail("recipient@campusflow.edu");
    assert.equal(res.accepted, false);
    assert.equal(res.category, "AUTH_FAILED");
    assert.match(res.error, /authentication rejected/i);

    resetTransporterForTesting(null);
});

test("7. Invalid or missing recipient addresses are cleanly rejected before sending", async () => {
    assert.equal(validateEmailAddress(""), false);
    assert.equal(validateEmailAddress("notanemail"), false);
    assert.equal(validateEmailAddress("user@"), false);
    assert.equal(validateEmailAddress("user@domain.com"), true);

    const resEmpty = await sendTestEmail("");
    assert.equal(resEmpty.accepted, false);
    assert.equal(resEmpty.category, "INVALID_RECIPIENT");

    const resInvalid = await sendTestEmail("plainaddress");
    assert.equal(resInvalid.accepted, false);
    assert.equal(resInvalid.category, "INVALID_RECIPIENT");

    const statusRes = await sendApplicationStatusEmail({ studentEmail: "bad-email" });
    assert.equal(statusRes.accepted, false);
    assert.match(statusRes.error, /Invalid recipient/i);

    const reminderRes = await sendDeadlineReminderEmail({ studentEmail: "" });
    assert.equal(reminderRes.accepted, false);
    assert.match(reminderRes.error, /Invalid recipient/i);

    const announceRes = await sendBroadcastAnnouncementEmail({ studentEmail: "bad@" });
    assert.equal(announceRes.accepted, false);
    assert.match(announceRes.error, /Invalid recipient/i);
});

test("8. Correct sender and recipient fields in application status email", async () => {
    let captured = null;
    resetTransporterForTesting({
        sendMail: async (opts) => {
            captured = opts;
            return { messageId: "status-msg-1" };
        }
    });

    // Test with studentEmail
    const res1 = await sendApplicationStatusEmail({
        studentEmail: "student1@campusflow.edu",
        studentName: "Aarav Sharma",
        companyName: "Google",
        jobTitle: "Software Engineer",
        status: "selected",
        offeredPackage: 24
    });
    assert.equal(res1.accepted, true);
    assert.equal(captured.to, "student1@campusflow.edu");
    assert.equal(captured.from, getSenderAddress());
    assert.match(captured.subject, /Google - Selected \/ Offered/);

    // Test with alias 'to'
    const res2 = await sendApplicationStatusEmail({
        to: "student2@campusflow.edu",
        studentName: "Diya Patel",
        companyName: "Microsoft",
        jobTitle: "Cloud Engineer",
        status: "interview",
        interviewRound: "Technical Round 1"
    });
    assert.equal(res2.accepted, true);
    assert.equal(captured.to, "student2@campusflow.edu");
    assert.match(captured.subject, /Microsoft - Interview Scheduled/);

    resetTransporterForTesting(null);
});
