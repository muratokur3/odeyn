# PROJECT DEBTDERT - AI & AGENT MANIFESTO

This document outlines the core rules, architectural decisions, and coding standards for the "DebtDert" project. All AI agents (Jules, Copilot, etc.) MUST adhere to these guidelines strictly.

## 1. CORE PHILOSOPHY: DUAL-LAYER ARCHITECTURE
The app now operates on a "Dual-Layer" architecture:
1.  **Current Stream (Cari / Akış):** For simple daily flow (e.g., "Lunch", "Taxi"). Visualized as a Chat.
2.  **Special Files (Dosyalar):** For complex debts (Installments, Dates, Contracts). Visualized as Cards/Files.

## 2. TECH STACK & ARCHITECTURE
*   **Frontend Library:** React (Functional Components with Hooks ONLY).
*   **Language:** JavaScript (ES6+) / React JSX / TypeScript.
*   **Backend / Database:** Firebase (Firestore, Authentication, Hosting).
*   **Styling:** Tailwind CSS (preferred) / CSS Modules.
*   **Routing:** React Router DOM.
*   **Platform:** Web (deployed via Firebase Hosting).

## 3. CRITICAL RULES (NEVER BREAK THESE)
1.  **1-Hour Hard Delete Rule:** A record can ONLY be deleted by its **Creator** and ONLY within **1 Hour** of creation. After that, it must be reversed or archived.
2.  **Unified Smart Input:** All entries start from a single FAB. Simple inputs go to Stream; Complex inputs (Date/Installment) go to Files.
3.  **NO Class Components:** Always use Functional Components and Hooks.
4.  **NO Direct DOM Manipulation:** Use `useRef` if absolutely necessary.
5.  **NO SQL:** Use Firestore SDK methods.
6.  **NO Secrets in Code:** Use environment variables.

## 4. DATA STRUCTURE
*   **Stream (Transactions):** stored in `debts/{ledgerId}/transactions` (Shared Ledger).
*   **Files (Debts):** stored in `debts` collection (Independent documents).

## 5. UI/UX STANDARDS
*   **Stream View:** Chat Bubbles (Right/Green = Given, Left/Red = Taken). Solid Borders.
*   **Files View:** Card List. Dashed Borders (Paper feel).
*   **Swipe Actions:** Swipe left on Stream bubble to delete (if < 1hr).

## 6. CODING STANDARDS
*   **Error Handling:** Wrap async ops in `try/catch`.
*   **User Feedback:** Use toasts/alerts.
*   **Firebase Usage:** Use `serverTimestamp()`. Validate data.

---
*Refer to `PROJECT_MANIFEST.md` for detailed business logic.*
