import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { cloudinary } from "../src/utils/cloudinary.js";
import {
    api,
    createAdmin,
    createSession,
    createStudent,
    startTestEnv,
    stopTestEnv
} from "./helpers/testEnv.js";

const originalPrivateDownloadUrl = cloudinary.utils.private_download_url;
let downloadRequest;

before(startTestEnv);
after(async () => {
    cloudinary.utils.private_download_url = originalPrivateDownloadUrl;
    await stopTestEnv();
});

test("Admin resume downloads use short-lived signed Cloudinary links", async () => {
    cloudinary.utils.private_download_url = (publicId, format, options) => {
        downloadRequest = { publicId, format, options };
        return "https://api.cloudinary.test/signed-resume";
    };

    const admin = await createAdmin();
    const session = await createSession();
    const student = await createStudent({
        session,
        resumeUrl: "https://res.cloudinary.com/test-cloud/raw/upload/v1792992450/resumes/student-resume.pdf"
    });
    student.profile.resume.publicId = "resumes/student-resume.pdf";
    await student.profile.save();

    const response = await api("GET", `/studentprofile/${student.profile._id}/resume-download`, {
        token: admin.token
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.url, "https://api.cloudinary.test/signed-resume");
    assert.equal(downloadRequest.publicId, student.profile.resume.publicId);
    assert.equal(downloadRequest.format, "pdf");
    assert.equal(downloadRequest.options.resource_type, "raw");
    assert.equal(downloadRequest.options.type, "upload");
    assert.ok(downloadRequest.options.expires_at <= Math.floor(Date.now() / 1000) + 300);
    assert.ok(downloadRequest.options.expires_at > Math.floor(Date.now() / 1000));
});

test("Student accounts cannot request TPO resume download links", async () => {
    cloudinary.utils.private_download_url = () => {
        throw new Error("Resume signing should not run for students");
    };

    const session = await createSession({ year: 2028 });
    const student = await createStudent({
        session,
        resumeUrl: "https://res.cloudinary.com/test-cloud/raw/upload/v1792992450/resumes/student-resume.pdf"
    });

    const response = await api("GET", `/studentprofile/${student.profile._id}/resume-download`, {
        token: student.token
    });

    assert.equal(response.status, 403);
});
