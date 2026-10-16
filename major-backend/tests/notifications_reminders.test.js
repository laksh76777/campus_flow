import assert from "node:assert/strict";
import { test } from "node:test";
import {
    isSmtpConfigured,
    getSenderAddress,
    resetTransporterForTesting,
    sendDeadlineReminderEmail,
    sendBroadcastAnnouncementEmail
} from "../src/utils/mailService.js";

test("SMTP configuration status is truthfully determined from environment", () => {
    const originalUser = process.env.EMAIL_USER;
    const originalPass = process.env.EMAIL_PASS;

    try {
        delete process.env.EMAIL_USER;
        delete process.env.SMTP_USER;
        delete process.env.EMAIL_PASS;
        delete process.env.SMTP_PASS;
        assert.equal(isSmtpConfigured(), false, "Reports false when credentials missing");

        process.env.EMAIL_USER = "placement@campusflow.edu";
        process.env.EMAIL_PASS = "securepassword";
        assert.equal(isSmtpConfigured(), true, "Reports true when credentials present");
    } finally {
        process.env.EMAIL_USER = originalUser;
        process.env.EMAIL_PASS = originalPass;
    }
});

test("Sender identity uses configured EMAIL_FROM or defaults safely", () => {
    const originalFrom = process.env.EMAIL_FROM;
    try {
        process.env.EMAIL_FROM = '"Campus Placement Office" <tpo@campusflow.edu>';
        assert.equal(getSenderAddress(), '"Campus Placement Office" <tpo@campusflow.edu>');

        delete process.env.EMAIL_FROM;
        const fallback = getSenderAddress();
        assert.match(fallback, /Training & Placement Cell/);
    } finally {
        process.env.EMAIL_FROM = originalFrom;
    }
});

test("Email dispatch rejects empty recipient and accepts mock transporter", async () => {
    const sent = [];
    resetTransporterForTesting({
        sendMail: async (opts) => {
            sent.push(opts);
            return { messageId: "mock-123" };
        }
    });

    const resEmpty = await sendDeadlineReminderEmail({
        studentEmail: "",
        studentName: "Student",
        companyName: "Acme",
        jobTitle: "Dev",
        deadline: new Date(),
        offsetHours: 6
    });
    assert.equal(resEmpty.accepted, false);

    const resValid = await sendDeadlineReminderEmail({
        studentEmail: "test@example.com",
        studentName: "Test Student",
        companyName: "Acme Corp",
        jobTitle: "Software Engineer",
        deadline: new Date(Date.now() + 24 * 3600 * 1000),
        offsetHours: 6,
        packageLPA: 12
    });

    assert.equal(resValid.accepted, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "test@example.com");
    assert.match(sent[0].subject, /Reminder/);
    assert.match(sent[0].html, /Acme Corp/);
});

test("Broadcast announcement formats HTML and text templates accurately", async () => {
    const sent = [];
    resetTransporterForTesting({
        sendMail: async (opts) => {
            sent.push(opts);
            return { messageId: "announcement-123" };
        }
    });

    const res = await sendBroadcastAnnouncementEmail({
        studentEmail: "cohort@campusflow.edu",
        studentName: "Candidate",
        title: "Upcoming Campus Drive Schedule",
        message: "Please assemble in Auditorium B at 10 AM.",
        priority: "urgent"
    });

    assert.equal(res.accepted, true);
    assert.equal(sent.length, 1);
    assert.match(sent[0].subject, /URGENT/);
    assert.match(sent[0].html, /Auditorium B/);
});
