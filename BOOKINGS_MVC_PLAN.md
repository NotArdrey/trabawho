# Bookings Module MVC Refactoring Plan

## Overview
Refactor `MyBookings.jsx` (2000+ lines, 40+ useState calls) from monolithic component to clean MVC architecture following the React-adapted MVC pattern proven in auth and admin modules.

---

## 1. Integration Analysis

### 1.1 Parent-Child Flow
```
App.js
  → useAppNavigation.js
      → handleOpenMyBookings = () => setCurrentView('my-bookings')
      → viewMap.jsx (my-bookings route)
          → MyBookings component
              → DashboardNavigation (sibling)
              → ChatWindow
              → SlotSelectionModal
              → PaymentModal
              → Confirmation overlay
```

### 1.2 Props Received by MyBookings
```javascript
{
  appTheme,                    // 'light' or 'dark'
  currentView,                 // 'my-bookings'
  searchQuery,                 // Search input state
  onSearchChange,              // Function
  onGoHome,                    // handleBackToClientDashboard
  onLogout,                    // handleLogout
  onOpenSellerSetup,           // handleOpenSellerOnboarding
  onOpenMyWork,                // handleOpenMyWork
  sellerProfile,               // Current user profile
  onOpenProfile,               // handleOpenProfile
  onOpenAccountSettings,       // handleOpenAccountSettings
  onOpenSettings,              // handleOpenSettings
  onOpenMyBookings,            // handleOpenMyBookings (cycle)
  onOpenDashboard,             // handleBackToClientDashboard
  onOpenAdminDashboard,        // handleOpenAdminDashboard
}
```

### 1.3 Callbacks to Parent (via DashboardNavigation)
- onGoHome → setCurrentView('client-dashboard')
- onLogout → sign out
- onOpenMyWork → setCurrentView('my-work')
- onOpenProfile → setCurrentView('profile')
- etc.

**CRITICAL:** All these callbacks must continue working after refactoring - they're passed through DashboardNavigation component

---

## 2. Current State Analysis

### 2.1 State Categories in MyBookings

**UI State (stays in component)** - 18 useState calls:
```javascript
// View/Modal UI State
selectedBookingId, uiState, hoveredCardId, hoveredOpenChatId, 
hoveredRateId, hoveredPayId, hoveredBackToBookings, isMobile,
isLoadingBookings

// Modal-specific UI State
ratingTargetId, ratingHover, isCashAmountFocused, isReferenceFocused
```

**Business Logic State (moves to controller)** - 22 useState calls:
```javascript
// Filter/Display State
activeFilter, displayFilter

// Modal Data State
ratingValue, ratingComment, paymentProofBookingId, proofFileName,
referenceNo, cashConfirmBookingId, cashEnteredAmount, transactionProofBookingId,
showPaymentStatusNotice, paymentStatusMessage, paymentProofError,
cashReviewState, cashReviewMessage, headerNotifications
```

**Data State (moves to service layer)** - 1 useState call:
```javascript
bookings  // Mock data array
```

### 2.2 Handler Functions (23 total - move to controller)
```javascript
// Booking actions
handleOpenChat, handleApproveQuote, handleRejectQuote, handleStopServiceAccepted

// Rating workflow
handleOpenRating, handleSubmitRating, handleLeaveRating

// Payment workflow
handleOpenPaymentProofModal, handleProofFileChange, handleSubmitPaymentProof,
handleSelectPaymentMethod

// Cash workflow
handleOpenCashConfirmModal, handleSubmitCashConfirmation, handleOpenTransactionProof

// Refund workflow
handleRequestRefund, handleConfirmRefundReceived

// Slot workflow
handleConfirmSlot, handleOpenSlotSelection

// Navigation
handleBackToList, handleNewInquiry

// Modal
handleApproveQuote, handleRejectQuote
```

### 2.3 Side Effects (localStorage sync) - Move to controller with custom hook
```javascript
// useEffect #1: Cash confirmation requests sync (2.5s polling + storage listener)
// useEffect #2: Refund requests sync (2.5s polling + storage listener)
// useEffect #3: Mobile responsive (window resize)
// useEffect #4: Initial loading skeleton (1s timeout)
```

### 2.4 Computed Values (keep in component, maybe useMemo if expensive)
```javascript
isGcashFlow(paymentMethod)
isRefundBooking(booking)
isCancelledCashBooking(booking)
parseDateOnly(dateString)
isRecurringBilling(booking)
isBookingStopped(booking)
isRecurringChargeDue(booking)
getNextChargeDate(booking, fromDate)
getBillingLabel(booking)
buildMockTransactionId(bookingId, channel)
// Filtering
filteredBookings
statusFilteredBookings
currentBooking
```

---

## 3. MVC Architecture Design

### 3.1 Model Layer (Services)

**File:** `src/features/bookings/services/bookingService.js`

Responsibilities:
- Mock/API data management
- Booking CRUD operations
- Payment operations
- Refund operations
- Rating submission

```javascript
// Simulated API service (later connect to Supabase)
export const bookingService = {
  // Data getters
  getBookings: () => { /* return mock bookings */ },
  getBookingById: (id) => { /* return single booking */ },
  
  // Booking status operations
  approveQuote: (bookingId) => { /* update status */ },
  rejectQuote: (bookingId, reason) => { /* update + notify */ },
  stopService: (bookingId) => { /* mark service stopped */ },
  
  // Payment operations
  submitPaymentProof: (bookingId, proofData) => { /* submit proof */ },
  submitCashConfirmation: (bookingId, amount) => { /* submit cash */ },
  
  // Refund operations
  requestRefund: (bookingId, reason) => { /* create refund request */ },
  confirmRefundReceived: (bookingId) => { /* mark refund complete */ },
  
  // Rating operations
  submitRating: (bookingId, rating, review) => { /* submit rating */ },
  
  // Slot operations
  confirmSlot: (bookingId, slotInfo) => { /* confirm and update */ },
  
  // Recurring billing
  chargeRecurringBilling: (bookingId) => { /* process charge */ },
};
```

### 3.2 Controller Layer (Custom Hooks)

**Files to Create:**

#### A. `src/features/bookings/hooks/useBookingListController.js`
Manages the main booking list view state and filtering

```javascript
export function useBookingListController(initialBookings) {
  const [bookings, setBookings] = useState(initialBookings);
  const [activeFilter, setActiveFilter] = useState('all');
  const [displayFilter, setDisplayFilter] = useState('all');
  
  // Filtering logic
  const filteredBookings = useMemo(() => {
    // Apply filters
  }, [bookings, activeFilter, displayFilter]);
  
  // Handlers
  const handleApproveQuote = useCallback(async (bookingId) => {
    const updated = await bookingService.approveQuote(bookingId);
    setBookings(prev => prev.map(b => b.id === bookingId ? updated : b));
  }, []);
  
  const handleRejectQuote = useCallback(async (bookingId, reason) => {
    const updated = await bookingService.rejectQuote(bookingId, reason);
    setBookings(prev => prev.map(b => b.id === bookingId ? updated : b));
  }, []);
  
  // ... other handlers
  
  return {
    bookings,
    filteredBookings,
    activeFilter, setActiveFilter,
    displayFilter, setDisplayFilter,
    handleApproveQuote,
    handleRejectQuote,
    // ... handlers
  };
}
```

#### B. `src/features/bookings/hooks/usePaymentController.js`
Manages payment proof submission and payment method selection

```javascript
export function usePaymentController(onPaymentSuccess) {
  const [paymentProofBookingId, setPaymentProofBookingId] = useState(null);
  const [proofFileName, setProofFileName] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [paymentProofError, setPaymentProofError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmitPaymentProof = useCallback(async () => {
    // Validate
    // Call service
    // Update parent
    onPaymentSuccess?.(bookingId, referenceNo);
  }, [paymentProofBookingId, referenceNo, onPaymentSuccess]);
  
  const handleSelectPaymentMethod = useCallback(async (bookingId, method) => {
    // Call service
    onPaymentSuccess?.(bookingId, method);
  }, [onPaymentSuccess]);
  
  return {
    paymentProofBookingId, setPaymentProofBookingId,
    proofFileName, setProofFileName,
    referenceNo, setReferenceNo,
    paymentProofError, setPaymentProofError,
    isSubmitting,
    handleSubmitPaymentProof,
    handleSelectPaymentMethod,
  };
}
```

#### C. `src/features/bookings/hooks/useCashConfirmationController.js`
Manages cash verification workflow with localStorage sync

```javascript
export function useCashConfirmationController(bookings, setBookings) {
  const [cashConfirmBookingId, setCashConfirmBookingId] = useState(null);
  const [cashEnteredAmount, setCashEnteredAmount] = useState('');
  const [cashReviewState, setCashReviewState] = useState('idle');
  const [cashReviewMessage, setCashReviewMessage] = useState('');
  
  // Effect: Sync cash requests from localStorage
  useEffect(() => {
    const syncCashRequests = () => {
      const requests = readCashRequests();
      setBookings(prev => {
        // Update bookings based on cash confirmation status
      });
    };
    
    syncCashRequests();
    const interval = setInterval(syncCashRequests, 2500);
    window.addEventListener('storage', () => syncCashRequests());
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', syncCashRequests);
    };
  }, []);
  
  const handleSubmitCashConfirmation = useCallback(async () => {
    // Validate amount
    // Write to localStorage
    // Update bookings state
    // Notify parent
  }, []);
  
  return {
    cashConfirmBookingId, setCashConfirmBookingId,
    cashEnteredAmount, setCashEnteredAmount,
    cashReviewState, setCashReviewState,
    cashReviewMessage, setCashReviewMessage,
    handleSubmitCashConfirmation,
  };
}
```

#### D. `src/features/bookings/hooks/useRefundController.js`
Manages refund request workflow with localStorage sync

```javascript
export function useRefundController(bookings, setBookings) {
  // Effect: Sync refund requests from localStorage (similar to cash)
  useEffect(() => {
    const syncRefundRequests = () => {
      const requests = readRefundRequests();
      setBookings(prev => {
        // Update bookings based on refund status
      });
    };
    
    syncRefundRequests();
    const interval = setInterval(syncRefundRequests, 2500);
    
    return () => clearInterval(interval);
  }, []);
  
  const handleRequestRefund = useCallback(async (bookingId, reason) => {
    // Call service
    // Write to localStorage
    // Update bookings
  }, []);
  
  const handleConfirmRefundReceived = useCallback(async (bookingId) => {
    // Update localStorage
    // Update bookings
  }, []);
  
  return {
    handleRequestRefund,
    handleConfirmRefundReceived,
  };
}
```

#### E. `src/features/bookings/hooks/useRatingController.js`
Manages rating submission workflow

```javascript
export function useRatingController(onRatingSubmitted) {
  const [ratingTargetId, setRatingTargetId] = useState(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  
  const handleSubmitRating = useCallback(async (bookingId) => {
    // Call service
    // Update parent
    onRatingSubmitted?.(bookingId, ratingValue, ratingComment);
  }, [ratingValue, ratingComment, onRatingSubmitted]);
  
  return {
    ratingTargetId, setRatingTargetId,
    ratingValue, setRatingValue,
    ratingHover, setRatingHover,
    ratingComment, setRatingComment,
    handleSubmitRating,
  };
}
```

#### F. `src/features/bookings/hooks/index.js`
Central export for all controller hooks

```javascript
export { useBookingListController } from './useBookingListController';
export { usePaymentController } from './usePaymentController';
export { useCashConfirmationController } from './useCashConfirmationController';
export { useRefundController } from './useRefundController';
export { useRatingController } from './useRatingController';
```

### 3.3 View Layer (Components)

**NO CHANGES** to these files - they already receive data and callbacks properly:
- `ChatWindow.jsx` - receives booking data + callbacks, renders UI only
- `SlotSelectionModal.jsx` - receives booking data + onConfirmSlot callback
- `PaymentModal.jsx` - receives booking data + onSelectPayment callback
- `BookingCalendarModal.jsx` - receives booking data + callbacks
- `BookingNotification.jsx` - receives notification data, renders UI only

**REFACTORED:** `MyBookings.jsx`
Becomes an orchestrator component (~200 lines):
```javascript
export function MyBookings(props) {
  // Initialize controllers
  const bookingListCtrl = useBookingListController(...);
  const paymentCtrl = usePaymentController(...);
  const cashCtrl = useCashConfirmationController(...);
  const refundCtrl = useRefundController(...);
  const ratingCtrl = useRatingController(...);
  
  // Local UI state only
  const [selectedBookingId, setSelectedBookingId] = useState(1);
  const [uiState, setUiState] = useState('chat');
  const [isMobile, setIsMobile] = useState(...);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  
  // Sync all child states with parent callbacks
  // Render components using controller state
  // Wire up callbacks between components
  
  return (
    <div>
      <DashboardNavigation {...props} />
      {uiState === 'chat' && (
        <ChatWindow
          booking={currentBooking}
          bookings={bookingListCtrl.filteredBookings}
          onApproveQuote={() => bookingListCtrl.handleApproveQuote(selectedBookingId)}
          // ... other callbacks
        />
      )}
      {/* Other modals */}
    </div>
  );
}
```

---

## 4. State Distribution Strategy

### 4.1 Service (bookingService)
- Mock bookings array
- API call definitions (currently mock, later Supabase)

### 4.2 Controllers (hooks)
- **useBookingListController:** bookings, filters, approval/rejection handlers
- **usePaymentController:** payment proof UI + submission
- **useCashConfirmationController:** cash amount UI + localStorage sync + submission
- **useRefundController:** localStorage sync + refund handlers
- **useRatingController:** rating UI + submission

### 4.3 MyBookings Component (Orchestrator)
- Coordinates all controllers
- Manages view state (selectedBookingId, uiState)
- Manages UI state (isMobile, hover states, focus states)
- Passes data down and callbacks up
- Routes between modals
- Renders DashboardNavigation + child components

### 4.4 Child Components (View Only)
- ChatWindow: receives booking + callbacks, no state
- SlotSelectionModal: receives booking + callbacks, no state
- PaymentModal: receives booking + callbacks, no state
- BookingCalendarModal: receives booking + callbacks, no state
- BookingNotification: receives data, no state

---

## 5. localStorage Integration

### Current localStorage Keys
- `trabawho_cash_confirmation_requests` - Array of cash confirmation requests
- `trabawho_refund_requests` - Array of refund requests

### New Pattern
Move localStorage logic into controller hooks:
- `useCashConfirmationController` handles all cash localStorage operations
- `useRefundController` handles all refund localStorage operations
- Both hooks manage 2.5s polling and storage event listeners
- Both hooks update bookings state based on localStorage changes

---

## 6. Callback Chain Preservation

### Critical:** All parent callbacks must continue working

```javascript
// These callbacks must be passed through MyBookings unchanged
props.onGoHome → DashboardNavigation
props.onLogout → DashboardNavigation
props.onOpenMyWork → DashboardNavigation
props.onOpenProfile → DashboardNavigation
props.onOpenAccountSettings → DashboardNavigation
props.onOpenSettings → DashboardNavigation
props.onOpenDashboard → DashboardNavigation
props.onOpenAdminDashboard → DashboardNavigation
```

**Implementation:** MyBookings passes these directly to DashboardNavigation - no changes needed

---

## 7. Implementation Sequence

### Phase 1: Create Service Layer
1. Create `bookingService.js` with mock data export + operation definitions
2. Export bookings array to use as initial state in controller

### Phase 2: Create Controller Hooks (in order of dependency)
1. `useBookingListController` - depends only on bookingService
2. `usePaymentController` - independent
3. `useRatingController` - independent
4. `useCashConfirmationController` - needs bookings state from list controller
5. `useRefundController` - needs bookings state from list controller
6. Export all from `index.js`

### Phase 3: Refactor MyBookings Component
1. Import and initialize all controllers
2. Move UI state to component local state
3. Wire up callbacks between controllers and child components
4. Test all workflows: quote → slot → payment → completion/refund/rating
5. Verify parent callbacks still work (via DashboardNavigation)

### Phase 4: Verify Child Components
1. Ensure ChatWindow still receives correct data + callbacks
2. Ensure SlotSelectionModal still works
3. Ensure PaymentModal still works
4. Ensure modals open/close properly

### Phase 5: Integration Testing
1. Test booking list display + filtering
2. Test quote approval/rejection
3. Test payment workflows (GCash + Cash)
4. Test refund workflows
5. Test rating workflows
6. Test localStorage sync (cash + refund)
7. Test parent navigation callbacks

---

## 8. Risk Mitigation

### Risks
1. **localStorage sync breaks** → Keep exact same polling interval (2.5s) and event listeners
2. **Parent callbacks broken** → Pass directly to DashboardNavigation unchanged
3. **Modal transitions fail** → Wire up uiState changes in orchestrator component
4. **Data loss** → Initialize bookings from service, sync localStorage exactly as before
5. **Styling breaks** → No style changes, move inline styles as-is to component

### Testing Strategy
1. Unit test each controller hook independently
2. Integration test controllers with MyBookings
3. E2E test full workflows from Dashboard → MyBookings → actions → results
4. Regression test all parent callbacks
5. localStorage test with browser DevTools

---

## 9. Success Criteria

- ✅ MyBookings reduced from 2000+ lines to ~200-300 lines
- ✅ All business logic moved to controller hooks
- ✅ All data management moved to bookingService
- ✅ Component only handles UI rendering and state coordination
- ✅ All parent callbacks continue working
- ✅ localStorage sync works exactly as before
- ✅ All modals function properly
- ✅ All workflows complete without errors
- ✅ Zero ESLint errors/warnings
- ✅ Code follows React best practices (exhaustive-deps, useCallback, useMemo where needed)

---

## Files to Create/Modify

### New Files
```
src/features/bookings/
├── services/
│   └── bookingService.js (NEW - API operations + mock data)
└── hooks/
    ├── useBookingListController.js (NEW)
    ├── usePaymentController.js (NEW)
    ├── useCashConfirmationController.js (NEW)
    ├── useRefundController.js (NEW)
    ├── useRatingController.js (NEW)
    └── index.js (NEW - export all hooks)
```

### Modified Files
```
src/features/bookings/
└── pages/
    └── MyBookings.jsx (REFACTORED - move state to hooks, keep orchestration)
```

### Unchanged Files
```
src/features/bookings/
├── components/
│   ├── ChatWindow.jsx (no changes)
│   ├── SlotSelectionModal.jsx (no changes)
│   ├── PaymentModal.jsx (no changes)
│   ├── BookingCalendarModal.jsx (no changes)
│   └── BookingNotification.jsx (no changes)
└── pages/
    └── MyBookings.jsx (refactored, not rewritten)
```

---

## Approval Checklist

Before implementation:
- [ ] User reviews integration points and confirms understanding
- [ ] User confirms localStorage operations stay the same
- [ ] User confirms all parent callbacks preserved
- [ ] User confirms MVC separation strategy acceptable
- [ ] User confirms implementation sequence works with existing codebase

Ready to proceed to Phase 1?
