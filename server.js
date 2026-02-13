require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 CONFIG
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const BASE_URL = "https://api.etherscan.io/v2/api";

if (!ETHERSCAN_API_KEY) {
    console.error("❌ Missing ETHERSCAN_API_KEY in .env");
    process.exit(1);
}

// ---- HELPERS ---- //

function isValidAddress(addr) {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function parseEth(wei) {
    return Number(wei) / 1e18;
}

// ---- MAIN ROUTE ---- //

app.get('/check-address/:address', async (req, res) => {
    const addr = req.params.address.trim().toLowerCase();

    if (!isValidAddress(addr)) {
        return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    console.log(`🔍 Checking ${addr}`);

    let riskScore = 0;
    let flags = [];

    let metrics = {
        txCount: 0,
        balanceEth: 0,
        walletAgeDays: 0
    };

    let txData = [];

    try {
        // =========================
        // 1. FETCH TRANSACTIONS
        // =========================
        try {
            const txRes = await axios.get(BASE_URL, {
                params: {
                    chainid: 1,
                    module: "account",
                    action: "txlist",
                    address: addr,
                    startblock: 0,
                    endblock: 99999999,
                    page: 1,
                    offset: 100,
                    sort: "asc",
                    apikey: ETHERSCAN_API_KEY
                }
            });

            if (txRes.data.status === "1") {
                txData = txRes.data.result;
                metrics.txCount = txData.length;
            } else {
                console.warn("⚠️ TX Error:", txRes.data.message);
            }

        } catch (err) {
            console.warn("⚠️ TX fetch failed:", err.message);
        }

        // =========================
        // 2. FETCH BALANCE
        // =========================
        try {
            const balRes = await axios.get(BASE_URL, {
                params: {
                    chainid: 1,
                    module: "account",
                    action: "balance",
                    address: addr,
                    tag: "latest",
                    apikey: ETHERSCAN_API_KEY
                }
            });

            if (balRes.data.status === "1") {
                metrics.balanceEth = parseEth(balRes.data.result);
            } else {
                console.warn("⚠️ Balance Error:", balRes.data.message);
            }

        } catch (err) {
            console.warn("⚠️ Balance fetch failed:", err.message);
        }

        // =========================
        // 3. WALLET AGE
        // =========================
        if (txData.length > 0) {
            const firstTx = txData[0];
            const firstTimestamp = parseInt(firstTx.timeStamp) * 1000;
            const ageDays = (Date.now() - firstTimestamp) / (1000 * 60 * 60 * 24);
            metrics.walletAgeDays = Math.floor(ageDays);
        }

        // =========================
        // 4. RISK SCORING
        // =========================

        if (metrics.txCount === 0) {
            riskScore += 20;
            flags.push("🆕 New / Inactive wallet");
        }

        if (metrics.txCount > 0 && metrics.txCount < 5) {
            riskScore += 10;
            flags.push("⚠️ Very low activity");
        }

        if (metrics.txCount > 50 && metrics.balanceEth < 0.05) {
            riskScore += 25;
            flags.push("⚡ High velocity + low balance");
        }

        if (metrics.balanceEth < 0.001 && metrics.txCount > 10) {
            riskScore += 15;
            flags.push("💸 Dust wallet pattern");
        }

        if (metrics.txCount > 200 && metrics.balanceEth > 0.5) {
            riskScore -= 20;
            flags.push("✅ Established wallet");
        }

        if (metrics.walletAgeDays > 180) {
            riskScore -= 10;
        }

        // Clamp score
        riskScore = Math.max(0, Math.min(100, riskScore));

        // =========================
        // 4.5 EXTRA METRICS (NEW)
        // =========================

        let launderingRisk = "LOW";
        let phishingRisk = "LOW";
        let contractRisk = "LOW";
        let velocityScore = 0;

        // Velocity Score (0–100)
        if (metrics.txCount > 0 && metrics.walletAgeDays > 0) {
            const txPerDay = metrics.txCount / metrics.walletAgeDays;
            velocityScore = Math.min(100, Math.floor(txPerDay * 10));
        }

        // Laundering heuristic
        if (metrics.txCount > 80 && metrics.balanceEth < 0.05) {
            launderingRisk = "HIGH";
        } else if (metrics.txCount > 30) {
            launderingRisk = "MEDIUM";
        }

        // Phishing heuristic
        if (metrics.balanceEth < 0.001 && metrics.txCount > 20) {
            phishingRisk = "MEDIUM";
        }

        // Contract interaction heuristic
        if (metrics.txCount > 100) {
            contractRisk = "MEDIUM";
        }

        // =========================
        // 5. FINAL OUTPUT
        // =========================

        const status =
            riskScore > 60 ? "HIGH RISK" :
            riskScore > 30 ? "MEDIUM RISK" :
            "LOW RISK";

        const response = {
            address: addr,
            riskScore,
            status,
            flags: flags.length ? flags : ["✅ No major risks detected"],
            metrics: {
                txCount: metrics.txCount,
                balanceEth: Number(metrics.balanceEth).toFixed(6),
                walletAgeDays: metrics.walletAgeDays,
                velocityScore,
                launderingRisk,
                phishingRisk,
                contractRisk
            }
        };

        console.log(`✅ ${status} | Score: ${riskScore} | TX: ${metrics.txCount}`);

        res.json(response);

    } catch (err) {
        console.error("💥 SERVER ERROR:", err.message);

        res.status(500).json({
            error: "Internal server error",
            details: err.message
        });
    }
});

// ---- HEALTH ---- //
app.get('/health', (req, res) => {
    res.json({ status: "OK" });
});

// ---- START ---- //
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
