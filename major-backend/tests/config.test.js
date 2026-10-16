import assert from "node:assert/strict";
import { test } from "node:test";
import {
    REQUIRED_ENVIRONMENT_VARIABLES,
    validateEnvironment
} from "../src/config.js";
import { resolveMongoConnection } from "../src/db/index.js";

test("required runtime configuration is validated without exposing values", () => {
    const validEnvironment = Object.fromEntries(
        REQUIRED_ENVIRONMENT_VARIABLES.map((name) => [name, `test-${name}`])
    );

    assert.equal(validateEnvironment(validEnvironment), validEnvironment);
    assert.throws(
        () => validateEnvironment({ MONGODB_URI: "mongodb://localhost" }),
        new RegExp(REQUIRED_ENVIRONMENT_VARIABLES.slice(1).join("|"))
    );
});

test("production configuration requires exact HTTPS CORS origins", () => {
    const baseEnvironment = Object.fromEntries(
        REQUIRED_ENVIRONMENT_VARIABLES.map((name) => [name, `test-${name}`])
    );

    assert.throws(
        () =>
            validateEnvironment({
                ...baseEnvironment,
                NODE_ENV: "production",
                CORS_ORIGIN: "*"
            }),
        /explicit HTTPS origins/
    );
    assert.throws(
        () =>
            validateEnvironment({
                ...baseEnvironment,
                NODE_ENV: "production",
                CORS_ORIGIN: "https://campus.example/path"
            }),
        /exact HTTPS origins/
    );
    assert.doesNotThrow(() =>
        validateEnvironment({
            ...baseEnvironment,
            NODE_ENV: "production",
            CORS_ORIGIN: "https://campus.example"
        })
    );
});

test("MongoDB URI defaults to the application's database and preserves options", () => {
    const resolved = resolveMongoConnection(
        "mongodb://user:password@localhost:27017/?retryWrites=true"
    );

    assert.equal(resolved.databaseName, "Place-on");
    assert.equal(
        new URL(resolved.connectionUri).searchParams.get("retryWrites"),
        "true"
    );
    assert.equal(new URL(resolved.connectionUri).pathname, "/Place-on");
});

test("MongoDB URI honors an explicit isolated database name", () => {
    const resolved = resolveMongoConnection(
        "mongodb+srv://user:password@cluster.example/Place-on_e2e_123?retryWrites=true"
    );

    assert.equal(resolved.databaseName, "Place-on_e2e_123");
    assert.equal(
        new URL(resolved.connectionUri).pathname,
        "/Place-on_e2e_123"
    );
});

test("MongoDB URI rejects invalid protocols and malformed input", () => {
    assert.throws(() => resolveMongoConnection("https://localhost/db"));
    assert.throws(() => resolveMongoConnection("not a uri"));
});
