import { criarCobranca, criarCobrancaUnica } from "./controllers/InterControllers.js";
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

const logStream = fs.createWriteStream('results.txt', { flags: 'a' });
function log(msg) {
    console.log(msg);
    logStream.write(msg + '\n');
}

async function runTests() {
    log("=== Starting Billing Logic Tests ===");

    // --- criarCobranca Tests ---
    log("\n--- Testing criarCobranca ---");

    // Test 1: Valid Standard Purchase
    log("Test 1: Valid Standard Purchase (8 credits, 6.80)");
    const req1 = {
        body: {
            value: "6.80",
            qtd_creditos: 8,
            cpf: "12345678901",
            nome: "Test User",
            dataVencimento: "2025-12-31",
            id_user: "uuid"
        }
    };
    const res1 = createMockRes();
    try { await criarCobranca(req1, res1); } catch (e) { }
    if (res1.statusCode === 400) log("FAILED: Got 400"); else log("PASSED");

    // --- criarCobrancaUnica Tests ---
    log("\n--- Testing criarCobrancaUnica ---");

    // Test 4: Valid Standard Purchase (Unica)
    log("Test 4: Valid Standard Purchase (Unica) (10 credits, 8.50)");
    const req4 = {
        body: {
            value: "8.50",
            qtd_creditos: 10,
            cpf: "12345678901",
            nome: "Test User Unica"
        }
    };
    const res4 = createMockRes();
    try { await criarCobrancaUnica(req4, res4); } catch (e) { }
    if (res4.statusCode === 400) log("FAILED: Got 400"); else log("PASSED");

    // Test 5: Valid Plan Purchase (Unica)
    log("Test 5: Valid Plan Purchase (Unica) (29.90)");
    const req5 = {
        body: {
            value: "29.90",
            qtd_creditos: 50,
            cpf: "12345678901",
            nome: "Test User Unica"
        }
    };
    const res5 = createMockRes();
    try { await criarCobrancaUnica(req5, res5); } catch (e) { }
    if (res5.statusCode === 400) log("FAILED: Got 400"); else log("PASSED");

    // Test 6: Invalid Purchase (Unica)
    log("Test 6: Invalid Purchase (Unica) (10 credits, 5.00)");
    const req6 = {
        body: {
            value: "5.00",
            qtd_creditos: 10,
            cpf: "12345678901",
            nome: "Test User Unica"
        }
    };
    const res6 = createMockRes();
    try { await criarCobrancaUnica(req6, res6); } catch (e) { }
    if (res6.statusCode === 400 && res6.jsonData.erro.includes("Valor incorreto")) {
        log("PASSED: Got expected 400 error");
    } else {
        log("FAILED: Expected 400, got " + res6.statusCode);
    }
    logStream.end();
}

runTests();
