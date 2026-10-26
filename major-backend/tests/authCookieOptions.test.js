import assert from "node:assert/strict";
import test from "node:test";
import { getAuthCookieOptions } from "../src/utils/authCookieOptions.js";

test("auth cookies are cross-site secure in production and localhost-friendly in development", () => {
    assert.deepEqual(getAuthCookieOptions("production"), {
        httpOnly: true,
        secure: true,
        sameSite: "none",
    });
    assert.deepEqual(getAuthCookieOptions("development"), {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
    });
});
