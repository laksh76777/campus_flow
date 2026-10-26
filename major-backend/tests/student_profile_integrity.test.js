import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { startTestEnv, stopTestEnv, resetDb, createSession, createStudent, createAdmin, createCompany, createDrive } from "./helpers/testEnv.js";
import { StudentProfile } from "../src/models/studentProfile.model.js";
import { EligibilityService } from "../src/services/eligibility.service.js";

before(startTestEnv);
after(stopTestEnv);
beforeEach(resetDb);

test("backlog counts recorded without itemized details survive saves (no silent reset to 0)", async () => {
    const session = await createSession();
    const { profile } = await createStudent({ session, activeBacklogs: 2 });
    let saved = await StudentProfile.findById(profile._id);
    assert.equal(saved.activeBacklogs, 2);

    // Any unrelated later save (e.g. a profile edit) must keep the count
    saved.alternatePhone = "9876543210";
    await saved.save();
    saved = await StudentProfile.findById(profile._id);
    assert.equal(saved.activeBacklogs, 2);
    assert.equal(saved.backlogs, 2);

    // Updating the count (profile form / TPO edit / import path) is persisted
    saved.backlogs = 1;
    saved.activeBacklogs = 1;
    await saved.save();
    assert.equal((await StudentProfile.findById(profile._id)).activeBacklogs, 1);
});

test("itemized backlog records still drive the counts, and clearing them resets to zero", async () => {
    const session = await createSession();
    const { profile } = await createStudent({ session });
    const doc = await StudentProfile.findById(profile._id);
    doc.backlogDetails = [
        { subjectCode: "18CS51", subjectName: "Management", semester: 5, status: "ACTIVE" },
        { subjectCode: "18CS42", subjectName: "DAA", semester: 4, status: "CLEARED" },
    ];
    await doc.save();
    let saved = await StudentProfile.findById(profile._id);
    assert.equal(saved.activeBacklogs, 1);
    assert.equal(saved.historicalBacklogs, 2);

    saved.backlogDetails = [];
    await saved.save();
    saved = await StudentProfile.findById(profile._id);
    assert.equal(saved.activeBacklogs, 0);
});

test("a student with active backlogs stays ineligible for a zero-backlog drive after unrelated edits", async () => {
    const admin = await createAdmin();
    const session = await createSession();
    const company = await createCompany(admin.user._id);
    const drive = await createDrive({ admin: admin.user, company, session });
    const { profile } = await createStudent({ session, activeBacklogs: 3 });
    const doc = await StudentProfile.findById(profile._id);
    doc.about = "Updated bio";
    await doc.save();
    const evaluation = EligibilityService.evaluate(await StudentProfile.findById(profile._id).lean(), drive);
    assert.equal(evaluation.isEligible, false);
    assert.ok(evaluation.reasons.some((r) => /Active backlogs \(3\)/.test(r)));
});
