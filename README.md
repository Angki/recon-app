# Recon-App 🛡️

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Electron](https://img.shields.io/badge/Electron-Desktop-lightgrey.svg?logo=electron)
![React](https://img.shields.io/badge/React-UI-blue.svg?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg?logo=typescript)

**Recon-App** is a robust, enterprise-grade desktop application built with Electron and React. It serves as a unified command center for automated security reconnaissance, vulnerability scanning, and AI-powered log analysis. Designed for penetration testers and DevSecOps professionals, it orchestrates industry-standard CLI tools seamlessly within a modern, dark-themed UI.

---

## ✨ Features

### 🚀 Unified Scanning Ecosystem
Run and monitor the most powerful open-source security tools from a single dashboard:
- **ProjectDiscovery Ecosystem:** Nuclei, Subfinder, HTTPX, Naabu, DNSX, AlterX, TLSX, Katana
- **Vulnerability Scanners:** Wapiti, Nmap, WPScan, ZAP
- **Commercial/Enterprise (Via Interface):** AppScan, Netsparker, Acunetix

### 🧠 AI-Powered Threat Analysis
Automatically feed raw scan logs into integrated AI models for immediate context, risk prioritization, and remediation advice.
- **Local Privacy:** Full support for local **Ollama** models (Llama 3, Mistral) for air-gapped or sensitive environments.
- **Cloud Intelligence:** Native integrations with **OpenAI (GPT-4)**, **Anthropic (Claude 3)**, and **Google Gemini**.

### 💻 Real-Time Terminal Emulation
- View stdout/stderr streams instantly with integrated **xterm.js**.
- Searchable logs, auto-scrolling, and clipboard integration.

### 📊 Persistence & History
- Automatic scan metadata management and state tracking.
- Retrieve past scan results from the internal storage history.

---

## 🏗️ Architecture

Recon-App follows the standard IPC (Inter-Process Communication) model of Electron applications:
- **Frontend (Renderer):** Built with React 18, Vite, and Tailwind CSS. Acts as the control plane.
- **Backend (Main Process):** Node.js environment responsible for spawning child processes (`child_process.spawn`), managing local storage (`fs`), and orchestrating the AI service daemons.
- **Communication:** Secured via `contextBridge` in `preload.ts` ensuring a strict boundary between Node.js internals and the React UI.

---

## 🛠️ Prerequisites

Before installing Recon-App, ensure your operating system has the following dependencies installed and available in your system's `PATH`:

### 1. Core Development Dependencies
- **Node.js** (v18.0.0 or higher)
- **npm** or **yarn**

### 2. Required Security Tools
Recon-App orchestrates external binaries. You must install the tools you intend to use:
- [Nuclei](https://github.com/projectdiscovery/nuclei) & [ProjectDiscovery Suite](https://projectdiscovery.io/)
- [Nmap](https://nmap.org/download.html)
- [Wapiti](https://github.com/wapiti-scanner/wapiti)
- [WPScan](https://wpscan.com/) (Optional, for WordPress scanning)

*Note: Ensure all installed tools can be executed globally from your command line (e.g., running `nuclei -version` should succeed).*

### 3. AI Capabilities (Optional but Recommended)
- [Ollama](https://ollama.com/) (For local LLM execution without internet)
- Valid API Keys for external providers (OpenAI, Anthropic, Gemini) if using cloud AI features.

---

## ⚙️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Angki/recon-app.git
   cd recon-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the application in development mode:**
   ```bash
   npm run dev
   ```
   *This command leverages Vite to start the React frontend and concurrently compiles/launches the Electron main process.*

---

## 📦 Building for Production

To package the application for distribution on your current operating system, run:

```bash
npm run build
```
This will generate the compiled executables in the `dist/` or `release/` folder based on your `electron-builder` configuration.

---

## 📝 Roadmap & Future Enhancements

- [ ] **Strategy Pattern Orchestrator:** Modularizing the `scanner.ts` backend to strictly adhere to SOLID principles.
- [ ] **Throttled IPC Logging:** Enhancing memory management and UI performance during heavy parallel scans.
- [ ] **Asynchronous Storage:** Migrating from synchronous filesystem reads to local SQLite or asynchronous key-value stores to prevent race conditions.
- [ ] **Dependency Manager:** Auto-fetching/updating of external CLI tools directly from within the UI into a sandboxed app directory.

---

## 🤝 Contributing

Contributions are welcome! If you're looking to help improve Recon-App:
1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

Please ensure your code strictly follows the existing styling and ESLint rules.

---

## 🛡️ Disclaimer

**Recon-App is designed strictly for authorized security auditing, educational purposes, and professional penetration testing.**
The authors and contributors are not responsible for any misuse, unauthorized access, or damage caused by this tool. Always ensure you have explicit permission to scan the target domains or networks.

---
*Developed with ❤️ by the Open Source Security Community.*
