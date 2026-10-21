import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import {
    previewRoundResults,
    commitRoundResults,
    LEGAL_TRANSITIONS
} from "../src/services/automatedDrive.service.js";
import { PlacementDrive } from "../src/models/placementDrive.model.js";
import { Application } from "../src/models/application.model.js";
import { ImportBatch } from "../src/models/importBatch.model.js";
import { Notification } from "../src/models/notification.model.js";

// Helper to mock mongoose query chains (.populate, .lean, .session)
function createQuery(result) {
    const chain = {
        populate: () => chain,
        lean: () => Promise.resolve(result),
        session: () => Promise.resolve(result),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
        catch: (reject) => Promise.resolve(result).catch(reject)
    };
    return chain;
}

test("Automated Placement Drive Integrity & Regression Test Suite", async (t) => {
    // Save original model methods
    const origDriveFindById = PlacementDrive.findById;
    const origAppFind = Application.find;
    const origAppFindById = Application.findById;
    const origBatchCreate = ImportBatch.create;
    const origBatchFindOneAndUpdate = ImportBatch.findOneAndUpdate;
    const origNotifFindOne = Notification.findOne;
    const origNotifInsertMany = Notification.insertMany;

    // In-memory isolated state for testing
    const driveAId = "60c72b2f9b1d8b2bad000001";
    const driveBId = "60c72b2f9b1d8b2bad000002";
    const adminUserId = "60c72b2f9b1d8b2bad000099";

    // Create 10 mock applications for drive A
    const mockApplications = Array.from({ length: 10 }, (_, i) => {
        const num = String(i + 1).padStart(3, "0");
        const appId = `60c72b2f9b1d8b2bad0001${num}`;
        const usn = `1MS25CS${num}`;
        const userId = `60c72b2f9b1d8b2bad0002${num}`;
        return {
            _id: appId,
            placementDrive: driveAId,
            student: {
                _id: `60c72b2f9b1d8b2bad0003${num}`,
                usn,
                branch: "CSE",
                user: { _id: userId, fullName: `Candidate ${i + 1}`, email: `cand${i + 1}@campusflow.edu` }
            },
            submittedSnapshot: {
                usn,
                fullName: `Candidate ${i + 1}`,
                email: `cand${i + 1}@campusflow.edu`,
                branch: "CSE"
            },
            status: "applied",
            interviewRounds: [],
            statusHistory: [
                { fromStatus: null, toStatus: "applied", remarks: "Initial application", updatedAt: new Date() }
            ],
            save: async function() { return this; }
        };
    });

    // Create 1 cross-drive application belonging to drive B
    const crossDriveApp = {
        _id: "60c72b2f9b1d8b2bad000999",
        placementDrive: driveBId,
        student: {
            _id: "60c72b2f9b1d8b2bad000888",
            usn: "1MS25EC099",
            branch: "ECE",
            user: { _id: "60c72b2f9b1d8b2bad000777", fullName: "Cross Drive Student", email: "cross@campusflow.edu" }
        },
        submittedSnapshot: { usn: "1MS25EC099", fullName: "Cross Drive Student", email: "cross@campusflow.edu" },
        status: "applied",
        interviewRounds: [],
        statusHistory: [],
        save: async function() { return this; }
    };

    // Mock drive A document
    const mockDriveA = {
        _id: driveAId,
        jobTitle: "Cloud Architect",
        package: 1800000,
        company: { _id: "60c72b2f9b1d8b2bad000005", companyName: "CloudTech Labs" },
        placementSession: "60c72b2f9b1d8b2bad000006",
        currentRoundNumber: 1,
        isPlacementCompleted: false,
        isActive: true,
        selectionRounds: [
            { roundNumber: 1, name: "Screening Assessment", status: "in_progress", advancedCount: 0, rejectedCount: 0 },
            { roundNumber: 2, name: "Technical Interview", status: "pending", advancedCount: 0, rejectedCount: 0 },
            { roundNumber: 3, name: "Final Selection", status: "pending", advancedCount: 0, rejectedCount: 0 }
        ],
        save: async function() { return this; }
    };

    const batchesStore = [];
    const notificationsStore = [];

    // Install mocks
    PlacementDrive.findById = (id) => {
        if (id?.toString() === driveAId.toString()) return createQuery(mockDriveA);
        return createQuery(null);
    };

    Application.find = (filter) => {
        if (filter.placementDrive?.toString() === driveAId.toString()) {
            return createQuery(mockApplications);
        }
        return createQuery([]);
    };

    Application.findById = (id) => {
        const targetId = id?.toString();
        const found = mockApplications.find((a) => a._id.toString() === targetId);
        if (found) return createQuery(found);
        if (crossDriveApp._id.toString() === targetId) return createQuery(crossDriveApp);
        return createQuery(null);
    };

    ImportBatch.create = async (doc) => {
        batchesStore.push(doc);
        return doc;
    };

    ImportBatch.findOneAndUpdate = async (filter, update) => {
        const existing = batchesStore.find((b) => b.batchId === filter.batchId);
        if (existing) {
            Object.assign(existing, update.$set);
            return existing;
        }
        const created = { ...filter, ...update.$set };
        batchesStore.push(created);
        return created;
    };

    Notification.findOne = async () => null;
    Notification.insertMany = async (items) => {
        notificationsStore.push(...items);
        return items;
    };

    t.after(() => {
        PlacementDrive.findById = origDriveFindById;
        Application.find = origAppFind;
        Application.findById = origAppFindById;
        ImportBatch.create = origBatchCreate;
        ImportBatch.findOneAndUpdate = origBatchFindOneAndUpdate;
        Notification.findOne = origNotifFindOne;
        Notification.insertMany = origNotifInsertMany;
    });

    // -------------------------------------------------------------------------
    // Subtest 1: Preview parses Excel and detects exceptions (unknown USN, duplicate, mismatch)
    // -------------------------------------------------------------------------
    await t.test("1. Preview parses results and detects exceptions accurately", async () => {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Round 1");
        ws.addRow(["USN", "Candidate Name", "Email", "Status"]);
        ws.addRow(["1MS25CS001", "Candidate 1", "cand1@campusflow.edu", "Shortlisted"]);
        ws.addRow(["1MS25CS002", "Wrong Name", "cand2@campusflow.edu", "Shortlisted"]); // Name mismatch
        ws.addRow(["1MS25CS003", "Candidate 3", "cand3@campusflow.edu", "Shortlisted"]);
        ws.addRow(["1MS25CS003", "Candidate 3", "cand3@campusflow.edu", "Shortlisted"]); // Duplicate row
        ws.addRow(["1MS25CS999", "Unknown Student", "unknown@campusflow.edu", "Shortlisted"]); // Unknown USN

        const buffer = await wb.xlsx.writeBuffer();
        const preview = await previewRoundResults({
            driveId: driveAId,
            roundNumber: 1,
            fileBuffer: Buffer.from(buffer),
            originalFilename: "R1_Results.xlsx",
            mode: "shortlist_only",
            adminUserId
        });

        assert.equal(preview.roundNumber, 1);
        assert.ok(preview.batchId, "Preview must generate and return a batchId");
        assert.ok(preview.proposedAdvances.some((p) => p.usn === "1MS25CS001"));

        // Verify exceptions detected
        const exTypes = preview.exceptions.map((e) => e.type);
        assert.ok(exTypes.includes("IDENTITY_MISMATCH"), "Must detect identity mismatch");
        assert.ok(exTypes.includes("DUPLICATE_USN_IN_FILE"), "Must detect duplicate USN in file");
        assert.ok(exTypes.includes("UNKNOWN_USN"), "Must detect unknown USN");

        // Verify ImportBatch preview persistence
        assert.ok(batchesStore.some((b) => b.batchId === preview.batchId && b.status === "PREVIEWED"));
    });

    // -------------------------------------------------------------------------
    // Subtest 2: Security - Reject Cross-Drive Application IDs
    // -------------------------------------------------------------------------
    await t.test("2. Rejects application IDs belonging to another placement drive", async () => {
        await assert.rejects(
            async () => {
                await commitRoundResults({
                    driveId: driveAId,
                    roundNumber: 1,
                    mode: "shortlist_only",
                    confirmedAdvances: [
                        { applicationId: crossDriveApp._id, remarks: "Illegal cross-drive advance" }
                    ],
                    confirmedRejections: [],
                    confirmedExceptionResolutions: [],
                    adminUserId
                });
            },
            (err) => {
                assert.match(err.message, /Cross-drive application commits are strictly rejected/i);
                return true;
            }
        );
    });

    // -------------------------------------------------------------------------
    // Subtest 3: Security - Reject Empty Imports
    // -------------------------------------------------------------------------
    await t.test("3. Rejects empty imports when candidate pool has active candidates", async () => {
        await assert.rejects(
            async () => {
                await commitRoundResults({
                    driveId: driveAId,
                    roundNumber: 1,
                    mode: "shortlist_only",
                    autoRejectAbsent: false,
                    confirmedAdvances: [],
                    confirmedRejections: [],
                    confirmedExceptionResolutions: [],
                    adminUserId
                });
            },
            (err) => {
                assert.match(err.message, /Cannot commit empty results/i);
                return true;
            }
        );
    });

    // -------------------------------------------------------------------------
    // Subtest 4: Security - Unresolved candidates in shortlist-only mode prevent completion
    // -------------------------------------------------------------------------
    await t.test("4. Incomplete results prevent round completion when autoRejectAbsent is false", async () => {
        await assert.rejects(
            async () => {
                await commitRoundResults({
                    driveId: driveAId,
                    roundNumber: 1,
                    mode: "shortlist_only",
                    autoRejectAbsent: false, // Explicit confirmation NOT given
                    confirmedAdvances: [
                        { applicationId: mockApplications[0]._id },
                        { applicationId: mockApplications[1]._id }
                    ],
                    confirmedRejections: [],
                    confirmedExceptionResolutions: [],
                    adminUserId
                });
            },
            (err) => {
                assert.match(err.message, /unresolved outcomes/i);
                return true;
            }
        );
    });

    // -------------------------------------------------------------------------
    // Subtest 5: Round 1 Execution - 10 applicants -> 7 advances, 3 confirmed rejections
    // -------------------------------------------------------------------------
    await t.test("5. Round 1 commit: 10 applicants, 7 advances, 3 confirmed rejections", async () => {
        const advances = mockApplications.slice(0, 7).map((a) => ({ applicationId: a._id }));
        const rejections = mockApplications.slice(7, 10).map((a) => ({ applicationId: a._id }));

        const r1Result = await commitRoundResults({
            driveId: driveAId,
            roundNumber: 1,
            mode: "complete_results",
            autoRejectAbsent: false,
            confirmedAdvances: advances,
            confirmedRejections: rejections,
            confirmedExceptionResolutions: [],
            adminUserId
        });

        assert.equal(r1Result.success, true);
        assert.equal(r1Result.advancedCount, 7);
        assert.equal(r1Result.rejectedCount, 3);

        // Verify status updates
        for (let i = 0; i < 7; i++) {
            assert.equal(mockApplications[i].status, "shortlisted");
            assert.equal(mockApplications[i].interviewRounds[0].status, "cleared");
        }
        for (let i = 7; i < 10; i++) {
            assert.equal(mockApplications[i].status, "rejected");
            assert.equal(mockApplications[i].interviewRounds[0].status, "failed");
        }

        // Verify drive progressed to round 2
        assert.equal(mockDriveA.currentRoundNumber, 2);
        assert.equal(mockDriveA.selectionRounds[0].status, "completed");
        assert.equal(mockDriveA.selectionRounds[1].status, "in_progress");

        // Verify batch was committed
        assert.ok(batchesStore.some((b) => b.importType === "automated_drive_results" && b.status === "COMMITTED"));
    });

    // -------------------------------------------------------------------------
    // Subtest 6: Security - Out-of-round candidates rejected
    // -------------------------------------------------------------------------
    await t.test("6. Out-of-round candidate rejected (previously rejected candidate cannot advance in R2)", async () => {
        await assert.rejects(
            async () => {
                await commitRoundResults({
                    driveId: driveAId,
                    roundNumber: 2,
                    mode: "complete_results",
                    confirmedAdvances: [
                        { applicationId: mockApplications[7]._id } // Candidate 8 was rejected in R1
                    ],
                    confirmedRejections: [],
                    confirmedExceptionResolutions: [],
                    adminUserId
                });
            },
            (err) => {
                assert.match(err.message, /not in the active candidate pool/i);
                return true;
            }
        );
    });

    // -------------------------------------------------------------------------
    // Subtest 7: Round 2 Execution - 7 candidates -> 5 advances, 2 rejections
    // -------------------------------------------------------------------------
    await t.test("7. Round 2 commit: 7 candidates, 5 advances, 2 rejections", async () => {
        const r2Advances = mockApplications.slice(0, 5).map((a) => ({ applicationId: a._id }));
        const r2Rejections = mockApplications.slice(5, 7).map((a) => ({ applicationId: a._id }));

        const r2Result = await commitRoundResults({
            driveId: driveAId,
            roundNumber: 2,
            mode: "complete_results",
            confirmedAdvances: r2Advances,
            confirmedRejections: r2Rejections,
            confirmedExceptionResolutions: [],
            adminUserId
        });

        assert.equal(r2Result.success, true);
        assert.equal(r2Result.advancedCount, 5);
        assert.equal(r2Result.rejectedCount, 2);

        for (let i = 0; i < 5; i++) {
            assert.equal(mockApplications[i].status, "interview");
            assert.equal(mockApplications[i].interviewRounds[1].status, "cleared");
        }
        for (let i = 5; i < 7; i++) {
            assert.equal(mockApplications[i].status, "rejected");
            assert.equal(mockApplications[i].interviewRounds[1].status, "failed");
        }

        assert.equal(mockDriveA.currentRoundNumber, 3);
        assert.equal(mockDriveA.selectionRounds[1].status, "completed");
    });

    // -------------------------------------------------------------------------
    // Subtest 8: Idempotency Protection - Repeated Commit prevents duplicate history
    // -------------------------------------------------------------------------
    await t.test("8. Repeated commit for completed round is idempotent without duplicate history", async () => {
        const historyCountBefore = mockApplications[0].statusHistory.length;
        const notifCountBefore = notificationsStore.length;

        const repeatRes = await commitRoundResults({
            driveId: driveAId,
            roundNumber: 2,
            mode: "complete_results",
            confirmedAdvances: mockApplications.slice(0, 5).map((a) => ({ applicationId: a._id })),
            confirmedRejections: mockApplications.slice(5, 7).map((a) => ({ applicationId: a._id })),
            confirmedExceptionResolutions: [],
            adminUserId
        });

        assert.equal(repeatRes.idempotent, true);
        assert.equal(mockApplications[0].statusHistory.length, historyCountBefore, "Must not append duplicate status history on retry");
        assert.equal(notificationsStore.length, notifCountBefore, "Must not dispatch duplicate notifications on retry");
    });

    // -------------------------------------------------------------------------
    // Subtest 9: Final Selection & Offer Distinction (Selected != Placed)
    // -------------------------------------------------------------------------
    await t.test("9. Final round marks candidates 'selected' with pending offer, NOT 'placed'", async () => {
        const finalAdvances = mockApplications.slice(0, 3).map((a) => ({ applicationId: a._id }));
        const finalRejections = mockApplications.slice(3, 5).map((a) => ({ applicationId: a._id }));

        const r3Result = await commitRoundResults({
            driveId: driveAId,
            roundNumber: 3,
            mode: "complete_results",
            confirmedAdvances: finalAdvances,
            confirmedRejections: finalRejections,
            confirmedExceptionResolutions: [],
            adminUserId
        });

        assert.equal(r3Result.success, true);
        assert.equal(r3Result.isFinalRound, true);
        assert.equal(r3Result.isPlacementCompleted, true);

        // Verify status distinction: status is 'selected', NOT 'offer_accepted'
        for (let i = 0; i < 3; i++) {
            assert.equal(mockApplications[i].status, "selected");
            assert.ok(mockApplications[i].offerDetails, "Offer details must be populated");
            assert.equal(mockApplications[i].offerDetails.studentDecision, "pending", "Offer decision must start as pending");
            assert.equal(mockApplications[i].student.isPlaced, undefined, "Student profile must NOT be marked isPlaced prematurely");
        }

        // Verify drive is closed
        assert.equal(mockDriveA.isPlacementCompleted, true);
        assert.equal(mockDriveA.isActive, false);
        assert.ok(mockDriveA.completedAt);
    });
});
