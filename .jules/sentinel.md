## 2024-05-22 - Firestore Insecure User Creation
**Vulnerability:** The \`users\` collection allowed \`create\` operation for any authenticated user without checking if the document ID matched the user's UID. Similarly, the \`debts\` collection allowed creation without verifying the creator was a participant.
**Learning:** In Firestore, \`create\` permissions must explicitly check \`request.auth.uid\` against the document ID or body, as authentication alone does not imply ownership of the target resource.
**Prevention:** Always use \`request.auth.uid == userId\` (or similar) in \`create\` and \`update\` rules for user-centric collections, and validate participation for shared resources.
