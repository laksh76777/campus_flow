import assert from "node:assert/strict";
import { after, test } from "node:test";
import { app } from "../src/app.js";

let server;
let baseUrl;

test("HTTP readiness, root health, and JSON 404 behavior", async () => {
    server = app.listen(0);
    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.status, 503);
    assert.deepEqual(await healthResponse.json(), {
        status: "unavailable",
        database: "disconnected"
    });

    const readyResponse = await fetch(`${baseUrl}/ready`);
    assert.equal(readyResponse.status, 503);
    assert.deepEqual(await readyResponse.json(), {
        status: "unavailable",
        database: "disconnected"
    });

    const rootResponse = await fetch(`${baseUrl}/`);
    assert.equal(rootResponse.status, 503);
    assert.equal(await rootResponse.text(), "backend database unavailable");

    const missingResponse = await fetch(`${baseUrl}/missing-route`);
    assert.equal(missingResponse.status, 404);
    const missingBody = await missingResponse.json();
    assert.equal(missingBody.success, false);
    assert.match(missingBody.message, /Route not found/);
    assert.equal("stack" in missingBody, false);

    const frontendOrigin = "https://campus-flow-smoky-ten.vercel.app";
    const preflightResponse = await fetch(`${baseUrl}/api/v1/admin/login`, {
        method: "OPTIONS",
        headers: {
            Origin: frontendOrigin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"
        }
    });
    assert.equal(preflightResponse.status, 200);
    assert.equal(
        preflightResponse.headers.get("access-control-allow-origin"),
        frontendOrigin
    );
    assert.equal(
        preflightResponse.headers.get("access-control-allow-credentials"),
        "true"
    );

    const untrustedPreflight = await fetch(`${baseUrl}/api/v1/admin/login`, {
        method: "OPTIONS",
        headers: {
            Origin: "https://untrusted.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"
        }
    });
    assert.equal(
        untrustedPreflight.headers.get("access-control-allow-origin"),
        null
    );
});

after(async () => {
    if (server?.listening) {
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
});
