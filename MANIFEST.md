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
- **phoneNumber:** Primary identifier for finding users (E.164 format).
- **secondaryPhoneNumbers:** (Array) Additional verified numbers for the user.
- **displayName:** User's chosen name.
- **preferences:** Settings for auto-approval, notifications, etc.

### Debt
The central entity tracking a financial obligation.
- **lenderId / borrowerId:**
    - If user is registered: Uses `UID`.
    - If user is NOT registered: Uses `PhoneNumber` (E.164).
- **amount:** Original and remaining amounts.
- **currency:** Currency of the debt (e.g., TRY, USD).
- **status:** Current state (`PENDING`, `ACTIVE`, `PAID`, `PARTIALLY_PAID`, `REJECTED`).
- **participants:** Array of IDs (UIDs or PhoneNumbers) for security rules and querying.

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
- **linkedUserId:** Link to a real system user if available. This allows the app to show "Real Name" or profile photo even if saved as "Plumber" in contacts.

## 5. Key Workflows & Rules

### Phone-Centric Architecture
- **Primary Identifier:** The phone number is the fundamental key for identity before registration.
- **Ghost Users:** Users who haven't registered yet exist in the system as "Phone Number IDs" within Debt documents.
- **Identity Resolution:** The system constantly attempts to resolve a Phone Number to a UID.

### Debt Claiming & Linking (The "Link" Protocol)
When a user registers or adds a phone number:
1.  **Debt Claiming:** The system searches for all debts where `participants` contains the user's phone number. It updates the `lenderId` or `borrowerId` from the Phone String to the new User UID. This ensures the user "inherits" their history.
2.  **Contact Linking:** The system (via client-side sync) checks the user's contacts. If a contact's phone number matches a registered System User, the contact is updated with `linkedUserId`. This connects the local address book to the global system.

### Debt Creation
- Users can create debts by entering a phone number.
- **Search Logic:**
    1. Check `contacts` for a match.
    2. Check `users` collection for a match (Primary or Secondary phone).
    3. If match found: Use `UID`.
    4. If no match: Use `PhoneNumber` string.

### Payment Flow
- **Direct Payment:** Users can record a payment immediately (updates remaining amount).
- **Payment Declaration:** Borrowers can declare they paid; Lender must confirm (updates status/amount).

### Security & Integrity
- **Multiple Numbers:** Users can have multiple numbers. The system treats all of them as aliases for the UID.
- **Number Change:** If a user changes their number, their old debts (already linked to UID) remain safe.
- **Data Safety:** `claimDebts` must be transactional to prevent data inconsistency.
