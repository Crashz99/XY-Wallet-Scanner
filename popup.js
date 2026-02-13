document.addEventListener('DOMContentLoaded', () => {

    // ===== ELEMENTS =====
    const scoreDisplay = document.getElementById('scoreDisplay');
    const statusDisplay = document.getElementById('statusDisplay');
    const flagList = document.getElementById('flagList');

    const txCountEl = document.getElementById('txCount');
    const balanceEthEl = document.getElementById('balanceEth');
    const walletAgeEl = document.getElementById('walletAge');
    const velocityEl = document.getElementById('velocity');

    const launderingRiskEl = document.getElementById('launderingRisk');
    const phishingRiskEl = document.getElementById('phishingRisk');
    const contractRiskEl = document.getElementById('contractRisk');

    const aiVerdict = document.getElementById('aiVerdict');

    const toggleBtn = document.getElementById('toggleDetails');
    const details = document.getElementById('details');

    const refreshBtn = document.getElementById('refreshBtn');

    // =========================
    // FIND WALLET ADDRESS
    // =========================
    async function scanPage() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        let address = tab.url.match(/0x[a-fA-F0-9]{40}/i)?.[0]?.toLowerCase();

        if (!address) {
            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        const text = document.body?.innerText || '';
                        const matches = text.match(/0x[a-fA-F0-9]{40}/gi) || [];

                        const valid = matches.filter(a =>
                            a !== '0x0000000000000000000000000000000000000000'
                        );

                        if (valid.length === 0) return null;

                        const count = {};
                        valid.forEach(a => count[a] = (count[a] || 0) + 1);

                        return Object.keys(count).reduce((a, b) =>
                            count[a] > count[b] ? a : b
                        );
                    }
                });

                address = results[0]?.result;
            } catch (e) {
                console.log("Page scan failed:", e);
            }
        }

        if (!address) {
            statusDisplay.innerText = "No valid wallet found";
            scoreDisplay.innerText = "--/100";
            return;
        }

        statusDisplay.innerText = `Scanning ${address.slice(0, 10)}...`;
        analyzeAddress(address);
    }

    // =========================
    // ANALYZE ADDRESS
    // =========================
    async function analyzeAddress(address) {
        try {
            const res = await fetch(`http://localhost:3000/check-address/${address}`);

            if (!res.ok) {
                const errText = await res.text();
                console.error("Backend error:", errText);
                throw new Error("Backend failed");
            }

            const data = await res.json();

            // ===== SCORE =====
            scoreDisplay.innerText = `${data.riskScore}/100`;

            // COLOR
            scoreDisplay.classList.remove('safe', 'medium', 'danger');

            if (data.status.includes("HIGH")) {
                scoreDisplay.classList.add('danger');
            } else if (data.status.includes("MEDIUM")) {
                scoreDisplay.classList.add('medium');
            } else {
                scoreDisplay.classList.add('safe');
            }

            // ===== STATUS =====
            statusDisplay.innerText = data.status;

            // ===== FLAGS =====
            flagList.innerHTML = data.flags?.length
                ? data.flags.map(f => `<li>${f}</li>`).join('')
                : "<li>No risks detected</li>";

            // ===== AI VERDICT =====
            aiVerdict.innerText =
                data.riskScore > 60
                    ? "🚨 High risk wallet — avoid interaction"
                    : data.riskScore > 30
                        ? "⚠️ Suspicious wallet — proceed carefully"
                        : "✔ Wallet looks safe";

            // ===== METRICS =====
            if (data.metrics) {
                txCountEl.textContent = data.metrics.txCount ?? "--";
                balanceEthEl.textContent = `${data.metrics.balanceEth ?? "--"} ETH`;
                walletAgeEl.textContent = `${data.metrics.walletAgeDays ?? "--"} days`;
                velocityEl.textContent = `${Math.min(data.metrics.txCount || 0, 100)}/100`;
            }

            // ===== RISK TAGS =====
            if (data.metrics) {
                setRisk(launderingRiskEl, data.metrics.launderingRisk);
                setRisk(phishingRiskEl, data.metrics.phishingRisk);
                setRisk(contractRiskEl, data.metrics.contractRisk);
            }

        } catch (err) {
            console.error("❌ ERROR:", err);

            statusDisplay.innerText = "Server offline";
            scoreDisplay.innerText = "--/100";
        }
    }

    // =========================
    // RISK COLOR HELPER
    // =========================
    function setRisk(element, value) {
        if (!element) return;

        element.textContent = value || "--";

        element.classList.remove("risk-high", "risk-low");

        if (value === "HIGH") {
            element.classList.add("risk-high");
        } else {
            element.classList.add("risk-low");
        }
    }

    // =========================
    // DROPDOWN TOGGLE
    // =========================
    toggleBtn.onclick = () => {
        const isOpen = details.classList.contains("open");

        if (isOpen) {
            details.classList.remove("open");
            toggleBtn.textContent = "▼ Advanced Analysis";
        } else {
            details.classList.add("open");
            toggleBtn.textContent = "▲ Hide Details";
        }
    };

    // =========================
    // REFRESH
    // =========================
    refreshBtn.onclick = scanPage;

    // =========================
    // AUTO START
    // =========================
    scanPage();
});
