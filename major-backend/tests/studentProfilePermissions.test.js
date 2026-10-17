import assert from "node:assert/strict";
import test from "node:test";
import { ensureProfileEditable } from "../src/services/studentProfilePermissions.service.js";

test("locked verified student profiles reject direct edits", () => {
    assert.throws(
        () => ensureProfileEditable(
            { isProfileLocked: true, verificationStatus: "VERIFIED" },
            { role: "student" }
        ),
        (error) => error.statusCode === 403
    );
});

test("TPO re-verification requests allow student profile edits", () => {
    assert.doesNotThrow(() => ensureProfileEditable(
        { isProfileLocked: true, verificationStatus: "REVERIFICATION_REQUESTED" },
        { role: "student" }
    ));
});

test("administrators can edit a locked profile", () => {
    assert.doesNotThrow(() => ensureProfileEditable(
        { isProfileLocked: true, verificationStatus: "VERIFIED" },
        { role: "admin" }
    ));
});
