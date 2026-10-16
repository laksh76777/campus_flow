import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
    normalizeUSN,
    normalizeName,
    parseCompanyResultFile,
} from "../src/services/automatedDrive.service.js";

test("1. USN Normalization handles case, whitespace, and hyphens", () => {
    assert.equal(normalizeUSN(" 1ms23cs001 "), "1MS23CS001");
    assert.equal(normalizeUSN("1MS-23-CS-002"), "1MS23CS002");
    assert.equal(normalizeUSN("1ms 23 is 045"), "1MS23IS045");
    assert.equal(normalizeUSN(""), "");
    assert.equal(normalizeUSN(null), "");
});

test("2. Candidate name normalization for cross-checking", () => {
    assert.equal(normalizeName("Rahul Sharma "), "rahulsharma");
    assert.equal(normalizeName("Ananya  V. Rao"), "ananyavrao");
    assert.equal(normalizeName(""), "");
});

test("3. Parse company result Excel (.xlsx) file with USN auto-detection", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Round 1 Results");

    sheet.addRow(["Sl No", "Candidate USN", "Student Name", "Email Address", "Status"]);
    sheet.addRow([1, "1MS23CS001", "Aarav Kumar", "aarav@campusflow.edu", "Shortlisted"]);
    sheet.addRow([2, "1MS23CS002", "Pooja Patel", "pooja@campusflow.edu", "Shortlisted"]);
    sheet.addRow([3, "1MS23CS003", "Rohan Mehta", "rohan@campusflow.edu", "Rejected"]);

    const buffer = await workbook.xlsx.writeBuffer();
    const parsed = await parseCompanyResultFile(Buffer.from(buffer), "Company_Round1_Results.xlsx");

    assert.equal(parsed.length, 3);
    assert.equal(parsed[0].usn, "1MS23CS001");
    assert.equal(parsed[0].name, "Aarav Kumar");
    assert.equal(parsed[0].status, "Shortlisted");
    assert.equal(parsed[1].usn, "1MS23CS002");
    assert.equal(parsed[2].usn, "1MS23CS003");
    assert.equal(parsed[2].status, "Rejected");
});

test("4. Parse company result CSV (.csv) file with column mapping", async () => {
    const csvContent = `USN,Name,Email,Result\n1MS23CS004,Sneha Rao,sneha@campusflow.edu,Selected\n1MS23CS005,Vikram Singh,vikram@campusflow.edu,Shortlisted\n`;
    const buffer = Buffer.from(csvContent, "utf-8");
    const parsed = await parseCompanyResultFile(buffer, "Shortlist.csv");

    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].usn, "1MS23CS004");
    assert.equal(parsed[0].name, "Sneha Rao");
    assert.equal(parsed[0].status, "Selected");
    assert.equal(parsed[1].usn, "1MS23CS005");
});

test("5. Parse text-readable result data with USN extraction", async () => {
    // Simulating extracted text lines from PDF or plain text
    const textData = `
    Candidate Assessment Results
    1MS23CS010 - Karthik Gowda - Cleared Round
    1MS23CS011 - Neha Reddy - Shortlisted
    `;
    const buffer = Buffer.from(textData, "utf-8");
    const parsed = await parseCompanyResultFile(buffer, "Results.pdf");

    assert.ok(parsed.length >= 2, "Should extract USNs from text data");
    const usns = parsed.map(p => p.usn);
    assert.ok(usns.includes("1MS23CS010"));
    assert.ok(usns.includes("1MS23CS011"));
});
