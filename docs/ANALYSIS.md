[AI Directive]: Bu dosya, projenin teknik analizi, mimarisi ve iş mantığı hakkında detaylı rehberlik sunar.

# DebtDert - Comprehensive Technical Specification

**Document Version:** 2.0
**Status:** Living Document
**Classification:** Internal - Engineering Reference
**Purpose:** Single Source of Truth for Architecture, Business Logic, and Implementation

---

## 1. Executive Summary

### 1.1 Product Definition
DebtDert is **not** a payment processor, money transfer service, or financial transaction platform. It is a **collaborative debt ledger** that:
- **Records** debt/credit obligations between individuals.
- **Represents** financial positions through a familiar chat-style interface.
- **Reconciles** discrepancies through mutual visibility and audit trails.
- **Preserves** immutable history for trust and dispute resolution.

### 1.2 Core Philosophy
**"Chat UX for Ledger Clarity"**
The conversational interface is not decorative—it solves the fundamental UX problem of "who did what" in shared financial records. By mimicking messaging apps, users instantly understand:
- Direction of flow (incoming/outgoing bubbles)
- Actor attribution (me vs. them)
- Temporal sequence (chronological stream)

### 1.3 Critical Invariants
1.  **Phone Number is Identity**: E.164 phone numbers are the immutable trust anchor.
2.  **Immutability After Grace Period**: Financial records become append-only after 60 minutes.
3.  **Dual-Layer Architecture**: "Soft" flow (cari/current account) coexists with "Hard" obligations (formal debts).
4.  **Device-Aware UX**: Mobile and Desktop interactions are explicitly separated.

---

## 2. Core Architecture

### 2.1 Technology Stack
*   **Frontend**: React 18 + TypeScript
*   **State**: React Context API
*   **Backend**: Firebase (Auth, Firestore, Storage)
*   **Auth**: Firebase Phone Auth (SMS OTP)
*   **Database**: Firestore (NoSQL)
*   **Validation**: Zod

### 2.2 Dual-Layer Financial Model
```
┌─────────────────────────────────────────────────┐
│                  USER INTERFACE                 │
├─────────────────────────────────────────────────┤
│  Tri-State View: [FLOW] | [SPECIAL] | [TOTAL]   │
├──────────────────┬──────────────────────────────┤
│   SOFT LAYER     │       HARD LAYER             │
│   (Cari/Stream)  │   (Formal Obligations)       │
├──────────────────┼──────────────────────────────┤
│ Transaction[]    │ Debt[]                       │
│ - Fluid entries  │ - Structured records         │
│ - Chat-like UX   │ - Installment support        │
│ - Editable (1h)  │ - Audit trail (logs)         │
└──────────────────┴──────────────────────────────┘
```

---

## 3. Data Model Specification

### 3.1 User Entity (`users/{uid}`)
*   **Identity**: `primaryPhoneNumber` (E.164) is the unique anchor.
*   **Profile**: `displayName`, `photoURL`.
*   **Settings**: `contactSyncEnabled`, `mutedCreators`.

### 3.2 Contact Entity (`users/{uid}/contacts/{contactId}`)
*   **Purpose**: Local address book for each user.
*   **Link Resolution**: Automatically links to a `User` if the phone number matches a registered user.

### 3.3 Debt Entity (`debts/{debtId}`) - Hard Layer
*   **Type**: `ONE_TIME` or `INSTALLMENT`.
*   **Status**: `ACTIVE`, `PARTIALLY_PAID`, `PAID`, `REJECTED_BY_RECEIVER`, `AUTO_HIDDEN`.
*   **Financials**: `originalAmount`, `remainingAmount`, `currency`, `installments`.
*   **1-Hour Rule**: `createdAt` determines editability.

### 3.4 Transaction Entity - Soft Layer
*   **Direction**: `INCOMING` (Green) or `OUTGOING` (Red).
*   **Logic**: Simple ledger entries for daily expenses.

### 3.5 PaymentLog Entity (`debts/{debtId}/logs/{logId}`)
*   **Purpose**: Immutable audit trail.
*   **Types**: `INITIAL_CREATION`, `PAYMENT`, `NOTE_ADDED`, `HARD_RESET`.

---

## 4. Business Logic & Constraints

### 4.1 The "1 Hour Rule" (Temporal Immutability)
*   **Logic**: `isEditable = (now - createdAt) < 60 minutes`.
*   **Effect**: After 60 minutes, records are strictly append-only (add payment/note).
*   **Hard Reset**: Allows full correction by resetting `createdAt` and logging a `HARD_RESET` event (preserving history).

### 4.2 Tri-State View Logic
*   **FLOW**: Transactions only (`Σ(INCOMING) - Σ(OUTGOING)`).
*   **SPECIAL**: Debts only (`Σ(remainingAmount)`).
*   **TOTAL**: Combined net position.

### 4.3 Installment Logic
*   **Interim Payment**: Deducts from principal, recalculates remaining unpaid installments equally.
*   **Specific Payment**: Marks specific installment as paid, deducts amount, does not recalculate others.

### 4.4 Device Separation
*   **Mobile (<1024px)**: Swipe gestures. No inline buttons.
*   **Desktop (≥1024px)**: Hover actions (Three Dot Menu). No swipe.

---

## 5. User Workflows

### 5.1 Authentication
1.  Enter Phone -> 2. SMS OTP -> 3. Verify -> 4. Load Data or Create Profile.

### 5.2 Creating Debt
*   **Unified Input**: Single "+" button.
*   **Modes**: Simple (Soft Layer) vs Advanced (Hard Layer/Installments).
*   **Validation**: Amount > 0, Currency required, Person required.

---

## 6. Performance & Scalability
*   **Query Optimization**: Composite indexes on `lastActivityAt` + `__name__` for dashboard pagination.
*   **Optimistic UI**: Immediate local updates while Firestore syncs.

## 7. Edge Cases
*   **Phone Change**: New account creation required (manual migration support).
*   **Concurrent Payments**: Handled via Firestore Transactions.
