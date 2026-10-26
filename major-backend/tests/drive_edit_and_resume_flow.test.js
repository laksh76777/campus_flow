import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import {
    startTestEnv, stopTestEnv, resetDb, api, cloudinaryCalls, setCloudinaryUploadFailure,
    createAdmin, createSession, createCompany, createStudent, createDrive,
} from "./helpers/testEnv.js";
import { PlacementDrive } from "../src/models/placementDrive.model.js";
import { Application } from "../src/models/application.model.js";
import { StudentProfile } from "../src/models/studentProfile.model.js";
import { EligibilityService } from "../src/services/eligibility.service.js";

const HOUR = 3600 * 1000;
const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

before(startTestEnv);
after(stopTestEnv);
beforeEach(resetDb);

const world = async ({ profileResume = null, cgpa = 8.2 } = {}) => {
    const admin = await createAdmin();
    const session = await createSession();
    const company = await createCompany(admin.user._id);
    const student = await createStudent({ session, cgpa, resumeUrl: profileResume });
    const drive = await createDrive({ admin: admin.user, company, session });
    return { admin, session, company, student, drive };
};

const applyForm = ({ file, fileName = "my_resume.pdf", resumeMode } = {}) => {
    const form = new FormData();
    if (resumeMode) form.append("resumeMode", resumeMode);
    if (file) form.append("resume", new Blob([file], { type: "application/pdf" }), fileName);
    return form;
};

// ---------------------------------------------------------------------------
// Drive editing
// ---------------------------------------------------------------------------

test("admin can edit a drive; unrelated fields are preserved and the saved drive is returned", async () => {
    const { admin, drive } = await world();
    const res = await api("PATCH", `/placementdrive/${drive._id}`, {
        token: admin.token,
        json: { jobTitle: "Senior Software Engineer", package: "18.5", minimumCGPA: "7.5" },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.jobTitle, "Senior Software Engineer");
    assert.equal(res.body.data.package, 18.5);
    assert.equal(res.body.data.company.companyName.startsWith("Example Systems"), true, "company is populated");

    const saved = await PlacementDrive.findById(drive._id).lean();
    assert.equal(saved.jobTitle, "Senior Software Engineer");
    assert.equal(saved.minimumCGPA, 7.5);
    assert.equal(saved.maximumBacklogs, 0, "untouched field preserved");
    assert.deepEqual(saved.eligibleProgramCodes, ["CSE"], "untouched targeting preserved");
});

test("invalid edits are rejected with 400 and nothing is saved", async () => {
    const { admin, drive } = await world();
    const cases = [
        { applicationDeadline: new Date(Date.now() - 48 * HOUR).toISOString() }, // before start date
        { driveDate: new Date(Date.now() + HOUR).toISOString() }, // before deadline
        { minimumCGPA: 11 },
        { minimumCGPA: "abc" },
        { package: -1 },
        { jobTitle: "   " },
        { jobType: "contract" },
        { applicationDeadline: "not-a-date" },
    ];
    for (const json of cases) {
        const res = await api("PATCH", `/placementdrive/${drive._id}`, { token: admin.token, json });
        assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(json)}, got ${res.status} ${JSON.stringify(res.body)}`);
        assert.equal(res.body.success, false);
    }
    const saved = await PlacementDrive.findById(drive._id).lean();
    assert.equal(saved.jobTitle, "Software Engineer");
    assert.equal(saved.minimumCGPA, 7);
});

test("students cannot edit drives; missing and malformed drive ids are handled", async () => {
    const { student, admin, drive } = await world();
    const forbidden = await api("PATCH", `/placementdrive/${drive._id}`, { token: student.token, json: { jobTitle: "Hacked" } });
    assert.equal(forbidden.status, 403);
    const anonymous = await api("PATCH", `/placementdrive/${drive._id}`, { json: { jobTitle: "Hacked" } });
    assert.equal(anonymous.status, 401);
    assert.equal((await PlacementDrive.findById(drive._id)).jobTitle, "Software Engineer");

    const missing = await api("PATCH", "/placementdrive/0123456789abcdef01234567", { token: admin.token, json: { jobTitle: "X" } });
    assert.equal(missing.status, 404);
    const malformed = await api("PATCH", "/placementdrive/not-an-id", { token: admin.token, json: { jobTitle: "X" } });
    assert.equal(malformed.status, 400, "malformed id is a client error, not a 500");
});

test("a closed drive can be edited; a deleted or completed drive cannot", async () => {
    const { admin, session, company, drive } = await world();
    await PlacementDrive.updateOne({ _id: drive._id }, { $set: { isActive: false } });
    const closedEdit = await api("PATCH", `/placementdrive/${drive._id}`, { token: admin.token, json: { venue: "Main Auditorium" } });
    assert.equal(closedEdit.status, 200);

    const completed = await createDrive({ admin: admin.user, company, session, overrides: { isPlacementCompleted: true } });
    const completedEdit = await api("PATCH", `/placementdrive/${completed._id}`, { token: admin.token, json: { venue: "X" } });
    assert.equal(completedEdit.status, 409);

    await api("DELETE", `/placementdrive/${drive._id}`, { token: admin.token });
    const deletedEdit = await api("PATCH", `/placementdrive/${drive._id}`, { token: admin.token, json: { venue: "Y" } });
    assert.equal(deletedEdit.status, 404);
});

test("editing criteria on a drive with applications preserves the submitted applications", async () => {
    const { admin, student, drive } = await world({ profileResume: "https://res.cloudinary.test/profile.pdf" });
    const applied = await api("POST", `/application/${drive._id}/apply`, { token: student.token, form: applyForm() });
    assert.equal(applied.status, 201, JSON.stringify(applied.body));

    const res = await api("PATCH", `/placementdrive/${drive._id}`, { token: admin.token, json: { minimumCGPA: 9.5 } });
    assert.equal(res.status, 200);
    const app = await Application.findOne({ placementDrive: drive._id });
    assert.equal(app.status, "applied", "existing application untouched");
    assert.equal(app.eligibilitySnapshot.status, "ELIGIBLE");

    const cohortChange = await api("PATCH", `/placementdrive/${drive._id}`, { token: admin.token, json: { graduationYear: 2028 } });
    assert.equal(cohortChange.status, 409, "cohort cannot move once applications exist");
});

test("edited drive details are what students see", async () => {
    const { admin, student, drive } = await world();
    await api("PATCH", `/placementdrive/${drive._id}`, { token: admin.token, json: { jobTitle: "Platform Engineer", location: "Mysuru" } });
    const res = await api("GET", "/placementdrive/my-eligible-drives", { token: student.token });
    assert.equal(res.status, 200);
    const seen = res.body.data.find((d) => d._id === String(drive._id));
    assert.equal(seen.jobTitle, "Platform Engineer");
    assert.equal(seen.location, "Mysuru");
});

// ---------------------------------------------------------------------------
// Eligibility vs. application resume
// ---------------------------------------------------------------------------

test("a missing profile resume does not make an otherwise eligible student ineligible", async () => {
    const { student, drive } = await world({ profileResume: null });
    const evaluation = EligibilityService.evaluate(student.profile, drive);
    assert.equal(evaluation.status, "ELIGIBLE");
    assert.equal(evaluation.isEligible, true);

    const res = await api("GET", `/placementdrive/${drive._id}/eligibility-check`, { token: student.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.isEligible, true);
});

test("genuine eligibility failures are still enforced", async () => {
    const { student, drive } = await world({ cgpa: 6.1 });
    const res = await api("POST", `/application/${drive._id}/apply`, { token: student.token, form: applyForm({ file: PDF_BYTES }) });
    assert.equal(res.status, 403);
    assert.match(res.body.message, /CGPA/);
    assert.equal(cloudinaryCalls.uploads.length, 0, "nothing is uploaded for an ineligible student");
    assert.equal(await Application.countDocuments({}), 0);
});

test("eligible student WITHOUT a profile resume can apply by uploading one", async () => {
    const { student, drive } = await world({ profileResume: null });
    const res = await api("POST", `/application/${drive._id}/apply`, {
        token: student.token, form: applyForm({ file: PDF_BYTES, resumeMode: "custom" }),
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const app = await Application.findOne({ placementDrive: drive._id }).lean();
    assert.equal(app.submittedSnapshot.resume.source, "uploaded");
    assert.equal(app.submittedSnapshot.resume.originalName, "my_resume.pdf");
    assert.match(app.submittedSnapshot.resume.url, /application_resumes/);
    const profile = await StudentProfile.findById(student.profile._id).lean();
    assert.ok(!profile.resume?.url, "the profile resume is NOT overwritten by an application upload");
});

test("eligible student without any resume gets a clear error instead of a false ineligibility", async () => {
    const { student, drive } = await world({ profileResume: null });
    const res = await api("POST", `/application/${drive._id}/apply`, { token: student.token, form: applyForm() });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /attach a resume/i);
    assert.doesNotMatch(res.body.message, /not eligible/i);
});

test("eligible student WITH a profile resume can apply using it, or with a different upload", async () => {
    const profileUrl = "https://res.cloudinary.test/campusflow/resumes/profile.pdf";
    const { student, drive, admin, company, session } = await world({ profileResume: profileUrl });

    const viaProfile = await api("POST", `/application/${drive._id}/apply`, { token: student.token, form: applyForm({ resumeMode: "profile" }) });
    assert.equal(viaProfile.status, 201, JSON.stringify(viaProfile.body));
    const appA = await Application.findOne({ placementDrive: drive._id }).lean();
    assert.equal(appA.submittedSnapshot.resume.url, profileUrl);
    assert.equal(appA.submittedSnapshot.resume.source, "profile");

    const drive2 = await createDrive({ admin: admin.user, company, session });
    const viaUpload = await api("POST", `/application/${drive2._id}/apply`, {
        token: student.token, form: applyForm({ file: PDF_BYTES, fileName: "tailored.pdf", resumeMode: "custom" }),
    });
    assert.equal(viaUpload.status, 201);
    const appB = await Application.findOne({ placementDrive: drive2._id }).lean();
    assert.equal(appB.submittedSnapshot.resume.source, "uploaded");
    assert.notEqual(appB.submittedSnapshot.resume.url, profileUrl);
    assert.equal((await StudentProfile.findById(student.profile._id)).resume.url, profileUrl, "profile resume unchanged");
});

test("invalid resume files are rejected before anything is stored", async () => {
    const { student, drive } = await world();
    const fake = await api("POST", `/application/${drive._id}/apply`, {
        token: student.token, form: applyForm({ file: Buffer.from("MZ executable pretending"), fileName: "resume.pdf" }),
    });
    assert.equal(fake.status, 400);
    assert.match(fake.body.message, /corrupted|not the file type/i);

    const exe = await api("POST", `/application/${drive._id}/apply`, {
        token: student.token, form: applyForm({ file: PDF_BYTES, fileName: "resume.exe" }),
    });
    assert.equal(exe.status, 400);
    assert.match(exe.body.message, /PDF, DOCX or DOC/);

    const big = await api("POST", `/application/${drive._id}/apply`, {
        token: student.token, form: applyForm({ file: Buffer.concat([PDF_BYTES, Buffer.alloc(6 * 1024 * 1024)]) }),
    });
    assert.equal(big.status, 400);
    assert.match(big.body.message, /5 MB/);

    assert.equal(cloudinaryCalls.uploads.length, 0);
    assert.equal(await Application.countDocuments({}), 0);
});

test("a failed resume upload fails the whole application truthfully", async () => {
    const { student, drive } = await world({ profileResume: "https://res.cloudinary.test/profile.pdf" });
    setCloudinaryUploadFailure(true);
    const res = await api("POST", `/application/${drive._id}/apply`, {
        token: student.token, form: applyForm({ file: PDF_BYTES, resumeMode: "custom" }),
    });
    assert.equal(res.status, 502);
    assert.match(res.body.message, /not submitted/i);
    assert.equal(await Application.countDocuments({}), 0, "no application without the chosen resume");
});

test("repeated submissions are blocked and do not upload orphan files", async () => {
    const { student, drive } = await world();
    const first = await api("POST", `/application/${drive._id}/apply`, { token: student.token, form: applyForm({ file: PDF_BYTES }) });
    assert.equal(first.status, 201);
    const second = await api("POST", `/application/${drive._id}/apply`, { token: student.token, form: applyForm({ file: PDF_BYTES }) });
    assert.equal(second.status, 409);
    assert.equal(cloudinaryCalls.uploads.length, 1, "duplicate attempt did not upload another file");
    assert.equal(await Application.countDocuments({}), 1);
});

test("concurrent double-submit yields exactly one application and cleans up the loser's upload", async () => {
    const { student, drive } = await world();
    const results = await Promise.all([
        api("POST", `/application/${drive._id}/apply`, { token: student.token, form: applyForm({ file: PDF_BYTES }) }),
        api("POST", `/application/${drive._id}/apply`, { token: student.token, form: applyForm({ file: PDF_BYTES }) }),
    ]);
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409]);
    assert.equal(await Application.countDocuments({}), 1);
    const kept = (await Application.findOne({}).lean()).submittedSnapshot.resume.publicId;
    const orphanUploads = cloudinaryCalls.uploads.map((u) => u.record.public_id).filter((id) => id !== kept);
    for (const id of orphanUploads) {
        assert.ok(cloudinaryCalls.destroys.some((d) => d.publicId === id), `orphan upload ${id} was deleted`);
    }
});

test("changing the profile resume later does not change or delete a submitted application's resume", async () => {
    const profileUrl = "https://res.cloudinary.test/campusflow/resumes/original.pdf";
    const { student, drive } = await world({ profileResume: profileUrl });
    await api("POST", `/application/${drive._id}/apply`, { token: student.token, form: applyForm({ resumeMode: "profile" }) });
    const originalPublicId = (await StudentProfile.findById(student.profile._id)).resume.publicId;

    const form = new FormData();
    form.append("resume", new Blob([PDF_BYTES], { type: "application/pdf" }), "new_profile.pdf");
    const update = await api("PATCH", "/studentprofile/update-resume", { token: student.token, form });
    assert.equal(update.status, 200, JSON.stringify(update.body));

    const app = await Application.findOne({ placementDrive: drive._id }).lean();
    assert.equal(app.submittedSnapshot.resume.url, profileUrl, "application keeps the resume it was submitted with");
    assert.ok(!cloudinaryCalls.destroys.some((d) => d.publicId === originalPublicId), "file still referenced by an application is not deleted");
});

test("TPO sees the resume submitted with the specific application", async () => {
    const { admin, student, drive } = await world({ profileResume: "https://res.cloudinary.test/campusflow/resumes/profile.pdf" });
    await api("POST", `/application/${drive._id}/apply`, {
        token: student.token, form: applyForm({ file: PDF_BYTES, fileName: "for_this_job.pdf", resumeMode: "custom" }),
    });
    const res = await api("GET", "/application/all-applications?limit=50", { token: admin.token });
    assert.equal(res.status, 200);
    const list = res.body.data.applications || res.body.data;
    const app = list.find((a) => String(a.placementDrive?._id || a.placementDrive) === String(drive._id));
    assert.equal(app.submittedSnapshot.resume.originalName, "for_this_job.pdf");
    assert.notEqual(app.submittedSnapshot.resume.url, "https://res.cloudinary.test/campusflow/resumes/profile.pdf");
});

test("applications before the opening date are refused", async () => {
    const admin = await createAdmin();
    const session = await createSession();
    const company = await createCompany(admin.user._id);
    const student = await createStudent({ session, resumeUrl: "https://res.cloudinary.test/p.pdf" });
    const drive = await createDrive({ admin: admin.user, company, session, startInHours: 24, deadlineInHours: 96 });
    const res = await api("POST", `/application/${drive._id}/apply`, { token: student.token, form: applyForm() });
    assert.equal(res.status, 403);
    assert.match(res.body.message, /open on/i);
});
