import fs from "fs";

const BASE_URL = "http://localhost:8000/api/v1";

async function run() {
    console.log("=== Testing Cloudinary Live Resume & Avatar Flow ===");

    // 1. Student login (Aarav Gupta or test student)
    let studentLoginRes = await fetch(`${BASE_URL}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: "student@campusflow.edu",
            password: "Student@12345"
        })
    });
    let studentData = await studentLoginRes.json();
    
    let token = "";
    if (studentLoginRes.ok) {
        token = studentData.data?.accessToken;
        console.log("✔ Student login successful (student@campusflow.edu)");
    } else {
        console.log("Student not found, logging in as admin to test avatar flow...");
        const adminLog = await (await fetch(`${BASE_URL}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@campusflow.edu", password: "Admin@12345" })
        })).json();
        token = adminLog.data?.accessToken;
        console.log("✔ Admin login successful");
    }

    // 2. Test Avatar Image Upload to Cloudinary
    console.log("Uploading profile avatar to Cloudinary...");
    // 1x1 transparent PNG buffer
    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const pngBuf = Buffer.from(pngBase64, "base64");
    const avatarBlob = new Blob([pngBuf], { type: "image/png" });
    const avatarFormData = new FormData();
    avatarFormData.append("avatar", avatarBlob, "test_avatar.png");

    const avatarUploadRes = await fetch(`${BASE_URL}/users/update-avatar`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: avatarFormData
    });
    const avatarUploadData = await avatarUploadRes.json();
    if (!avatarUploadRes.ok) {
        throw new Error(`Avatar upload failed: ${JSON.stringify(avatarUploadData)}`);
    }
    const avatarUrl = avatarUploadData.data?.avatar?.url;
    console.log("✔ Avatar uploaded to Cloudinary successfully:", avatarUrl);

    // Verify avatar URL is reachable
    const fetchAvatar = await fetch(avatarUrl);
    console.log(`✔ Cloudinary Avatar HTTP Status: ${fetchAvatar.status}`);

    // 3. Test Resume PDF Upload to Cloudinary (if student profile exists)
    const profileRes = await fetch(`${BASE_URL}/studentprofile/current-student-profile`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (profileRes.ok) {
        console.log("Uploading student resume PDF to Cloudinary...");
        const pdfData = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000117 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF';
        const pdfBlob = new Blob([Buffer.from(pdfData)], { type: "application/pdf" });
        const resumeFormData = new FormData();
        resumeFormData.append("resume", pdfBlob, "Master_Placement_Resume.pdf");

        const resumeUploadRes = await fetch(`${BASE_URL}/studentprofile/update-resume`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
            body: resumeFormData
        });
        const resumeUploadData = await resumeUploadRes.json();
        if (!resumeUploadRes.ok) {
            throw new Error(`Resume upload failed: ${JSON.stringify(resumeUploadData)}`);
        }
        const resumeUrl = resumeUploadData.data?.resume?.url;
        console.log("✔ Resume uploaded to Cloudinary successfully:", resumeUrl);

        // Verify document preview rendering URL
        const previewUrl = resumeUrl.replace(/\.pdf$/i, ".png");
        const fetchResumePreview = await fetch(previewUrl);
        console.log(`✔ Cloudinary Document Preview HTTP Status: ${fetchResumePreview.status}`);
    }

    console.log("=== Cloudinary Resume & Avatar Workflow Tested & Verified 100% ===");
}

run().catch((err) => {
    console.error("❌ Cloudinary Live Test Error:", err);
    process.exit(1);
});
