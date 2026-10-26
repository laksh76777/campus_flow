import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import {
    startTestEnv, stopTestEnv, resetDb, api,
    createAdmin, createSession, createCompany, createStudent, createDrive,
} from "./helpers/testEnv.js";
import { Application } from "../src/models/application.model.js";

before(startTestEnv);
after(stopTestEnv);
beforeEach(resetDb);

const setup = async () => {
    const admin = await createAdmin();
    const session = await createSession();
    const company = await createCompany(admin.user._id, "Placed Corp");
    const student = await createStudent({ session });
    const drive = await createDrive({ admin: admin.user, company, session });
    return { admin, session, company, student, drive };
};

test("accepted offers still count as placed in TPO statistics", async () => {
    const { admin, student, drive } = await setup();
    await Application.create({ student: student.profile._id, placementDrive: drive._id, status: "offer_accepted", offeredPackage: 14, statusHistory: [] });
    const res = await api("GET", "/dashboard/stats", { token: admin.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.students.placed, 1);
    assert.equal(res.body.data.salary.highestCTC, 14);
    assert.equal(res.body.data.topRecruiters[0].companyName, "Placed Corp");
});

test("student offer banner data includes the application id and status needed to respond", async () => {
    const { student, drive } = await setup();
    const app = await Application.create({ student: student.profile._id, placementDrive: drive._id, status: "selected", statusHistory: [] });
    const res = await api("GET", "/dashboard/student/stats", { token: student.token });
    assert.equal(res.status, 200);
    const offer = res.body.data.offerDetails;
    assert.equal(offer.applicationId, String(app._id));
    assert.equal(offer.status, "selected");
    assert.equal(offer.companyName, "Placed Corp");

    // ...and the id actually works for accepting the offer
    const accept = await api("PATCH", `/application/${offer.applicationId}/respond-offer`, { token: student.token, json: { decision: "accept", response: "accept", action: "accept" } });
    assert.ok([200, 201].includes(accept.status), JSON.stringify(accept.body));
    const after = await api("GET", "/dashboard/student/stats", { token: student.token });
    assert.equal(after.body.data.offerDetails.status, "offer_accepted", "banner keeps showing the accepted offer");
});

test("student eligible-drive count uses the eligibility engine (verified CGPA, toggles)", async () => {
    const admin = await createAdmin();
    const session = await createSession();
    const company = await createCompany(admin.user._id);
    const student = await createStudent({ session, cgpa: 6.5 });
    // CGPA check disabled on this drive: the engine treats the student as eligible
    await createDrive({ admin: admin.user, company, session, overrides: { checkCgpa: false, minimumCGPA: 9 } });
    await createDrive({ admin: admin.user, company, session, overrides: { minimumCGPA: 9 } });
    const res = await api("GET", "/dashboard/student/stats", { token: student.token });
    assert.equal(res.body.data.placementDrives.eligible, 1);
});
