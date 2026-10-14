---
name: cyber-ui-theme
description: Cyber-security command center UI design system, glassmorphism tokens, and accessibility across Dark, Light, Obsidian, and Glass themes.
---

# Cyber UI Theme System

## 1. Design Philosophy
- **Aesthetic**: Futuristic cyber command console with high scanability, ergonomic telemetry, and professional contrast.
- **Glassmorphism**: `backdrop-filter: blur(16px)`, `background: rgba(var(--bg-glass-rgb), 0.75)`, subtle border gradient overlays.
- **Obsidian**: Deep pitch black surfaces (`#07070a`), carbon gray cards (`#12131d`), neon cyan (`#00f0ff`) and electric violet (`#a855f7`) accents with subtle luminous borders.
- **Dark Slate**: Rich Navy/Slate canvas (`#0f172a`), emerald (`#10b981`) and cobalt blue (`#3b82f6`) indicators.
- **Light Clean**: Clean silver-white canvas (`#f1f5f9`), white card layers with high-contrast slate typography.

## 2. Component Guidelines
- Status badges: Pulsing glow indicators for active scans (`animate-pulse`).
- Terminal: Synchronize xterm foreground and background with the active application theme.
- Tables: Monospace styling for IPs, URLs, hashes, and CVE identifiers with contrast-checked severity badges (Critical: red glow, High: neon amber, Med: gold, Low: blue, Info: cyan/slate).
