# Odeyn AI Coding Instructions & Architectural Rules (V2)

This document serves as the **Source of Truth** for all AI-generated code and architectural decisions for Odeyn.
All future modifications must strictly adhere to these guidelines.

## 1. Core Philosophy: The Asymmetric Trust Model
The "Mutual Confirmation" model is obsolete. Odeyn V2 operates on **Asymmetric Trust**.

- **Instant Validity:** All Debts and Payments are **Instantly Active** upon creation. There is no "Pending" state, no "Approval Request", and no "Waiting for Confirmation".
    - *Rationale:* Users record debts for themselves first. Trust is implicit or verified socially, not blocked by UI.
- **Opt-Out Mechanism:** A receiver (the person who did *not* create the record) cannot "Block" or "Prevent" a transaction.
    - They can only **"Delete/Reject"** it.
    - **Effect:** This removes the record from the *Receiver's* view and totals completely.
    - **Retention:** The record remains in the *Creator's* history but is marked as `REJECTED_BY_RECEIVER` (or similar status), preserving the Creator's ledger integrity.

## 2. Session & User Management (Anti-Gravity)
- **Persistence:** Users stay logged in indefinitely.
- **Rolling Window:** Session remains valid unless inactive for **90 Days**.
- **Device Tracking:** Devices are tracked via `localStorage` UUIDs.
- **Revocation:** Users can remotely revoke specific devices from Settings.

## 3. Payment Logic
- **Instant Entry:** If the creditor has enabled `allowPaymentEntry` (default: true), payments added by the debtor are applied **instantly**.
- **Reversal Rights:** The Creditor retains the unilateral right to "Reject" (Reverse) a payment entry if it is incorrect. This reverts the balance and marks the payment log as `REJECTED`.

## 4. UI/UX Standards (Visual Manifest)
The UI must prioritize clarity, speed, and context.

### A. Transaction List (History)
- **Layout:** Must use a **Chat-Like Timeline**.
- **Alignment:**
    - **Right:** Items created by the *current user* (Me).
    - **Left:** Items created by the *counterparty* (Them).
- **Styling:** distinct background colors or styles to separate "My Actions" from "Their Actions".

### B. Context-Aware FAB (Floating Action Button)
The main action button adapts to the current route:
- **Global / Home:** **Blue** (New Debt - General)
- **User Profile:** **Purple** (New Debt - Pre-filled for this user)
- **Debt Detail:** **Green** (New Payment - For this specific debt)

### C. Dashboard & Activity
- **Activity Feed:** The dashboard must show a "Last Activity" summary (e.g., "Ahmet 500TL ödeme ekledi") directly on the main card or list item, reducing the need to drill down into details.

## 5. Privacy & Contact Logic
- **Clean Slate Muting:** "Muting" (Sessize Alma) hides *future* notifications and *current* totals.
    - **Unmuting:** Does **not** flood the dashboard with past hidden records. Only *new* or *updated* records appear after unmuting.
- **Hybrid Discovery:** Contact routing and resolution must **Always** prioritize registered `UID`s over Phone Numbers.
    - If a UID is available/linked, use it. Phone matching is a fallback.

## 6. Implementation Notes for AI
- **Deprecations:** Do not generate code related to `confirmPayment`, `requestApproval`, `pending` status checks for validity.
- **Data Structure:** Ensure `Debt` and `PaymentLog` objects support `rejectedBy` and `status` fields that align with the asymmetric model (e.g., `REJECTED_BY_RECEIVER`).
