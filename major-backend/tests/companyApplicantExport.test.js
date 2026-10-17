import assert from "node:assert/strict";
import test from "node:test";
import {
    buildCompanyApplicantExportFields,
    getCompanyApplicantExportValue
} from "../src/services/companyApplicantExport.service.js";

const driveRequirements = [
    { fieldKey: "fullName", category: "personal", shareWithCompany: true },
    { fieldKey: "email", category: "personal", shareWithCompany: true },
    { fieldKey: "phone", category: "personal", shareWithCompany: false },
    { fieldKey: "personalEmail", category: "personal", shareWithCompany: false },
    { fieldKey: "cgpa", category: "academic", shareWithCompany: true },
    { fieldKey: "currentAddress", category: "family_address", shareWithCompany: true },
    { fieldKey: "familyDetails", category: "family_address", shareWithCompany: false }
];

test("company exports only include fields explicitly shared by the drive", () => {
    const fields = buildCompanyApplicantExportFields(driveRequirements);

    assert.deepEqual(fields.map((field) => field.key), ["fullName", "email", "cgpa"]);
});

test("sensitive fields require both drive permission and explicit export opt-in", () => {
    const fields = buildCompanyApplicantExportFields(driveRequirements, {
        includeSensitiveFamily: true
    });

    assert.deepEqual(
        fields.map((field) => field.key),
        ["fullName", "email", "cgpa", "currentAddress"]
    );
});

test("selected fields further narrow the drive-approved export fields", () => {
    const fields = buildCompanyApplicantExportFields(driveRequirements, {
        selectedFields: ["email", "phone", "personalEmail", "cgpa"]
    });

    assert.deepEqual(fields.map((field) => field.key), ["email", "cgpa"]);
});

test("export values prefer the submitted snapshot over later profile edits", () => {
    const [nameField] = buildCompanyApplicantExportFields(driveRequirements);
    const value = getCompanyApplicantExportValue(nameField, {
        snapshot: { fullName: "Original Name" },
        student: { fullName: "Updated Name" }
    });

    assert.equal(value, "Original Name");
});
