### User Existence Verification Patterns
- **Problem**: Verifying user existence by phone number from the client side is risky (privacy leak) and restricted by security rules (no listing allowed).
- **Solution**: Use a dedicated 'registry' collection where document IDs are hashes of the private data (e.g., SHA-256 of phone number).
- **Security**:
  - Allow `get` on `/registry/{hash}` for public existence checks.
  - Deny `list` to prevent enumeration.
  - Allow `create`/`update` only for authenticated users claiming their own UID.
- **Privacy**: Hashing prevents storing raw PII in a publicly accessible way, although phone number entropy is low, limiting `list` access mitigates brute-force attacks.
