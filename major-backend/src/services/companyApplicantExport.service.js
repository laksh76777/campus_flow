const APPLICANT_EXPORT_FIELDS = [
    {
        fieldKey: "fullName",
        key: "fullName",
        label: "Candidate Name",
        value: ({ snapshot, student, user }) => snapshot.fullName || user.fullName || student.fullName || ""
    },
    {
        fieldKey: "usn",
        key: "usn",
        label: "USN / Enrollment ID",
        value: ({ snapshot, student }) => snapshot.usn || student.enrollmentNumber || student.usn || ""
    },
    {
        fieldKey: "email",
        key: "email",
        label: "Institutional Email",
        value: ({ snapshot, student, user }) => snapshot.email || user.email || student.collegeEmail || ""
    },
    {
        fieldKey: "personalEmail",
        key: "personalEmail",
        label: "Personal Email",
        value: ({ snapshot, student }) => snapshot.personalEmail || student.personalEmail || ""
    },
    {
        fieldKey: "phone",
        key: "phone",
        label: "Contact Number",
        value: ({ snapshot, student, user }) => snapshot.phone || user.phone || student.alternatePhone || ""
    },
    {
        fieldKey: "branch",
        key: "branch",
        label: "Academic Program",
        value: ({ snapshot, student }) => snapshot.branch || snapshot.department || student.branch || student.department || ""
    },
    {
        fieldKey: "graduationYear",
        key: "graduationYear",
        label: "Graduation Year",
        value: ({ snapshot, student }) => snapshot.graduationYear ?? student.graduationYear ?? ""
    },
    {
        fieldKey: "cgpa",
        key: "cgpa",
        label: "Overall CGPA",
        value: ({ snapshot, student }) => snapshot.cgpa ?? student.verifiedCGPA ?? student.cgpa ?? ""
    },
    {
        fieldKey: "semesterSGPA",
        key: "semesterSGPA",
        label: "Semester Results",
        value: ({ snapshot, student }) => JSON.stringify(snapshot.semesterResults || student.semesterResults || [])
    },
    {
        fieldKey: "activeBacklogs",
        key: "activeBacklogs",
        label: "Active Backlogs",
        value: ({ snapshot, student }) => snapshot.activeBacklogs ?? student.activeBacklogs ?? student.backlogs ?? 0
    },
    {
        fieldKey: "historicalBacklogs",
        key: "historicalBacklogs",
        label: "Historical Backlogs",
        value: ({ snapshot, student }) => snapshot.historicalBacklogs ?? student.historicalBacklogs ?? 0
    },
    {
        fieldKey: "tenthPercentage",
        key: "tenthPercentage",
        label: "Class 10 (%)",
        value: ({ snapshot, student }) => snapshot.tenthDetails?.percentage ?? student.tenthDetails?.percentage ?? student.tenthPercentage ?? ""
    },
    {
        fieldKey: "tenthPassingYear",
        key: "tenthPassingYear",
        label: "Class 10 Passing Year",
        value: ({ snapshot, student }) => snapshot.tenthDetails?.passingYear ?? student.tenthDetails?.passingYear ?? ""
    },
    {
        fieldKey: "twelfthOrDiploma",
        key: "twelfthOrDiploma",
        label: "Class 12 / Diploma (%)",
        value: ({ snapshot, student }) => snapshot.twelfthOrDiplomaDetails?.percentage ?? student.twelfthOrDiplomaDetails?.percentage ?? student.twelfthPercentage ?? ""
    },
    {
        fieldKey: "educationGaps",
        key: "educationGaps",
        label: "Education Gaps",
        value: ({ snapshot, student }) => JSON.stringify(snapshot.educationGaps || student.educationGaps || [])
    },
    {
        fieldKey: "resume",
        key: "resumeLink",
        label: "Resume URL",
        value: ({ snapshot, student }) => snapshot.resume?.url || student.resume?.url || student.resumeUrl || ""
    },
    {
        fieldKey: "tenthMarksheet",
        key: "tenthMarksheet",
        label: "Class 10 Marksheet URL",
        value: ({ snapshot, student }) => snapshot.tenthDetails?.marksheetUrl || student.tenthDetails?.marksheetUrl || ""
    },
    {
        fieldKey: "twelfthMarksheet",
        key: "twelfthMarksheet",
        label: "Class 12 / Diploma Marksheet URL",
        value: ({ snapshot, student }) => snapshot.twelfthOrDiplomaDetails?.marksheetUrl || student.twelfthOrDiplomaDetails?.marksheetUrl || ""
    },
    {
        fieldKey: "currentAddress",
        key: "currentAddress",
        label: "Current Address",
        sensitive: true,
        value: ({ snapshot, student }) => formatAddress(snapshot.currentAddress || student.currentAddress)
    },
    {
        fieldKey: "permanentAddress",
        key: "permanentAddress",
        label: "Permanent Address",
        sensitive: true,
        value: ({ snapshot, student }) => formatAddress(snapshot.permanentAddress || student.permanentAddress)
    },
    {
        fieldKey: "familyDetails",
        key: "fatherName",
        label: "Father Name",
        sensitive: true,
        value: ({ snapshot, student }) => (snapshot.family || student.family || {}).fatherName || ""
    },
    {
        fieldKey: "familyDetails",
        key: "motherName",
        label: "Mother Name",
        sensitive: true,
        value: ({ snapshot, student }) => (snapshot.family || student.family || {}).motherName || ""
    },
    {
        fieldKey: "familyDetails",
        key: "guardianPhone",
        label: "Guardian Contact",
        sensitive: true,
        value: ({ snapshot, student }) => {
            const family = snapshot.family || student.family || {};
            return family.guardianPhone || family.parentPhone || family.fatherPhone || "";
        }
    }
];

function formatAddress(address = {}) {
    return [
        address.street,
        address.locality,
        address.city,
        address.district,
        address.state,
        address.pincode,
        address.country
    ].filter(Boolean).join(", ");
}

export function buildCompanyApplicantExportFields(
    driveRequirements,
    { selectedFields, includeSensitiveFamily = false } = {}
) {
    const requirements = Array.isArray(driveRequirements) && driveRequirements.length > 0
        ? driveRequirements
        : [];
    const sharedFieldKeys = new Set(
        requirements
            .filter((requirement) => requirement.shareWithCompany === true)
            .filter((requirement) => includeSensitiveFamily || requirement.category !== "family_address")
            .map((requirement) => requirement.fieldKey)
    );
    const selected = Array.isArray(selectedFields) && selectedFields.length > 0
        ? new Set(selectedFields)
        : null;

    return APPLICANT_EXPORT_FIELDS.filter((field) =>
        sharedFieldKeys.has(field.fieldKey) &&
        (!selected || selected.has(field.fieldKey)) &&
        (!field.sensitive || includeSensitiveFamily)
    );
}

export function getCompanyApplicantExportValue(field, applicant) {
    const snapshot = applicant.snapshot || {};
    const student = applicant.student || {};
    const user = student.user || {};

    return field.value({
        snapshot,
        student,
        user,
        application: applicant.application
    });
}
