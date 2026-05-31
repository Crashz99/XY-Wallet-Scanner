# XY Blockchain Tracer 🔍

A Manifest V3 Chrome Extension designed to parse browser tabs, trace crypto wallet data, and communicate with a custom local backend for blockchain security analytics.

### 🚀 Features
* **Active Tab Scanning:** Automatically parses web page content for crypto wallet addresses.
* **Etherscan API Integration:** Fetches real-time data from Etherscan to evaluate contract and wallet secureness.
* **Local Backend Communication:** Interfaces seamlessly with a local server (`localhost:3000`) for deeper data processing.

> ⚠️ **Note:** The security analysis formulae are currently undergoing  scrutiny and tightening , maybe slightly off in values for now .

### 🛠️ Tech Stack
* **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3, Chrome Extension Web APIs (Manifest V3)
* **Backend:** Node.js (running locally)
