import test from "node:test";
import assert from "node:assert/strict";
import {
    isPrivateOrReservedIp,
    validateHostForSsrf,
    safeFetchUrl,
    normalizeName,
    compareStudentIdentity,
    inspectIssuerFromUrl,
    extractHtmlMetadata,
    verifyCertificatePipeline,
    extractTextFromPdfBuffer,
    cleanCertificateTitle,
    isLoginPageOrErrorPage,
    extractDetailsFromText,
    normalizeUrl,
    computeFileHash,
    checkCrossStudentDuplicate
} from "../src/services/certificateVerification.service.js";
import { persistValidatedCertificate } from "../src/controllers/studentProfile.controller.js";

test("Certificate Verification & SSRF Security Test Suite", async (t) => {
    await t.test("1. SSRF Defense: Detects all IPv4 and IPv6 loopback, private, and link-local IPs", () => {
        // Loopback
        assert.equal(isPrivateOrReservedIp("127.0.0.1"), true);
        assert.equal(isPrivateOrReservedIp("127.255.255.254"), true);
        assert.equal(isPrivateOrReservedIp("::1"), true);

        // Link-local / Cloud Metadata (AWS / GCP / Azure)
        assert.equal(isPrivateOrReservedIp("169.254.169.254"), true);
        assert.equal(isPrivateOrReservedIp("169.254.1.1"), true);

        // RFC 1918 Private Ranges
        assert.equal(isPrivateOrReservedIp("10.0.0.1"), true);
        assert.equal(isPrivateOrReservedIp("10.254.254.254"), true);
        assert.equal(isPrivateOrReservedIp("172.16.0.1"), true);
        assert.equal(isPrivateOrReservedIp("172.31.255.255"), true);
        assert.equal(isPrivateOrReservedIp("192.168.0.1"), true);
        assert.equal(isPrivateOrReservedIp("192.168.1.100"), true);

        // Carrier-grade NAT & Current network
        assert.equal(isPrivateOrReservedIp("0.0.0.0"), true);
        assert.equal(isPrivateOrReservedIp("100.64.0.1"), true);

        // Public IPs must pass
        assert.equal(isPrivateOrReservedIp("8.8.8.8"), false);
        assert.equal(isPrivateOrReservedIp("1.1.1.1"), false);
        assert.equal(isPrivateOrReservedIp("142.250.190.46"), false);
    });

    await t.test("2. SSRF Defense: Blocks dangerous hostnames without external network calls", async () => {
        await assert.rejects(
            async () => await validateHostForSsrf("localhost"),
            /Access to private host 'localhost' is prohibited/
        );
        await assert.rejects(
            async () => await validateHostForSsrf("metadata.google.internal"),
            /Access to private host/
        );
        await assert.rejects(
            async () => await validateHostForSsrf("service.local"),
            /Access to private host/
        );
        await assert.rejects(
            async () => await validateHostForSsrf("127.0.0.1"),
            /Access to private/
        );
        await assert.rejects(
            async () => await validateHostForSsrf("169.254.169.254"),
            /Access to private/
        );
    });

    await t.test("3. SafeFetch: Rejects prohibited protocols immediately", async () => {
        await assert.rejects(
            async () => await safeFetchUrl("file:///etc/passwd"),
            /Unsupported protocol 'file:'/
        );
        await assert.rejects(
            async () => await safeFetchUrl("ftp://credentials.internal/doc"),
            /Unsupported protocol 'ftp:'/
        );
        await assert.rejects(
            async () => await safeFetchUrl("javascript:alert(1)"),
            /Unsupported protocol 'javascript:'/
        );
    });

    await t.test("4. SafeFetch: Rejects invalid or unparseable URLs", async () => {
        await assert.rejects(
            async () => await safeFetchUrl("not-a-valid-url"),
            /Invalid URL format/
        );
    });

    await t.test("5. Identity Matching: Correctly identifies exact student name matches", () => {
        const result = compareStudentIdentity("Akshat Sharma", "Akshat Sharma");
        assert.equal(result.status, "Match");
        assert.equal(result.confidence, "high");

        // Case insensitivity and whitespace normalization
        const result2 = compareStudentIdentity("  akshat   sharma ", "AKSHAT SHARMA");
        assert.equal(result2.status, "Match");

        // Honorific removal (Mr., Shri, etc.)
        const result3 = compareStudentIdentity("Mr. Akshat Sharma", "Akshat Sharma");
        assert.equal(result3.status, "Match");
    });

    await t.test("6. Identity Matching: Correctly flags multi-part or middle name as Possible Match", () => {
        const result = compareStudentIdentity("Akshat Kumar Sharma", "Akshat Sharma");
        assert.equal(result.status, "Possible Match");
        assert.match(result.reason, /matches primary name tokens/i);

        const result2 = compareStudentIdentity("Akshat Sharma", "Akshat K. Sharma");
        assert.equal(result2.status, "Possible Match");
    });

    await t.test("7. Identity Matching: Correctly flags completely different names as Mismatch", () => {
        const result = compareStudentIdentity("Vikram Patel", "Akshat Sharma");
        assert.equal(result.status, "Mismatch");
        assert.equal(result.confidence, "high");
    });

    await t.test("8. Identity Matching: Handles missing extracted recipient name as Insufficient Information", () => {
        const result = compareStudentIdentity("", "Akshat Sharma");
        assert.equal(result.status, "Insufficient Information");
        assert.equal(result.confidence, "none");
    });

    await t.test("9. Known Issuer Inspection: Recognizes Coursera credential verification URLs", () => {
        const info = inspectIssuerFromUrl("https://coursera.org/verify/ABC123XYZ999");
        assert.equal(info.issuer, "Coursera");
        assert.equal(info.credentialId, "ABC123XYZ999");
        assert.equal(info.isOfficialVerificationUrl, true);
    });

    await t.test("10. Known Issuer Inspection: Recognizes Credly badge verification URLs", () => {
        const info = inspectIssuerFromUrl("https://www.credly.com/badges/550e8400-e29b-41d4-a716-446655440000");
        assert.equal(info.issuer, "Credly");
        assert.equal(info.credentialId, "550e8400-e29b-41d4-a716-446655440000");
        assert.equal(info.isOfficialVerificationUrl, true);
    });

    await t.test("11. Known Issuer Inspection: Recognizes HackerRank certificate URLs", () => {
        const info = inspectIssuerFromUrl("https://www.hackerrank.com/certificates/e4d909c2a123");
        assert.equal(info.issuer, "HackerRank");
        assert.equal(info.credentialId, "e4d909c2a123");
        assert.equal(info.isOfficialVerificationUrl, true);
    });

    await t.test("12. Known Issuer Inspection: Categorizes unknown domains as Generic URLs", () => {
        const info = inspectIssuerFromUrl("https://mycompany.com/certificate/12345");
        assert.equal(info.type, "GENERIC_URL");
        assert.equal(info.isOfficialVerificationUrl, false);
    });

    await t.test("13. HTML Metadata Extraction: Extracts Open Graph and title metadata safely", () => {
        const sampleHtml = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Machine Learning Specialization - Coursera</title>
                    <meta property="og:title" content="Machine Learning Specialization by Stanford University" />
                    <meta property="og:site_name" content="Coursera" />
                    <meta property="og:description" content="Completed by Akshat Sharma" />
                </head>
                <body>
                    <div class="recipient">Akshat Sharma</div>
                </body>
            </html>
        `;
        const meta = extractHtmlMetadata(sampleHtml);
        assert.equal(meta.title, "Machine Learning Specialization by Stanford University");
        assert.equal(meta.siteName, "Coursera");
    });

    await t.test("14. Master Pipeline: Gracefully falls back when Gemini API key is absent without throwing", async () => {
        const mockStudent = {
            user: {
                fullName: "Akshat Sharma",
                email: "akshat@example.com"
            }
        };

        const result = await verifyCertificatePipeline({
            certificateUrl: "https://coursera.org/verify/DEMO123456",
            student: mockStudent
        });

        assert.ok(result);
        assert.equal(result.issuer, "Coursera");
        assert.equal(result.credentialId, "DEMO123456");
        // Non-breaking fallback in aiAnalysis
        assert.ok(result.aiAnalysis);
        assert.ok(typeof result.aiAnalysis.summary === "string");
        assert.ok(Array.isArray(result.aiAnalysis.warnings));
    });

    await t.test("15. Authoritative Status Rule: Non-official sources are NEVER automatically marked 'Verified'", async () => {
        const mockStudent = {
            user: {
                fullName: "Priya Singh",
                email: "priya@example.com"
            }
        };

        // Even with a generic URL that mentions the student, absence of an official issuer mechanism prevents "Verified"
        const result = await verifyCertificatePipeline({
            certificateUrl: "https://generic-unknown-issuer.org/certificate/999",
            student: mockStudent
        });

        assert.notEqual(result.verificationStatus, "Verified");
        assert.ok(["Unable to Verify", "Needs Review"].includes(result.verificationStatus));
    });

    await t.test("16. Name Normalization: Preserves core alphanumeric tokens and ignores excess punctuation", () => {
        assert.equal(normalizeName("Dr. Jane  Doe, Ph.D."), "jane doe ph d");
        assert.equal(normalizeName("  Mohammad   Ali-Reza  "), "mohammad ali reza");
    });

    await t.test("17. PDF Buffer Text Extraction: Successfully reads text from binary PDF buffer", async () => {
        const testPdf = Buffer.from(
            "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
            "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
            "3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n" +
            "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n" +
            "5 0 obj\n<< /Length 75 >>\nstream\n" +
            "BT /F1 12 Tf 72 712 Td (This is to certify that Laksh Suthar has completed AWS Solutions) Tj ET\n" +
            "endstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000216 00000 n \n0000000293 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n417\n%%EOF"
        );

        const extractedText = await extractTextFromPdfBuffer(testPdf);
        assert.ok(extractedText);
        assert.match(extractedText, /Laksh Suthar/);
        assert.match(extractedText, /AWS Solutions/);
    });

    await t.test("18. Title Cleaning: Strips raw URLs and provides human-readable titles", () => {
        assert.equal(cleanCertificateTitle("https://coursera.org/verify/123", "Coursera"), "Coursera Certificate");
        assert.equal(cleanCertificateTitle("http://example.com/cert.pdf", ""), "Untitled Certificate");
        assert.equal(cleanCertificateTitle("www.hackerrank.com/certificates/abc", "HackerRank"), "HackerRank Certificate");
        assert.equal(cleanCertificateTitle("AWS Certified Developer Associate", "AWS"), "AWS Certified Developer Associate");
        assert.equal(cleanCertificateTitle("", "Udemy"), "Udemy Certificate");
    });

    await t.test("19. Login & Error Page Detection: Flags authentication walls and 404s", () => {
        assert.equal(isLoginPageOrErrorPage("<html><body><input type=\"password\" name=\"pwd\"/></body></html>", 200), true);
        assert.equal(isLoginPageOrErrorPage("<html><body><h1>Please sign in to view certificate</h1></body></html>", 200), true);
        assert.equal(isLoginPageOrErrorPage("<html><body><h1>404 Not Found</h1></body></html>", 404), true);
        assert.equal(isLoginPageOrErrorPage("<html><body><h1>Welcome to Cloud Computing Certificate</h1></body></html>", 200), false);
    });

    await t.test("20. Heuristic Text Parsing: Extracts recipient, title, issuer, dates, and credential ID", () => {
        const text = `
            CERTIFICATE OF COMPLETION
            This is to certify that Laksh Suthar
            has successfully completed AWS Certified Solutions Architect
            Issued on: 12 August 2026
            Credential ID: AWS-849201-XYZ
            Amazon Web Services Academy
        `;
        const extracted = extractDetailsFromText(text);
        assert.equal(extracted.recipientName, "Laksh Suthar");
        assert.equal(extracted.issuer, "AWS");
        assert.equal(extracted.credentialId, "AWS-849201-XYZ");
        assert.equal(extracted.issueDate, "12 August 2026");
        assert.ok(extracted.title);
    });

    await t.test("21. Automatic Certificate Persistence & Idempotency: Updates existing record without duplicates", async () => {
        const fakeStudentProfile = {
            certificates: [],
            save: async function () { return this; }
        };

        const cert1 = {
            title: "AWS Cloud Practitioner",
            issuer: "AWS",
            recipientName: "Akshat Sharma",
            credentialId: "AWS-112233",
            certificateUrl: "https://aws.amazon.com/verify/112233",
            verificationStatus: "Verified",
            verificationMethod: "OFFICIAL_ISSUER"
        };

        // First call: appends certificate
        await persistValidatedCertificate(fakeStudentProfile, cert1);
        assert.equal(fakeStudentProfile.certificates.length, 1);
        assert.equal(fakeStudentProfile.certificates[0].title, "AWS Cloud Practitioner");
        assert.equal(fakeStudentProfile.certificates[0].credentialId, "AWS-112233");

        // Second call with same credential ID: updates in-place, does not create duplicate
        const cert1Updated = {
            title: "AWS Certified Cloud Practitioner - Updated",
            issuer: "AWS",
            recipientName: "Akshat Sharma",
            credentialId: "AWS-112233",
            certificateUrl: "https://aws.amazon.com/verify/112233",
            verificationStatus: "Verified",
            verificationMethod: "OFFICIAL_ISSUER"
        };

        await persistValidatedCertificate(fakeStudentProfile, cert1Updated);
        assert.equal(fakeStudentProfile.certificates.length, 1, "Must maintain exactly 1 record without duplicates");
        assert.equal(fakeStudentProfile.certificates[0].title, "AWS Certified Cloud Practitioner - Updated");
    });

    await t.test("22. URL Normalization: Safely strips tracking query parameters while preserving credential identity", () => {
        const rawUrl = "HTTPS://Coursera.org/verify/ABC123XYZ/?utm_source=email&utm_medium=button&ref=student_portal#tab1";
        const normalized = normalizeUrl(rawUrl);
        assert.equal(normalized, "https://coursera.org/verify/ABC123XYZ");

        // Preserves essential query params while lowercasing host and trimming slash
        const paramUrl = "https://example.com/certificates/verify/?id=CERT-999&auth=valid&utm_campaign=winter";
        const normalizedParam = normalizeUrl(paramUrl);
        assert.equal(normalizedParam, "https://example.com/certificates/verify?id=CERT-999&auth=valid");
    });

    await t.test("23. Content Hashing: Computes SHA-256 to detect byte-identical documents regardless of filename", () => {
        const buffer1 = Buffer.from("PDF-Certificate-Contents-Student-A");
        const buffer2 = Buffer.from("PDF-Certificate-Contents-Student-A");
        const buffer3 = Buffer.from("PDF-Certificate-Contents-Student-B");

        const hash1 = computeFileHash(buffer1);
        const hash2 = computeFileHash(buffer2);
        const hash3 = computeFileHash(buffer3);

        assert.equal(hash1, hash2, "Identical buffers must produce identical SHA-256 hashes");
        assert.notEqual(hash1, hash3, "Different content must produce different SHA-256 hashes");
        assert.equal(hash1.length, 64, "SHA-256 hash must be 64-char hexadecimal");
    });

    await t.test("24. Order-Independent Identity Matching: Recognizes inverted name formatting as MATCH", () => {
        // "Sharma Akshat" vs "Akshat Sharma"
        const result = compareStudentIdentity("Sharma Akshat", "Akshat Sharma");
        assert.equal(result.ownershipStatus, "MATCH");
        assert.equal(result.status, "Match");

        // With honorific and inverted tokens: "Er. Sharma Akshat" vs "Akshat Sharma"
        const result2 = compareStudentIdentity("Er. Sharma Akshat", "Akshat Sharma");
        assert.equal(result2.ownershipStatus, "MATCH");

        // Clear mismatch: "Rohit Verma" vs "Akshat Sharma"
        const resultMismatch = compareStudentIdentity("Rohit Verma", "Akshat Sharma");
        assert.equal(resultMismatch.ownershipStatus, "MISMATCH");
        assert.equal(resultMismatch.status, "Mismatch");

        // Insufficient info: empty string or whitespace
        const resultEmpty = compareStudentIdentity("", "Akshat Sharma");
        assert.equal(resultEmpty.ownershipStatus, "INSUFFICIENT_INFORMATION");
    });

    await t.test("25. Cross-Student Duplicate Detection: Detects identical credential ID & issuer across different students", async () => {
        // Mock StudentProfileModel with another student having the same credential ID & issuer
        const mockModel = {
            findOne: () => ({
                select: () => ({
                    lean: () => Promise.resolve({
                        _id: "other-student-profile-id",
                        certificates: [{
                            credentialId: "CERT-1001",
                            issuer: "Coursera",
                            title: "Machine Learning",
                            recipientName: "Student Alpha"
                        }]
                    })
                })
            })
        };

        const dupResult = await checkCrossStudentDuplicate({
            credentialId: "CERT-1001",
            issuer: "Coursera",
            certificateUrl: "https://coursera.org/verify/CERT-1001",
            fileHash: "hash-alpha-12345678",
            currentStudentProfileId: "current-student-profile-id",
            StudentProfileModel: mockModel
        });

        assert.equal(dupResult.isDuplicate, true);
        assert.equal(dupResult.duplicateStatus, "CROSS_STUDENT_DUPLICATE");
        assert.equal(dupResult.conflictSignal, "CREDENTIAL_ID_ISSUER");
        // Safe message without exposing personal information of Student Alpha
        assert.equal(dupResult.message, "This credential appears to be associated with another submission. Additional ownership verification is required.");
        assert.equal(dupResult.conflictingProfileId, undefined, "Must NOT expose conflicting student ID");
    });

    await t.test("26. Cross-Student Duplicate Detection: Detects identical fileHash across different students", async () => {
        const mockModel = {
            findOne: () => ({
                select: () => ({
                    lean: () => Promise.resolve({
                        _id: "student-1",
                        certificates: [{
                            fileHash: "sha256-matching-identical-pdf",
                            title: "AWS Certificate"
                        }]
                    })
                })
            })
        };

        const dupResult = await checkCrossStudentDuplicate({
            credentialId: "",
            issuer: "Unknown",
            certificateUrl: "",
            fileHash: "sha256-matching-identical-pdf",
            currentStudentProfileId: "student-2",
            StudentProfileModel: mockModel
        });

        assert.equal(dupResult.isDuplicate, true);
        assert.equal(dupResult.duplicateStatus, "CROSS_STUDENT_DUPLICATE");
        assert.equal(dupResult.conflictSignal, "FILE_HASH");
    });

    await t.test("27. Cross-Student Duplicate Detection: Does NOT flag distinct certificates from the same issuer", async () => {
        const mockModel = {
            findOne: () => ({
                select: () => ({
                    lean: () => Promise.resolve(null)
                })
            })
        };

        const dupResult = await checkCrossStudentDuplicate({
            credentialId: "DISTINCT-ID-2002",
            issuer: "Coursera",
            certificateUrl: "https://coursera.org/verify/DISTINCT-ID-2002",
            fileHash: "hash-distinct-45678",
            currentStudentProfileId: "current-student-id",
            StudentProfileModel: mockModel
        });

        assert.equal(dupResult.isDuplicate, false);
        assert.equal(dupResult.duplicateStatus, "NONE");
    });

    await t.test("28. Decision Policy & Persistence: Authentic certificate with ownership MATCH is verified directly", async () => {
        const fakeStudentProfile = {
            certificates: [],
            save: async function () { return this; }
        };

        const authenticCert = {
            title: "Google Professional Data Engineer",
            issuer: "Google Cloud",
            recipientName: "Akshat Sharma",
            credentialId: "GCP-987654",
            certificateUrl: "https://www.credential.net/gcp-987654",
            verificationStatus: "Verified",
            authenticityStatus: "AUTHENTIC",
            ownershipStatus: "MATCH",
            duplicateStatus: "NONE"
        };

        const certs = await persistValidatedCertificate(fakeStudentProfile, authenticCert);
        const saved = certs[0];
        assert.equal(saved.verificationStatus, "Verified", "Genuine certificate owned by student must be Verified directly without forced review");
        assert.equal(saved.certificateUrl, "https://www.credential.net/gcp-987654");
        assert.equal(saved.documentUrl, "https://www.credential.net/gcp-987654");
    });

    await t.test("29. Decision Policy & Persistence: Cross-student duplicate is blocked from Verified status", async () => {
        const fakeStudentProfile = {
            certificates: [],
            save: async function () { return this; }
        };

        const conflictingCert = {
            title: "Google Professional Data Engineer",
            issuer: "Google Cloud",
            recipientName: "Akshat Sharma",
            credentialId: "GCP-987654",
            certificateUrl: "https://www.credential.net/gcp-987654",
            verificationStatus: "Verified",
            authenticityStatus: "AUTHENTIC",
            ownershipStatus: "MATCH",
            duplicateStatus: "CROSS_STUDENT_DUPLICATE",
            duplicateDetails: "This credential appears to be associated with another submission. Additional ownership verification is required."
        };

        const certs = await persistValidatedCertificate(fakeStudentProfile, conflictingCert);
        const saved = certs[0];
        assert.equal(saved.verificationStatus, "Needs Review", "Cross-student duplicate MUST be blocked from Verified status");
        assert.equal(saved.duplicateStatus, "CROSS_STUDENT_DUPLICATE");
    });

    await t.test("30. Decision Policy & Persistence: Recipient mismatch is blocked from Verified status", async () => {
        const fakeStudentProfile = {
            certificates: [],
            save: async function () { return this; }
        };

        const mismatchedCert = {
            title: "AWS Solutions Architect",
            issuer: "AWS",
            recipientName: "Someone Else",
            credentialId: "AWS-555555",
            certificateUrl: "https://aws.amazon.com/verify/555555",
            verificationStatus: "Verified",
            authenticityStatus: "AUTHENTIC",
            ownershipStatus: "MISMATCH",
            duplicateStatus: "NONE"
        };

        const certs = await persistValidatedCertificate(fakeStudentProfile, mismatchedCert);
        const saved = certs[0];
        assert.equal(saved.verificationStatus, "Needs Review", "Recipient mismatch MUST be blocked from Verified status");
        assert.equal(saved.ownershipStatus, "MISMATCH");
    });

    await t.test("31. Direct Credential Viewing: Directly attaches URL so [View Credential] opens accurately", async () => {
        const fakeStudentProfile = {
            certificates: [],
            save: async function () { return this; }
        };

        const certWithUrl = {
            title: "HackerRank Problem Solving",
            issuer: "HackerRank",
            recipientName: "Akshat Sharma",
            credentialId: "HR-998877",
            url: "https://www.hackerrank.com/certificates/HR-998877",
            authenticityStatus: "AUTHENTIC",
            ownershipStatus: "MATCH",
            duplicateStatus: "NONE"
        };

        const certs = await persistValidatedCertificate(fakeStudentProfile, certWithUrl);
        const saved = certs[0];
        // Both certificateUrl and documentUrl must receive the direct resolved URL
        assert.equal(saved.certificateUrl, "https://www.hackerrank.com/certificates/HR-998877");
        assert.equal(saved.documentUrl, "https://www.hackerrank.com/certificates/HR-998877");
    });
});
