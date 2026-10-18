# Architecture Decision Record (ADR) 001: Trust Boundaries, Client Isolation & Local Database Strategy

**Status:** Accepted  
**Date:** 2026-10-15  
**Deciders:** Core Engineering Team, SecOps Architecture Group  
**Consulted:** Enterprise Review Board, Threat Modeling Working Group  

---

## 1. Context & Problem Statement

ReconApp is designed as a desktop-native security operations and reconnaissance workstation. As teams expand usage from individual penetration testers to collaborative assessment squads, requirements arise for sharing scan results, managing shared baselines, and coordinating multi-scanner workloads.

A common anti-pattern in desktop applications is exposing the local database (SQLite) directly over network shares (SMB/NFS) or opening unauthenticated TCP listener ports on client workstations to serve peer clients ("ad-hoc team mode"). This creates severe vulnerabilities:
1. **Network Trust Confusion**: Local assessment databases contain unredacted vulnerability payloads, target topology diagrams, internal API schemas, and active security findings. Exposing these on untrusted LAN/Wi-Fi surfaces exposes critical organizational security posture.
2. **SQLite File-Locking Corruption**: SQLite WAL mode relies on POSIX advisory locks or Windows byte-range file locks, which fail silently or corrupt data across network filesystems (SMB, NFS, CIFS).
3. **Privilege Escalation via Scanner Orchestration**: If remote clients can trigger binary execution on peer machines without mutual TLS, cryptographically signed mandates, and tenant isolation, the workstation becomes an unauthenticated remote code execution (RCE) vector.

---

## 2. Decision

We formally decide that:

1. **Strict Local Boundary for Client Database**:
   - The desktop client database (`recon_app.sqlite` in `Documents/SecOpsScans`) remains strictly local to the workstation operating system user account.
   - It will **never** be mounted on shared network folders, synced across cloud file sync services (Dropbox/OneDrive) while active, or queried directly over ad-hoc peer-to-peer TCP connections.

2. **Decoupled Team Architecture via Central Coordinator**:
   - Multi-user collaboration ("Team Mode") will **never** be implemented by binding peer clients directly to local workstation storage.
   - Instead, Team Mode must operate through a distinct, centralized Enterprise Coordinator service:
     - The Coordinator exposes an authenticated REST / gRPC API terminating at an enterprise boundary.
     - Authentication requires mTLS, Enterprise OIDC/SAML, or scoped API tokens.
     - Client workstations push completed, verified assessment reports (e.g., standard OASIS SARIF v2.1.0 or encrypted JSON packages) to the Coordinator.
     - The Coordinator ingests reports into an enterprise-grade relational database (e.g., PostgreSQL with Row-Level Security), computing global cross-target baselines.

3. **Isolated Client Execution Sandbox**:
   - All external CLI engines (Nuclei, Wapiti, ZAP, Schemathesis, SSLyze, Semgrep, Trivy) execute as unprivileged child processes managed by the local OS user.
   - Output artifacts are written exclusively to `Documents/SecOpsScans/reports/<scanId>`, governed by atomic mutexes and directory path traversal guards.
   - IPC communication is constrained to the Electron preload boundary with schema validation on all inputs.

---

## 3. Consequences

### Positive Consequences
- **Zero Workstation Attack Surface**: Workstations run 0 open inbound network ports; no peer-to-peer listeners exist that can be abused for lateral movement.
- **Data Integrity & Zero DB Corruption**: Eliminates concurrency race conditions, lock starvation, and WAL header corruption inherent to SQLite over SMB/NFS.
- **Enterprise Compliance & Auditability**: When team synchronization occurs, it passes through central authentication, audit logging, and authorization boundaries rather than opaque workstation-to-workstation gossiping.
- **Interoperability**: Standardized OASIS SARIF v2.1.0 and structured JSON exports allow integration with existing enterprise SIEM, SOAR, DefectDojo, or GitHub Code Scanning without proprietary protocol lock-in.

### Negative / Trade-Off Consequences
- Real-time live observation of another operator's in-flight terminal stream requires an external relay or screen sharing rather than direct database peering.
- Teams must deploy the optional centralized Coordinator API if centralized aggregation is required; offline teams must manually exchange exported SARIF/HTML bundles.

---

## 4. Compliance & Verification

- Tested and enforced in `tests/phase2-gates.test.ts` (IPC isolation, protocol allowlisting, secret vault protection).
- Audited against OWASP Top 10 Desktop Application Security Risks and ASVS standards.
