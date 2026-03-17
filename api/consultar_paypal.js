// api/consultar_paypal.js
import fetch from 'node-fetch';
import 'dotenv/config';

async function getAccessToken() {
    const auth = Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

    const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.paypal.com';
    
    console.log(`Usando Base URL: ${baseUrl}`);

    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });

    const data = await response.json();
    if (data.error) {
        throw new Error(`Erro ao obter token: ${data.error_description || data.error}`);
    }
    return data.access_token;
}

async function listProducts(token) {
    const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.paypal.com';
    const response = await fetch(`${baseUrl}/v1/catalogs/products`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return await response.json();
}

async function listPlans(token) {
    const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.paypal.com';
    const response = await fetch(`${baseUrl}/v1/billing/plans`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return await response.json();
}

async function getPlanDetails(token, planId) {
    const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.paypal.com';
    const response = await fetch(`${baseUrl}/v1/billing/plans/${planId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return await response.json();
}

async function main() {
    try {
        console.log("--- Iniciando Consulta PayPal ---");
        const token = await getAccessToken();
        console.log("✅ Token obtido com sucesso.");

        console.log("\n--- Listando Produtos ---");
        const products = await listProducts(token);
        if (products.products && products.products.length > 0) {
            products.products.forEach(p => {
                console.log(`ID: ${p.id} | Nome: ${p.name} | Status: ${p.status}`);
            });
        } else {
            console.log("Nenhum produto encontrado.");
        }

        console.log("\n--- Listando Planos (com detalhes) ---");
        const plans = await listPlans(token);
        if (plans.plans && plans.plans.length > 0) {
            for (const p of plans.plans) {
                const details = await getPlanDetails(token, p.id);
                console.log(`\nID: ${details.id}`);
                console.log(`Nome: ${details.name}`);
                console.log(`Status: ${details.status}`);
                console.log(`Descrição: ${details.description || 'N/A'}`);
                
                if (details.billing_cycles && details.billing_cycles.length > 0) {
                    const cycle = details.billing_cycles[0];
                    const price = cycle.pricing_scheme?.fixed_price;
                    const frequency = cycle.frequency;
                    console.log(`Preço: ${price?.currency_code} ${price?.value}`);
                    console.log(`Frequência: ${frequency?.interval_count} ${frequency?.interval_unit}(s)`);
                }
                console.log("-----------------------");
            }
        } else {
            console.log("Nenhum plano encontrado.");
        }

        console.log("\n--- Fim da Consulta ---");
    } catch (error) {
        console.error("❌ Erro:", error.message);
    }
}

main();
