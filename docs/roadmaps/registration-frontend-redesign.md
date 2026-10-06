# Registration frontend redesign handoff

## Preserved reference

The older registration frontend and its navigation wiring are preserved in the local Git branch `snapshot/registration-ui-warranty-20261005` at commit `d379da3` (copied from `feature/warranty`). This is a complete source snapshot, not a Markdown mockup. `main` remains the working branch.

Reference files in the snapshot:

- `src/features/auth/pages/AuthPage.jsx` — older registration, sign-in, and recovery presentation; its top-bar logo and Back button both call `onBack`.
- `src/features/auth/pages/IdentityRegistrationPage.jsx` — older dedicated identity-registration screen and its home/logo navigation.
- `src/features/landing/pages/LandingPage.tsx` — connects auth-page mode and `onBack` to the public route.
- `src/features/navigation/useAppNavigation.js`, `src/features/navigation/viewMap.jsx`, and `src/App.tsx` — navigation handlers, view wiring, and route guards.
- `src/shared/components/Navigation.tsx` and `src/shared/components/Header.jsx` — public and signed-in logo/navigation behavior.

To inspect one source file without switching branches:

```sh
git show snapshot/registration-ui-warranty-20261005:src/features/auth/pages/AuthPage.jsx
```

## How to rebuild on `main`

Use the snapshot as a visual and interaction reference, not as a wholesale replacement. The typed registration journey follows **Account Details → Email Verification → Identity Verification → Identity Review**. Email confirmation must finish before Didit or manual submission; administrator approval opens marketplace access. Start a dedicated redesign branch from current `main`, then work in the existing `src/features/auth` components and hooks. Keep registration presentation, navigation state, and backend calls separate; do not copy the old oversized JSX pages or revert the current registration service.

Navigation behavior to preserve and test: the logo and Back-to-home action return to `/`; leaving with an unsaved registration draft opens the existing confirmation dialog; cancelling that dialog retains the draft and focus; sign-in/create-account changes use the expected route; browser Back/Forward and a refreshed registration URL remain usable. Check client/worker identity paths, Didit/manual review outcomes, and the documented mobile and desktop widths.

Before merging a redesign, run `npm run check` and the registration Playwright journeys, especially `tests/e2e/registration-design.e2e.spec.ts`, `tests/e2e/registration-navigation.e2e.spec.ts`, `tests/e2e/registration-draft-flow.e2e.spec.ts`, and `tests/e2e/identity-registration.e2e.spec.ts`.
