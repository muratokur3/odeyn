# PamukEller Project Manifest

## 1. Project Overview
**Name:** PamukEller
**Description:** A personal debt tracking application designed to help users manage their receivables and payables with friends, family, and other contacts. It supports multi-currency tracking, payment logging, and contact management.

## 2. Technology Stack
- **Frontend Framework:** React (with TypeScript)
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State/Logic:** React Hooks (Custom hooks for modularity)
- **Routing:** React Router DOM
- **Backend/Database:** Firebase (Firestore, Auth)
- **Icons:** Lucide React

## 3. Project Structure
```
/
├── public/              # Static assets
├── src/
│   ├── assets/          # Images and other static files
│   ├── components/      # Reusable UI components
│   ├── context/         # React Context providers (Theme, etc.)
│   ├── hooks/           # Custom React hooks (Business logic)
│   ├── pages/           # Application views/routes
│   ├── services/        # External services (Firebase, Currency API)
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions (Formatting, Phone cleaning)
│   ├── App.tsx          # Main application component
│   └── main.tsx         # Entry point
├── firestore.rules      # Firestore security rules
└── vite.config.ts       # Vite configuration
```

## 4. Core Entities & Data Models

### User
Represents a registered user of the application.
- **uid:** Unique identifier (from Firebase Auth).
- **phoneNumber:** Primary identifier for finding users.
- **displayName:** User's chosen name.
- **preferences:** Settings for auto-approval, notifications, etc.

### Debt
The central entity tracking a financial obligation.
- **lenderId / borrowerId:** UIDs or Phone Numbers of participants.
- **amount:** Original and remaining amounts.
- **currency:** Currency of the debt (e.g., TRY, USD).
- **status:** Current state (`PENDING`, `ACTIVE`, `PAID`, `PARTIALLY_PAID`, `REJECTED`).
- **participants:** Array of IDs for security rules.

### PaymentLog
Tracks history of actions on a debt.
- **type:** `INITIAL_CREATION`, `PAYMENT`, `NOTE_ADDED`, etc.
- **amountPaid:** Amount involved in the transaction.
- **performedBy:** ID of the user performing the action.
- **timestamp:** Time of action.

### Contact
Local address book for a user.
- **name:** Display name set by the user.
- **phoneNumber:** Normalized phone number.
- **linkedUserId:** Link to a real system user if available.

## 5. Key Workflows & Rules

### Debt Creation
- Users can create debts by entering a phone number.
- If the number matches a registered user, they are linked.
- Status defaults to `PENDING` unless the counterparty has `autoApproveDebt` enabled.

### Payment Flow
- **Direct Payment:** Users can record a payment immediately (updates remaining amount).
- **Payment Declaration:** Borrowers can declare they paid; Lender must confirm (updates status/amount).

### Currency Handling
- Debts retain their original currency.
- Dashboard aggregates totals by converting to a base currency (TRY) using real-time rates for display, but underlying data remains in original currency.

### Security (Firestore Rules)
- Users can only read/write data they participate in (`participants` array).
- Users can only edit their own profile.
