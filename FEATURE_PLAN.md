# TrabaWho — Feature Plan & Checklist

A page-by-page audit of what's **done**, what's **missing (necessary)**, and **suggested** enhancements.

Legend:
- [x] Done / shipped
- [ ] Missing (necessary)
- [~] Partial — exists but incomplete
- 💡 Suggested (nice-to-have)

---

## 0. Global / Cross-Cutting

### ✅ Done
- [x] State-driven navigation via `useAppNavigation` ([src/features/navigation/useAppNavigation.js](src/features/navigation/useAppNavigation.js))
- [x] View map routing ([src/features/navigation/viewMap.jsx](src/features/navigation/viewMap.jsx))
- [x] Supabase client + auth service ([src/shared/services/supabaseClient.js](src/shared/services/supabaseClient.js), [src/shared/services/authService.js](src/shared/services/authService.js))
- [x] Theme tokens (light/dark) ([src/shared/styles/themeTokens.js](src/shared/styles/themeTokens.js))
- [x] Success / Error notifications
- [x] Loading screen transitions
- [x] Shared Header / Navigation / DashboardNavigation
- [x] Seller onboarding floating overlay

### ❗ Missing (necessary)
- [ ] **URL-based routing** (React Router) — currently `currentView` is in-memory, so refresh loses page
- [ ] **Protected route guards** (admin / seller-only views)
- [ ] **Session persistence verification** on cold reload
- [ ] **Global error boundary** to catch render crashes
- [ ] **Offline / network-down banner**
- [ ] **Centralized API error → user-facing message** mapper (PGRST204, RLS denials, etc.)
- [ ] **TypeScript or PropTypes** for prop contracts (many `propsBuilder` props are silently optional)
- [ ] **Realtime subscriptions** for bookings/chat (Supabase channels)
- [ ] **i18n implementation** — `appLanguage` exists but no string catalog
- [ ] **Accessibility audit** (aria labels, focus traps in modals, keyboard nav)

### 💡 Suggested
- 💡 PWA / installable app (manifest already present)
- 💡 Sentry / error telemetry
- 💡 Feature flags table in Supabase
- 💡 Analytics events (booking created, payment, signup)
- 💡 Skeleton loaders instead of spinners

---

## 1. Landing Page — `LandingPage`
File: [src/features/landing/pages/LandingPage.jsx](src/features/landing/pages/LandingPage.jsx)

### ✅ Done
- [x] Hero slider
- [x] Login modal trigger
- [x] Forgot password flow
- [x] Resend verification

### ❗ Missing (necessary)
- [ ] **Public service preview** (browse without login)
- [ ] **Sign-up CTA** clearly separated from login
- [ ] **Terms / Privacy / About** footer links
- [ ] **SEO meta tags** (title, description, OG image)
- [ ] **Mobile hero responsiveness check**

### 💡 Suggested
- 💡 Testimonials / featured workers section
- 💡 Categories preview grid
- 💡 "How it works" 3-step explainer

---

## 2. Authentication — `AuthPage` & Modals
Files: [src/features/auth/](src/features/auth/)

### ✅ Done
- [x] Login modal
- [x] Forgot password modal
- [x] Reset password modal
- [x] Logout confirmation modal
- [x] Auth modal controller hook

### ❗ Missing (necessary)
- [ ] **Sign-up / Registration page or modal** (no `RegisterModal.jsx` found)
- [ ] **Email verification gate** UX (resend exists, but blocking state unclear)
- [ ] **Password strength meter**
- [ ] **Rate-limit feedback** (too many attempts)
- [ ] **Remember-me / persistent session toggle**

### 💡 Suggested
- 💡 OAuth (Google, Facebook) login
- 💡 Magic-link login option
- 💡 Phone / SMS OTP for PH market
- 💡 Two-factor auth for admins

---

## 3. Seller Onboarding — `SellerOnboarding`
File: [src/features/onboarding/pages/SellerOnboarding.jsx](src/features/onboarding/pages/SellerOnboarding.jsx)

### ✅ Done
- [x] 3-step multi-form
- [x] Field validation per step
- [x] Floating overlay mode

### ❗ Missing (necessary)
- [ ] **ID / KYC document upload** (Supabase storage)
- [ ] **Profile photo upload**
- [ ] **Save draft / resume later**
- [ ] **Service category selector** backed by DB enum
- [ ] **Location picker with map** (not just text)
- [ ] **Submit → admin review status** (pending/approved/rejected)

### 💡 Suggested
- 💡 Progress saved per step to backend
- 💡 Skill tags autocomplete
- 💡 Sample portfolio upload during onboarding

---

## 4. Client Dashboard — `Dashboard`
File: [src/features/dashboard/pages/Dashboard.jsx](src/features/dashboard/pages/Dashboard.jsx)

### ✅ Done
- [x] Search bar
- [x] Become-seller entry
- [x] Quick links to bookings / work / profile

### ❗ Missing (necessary)
- [ ] **Recent / recommended services section**
- [ ] **Active bookings widget** (next upcoming)
- [ ] **Notifications bell** with unread count
- [ ] **Empty states** when no data
- [ ] **Refresh / pull-to-refresh** on mobile

### 💡 Suggested
- 💡 Personalized recommendations (saved categories)
- 💡 Recently viewed services
- 💡 Promo / announcement banner slot

---

## 5. Browse Services — `BrowseServicesPage`
File: [src/features/marketplace/pages/BrowseServicesPage.jsx](src/features/marketplace/pages/BrowseServicesPage.jsx)

### ✅ Done
- [x] Service cards
- [x] Worker detail modal
- [x] Reviews modal
- [x] Authenticated + guest modes

### ❗ Missing (necessary)
- [ ] **Category filter UI**
- [ ] **Price range filter**
- [ ] **Location / distance filter**
- [ ] **Sort options** (rating / price / newest)
- [ ] **Pagination or infinite scroll**
- [ ] **Favorite / save to wishlist**
- [ ] **"No results" empty state**

### 💡 Suggested
- 💡 Map view of nearby workers
- 💡 Verified-worker badge
- 💡 Quick-book from card
- 💡 Share service link

---

## 6. My Bookings — `MyBookings`
File: [src/features/bookings/pages/MyBookings.jsx](src/features/bookings/pages/MyBookings.jsx)

### ✅ Done
- [x] Booking list controller
- [x] Payment modal (GCash advance / cash after / GCash after)
- [x] Chat window with worker
- [x] Slot selection modal
- [x] Booking calendar modal
- [x] Cash confirmation flow
- [x] Refund controller
- [x] Rating controller
- [x] Recurring billing logic (weekly/monthly)

### ❗ Missing (necessary)
- [ ] **Filter by status** (pending / active / completed / cancelled)
- [ ] **Booking detail page or expand row**
- [ ] **Cancel booking confirmation + reason**
- [ ] **Receipt / invoice PDF** (jspdf is installed but verify wired)
- [ ] **Realtime status updates** from worker actions
- [ ] **Dispute / report issue** button

### 💡 Suggested
- 💡 Calendar view of all bookings
- 💡 Rebook same worker shortcut
- 💡 Export bookings as CSV
- 💡 Reminder notifications before service date

---

## 7. My Work (Seller) — `MyWork`
File: [src/features/work/pages/MyWork.jsx](src/features/work/pages/MyWork.jsx)

### ✅ Done
- [x] Create service modal
- [x] Calendar availability modal
- [x] Seller schedule modal
- [x] Slot edit modal
- [x] Profile edit modal
- [x] Inquiry chat modal
- [x] QR preview modal (for GCash payment)
- [x] Work payments hook
- [x] Schedule hook
- [x] Profile + services hook

### ❗ Missing (necessary)
- [ ] **Service edit / delete** confirmation flows verified
- [ ] **Booking accept / reject** queue
- [ ] **Earnings summary** (week/month/total)
- [ ] **Payout request** button
- [ ] **Service status toggle** (active/paused)
- [ ] **Image upload for services**

### 💡 Suggested
- 💡 Service performance analytics (views, conversion)
- 💡 Duplicate service action
- 💡 Promotional pricing / discount codes
- 💡 Auto-reply to inquiries

---

## 8. Worker Dashboard — `WorkerDashboard`
File: [src/features/work/pages/WorkerDashboard.jsx](src/features/work/pages/WorkerDashboard.jsx)

### ✅ Done
- [x] Page exists with theme + nav

### ❗ Missing (necessary)
- [ ] **Today's jobs widget**
- [ ] **Upcoming jobs list**
- [ ] **Pending payments summary**
- [ ] **Inquiries unread count**
- [ ] **Rating / review snapshot**
- [ ] **Toggle availability online/offline**

### 💡 Suggested
- 💡 Heatmap of busiest days
- 💡 Goals tracker (monthly earnings target)
- 💡 Tips & training resources card

---

## 9. Profile — `Profile`
File: [src/features/profile/pages/Profile.jsx](src/features/profile/pages/Profile.jsx)

### ✅ Done
- [x] Profile page renders
- [x] Update profile handler
- [x] Digital portfolio modal

### ❗ Missing (necessary)
- [ ] **Profile photo upload + crop**
- [ ] **Public vs private profile preview**
- [ ] **Editable bio / skills**
- [ ] **Verified badge display**
- [ ] **Contact info privacy controls**

### 💡 Suggested
- 💡 Share profile link / QR
- 💡 Profile completion % indicator
- 💡 Linked social accounts

---

## 10. Account Settings — `AccountSettings`
File: [src/features/profile/pages/AccountSettings.jsx](src/features/profile/pages/AccountSettings.jsx)

### ✅ Done
- [x] Update profile
- [x] Update password

### ❗ Missing (necessary)
- [ ] **Change email flow** (with verification)
- [ ] **Delete account** (with confirmation + grace period)
- [ ] **Download my data** (GDPR / Data Privacy Act PH)
- [ ] **Active sessions / device list**
- [ ] **Linked payment methods** management

### 💡 Suggested
- 💡 2FA setup
- 💡 Login history log
- 💡 Notification preferences (email / SMS / push)

---

## 11. Settings — `Settings`
File: [src/features/profile/pages/Settings.jsx](src/features/profile/pages/Settings.jsx)

### ✅ Done
- [x] Theme switcher (light/dark)
- [x] Language selector (UI)

### ❗ Missing (necessary)
- [ ] **Language strings actually applied** (i18n catalog)
- [ ] **Notification toggles** (per channel)
- [ ] **Currency display** preference
- [ ] **Time zone** preference

### 💡 Suggested
- 💡 Accessibility: font size / high contrast
- 💡 Data saver mode
- 💡 Beta features toggle

---

## 12. Admin Dashboard — `AdminDashboard`
File: [src/features/admin/pages/AdminDashboard.jsx](src/features/admin/pages/AdminDashboard.jsx)

### ✅ Done
- [x] Admin navigation
- [x] Admin overview
- [x] Accounts table + service
- [x] Comments section
- [x] Logs section
- [x] Access action modal

### ❗ Missing (necessary)
- [ ] **Role guard** — verify only admins reach this view (RLS + UI)
- [ ] **Seller approval queue** (KYC review)
- [ ] **Booking moderation / refund override**
- [ ] **Dispute resolution panel**
- [ ] **Reports / analytics** (revenue, signups, churn)
- [ ] **Bulk actions** (suspend, verify)

### 💡 Suggested
- 💡 Export reports to CSV / PDF
- 💡 Admin activity audit trail
- 💡 Broadcast announcement to all users
- 💡 Feature-flag toggles UI

---

## 13. Chat / Messaging
Files: [src/features/bookings/components/ChatWindow.jsx](src/features/bookings/components/ChatWindow.jsx), [src/features/work/components/InquiryChatModal.jsx](src/features/work/components/InquiryChatModal.jsx)

### ✅ Done
- [x] Booking chat window
- [x] Inquiry chat modal

### ❗ Missing (necessary)
- [ ] **Realtime message delivery** (Supabase Realtime channel)
- [ ] **Unread count + indicators**
- [ ] **Typing indicator**
- [ ] **Image / file attachments**
- [ ] **Message persistence verification**
- [ ] **Block / report user**

### 💡 Suggested
- 💡 Voice notes
- 💡 Read receipts
- 💡 Saved replies for sellers
- 💡 Auto-translation (PH multilingual market)

---

## 14. Payments
Files: [src/features/bookings/components/PaymentModal.jsx](src/features/bookings/components/PaymentModal.jsx), [src/features/work/services/paymentService.js](src/features/work/services/paymentService.js)

### ✅ Done
- [x] GCash advance flow
- [x] Cash after-service flow
- [x] GCash after-service flow
- [x] Proof of payment upload
- [x] QR code preview
- [x] Recurring billing engine

### ❗ Missing (necessary)
- [ ] **Automated GCash verification** (currently proof-based?)
- [ ] **Refund execution** (controller exists; backend flow?)
- [ ] **Payout to worker** (cash-out)
- [ ] **Payment history page**
- [ ] **Failed payment retry**

### 💡 Suggested
- 💡 PayMaya / Maya integration
- 💡 Card payments (Stripe/PayMongo)
- 💡 Escrow hold for advance payments
- 💡 Split payments / partial deposits

---

## Priority Suggestions (Top 10 Next Steps)

1. [ ] Add **React Router** for real URLs / refresh-safe navigation
2. [ ] Build **Registration / Sign-up modal** (currently login-only)
3. [ ] Implement **realtime** for chat + bookings via Supabase channels
4. [ ] Add **filters + pagination** on Browse Services
5. [ ] Wire **image / file uploads** (profile photo, service photos, KYC)
6. [ ] Build **earnings + payout** flow for workers
7. [ ] Add **notifications system** (in-app bell + email)
8. [ ] Add **booking cancel + dispute** flows
9. [ ] Implement **role-based access guard** for admin views
10. [ ] Add **error boundary + Sentry** for production resilience
