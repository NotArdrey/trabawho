# TrabaWho — UI/UX Plan & Checklist

A page-by-page audit of UI/UX state. Focus: visual design, interaction patterns, responsiveness, accessibility, and polish.

Legend:
- [x] Done / shipped
- [ ] Missing (necessary)
- [~] Partial — exists but incomplete
- 💡 Suggested (polish / delight)

---

## 0. Global Design System

### ✅ Done
- [x] Light / dark theme tokens ([src/shared/styles/themeTokens.js](src/shared/styles/themeTokens.js))
- [x] Centralized color palette (accent, surface, text, border, success, danger)
- [x] Shared shadows (`shadow`, `shadowSoft`)
- [x] Modern global stylesheet ([src/shared/styles/modern.css](src/shared/styles/modern.css))
- [x] Success / Error notification components
- [x] Loading screen component
- [x] Shared modal-style overlays

### ❗ Missing (necessary)
- [ ] **Typography scale tokens** (no `fontSize`, `lineHeight`, `fontWeight` in tokens)
- [ ] **Spacing scale tokens** (4/8/12/16/24/32) — inline values everywhere
- [ ] **Radius tokens** (sm / md / lg / pill)
- [ ] **Z-index scale** (modal, overlay, toast, dropdown)
- [ ] **Breakpoint constants** (mobile / tablet / desktop)
- [ ] **Reusable Button component** with variants (primary / secondary / ghost / destructive)
- [ ] **Reusable Input / Select / Textarea** with consistent error states
- [ ] **Reusable Card / Modal / Drawer** wrappers
- [ ] **Skeleton loader** component (replace blank spinners)
- [ ] **Empty state** component (illustration + message + CTA)
- [ ] **Focus-visible outline styles** for keyboard users
- [ ] **Reduced-motion** media query honored on animations

### 💡 Suggested
- 💡 Storybook to document the design system
- 💡 Design tokens exported as CSS variables (consumable in CSS too)
- 💡 Icon system: standardize on `lucide-react` everywhere (already installed)
- 💡 Component playground page for QA

---

## 1. Landing Page
File: [src/features/landing/pages/LandingPage.jsx](src/features/landing/pages/LandingPage.jsx)

### ✅ Done
- [x] Hero slider with rotating content
- [x] Login modal entry point
- [x] Branded logo + name

### ❗ Missing (necessary)
- [ ] **Mobile hero responsiveness** — slider on <480px
- [ ] **Visible Sign-up CTA** distinct from Login
- [ ] **Footer** with legal / about / contact
- [ ] **Trust signals** (verified workers count, ratings)
- [ ] **Above-the-fold value prop** — one clear sentence
- [ ] **Loading state for slider images**

### 💡 Suggested
- 💡 Parallax / subtle motion on hero
- 💡 Featured workers carousel
- 💡 Animated counter (gigs completed, workers, cities)
- 💡 Dark mode toggle visible from landing
- 💡 Language switcher (Tagalog/English) in header

---

## 2. Auth Modals
Files: [src/features/auth/components/](src/features/auth/components/)

### ✅ Done
- [x] Login modal
- [x] Forgot password modal
- [x] Reset password modal
- [x] Logout confirm modal

### ❗ Missing (necessary)
- [ ] **Sign-up / Register modal UI** (modal missing)
- [ ] **Show/hide password toggle** (eye icon)
- [ ] **Inline field validation** (not just on submit)
- [ ] **Loading state on submit button** (spinner inside button)
- [ ] **Auto-focus first input** on modal open
- [ ] **Close on ESC key**
- [ ] **Focus trap inside modal**
- [ ] **Backdrop click to close** (configurable)
- [ ] **Error banner styling** consistent across all auth modals
- [ ] **Mobile-friendly modal sizing** (full-screen on small)

### 💡 Suggested
- 💡 Password strength meter visual
- 💡 Social login buttons (Google, FB) with branded styles
- 💡 "Welcome back" personalized message after first login
- 💡 Subtle entry/exit animation

---

## 3. Seller Onboarding
File: [src/features/onboarding/pages/SellerOnboarding.jsx](src/features/onboarding/pages/SellerOnboarding.jsx)

### ✅ Done
- [x] 3-step form layout
- [x] Step-based conditional rendering
- [x] Error messages per step
- [x] Floating overlay variant

### ❗ Missing (necessary)
- [ ] **Visual stepper / progress indicator** (1—2—3)
- [ ] **Back button enabled on all steps except first**
- [ ] **Field-level inline validation** (red border + helper text)
- [ ] **Smooth step transitions** (slide / fade)
- [ ] **Sticky footer** with Next/Back on mobile
- [ ] **Image preview** for any uploads
- [ ] **Confirmation screen** at end summarizing entries

### 💡 Suggested
- 💡 Auto-save draft toast
- 💡 Animated success checkmark on complete
- 💡 Estimated time remaining ("Step 2 of 3 · ~1 min left")
- 💡 Help / tooltip icons on complex fields

---

## 4. Client Dashboard
File: [src/features/dashboard/pages/Dashboard.jsx](src/features/dashboard/pages/Dashboard.jsx)

### ✅ Done
- [x] Search bar
- [x] Quick action links

### ❗ Missing (necessary)
- [ ] **Greeting / personalization** ("Good morning, {name}")
- [ ] **Hero card / featured callout**
- [ ] **Empty state** when user has no bookings yet
- [ ] **Card hover / active states**
- [ ] **Mobile grid → stack** breakpoint
- [ ] **Notification bell** placement

### 💡 Suggested
- 💡 Quick-stats tiles (active bookings, saved workers)
- 💡 "Continue where you left off" rail
- 💡 Time-of-day theming
- 💡 Subtle illustrations per section

---

## 5. Browse Services
File: [src/features/marketplace/pages/BrowseServicesPage.jsx](src/features/marketplace/pages/BrowseServicesPage.jsx)

### ✅ Done
- [x] Service card grid
- [x] Worker detail modal
- [x] Reviews modal
- [x] Search query support

### ❗ Missing (necessary)
- [ ] **Filter sidebar / drawer** UI
- [ ] **Sort dropdown**
- [ ] **Active-filter chips** (removable)
- [ ] **Loading skeleton cards** while fetching
- [ ] **Empty / no-results state** with reset
- [ ] **Card image lazy-loading**
- [ ] **Consistent card heights** (avoid jagged grid)
- [ ] **Mobile card layout** (1-col, larger image)
- [ ] **Sticky search bar** on scroll
- [ ] **Pagination or infinite scroll UI**

### 💡 Suggested
- 💡 Heart / save-to-wishlist icon on card
- 💡 Verified badge on cards
- 💡 Map / list view toggle
- 💡 Quick-view modal (without leaving grid)
- 💡 Recently viewed strip at top

---

## 6. My Bookings
File: [src/features/bookings/pages/MyBookings.jsx](src/features/bookings/pages/MyBookings.jsx)

### ✅ Done
- [x] Booking list rendering
- [x] Payment modal
- [x] Chat window
- [x] Slot selection modal
- [x] Calendar modal
- [x] Status badges (visible in UI)

### ❗ Missing (necessary)
- [ ] **Status filter tabs** (All / Active / Completed / Cancelled)
- [ ] **Sortable columns or sort dropdown**
- [ ] **Expandable booking detail row** or full detail page
- [ ] **Empty state** when no bookings
- [ ] **Mobile list layout** — cards not table
- [ ] **Color-coded status badges** with legend
- [ ] **Action button consistency** (primary action emphasized)
- [ ] **Confirmation dialogs** before destructive actions (cancel, refund)
- [ ] **Loading state per row** during action
- [ ] **Receipt download** UI button

### 💡 Suggested
- 💡 Timeline view of booking lifecycle (booked → paid → in-progress → done)
- 💡 Calendar view toggle
- 💡 Quick-rebook button on completed
- 💡 Animated state changes
- 💡 Receipt preview before download

---

## 7. My Work (Seller)
File: [src/features/work/pages/MyWork.jsx](src/features/work/pages/MyWork.jsx)

### ✅ Done
- [x] Service create modal
- [x] Calendar availability modal
- [x] Schedule modal
- [x] Slot edit modal
- [x] Profile edit modal
- [x] Inquiry chat modal
- [x] QR preview modal

### ❗ Missing (necessary)
- [ ] **Earnings summary card** (visible up top)
- [ ] **Tabs: Services / Schedule / Inquiries / Earnings**
- [ ] **Service card actions** (Edit / Pause / Delete) clearly grouped
- [ ] **Drag-to-reorder services**
- [ ] **Image gallery** on service edit
- [ ] **Pause / Active toggle visual** (switch component)
- [ ] **Confirmation before delete service**
- [ ] **Mobile-friendly modal sizing**
- [ ] **Empty state when no services**

### 💡 Suggested
- 💡 Service preview as customer sees it
- 💡 Performance sparkline per service (views/week)
- 💡 Smart suggestions ("Add more photos to rank higher")
- 💡 Bulk-pause during vacation

---

## 8. Worker Dashboard
File: [src/features/work/pages/WorkerDashboard.jsx](src/features/work/pages/WorkerDashboard.jsx)

### ❗ Missing (necessary)
- [ ] **KPI cards** (today's jobs, week earnings, rating)
- [ ] **Today's schedule list** with time slots
- [ ] **Online / Offline availability toggle** prominent
- [ ] **Inquiry inbox preview**
- [ ] **Empty / first-time state**
- [ ] **Mobile-first layout**

### 💡 Suggested
- 💡 Earnings chart (week / month)
- 💡 Streak / consistency tracker
- 💡 Leaderboard or percentile ranking
- 💡 Push reminder for next job

---

## 9. Profile
File: [src/features/profile/pages/Profile.jsx](src/features/profile/pages/Profile.jsx)

### ✅ Done
- [x] Digital portfolio modal
- [x] Profile renders with theme

### ❗ Missing (necessary)
- [ ] **Profile header** with avatar, name, role, verified badge
- [ ] **Profile photo upload UI** with crop
- [ ] **Edit-in-place** for bio / contact
- [ ] **Tabs**: About / Portfolio / Reviews / Services
- [ ] **Mobile-friendly portfolio gallery**
- [ ] **Loading skeleton** while profile fetches

### 💡 Suggested
- 💡 Cover photo / banner
- 💡 Profile completion progress bar
- 💡 Animated badge unlock
- 💡 Share profile button → QR + link

---

## 10. Account Settings
File: [src/features/profile/pages/AccountSettings.jsx](src/features/profile/pages/AccountSettings.jsx)

### ✅ Done
- [x] Profile + password update sections

### ❗ Missing (necessary)
- [ ] **Sectioned layout** with cards (Personal / Security / Privacy / Danger Zone)
- [ ] **Inline edit + Save/Cancel** pattern per field
- [ ] **Show/hide password** toggle
- [ ] **Password strength meter**
- [ ] **Confirm-current-password** before change
- [ ] **Danger Zone** styling (red border for delete account)
- [ ] **Disabled-state styling** when nothing changed
- [ ] **Success toast after save**

### 💡 Suggested
- 💡 Avatar editor inline
- 💡 Smooth section anchors (sticky side-nav)
- 💡 Activity log preview

---

## 11. Settings (App Preferences)
File: [src/features/profile/pages/Settings.jsx](src/features/profile/pages/Settings.jsx)

### ✅ Done
- [x] Theme selector (light/dark)
- [x] Language selector UI

### ❗ Missing (necessary)
- [ ] **Toggle switches** (not checkboxes) for binary settings
- [ ] **Theme preview swatches** (visual sample of light/dark)
- [ ] **System theme option** ("Follow system")
- [ ] **Grouped sections** (Appearance / Language / Notifications / Accessibility)
- [ ] **Save automatically** (no submit needed) with confirmation toast

### 💡 Suggested
- 💡 Live theme preview as you toggle
- 💡 Font size slider
- 💡 High contrast mode
- 💡 Reduce motion toggle

---

## 12. Admin Dashboard
File: [src/features/admin/pages/AdminDashboard.jsx](src/features/admin/pages/AdminDashboard.jsx)

### ✅ Done
- [x] Admin navigation
- [x] Overview section
- [x] Accounts table
- [x] Comments section
- [x] Logs section
- [x] Access action modal

### ❗ Missing (necessary)
- [ ] **Dense table styling** suitable for admin (sticky header, zebra rows)
- [ ] **Table pagination + search**
- [ ] **Column sort affordance** (caret icons)
- [ ] **Row actions menu** (kebab) consistent across tables
- [ ] **Status pills** color-coded (active/suspended/pending)
- [ ] **Bulk select + bulk action bar**
- [ ] **Filter chips above tables**
- [ ] **Empty state per section**
- [ ] **Confirmation modal** for destructive admin actions
- [ ] **Mobile responsiveness** (admin often desktop-only — at least graceful)

### 💡 Suggested
- 💡 Dashboard charts (signups over time, revenue)
- 💡 Quick-action command palette (Cmd+K)
- 💡 Saved filter views
- 💡 Inline edit on cells

---

## 13. Chat / Messaging
Files: [src/features/bookings/components/ChatWindow.jsx](src/features/bookings/components/ChatWindow.jsx), [src/features/work/components/InquiryChatModal.jsx](src/features/work/components/InquiryChatModal.jsx)

### ✅ Done
- [x] Chat window in bookings
- [x] Inquiry chat modal in work

### ❗ Missing (necessary)
- [ ] **Message bubbles** (sender vs receiver styling)
- [ ] **Timestamps** (relative — "2m ago")
- [ ] **Auto-scroll to latest message**
- [ ] **Input grows with content** (textarea, max-height)
- [ ] **Send button states** (disabled when empty, loading on send)
- [ ] **Enter to send / Shift+Enter newline**
- [ ] **Typing indicator UI**
- [ ] **Unread divider** ("New messages below")
- [ ] **Empty chat state** ("Say hi 👋")
- [ ] **Mobile keyboard handling** (input above keyboard)

### 💡 Suggested
- 💡 Emoji picker
- 💡 Attachment button with preview
- 💡 Quick replies / canned responses for sellers
- 💡 Message reactions
- 💡 Voice notes

---

## 14. Payment & Booking Modals
Files: [src/features/bookings/components/PaymentModal.jsx](src/features/bookings/components/PaymentModal.jsx), [src/features/bookings/components/SlotSelectionModal.jsx](src/features/bookings/components/SlotSelectionModal.jsx), [src/features/bookings/components/BookingCalendarModal.jsx](src/features/bookings/components/BookingCalendarModal.jsx)

### ✅ Done
- [x] Payment method choice (GCash advance, cash, GCash after)
- [x] QR code preview
- [x] Calendar slot picker

### ❗ Missing (necessary)
- [ ] **Stepper inside payment modal** (Choose method → Pay → Proof → Done)
- [ ] **Receipt-style summary** before confirm
- [ ] **Image-upload drag-and-drop** for proof
- [ ] **Upload preview thumbnail** with remove button
- [ ] **Mobile full-screen modal** variant
- [ ] **Sticky footer** with primary action
- [ ] **Selected-slot visual feedback** in calendar
- [ ] **Disabled past dates** styling
- [ ] **Calendar legend** (available / booked / blocked)

### 💡 Suggested
- 💡 Confetti animation on successful payment
- 💡 Copy GCash number with one click
- 💡 QR enlarge on tap
- 💡 Booking summary as shareable image

---

## 15. Navigation & Layout
Files: [src/shared/components/Header.js](src/shared/components/Header.js), [src/shared/components/Navigation.js](src/shared/components/Navigation.js), [src/shared/components/DashboardNavigation.jsx](src/shared/components/DashboardNavigation.jsx)

### ✅ Done
- [x] Header
- [x] Top navigation
- [x] Dashboard sub-navigation

### ❗ Missing (necessary)
- [ ] **Mobile hamburger / drawer menu**
- [ ] **Active link visual state** (underline, bold, accent)
- [ ] **Breadcrumbs** on deep pages
- [ ] **User avatar + dropdown** with quick links
- [ ] **Notification bell** with badge
- [ ] **Sticky header** on scroll
- [ ] **Hide-on-scroll-down, show-on-scroll-up** for mobile

### 💡 Suggested
- 💡 Bottom tab bar on mobile (native app feel)
- 💡 Command palette (Cmd+K) — power users / admins
- 💡 Search-everywhere global bar

---

## 16. Notifications (Toast System)
Files: [src/shared/components/SuccessNotification.js](src/shared/components/SuccessNotification.js), [src/shared/components/ErrorNotification.js](src/shared/components/ErrorNotification.js)

### ✅ Done
- [x] Success toast
- [x] Error toast
- [x] Auto-hide (presumed)

### ❗ Missing (necessary)
- [ ] **Stackable toasts** (multiple at once)
- [ ] **Info / Warning** variants
- [ ] **Action button** in toast ("Undo")
- [ ] **Position consistency** (top-right vs bottom-center)
- [ ] **Persist on hover** (pause auto-dismiss)
- [ ] **Slide-in / fade-out animation**

### 💡 Suggested
- 💡 In-app notification center (history of toasts)
- 💡 Sound option for important alerts

---

## 17. Accessibility (WCAG)

### ❗ Missing (necessary)
- [ ] **Color contrast audit** — verify accent on white meets AA
- [ ] **Alt text** on all images / avatars
- [ ] **aria-label** on icon-only buttons
- [ ] **role="dialog" + aria-modal** on all modals (some have it)
- [ ] **Focus trap** in modals
- [ ] **Skip-to-content** link
- [ ] **Keyboard navigation** for cards, tables, dropdowns
- [ ] **Reduced motion** support
- [ ] **Screen reader** test pass

### 💡 Suggested
- 💡 Axe / Lighthouse CI in pipeline
- 💡 High-contrast theme variant

---

## 18. Responsiveness

### ❗ Missing (necessary)
- [ ] **Breakpoint strategy documented** (mobile-first?)
- [ ] **Mobile testing on real devices** (iPhone SE, Android mid-tier)
- [ ] **Table → card** transformation on small screens
- [ ] **Modal → full-screen** on mobile
- [ ] **Touch targets** ≥ 44×44 px
- [ ] **No horizontal scroll** on any page
- [ ] **Image responsive sizing**

### 💡 Suggested
- 💡 Tablet-specific layouts (landscape)
- 💡 Foldable / dual-screen consideration

---

## 19. Motion & Micro-interactions

### ❗ Missing (necessary)
- [ ] **Hover transitions** on all interactive elements (150ms ease)
- [ ] **Active / pressed state** on buttons
- [ ] **Modal enter/exit animation**
- [ ] **Page-change subtle fade**
- [ ] **Loading skeleton shimmer**

### 💡 Suggested
- 💡 Lottie animations for empty / success states
- 💡 Spring-physics for drag interactions
- 💡 Page-transition library (framer-motion)

---

## Priority Top 10 UI/UX Next Steps

1. [ ] Extract a reusable **Button / Input / Modal** component set with variants
2. [ ] Add **typography + spacing + radius tokens** to `themeTokens.js`
3. [ ] Build a **Skeleton + Empty-State** component library
4. [ ] Implement **mobile drawer nav** + bottom tab bar
5. [ ] Add **status filter tabs + skeleton cards** to My Bookings & Browse Services
6. [ ] Polish **chat UI** (bubbles, timestamps, auto-scroll, typing)
7. [ ] Add **focus trap + ESC close + a11y labels** to every modal
8. [ ] Add **toast stacking + variants** (info/warning) + undo action
9. [ ] Add a **visual stepper** to Seller Onboarding & Payment flow
10. [ ] Run a full **mobile-responsive sweep** (375px and 414px viewports)
