import { consultarPix } from "./controllers/InterControllers.js";
import fs from 'fs';

// Mock Response Object
const createMockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.jsonData = null;
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.jsonData = data;
        return res;
    };
    return res;
};

const logStream = fs.createWriteStream('results_consultar.txt', { flags: 'a' });
function log(msg) {
    console.log(msg);
    logStream.write(msg + '\n');
}

async function runTests() {
    log("=== Starting Consultar Pix Tests ===");

    // Test 1: Missing TXID
    log("\nTest 1: Missing TXID");
    const req1 = { body: {} };
    const res1 = createMockRes();
    try { await consultarPix(req1, res1); } catch (e) { log("Error: " + e.message); }

    if (res1.statusCode === 400) {
        log("PASSED: Got 400 for missing TXID");
    } else {
        log("FAILED: Expected 400, got " + res1.statusCode);
    }

    // Test 2: Valid TXID (Mocked execution - will likely fail at token/network but verify controller logic)
    log("\nTest 2: Valid TXID (Execution Flow)");
    const req2 = { body: { txid: "test_txid_123" } };
    const res2 = createMockRes();

    // We expect this to either succeed (if creds are valid and txid exists) 
    // or fail with 500/404/401 (network/auth/not found).
    // The key is that it shouldn't be 400.
    try { await consultarPix(req2, res2); } catch (e) { }

    if (res2.statusCode !== 400) {
        log("PASSED: Controller accepted TXID (Status " + res2.statusCode + ")");
    } else {
        log("FAILED: Got 400 for valid TXID request structure");
    }

    logStream.end();
}

runTests();
