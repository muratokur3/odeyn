## 2024-05-23 - Custom Toggles Accessibility
**Learning:** Custom toggle components implemented as `div`s with `onClick` are a common pattern here but completely inaccessible. They lack `role="switch"`, `aria-checked`, and keyboard support.
**Action:** Always replace ad-hoc `div` toggles with a standardized, accessible `<Toggle />` component that uses `<button type="button">` or proper ARIA attributes.
