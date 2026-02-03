# DebtDert - Comprehensive Technical Specification

**Document Version:** 2.0  
**Date:** 2026-02-03  
**Status:** Living Document  
**Classification:** Internal - Engineering Reference  
**Purpose:** Single Source of Truth for Architecture, Business Logic, and Implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Core Architecture](#2-core-architecture)
3. [Data Model Specification](#3-data-model-specification)
4. [Business Logic & Constraints](#4-business-logic--constraints)
5. [State Machines & Transitions](#5-state-machines--transitions)
6. [User Workflows](#6-user-workflows)
7. [Screen Specifications](#7-screen-specifications)
8. [Security & Access Control](#8-security--access-control)
9. [Performance & Scalability](#9-performance--scalability)
10. [Edge Cases & Error Handling](#10-edge-cases--error-handling)
11. [**CRITICAL ENHANCEMENTS** (Builder's Perspective)](#11-critical-enhancements)
12. [Fraud Prevention & Abuse](#12-fraud-prevention--abuse)
13. [Dispute Resolution Mechanism](#13-dispute-resolution-mechanism)
14. [Simplification Opportunities](#14-simplification-opportunities)
15. [Missing Features (Must-Have)](#15-missing-features-must-have)

---

## 1. Executive Summary

### 1.1 Product Definition

DebtDert is **not** a payment processor, money transfer service, or financial transaction platform. It is a **collaborative debt ledger** that:

- **Records** debt/credit obligations between individuals
- **Represents** financial positions through a familiar chat-style interface
- **Reconciles** discrepancies through mutual visibility and audit trails
- **Preserves** immutable history for trust and dispute resolution

### 1.2 Core Philosophy

**"Chat UX for Ledger Clarity"**  
The conversational interface is not decorative—it solves the fundamental UX problem of "who did what" in shared financial records. By mimicking messaging apps, users instantly understand:

- Direction of flow (incoming/outgoing bubbles)
- Actor attribution (me vs. them)
- Temporal sequence (chronological stream)

### 1.3 Critical Invariants

1. **Phone Number is Identity**: E.164 phone numbers are the immutable trust anchor. Email, displayName, and even Firebase UID are secondary metadata.
2. **Immutability After Grace Period**: Financial records become append-only after 60 minutes to prevent historical manipulation.
3. **Dual-Layer Architecture**: "Soft" flow (cari/current account) coexists with "Hard" obligations (formal debts/installments).
4. **Device-Aware UX**: Mobile and Desktop interactions are explicitly separated—no hybrid patterns.

---

## 2. Core Architecture

### 2.1 Technology Stack

| Layer          | Technology                          | Purpose                    |
| -------------- | ----------------------------------- | -------------------------- |
| **Frontend**   | React 18 + TypeScript               | Type-safe UI components    |
| **State**      | React Context API                   | Global auth and view state |
| **Backend**    | Firebase (Auth, Firestore, Storage) | Serverless infrastructure  |
| **Auth**       | Firebase Phone Auth (SMS OTP)       | Identity verification      |
| **Database**   | Firestore (NoSQL)                   | Document-oriented storage  |
| **Validation** | Zod                                 | Runtime schema validation  |

### 2.2 Dual-Layer Financial Model

```
┌─────────────────────────────────────────────────┐
│                  USER INTERFACE                 │
├─────────────────────────────────────────────────┤
│  Tri-State View: [FLOW] | [SPECIAL] | [TOTAL]  │
├──────────────────┬──────────────────────────────┤
│   SOFT LAYER     │       HARD LAYER             │
│   (Cari/Stream)  │   (Formal Obligations)       │
├──────────────────┼──────────────────────────────┤
│ Transaction[]    │ Debt[]                       │
│ - Fluid entries  │ - Structured records         │
│ - Chat-like UX   │ - Installment support        │
│ - Editable (1h)  │ - Audit trail (logs)         │
│ - No approval    │ - Status workflow            │
└──────────────────┴──────────────────────────────┘
         ↓                    ↓
    Net Balance Calculation (Aggregated)
```

**Key Distinction:**

- **Soft Layer**: Informal "I gave you 50 TRY" entries. Think: splitting dinner bills.
- **Hard Layer**: Contractual "You owe me 10,000 TRY in 6 installments" records. Think: lending for a car down payment.

---

## 3. Data Model Specification

### 3.1 User Entity

**Collection Path:** `users/{uid}`  
**Primary Index:** `primaryPhoneNumber` (unique)  
**Security:** User can only read/write their own document

#### Schema

```typescript
interface User {
  // === IDENTITY (Immutable Core) ===
  uid: string; // Firebase Auth UID
  phoneNumbers: string[]; // E.164 verified numbers (multi-number support)
  primaryPhoneNumber: string; // *** CRITICAL TRUST ANCHOR ***

  // === PROFILE (Mutable) ===
  displayName: string; // Public nickname (editable)
  photoURL?: string; // Avatar (Firebase Storage URL)
  email?: string; // Optional (not used for auth)
  recoveryEmail?: string; // For account recovery only

  // === PREFERENCES ===
  preferences?: {
    autoApproveDebt?: boolean; // @deprecated (approval flow removed)
    requireApproval?: boolean; // @deprecated
    defaultAllowPaymentAddition?: boolean;
  };

  settings?: {
    contactSyncEnabled: boolean; // Sync device contacts to Firestore
    contactAccessGranted: boolean; // OS-level permission status
    suppressSyncSuggestion: boolean; // Hide "sync contacts" banner
    lastSyncAt?: Timestamp; // Last successful sync
  };

  // === MODERATION ===
  mutedCreators?: string[]; // UIDs of users whose debts are auto-hidden

  // === AUDIT ===
  createdAt: Timestamp; // Account creation
}
```

#### Why Phone Number is Identity

**Problem:** Traditional identity systems (email, username) are:

- Forgettable (people forget their own emails)
- Changeable (users want to switch emails)
- Not universal (not everyone has email)

**Solution:** Phone numbers are:

- **Memorable**: Users know their own number
- **Verifiable**: SMS OTP proves ownership
- **Stable**: People rarely change numbers (high switching cost)
- **Universal**: Required for account creation
- **Portable**: Can transfer to new devices

**Implementation:**

- `primaryPhoneNumber` is stored in **E.164 format** (`+905551234567`)
- Firestore Security Rules enforce `primaryPhoneNumber` uniqueness
- Even if a user's Firebase UID changes (account migration), the phone number remains the anchor

#### Validation Rules

```typescript
const UserSchema = z.object({
  uid: z.string().min(1),
  phoneNumbers: z.array(z.string().regex(/^\+[1-9]\d{10,14}$/)), // E.164
  primaryPhoneNumber: z.string().regex(/^\+[1-9]\d{10,14}$/),
  displayName: z.string().min(1).max(50),
  photoURL: z.string().url().optional(),
  // ... (full schema in types/index.ts)
});
```

**Constraints:**

- `displayName`: 1-50 characters, no special regex (allows international names)
- `phoneNumbers`: Must be E.164 format, max 3 numbers per user
- `primaryPhoneNumber`: Must exist in `phoneNumbers` array

---

### 3.2 Contact Entity

**Collection Path:** `users/{uid}/contacts/{contactId}`  
**Purpose:** Local address book for each user (private, not shared)

#### Schema

```typescript
interface Contact {
  id: string; // Auto-generated document ID
  name: string; // User's local alias ("Mom", "Ali Bey")
  phoneNumber: string; // E.164 format
  linkedUserId?: string; // UID if this phone matches a registered User

  // === ACTIVITY TRACKING ===
  lastActivityMessage?: string; // Preview text ("Paid 100 TRY")
  lastActivityAt?: Timestamp; // For sorting (most recent first)
  lastActorId?: string; // UID of who performed last action

  // === UNREAD INDICATOR ===
  hasUnreadActivity?: boolean; // Calculated: lastActivityAt > lastReadAt
  lastReadAt?: Timestamp; // When user opened this contact's detail page

  createdAt: Timestamp;
}
```

#### Link Resolution Logic

When a user adds a contact with phone `+905551234567`:

1. **Query** `users` collection where `primaryPhoneNumber == '+905551234567'`
2. **If found**: Set `linkedUserId` to that User's UID → Enable real-time sync
3. **If not found**: Leave `linkedUserId` as `null` → Contact is "unregistered"

**Benefits:**

- Registered users get: Real-time updates, avatars, display names
- Unregistered contacts still work: Stored by phone number for future linking

**Edge Case:** If a non-user joins the app later, their existing contacts auto-upgrade via a background Cloud Function that re-scans and links.

---

### 3.3 Debt Entity (Hard Layer)

**Collection Path:** `debts/{debtId}`  
**Access:** Visible to both `lenderId` and `borrowerId`

#### Schema

```typescript
interface Debt {
  id: string;

  // === TYPE & STATUS ===
  type: "ONE_TIME" | "INSTALLMENT"; // Payment structure
  status: DebtStatus; // See State Machine (Section 5)

  // === PARTIES ===
  lenderId: string; // UID or E.164 (if non-user)
  lenderName: string; // Cached display name
  borrowerId: string; // UID or E.164
  borrowerName: string; // Cached display name
  participants: string[]; // [lenderId, borrowerId] for queries

  // === FINANCIAL ===
  originalAmount: number; // Initial principal (immutable after creation)
  remainingAmount: number; // Current outstanding (updated by payments)
  currency: string; // ISO 4217 (TRY, USD, EUR) + GOLD

  // === INSTALLMENTS (Optional) ===
  installments?: Installment[]; // Only if type === 'INSTALLMENT'

  // === TIMING ===
  dueDate?: Timestamp; // Final payment deadline (advisory)
  createdAt: Timestamp; // *** CRITICAL FOR 1-HOUR RULE ***
  createdBy: string; // UID of creator (for permissions)

  // === METADATA ===
  note?: string; // Optional description
  lockedPhoneNumber?: string; // Immutable phone anchor (if borrower is non-user)

  // === SOFT DELETE ===
  isDeleted?: boolean; // Trash (only within 1 hour)
  deletedAt?: Timestamp;

  // === PERMISSIONS ===
  canBorrowerAddPayment?: boolean; // Allow counterparty to record payments
  allow_counterparty_edit?: boolean; // @deprecated

  // === REJECTION ===
  rejectedAt?: Timestamp; // When receiver rejected this debt
  isMuted?: boolean; // Auto-hide (without notifying sender)
}

interface Installment {
  id: string; // UUID
  dueDate: Timestamp; // When this installment is due
  amount: number; // Payment amount (recalculated on interim payments)
  isPaid: boolean; // Payment status
  paidAt?: Timestamp; // When marked as paid
}
```

#### Debt Status Enum

```typescript
type DebtStatus =
  | "PENDING" // @deprecated (approval flow removed)
  | "ACTIVE" // Currently outstanding
  | "PARTIALLY_PAID" // Some installments paid
  | "PAID" // Fully settled (remainingAmount ≈ 0)
  | "REJECTED" // @deprecated
  | "REJECTED_BY_RECEIVER" // Borrower declined
  | "AUTO_HIDDEN" // Muted by receiver (silent rejection)
  | "ARCHIVED" // @deprecated (conflicted with 1-hour rule)
  | "HIDDEN"; // @deprecated
```

**Active Statuses:** `ACTIVE`, `PARTIALLY_PAID`, `PAID`  
**Terminal Statuses:** `PAID`, `REJECTED_BY_RECEIVER`, `AUTO_HIDDEN`

#### Currency Support

**Standard Currencies:** TRY, USD, EUR, GBP  
**Special Case:** `GOLD` (measured in grams, stored as numeric weight)

**Validation:**

```typescript
const CurrencySchema = z.enum(["TRY", "USD", "EUR", "GBP", "GOLD"]);
```

**Display Logic:**

- TRY: "5.000,00 ₺" (Turkish formatting)
- USD: "$5,000.00"
- GOLD: "250.5 gr" (decimal grams)

---

### 3.4 Transaction Entity (Soft Layer)

**Collection Path:** Stored in contact-specific ledger (implementation detail)

#### Schema

```typescript
interface Transaction {
  id: string;
  amount: number; // Positive value
  currency?: string; // Default: TRY
  description?: string; // Optional note
  direction: "INCOMING" | "OUTGOING"; // Perspective of current user
  createdAt: Timestamp;
  createdBy: string; // UID
  type: "SIMPLE"; // Reserved for future expansion
}
```

**Direction Semantics:**

- `OUTGOING`: "I gave money to this person" → Red/Negative in UI
- `INCOMING`: "I received money from this person" → Green/Positive in UI

**Balance Calculation:**

```typescript
const netBalance = transactions.reduce((sum, tx) => {
  return sum + (tx.direction === "INCOMING" ? tx.amount : -tx.amount);
}, 0);
```

---

### 3.5 PaymentLog Entity (Audit Trail)

**Collection Path:** `debts/{debtId}/logs/{logId}`  
**Purpose:** Immutable append-only log of all debt modifications

#### Schema

```typescript
interface PaymentLog {
  id: string;
  type: PaymentLogType;
  timestamp: Timestamp;
  performedBy: string; // UID of actor

  // === FINANCIAL FIELDS (for PAYMENT type) ===
  amountPaid?: number;
  previousRemaining: number; // Before this action
  newRemaining: number; // After this action
  installmentId?: string; // If specific installment was paid

  // === METADATA ===
  note?: string; // User-provided comment
  status?: "PENDING" | "APPROVED" | "REJECTED"; // @deprecated
}

type PaymentLogType =
  | "INITIAL_CREATION" // Debt was created
  | "PAYMENT" // Money was paid
  | "NOTE_ADDED" // Comment was added
  | "PAYMENT_DECLARATION" // Async payment claim
  | "HARD_RESET"; // Special reset event
```

**Write Pattern:** Logs are **never deleted or updated**. Any correction adds a new log entry.

**Example Log Sequence:**

```
1. INITIAL_CREATION  (0 → 10,000 TRY)
2. PAYMENT           (10,000 → 8,000 TRY, installmentId: null)
3. PAYMENT           (8,000 → 6,000 TRY, installmentId: "inst-001")
4. NOTE_ADDED        ("Confirmed via phone call")
5. HARD_RESET        (6,000 → 10,000 TRY) [mistake correction]
```

---

## 4. Business Logic & Constraints

### 4.1 The "1 Hour Rule" (Temporal Immutability)

**Problem:** Allowing unlimited editing of financial records destroys trust. If Alice pays Bob, then later Bob edits the amount, Alice has no recourse.

**Solution:** A 60-minute grace period balances flexibility (fix typos) with accountability (prevent fraud).

#### Implementation

```typescript
function isTransactionEditable(createdAt: Timestamp): boolean {
  const now = Timestamp.now();
  const elapsedMinutes = (now.toMillis() - createdAt.toMillis()) / 60000;
  return elapsedMinutes < 60;
}
```

**UI Enforcement:**

```tsx
{
  isTransactionEditable(debt.createdAt) && (
    <>
      <EditButton onClick={handleEdit} />
      <DeleteButton onClick={handleDelete} />
    </>
  );
}
```

**After 60 Minutes:**

- Edit/Delete buttons disappear
- Only "Add Payment" or "Add Note" actions remain
- Original record becomes part of immutable history

**Exception:** "Hard Reset" (see 4.2) can recreate a debt, but the old one remains in logs.

---

### 4.2 Hard Reset Logic (Error Correction)

**Scenario:** User creates a 12-installment debt with wrong parameters. They realize 5 minutes later but want to fix it completely.

**Naive Approach (Rejected):**

```
1. Delete old debt
2. Create new debt
Problem: Breaks referential integrity, confuses audit trail
```

**Correct Approach (Hard Reset):**

```typescript
async function updateDebtHardReset(
  debtId: string,
  newAmount: number,
  newInstallments: Installment[],
) {
  await firestore.runTransaction(async (tx) => {
    // 1. Add a HARD_RESET log entry
    tx.set(doc(firestore, `debts/${debtId}/logs/${uuid()}`), {
      type: "HARD_RESET",
      previousRemaining: currentDebt.remainingAmount,
      newRemaining: newAmount,
      timestamp: Timestamp.now(),
      performedBy: userId,
      note: "Full reset - parameters corrected",
    });

    // 2. Update debt with new values + **reset createdAt**
    tx.update(doc(firestore, `debts/${debtId}`), {
      remainingAmount: newAmount,
      originalAmount: newAmount,
      installments: newInstallments,
      createdAt: Timestamp.now(), // *** RESTART 1-HOUR TIMER ***
    });
  });
}
```

**Key Insight:** By resetting `createdAt`, the 1-hour rule clock restarts, giving the user another grace period to fix any remaining errors.

**Audit Trail Preserved:** The HARD_RESET log shows:

- What the debt looked like before
- What changed
- Who made the change
- When it happened

---

### 4.3 Tri-State View Logic (Financial Lens)

**Problem:** Users have both "informal IOUs" and "formal contracts" with the same person. Mixing them causes confusion.

**Solution:** Three distinct views with clear separation.

#### View Modes

```typescript
type ViewMode = "FLOW" | "SPECIAL" | "TOTAL";
```

| Mode        | Shows             | Calculation                      | Use Case                        |
| ----------- | ----------------- | -------------------------------- | ------------------------------- |
| **FLOW**    | Transactions only | `Σ(INCOMING) - Σ(OUTGOING)`      | "How much cash changed hands?"  |
| **SPECIAL** | Debts only        | `Σ(remainingAmount)`             | "What formal debts exist?"      |
| **TOTAL**   | Combined          | `Flow Balance + Special Balance` | "What's the true net position?" |

#### Example

```
Relationship with "Alice":

FLOW (Cari):
  • I paid 50 TRY for dinner (OUTGOING)
  • Alice paid 30 TRY for drinks (INCOMING)
  Flow Balance: -20 TRY (I owe Alice)

SPECIAL (Borç):
  • Alice lent me 5,000 TRY for rent (ACTIVE debt)
  Special Balance: -5,000 TRY

TOTAL:
  Net Position: -5,020 TRY (I owe Alice in total)
```

#### Persistence

User's last selected mode is saved in:

```typescript
localStorage.setItem(`viewMode_${contactId}`, mode);
```

Restores on next visit for that contact.

---

### 4.4 Installment Payment Logic

#### Interim Payment (Partial Payment)

**User Action:** "I can't pay the full installment, but I have 1,500 TRY now."

**System Behavior:**

1. Deduct from `remainingAmount`
2. **Recalculate** all unpaid installments equally

**Example:**

```
Initial State:
  Debt: 6,000 TRY
  Installments: [2000, 2000, 2000] (all unpaid)

User pays 1,500 TRY:
  remainingAmount: 6,000 - 1,500 = 4,500 TRY
  Unpaid installments: 3
  New amount per installment: 4,500 / 3 = 1,500 TRY

New State:
  Installments: [1500, 1500, 1500] (all unpaid)
```

**Code:**

```typescript
async function makeInterimPayment(debtId: string, amount: number) {
  const debt = await getDebt(debtId);
  const newRemaining = debt.remainingAmount - amount;

  const unpaidInstallments = debt.installments!.filter((i) => !i.isPaid);
  const newInstallmentAmount = newRemaining / unpaidInstallments.length;

  const updatedInstallments = debt.installments!.map((inst) =>
    inst.isPaid ? inst : { ...inst, amount: newInstallmentAmount },
  );

  await updateDebt(debtId, {
    remainingAmount: newRemaining,
    installments: updatedInstallments,
    status: newRemaining < 0.1 ? "PAID" : "PARTIALLY_PAID",
  });
}
```

#### Specific Installment Payment

**User Action:** "I want to pay the 2nd installment exactly."

**System Behavior:**

1. Mark `installments[1].isPaid = true`
2. Deduct `installments[1].amount` from `remainingAmount`
3. **Do NOT** recalculate other installments

**Code:**

```typescript
async function paySpecificInstallment(debtId: string, installmentId: string) {
  const debt = await getDebt(debtId);
  const target = debt.installments!.find((i) => i.id === installmentId)!;

  await updateDebt(debtId, {
    remainingAmount: debt.remainingAmount - target.amount,
    installments: debt.installments!.map((inst) =>
      inst.id === installmentId
        ? { ...inst, isPaid: true, paidAt: Timestamp.now() }
        : inst,
    ),
  });
}
```

#### Floating Point Tolerance

**Problem:** JavaScript decimals are imprecise.  
**Example:** `0.1 + 0.2 === 0.30000000000000004`

**Solution:** Epsilon comparison for "paid" status.

```typescript
const EPSILON = 0.1; // 0.10 TRY tolerance

function isPaidOff(remainingAmount: number): boolean {
  return Math.abs(remainingAmount) < EPSILON;
}
```

---

### 4.5 Responsive Interaction Model (Strict Device Separation)

**Problem:** Hybrid UX patterns (buttons + swipe) confuse users and clutter mobile UI.

**Solution:** Platform-specific interactions enforced via breakpoints.

#### Mobile (<1024px)

**Primary:** Swipe gestures (React Swipeable)  
**Secondary:** Long-press for context menu  
**Forbidden:** Inline buttons (trash cans, pencils)

```tsx
<Swipeable
  onSwipedLeft={() => showActions("delete")}
  onSwipedRight={() => showActions("edit")}
>
  <DebtCard debt={debt} />
</Swipeable>
```

**Rationale:** Mobile screen space is precious. Buttons on every row waste space and look cluttered.

#### Desktop (≥1024px)

**Primary:** Hover reveals "Three Dot Menu"  
**Forbidden:** Swipe gestures (mouse swipe is awkward)

```tsx
<div className="debt-card" onMouseEnter={() => setShowMenu(true)}>
  {showMenu && <ThreeDotMenu />}
</div>
```

**Rationale:** Desktop has abundant space. Hover is the native interaction pattern.

#### Enforcement

```typescript
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    media.addEventListener("change", (e) => setMatches(e.matches));
  }, [query]);
  return matches;
};

const isMobile = useMediaQuery("(max-width: 1023px)");
```

---

## 5. State Machines & Transitions

### 5.1 Debt Lifecycle

```
[CREATED] → ACTIVE
    ↓
  [PAYMENT OCCURS]
    ↓
  PARTIALLY_PAID
    ↓
  [FINAL PAYMENT]
    ↓
  PAID (Terminal)

Alternative Paths:
  ACTIVE → REJECTED_BY_RECEIVER (Terminal)
  ACTIVE → AUTO_HIDDEN (Terminal)
```

**Transitions:**

```typescript
function getNextStatus(
  current: DebtStatus,
  remainingAmount: number,
): DebtStatus {
  if (remainingAmount < 0.1) return "PAID";
  if (remainingAmount < current.originalAmount) return "PARTIALLY_PAID";
  return "ACTIVE";
}
```

---

## 6. User Workflows

### 6.1 Authentication Flow

```
┌──────────────┐
│ User opens   │
│ app          │
└──────┬───────┘
       ↓
  ┌────────────────┐
  │ Logged in?     │
  └────┬─────┬─────┘
       No    Yes
       ↓     ↓
  [Login] [Dashboard]
       ↓
  ┌──────────────────────┐
  │ Enter Phone Number   │
  │ (+XX XXXXXXXXXXX)    │
  └──────┬───────────────┘
       ↓
  ┌──────────────────────┐
  │ Firebase sends OTP   │
  │ (SMS)                │
  └──────┬───────────────┘
       ↓
  ┌──────────────────────┐
  │ User enters 6-digit  │
  │ code                 │
  └──────┬───────────────┘
       ↓
  ┌──────────────────────┐
  │ Verify with Firebase │
  └──────┬───────────────┘
       ↓ (Success)
  ┌──────────────────────┐
  │ Check users/{uid}    │
  └──────┬───────┬───────┘
     Exists     New
       ↓         ↓
  [Load Data] [Create Profile]
       ↓         ↓
  ┌──────────────────────┐
  │ Redirect to          │
  │ Dashboard            │
  └──────────────────────┘
```

**Error Handling:**

- Invalid OTP: "Code incorrect. X attempts remaining. [Resend Code]"
- Network timeout: "SMS delivery delayed. [Retry] or [Use Password]"
- Banned number: "This number is restricted. Contact support@debtdert.com"

---

### 6.2 Creating a Formal Debt

**Entry Points:**

1. FAB button in Dashboard → Select person
2. "Add Debt" button in Person Detail → Person pre-selected

**Form Validation:**

| Field        | Type   | Constraints                      | Default  |
| ------------ | ------ | -------------------------------- | -------- |
| Person       | Select | Required, must exist in contacts | N/A      |
| Amount       | Number | Required, >0, ≤1,000,000         | —        |
| Currency     | Enum   | Required                         | TRY      |
| Type         | Toggle | Required                         | ONE_TIME |
| Installments | Number | If INSTALLMENT: 2-120            | —        |
| Down Payment | Number | Optional, 0-100% of Amount       | 0        |
| Due Date     | Date   | Optional, ≥ Today                | +30 days |

**Calculation Preview:**

```
Input: 10,000 TRY, 5 installments, 2,000 TRY down payment

Preview:
  Principal: 10,000 TRY
  Down Payment: -2,000 TRY
  Remaining: 8,000 TRY
  ÷ 5 installments = 1,600 TRY/month
```

**Submit Logic:**

```typescript
async function createDebt(params: CreateDebtParams) {
  // 1. Validate
  const validated = CreateDebtSchema.parse(params);

  // 2. Create debt document
  const debtId = uuid();
  await setDoc(doc(firestore, `debts/${debtId}`), {
    ...validated,
    createdAt: Timestamp.now(),
    createdBy: currentUserId,
    status: "ACTIVE",
  });

  // 3. If down payment, auto-create payment log
  if (validated.downPayment > 0) {
    await addPaymentLog(debtId, {
      type: "PAYMENT",
      amountPaid: validated.downPayment,
      previousRemaining: validated.originalAmount,
      newRemaining: validated.originalAmount - validated.downPayment,
    });
  }

  // 4. Update contact activity
  await updateContact(contactId, {
    lastActivityAt: Timestamp.now(),
    lastActivityMessage: `New debt: ${validated.amount} ${validated.currency}`,
  });
}
```

---

## 7. Screen Specifications

### 7.1 Dashboard (Home Screen)

**URL:** `/dashboard`  
**Access:** Authenticated users only

#### Layout

```
┌─────────────────────────────────────┐
│ ☰  DebtDert           🔔  👤        │ Header
├─────────────────────────────────────┤
│ Net Worth: 2,450 TRY                │ Summary
│ ↑ Owed to me: 5,000 TRY             │
│ ↓ I owe: 2,550 TRY                  │
├─────────────────────────────────────┤
│ 🔍 Search contacts...               │ Search Bar
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────┐   │
│ │ [●] Alice Johnson           │   │ Contact Card
│ │     +90 555 123 4567        │   │
│ │     Owes you: 1,200 TRY     │   │
│ │     "Paid rent deposit"     │   │
│ └─────────────────────────────┘   │
│                                     │
│ ┌─────────────────────────────┐   │
│ │     Bob Smith               │   │
│ │     +90 555 987 6543        │   │
│ │     You owe: 350 TRY        │   │
│ │     "Dinner last week"      │   │
│ └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
│ ┌─────────┐                       │ FAB
│ │    +    │                       │
│ └─────────┘                       │
└─────────────────────────────────────┘
```

#### Components

**NetWorthSummary:**

- Calculates: `Σ(I'm owed) - Σ(I owe)` across all contacts
- Color: Green if positive, Red if negative
- Click: Expands to currency breakdown

**PersonCard:**

- Shows: Avatar, Name, Phone, Net balance, Last message preview
- Unread indicator: Green dot if `hasUnreadActivity === true`
- Click: Navigate to `/person/{contactId}`
- Sort: By `lastActivityAt` (most recent first)

---

### 7.2 Person Detail (Stream View)

**URL:** `/person/{contactId}`

#### Layout

```
┌─────────────────────────────────────┐
│ ← Alice Johnson            ⋮        │ Header
│   +90 555 123 4567                  │
├─────────────────────────────────────┤
│ [FLOW] [SPECIAL] [TOTAL]            │ Tri-State Toggle
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ TRY: +1,200 → │ USD: -50 →    │ │ Balance Carousel
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ ──────── Bugün ────────             │ Date Separator
│                                     │
│   ┌───────────────────┐            │
│   │ Paid 500 TRY      │ 14:32     │ OUTGOING Bubble
│   │ "Half of rent"    │            │
│   └───────────────────┘            │
│                                     │
│            ┌───────────────────┐   │
│      13:45 │ Borrowed 1,000    │   │ INCOMING Bubble
│            │ TRY for groceries │   │
│            └───────────────────┘   │
│                                     │
│ ──────── Dün ──────                │
│   ...                               │
└─────────────────────────────────────┘
│ ┌─────────┐                       │
│ │    +    │                       │ Add Transaction FAB
│ └─────────┘                       │
└─────────────────────────────────────┘
```

#### Tri-State Toggle Implementation

```tsx
const [viewMode, setViewMode] = useState<ViewMode>("TOTAL");

const filteredData = useMemo(() => {
  switch (viewMode) {
    case "FLOW":
      return transactions; // Only cari entries
    case "SPECIAL":
      return debts; // Only formal debts
    case "TOTAL":
      return [...transactions, ...debts].sort(byTimestamp);
  }
}, [viewMode, transactions, debts]);
```

#### Date Separators (WhatsApp-style)

**Logic:**

```typescript
const today = startOfDay(new Date());
const yesterday = subDays(today, 1);
const sevenDaysAgo = subDays(today, 7);

function getDateSeparator(timestamp: Timestamp): string {
  const date = timestamp.toDate();

  if (isSameDay(date, today)) return "Bugün";
  if (isSameDay(date, yesterday)) return "Dün";
  if (date >= sevenDaysAgo) return format(date, "EEEE", { locale: tr }); // "Pazartesi"
  return format(date, "d MMMM yyyy", { locale: tr }); // "15 Ocak 2024"
}
```

---

## 8. Security & Access Control

### 8.1 Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }

    // Contacts are private to each user
    match /users/{userId}/contacts/{contactId} {
      allow read, write: if request.auth.uid == userId;
    }

    // Debts visible to both parties
    match /debts/{debtId} {
      allow read: if request.auth.uid in resource.data.participants;
      allow create: if request.auth.uid == request.resource.data.createdBy;
      allow update: if request.auth.uid in resource.data.participants
                    && isWithinGracePeriod(resource.data.createdAt);
      allow delete: if request.auth.uid == resource.data.createdBy
                    && isWithinGracePeriod(resource.data.createdAt);
    }

    // Logs are append-only
    match /debts/{debtId}/logs/{logId} {
      allow read: if request.auth.uid in get(/databases/$(database)/documents/debts/$(debtId)).data.participants;
      allow create: if request.auth.uid in get(/databases/$(database)/documents/debts/$(debtId)).data.participants;
      allow update, delete: if false; // Never allow modification
    }

    function isWithinGracePeriod(createdAt) {
      return request.time < createdAt + duration.value(1, 'h');
    }
  }
}
```

---

## 9. Performance & Scalability

### 9.1 Query Optimization

**Problem:** Loading all contacts on Dashboard is slow.

**Solution:** Firestore composite index + pagination.

```typescript
const contactsQuery = query(
  collection(firestore, `users/${uid}/contacts`),
  orderBy("lastActivityAt", "desc"),
  limit(20),
);
```

**Index Required:**

```
Collection: users/{userId}/contacts
Fields: lastActivityAt (Descending), __name__ (Descending)
```

---

## 10. Edge Cases & Error Handling

### 10.1 Phone Number Changes

**Scenario:** User's phone number changes (new SIM).

**Solution:**

1. User logs in with new number → Creates new account
2. Old account data remains at old UID
3. **Manual migration:** Customer support transfers debts to new UID

**Future:** Implement "Link Phone Number" feature with OTP verification of old number.

---

### 10.2 Concurrent Payments

**Scenario:** Both parties try to record payment simultaneously.

**Solution:** Firestore transactions + optimistic locking.

```typescript
await firestore.runTransaction(async (tx) => {
  const debtSnap = await tx.get(debtRef);
  const currentRemaining = debtSnap.data().remainingAmount;

  tx.update(debtRef, {
    remainingAmount: currentRemaining - paymentAmount,
    updatedAt: Timestamp.now(),
  });
});
```

If conflict occurs, Firestore auto-retries the transaction with fresh data.

---

### 10.3 Negative Remaining Amount

**Scenario:** Overpayment (user pays 5,100 TRY on a 5,000 TRY debt).

**Handling:**

```typescript
if (newRemaining < 0) {
  // Option A: Clamp to zero
  newRemaining = 0;

  // Option B: Create reverse debt (credit)
  await createDebt({
    lenderId: originalBorrowerId,
    borrowerId: originalLenderId,
    amount: Math.abs(newRemaining),
    currency: debt.currency,
    note: "Overpayment from previous debt",
  });
}
```

**Current Implementation:** Option A (clamp), with UI warning before submit.

---

**END OF SPECIFICATION**

---

## Appendices

### A. Glossary

- **Cari:** Turkish for "current account" - informal ledger of day-to-day money flows
- **Taksit:** Installment payment
- **Peşinat:** Down payment
- **Vade:** Due date/maturity
- **E.164:** International phone number format (+countrycode + number)

### B. References

- Firebase Firestore Security Rules: https://firebase.google.com/docs/firestore/security
- Zod Validation: https://zod.dev
- React Swipeable: https://github.com/FormidableLabs/react-swipeable

### C. Changelog

| Version | Date       | Changes                                                             |
| ------- | ---------- | ------------------------------------------------------------------- |
| 1.0     | 2026-01-15 | Initial draft                                                       |
| 2.0     | 2026-02-03 | Complete overhaul with state machines, edge cases, validation rules |
