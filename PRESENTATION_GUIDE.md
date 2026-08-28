# TrabaWho - Complete Presentation & Defense Guide
**A Comprehensive Breakdown of React Principles & Code Implementations**

---

## TABLE OF CONTENTS
1. [Component Architecture](#1-component-architecture)
2. [State Management & React Hooks](#2-state-management--react-hooks)
3. [Skeleton Loading Pattern](#3-skeleton-loading-pattern)
4. [Parent-Child Communication](#4-parent-child-communication)
5. [Naming Conventions (camelCase)](#5-naming-conventions-camelcase)
6. [Dynamic Rendering](#6-dynamic-rendering)
7. [Props Flow](#7-props-flow)
8. [Conditional Rendering](#8-conditional-rendering)
9. [Data Flow & State Updates](#9-data-flow--state-updates)
10. [Reusable Components](#10-reusable-components)

---

## 1. COMPONENT ARCHITECTURE

### 1.1 Parent-Child Component Structure

**Definition:** Parent components manage business logic and state. Child components receive data via props and communicate back through callback functions.

#### **Hierarchy in TrabaWho:**

```
App.js (Root Parent)
├── Header.js (Navigation Parent)
├── Dashboard.js (Page Parent)
│   ├── ServiceCard.js (Child)
│   └── SkeletonServiceCard.js (Child)
├── MyBookings.js (Page Parent)
│   ├── BookingCalendarModal.js (Child)
│   ├── PaymentModal.js (Child)
│   ├── ChatWindow.js (Child)
│   └── SkeletonCard.js (Child)
├── MyWork.js (Page Parent)
│   ├── SimulatedChat.js (Child)
│   ├── SlotEditModal.js (Child)
│   └── ProfileEditModal.js (Child)
└── WorkerDashboard.js (Page Parent)
    ├── CalendarAvailabilityModal.js (Child)
    └── SellerScheduleModal.js (Child)
```

### 1.2 Parent Component Example: MyBookings.js

**Location:** `src/pages/MyBookings.js`

**Responsibilities:**
- State management (bookings, selected booking, payment status)
- Business logic (filtering, validations)
- Handler functions (callbacks passed to children)
- Layout & conditional rendering

```javascript
// Line 33-35: Main state declarations
const [bookings, setBookings] = useState([...]);
const [selectedBookingId, setSelectedBookingId] = useState(null);
const [paymentProofBookingId, setPaymentProofBookingId] = useState(null);
```

**Key Handler Functions:**
- `handlePaymentProofSubmit()` - Line 276: Updates booking status after payment
- `handleScheduleNewSession()` - Line 307: Handles recurring billing
- `handleBookingAction()` - Line 436: Processes booking actions

### 1.3 Child Component Example: PaymentModal.js

**Location:** `src/components/PaymentModal.js`

**Responsibilities:**
- Display only (UI rendering)
- User interaction handling
- Call parent callbacks on events

```javascript
// Line 20: Receives props from parent
const PaymentModal = ({ booking, onSelectPayment, onCancel }) => {
  const [selectedMethod, setSelectedMethod] = useState(null);
  
  // Line 88: Calls parent callback with payment method
  const handleConfirm = () => {
    onSelectPayment({
      paymentMethod: selectedMethod,
      ...
    });
  };
};
```

---

## 2. STATE MANAGEMENT & REACT HOOKS

### 2.1 useState Hook

**Definition:** React hook to manage component state. Syntax: `const [state, setState] = useState(initialValue)`

**Examples in App.js:**

```javascript
// Line 40: Authentication state
const [isLoggedIn, setIsLoggedIn] = useState(false);

// Line 41: Page navigation state
const [currentView, setCurrentView] = useState('client-dashboard');

// Line 43: Seller profile state
const [sellerProfile, setSellerProfile] = useState(null);

// Line 44: User location state
const [userLocation, setUserLocation] = useState(null);

// Line 45-48: Theme state
const [themeMode, setThemeMode] = useState(() => getStoredThemeMode());
const [appTheme, setAppTheme] = useState(() => {
  const initialMode = getStoredThemeMode();
  return initialMode === 'system' ? getSystemTheme() : initialMode;
});
```

**Examples in MyWork.js:**

```javascript
// Line 337: Current profile state
const [currentProfile, setCurrentProfile] = useState(sellerProfile || defaultSellerProfile);

// Line 338: Chat selection state
const [selectedChatId, setSelectedChatId] = useState(null);

// Line 354: Cash confirmation decision state
const [cashDecisionTarget, setCashDecisionTarget] = useState(null);

// Line 357: View toggle state (NEW - Cash Payment Feature)
const [cashPaymentView, setCashPaymentView] = useState('pending');
```

### 2.2 useEffect Hook

**Definition:** React hook to run side effects (API calls, timers, subscriptions)

**Examples:**

**In App.js - Theme Management (Lines 53-75):**
```javascript
useEffect(() => {
  const nextTheme = themeMode === 'system' ? getSystemTheme() : themeMode;
  setAppTheme(nextTheme);
  localStorage.setItem('trabawho-theme-mode', themeMode);
  // Updates DOM and listens to system theme changes
}, [themeMode]);
```

**In SkeletonCard.js - Shimmer Effect (Lines 10-16):**
```javascript
useEffect(() => {
  const interval = setInterval(() => {
    setShimmer((prev) => (prev + 1) % 2);
  }, 800);  // Toggles shimmer every 800ms
  return () => clearInterval(interval);  // Cleanup
}, []);
```

**In Dashboard.js - Simulate Loading (Lines 177-185):**
```javascript
// Simulates data loading with skeleton screens
setTimeout(() => {
  setIsSkeletonLoading(false);
}, 2000);
```

### 2.3 useMemo Hook

**Definition:** Memoizes computed values to avoid recalculation on every render

**Example in WorkerDashboard.js:**
```javascript
// Line 37-43: Memoized worker provider data
const workerProvider = useMemo(
  () => [
    {
      id: 999,
      name: workerName,
      serviceType,
    },
  ],
  [workerName, serviceType]  // Only recalculates when these change
);
```

---

## 3. SKELETON LOADING PATTERN

### 3.1 What is Skeleton Loading?

**Definition:** Visual placeholder that mimics the shape of actual content, showing a loading state with animated shimmer effect.

**Why Use It:**
- Better UX than spinner
- Shows content structure during load
- Perceived faster loading
- Professional appearance

### 3.2 Skeleton Component Implementation

**Location:** `src/components/SkeletonCard.js`

**Complete Implementation:**

```javascript
// Lines 1-7: Imports and component definition
import { useEffect, useState } from 'react';

function SkeletonCard() {
  const [shimmer, setShimmer] = useState(0);

  // Lines 10-16: Shimmer animation logic
  useEffect(() => {
    const interval = setInterval(() => {
      setShimmer((prev) => (prev + 1) % 2);  // Toggles 0 -> 1 -> 0
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // Lines 18-60: Inline styles with shimmer effect
  const styles = {
    card: {
      background: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      borderLeft: '4px solid #27ae60',
    },
    skeletonLine: {
      // Gradient animates position based on shimmer state
      background: `linear-gradient(90deg, #f0f0f0 ${shimmer ? '50%' : '25%'}, #e0e0e0 ${shimmer ? '51%' : '26%'}, #f0f0f0 100%)`,
      height: '16px',
      borderRadius: '6px',
    },
    skeletonTitle: {
      background: `linear-gradient(90deg, #f0f0f0 ${shimmer ? '50%' : '25%'}, #e0e0e0 ${shimmer ? '51%' : '26%'}, #f0f0f0 100%)`,
      height: '20px',
      borderRadius: '6px',
      width: '70%',
    },
    skeletonAmount: {
      background: `linear-gradient(90deg, #f0f0f0 ${shimmer ? '50%' : '25%'}, #e0e0e0 ${shimmer ? '51%' : '26%'}, #f0f0f0 100%)`,
      height: '24px',
      borderRadius: '6px',
      width: '40%',
    },
    skeletonButton: {
      background: `linear-gradient(90deg, #f0f0f0 ${shimmer ? '50%' : '25%'}, #e0e0e0 ${shimmer ? '51%' : '26%'}, #f0f0f0 100%)`,
      height: '40px',
      borderRadius: '8px',
      width: '100%',
    },
  };
```

### 3.3 How Skeleton Loading Works

**Step-by-Step Process:**

1. **Initial Load:** Show skeleton (placeholder)
2. **Data Fetching:** Skeleton animates with shimmer effect
3. **Data Ready:** Replace skeleton with actual content

**Usage in Dashboard.js:**

```javascript
// Line 177-178: Skeleton loading state
const [isSkeletonLoading, setIsSkeletonLoading] = useState(true);

// Line 179-181: Simulate data loading
const serviceToDisplay = isSkeletonLoading
  ? Array(6).fill(null)  // Show 6 skeleton cards
  : bestWorkers;

// Lines 444-445: Conditional rendering
{serviceToDisplay.map((service, index) =>
  isSkeletonLoading ? (
    <SkeletonServiceCard key={`skeleton-${index}`} />  // Show skeleton
  ) : (
    <ServiceCard key={service.id} {...service} />  // Show actual card
  )
)}
```

### 3.4 Multiple Skeleton Types

**SkeletonCard.js** - Booking cards with shimmer
**SkeletonServiceCard.js** - Service provider cards
**SkeletonChatMessage.js** - Chat messages during load
**SkeletonText.js** - Generic text placeholder
**SkeletonAvatar.js** - User profile pictures

Each follows the same pattern:
- State for shimmer toggle
- useEffect for animation interval
- Inline styles with gradient animation
- Conditional opacity/visibility

---

## 4. PARENT-CHILD COMMUNICATION

### 4.1 One-Way Data Flow (Props Down)

**Pattern:** Parent passes data to child via props

**Example: Dashboard → ServiceCard**

```javascript
// Dashboard.js Line 444-448: Parent passes data
<ServiceCard 
  key={service.id}
  id={service.id}
  name={service.name}
  rating={service.rating}
  location={service.location}
/>

// ServiceCard.js Line 5: Child receives props
function ServiceCard({ id, name, rating, location }) {
  // Uses props to render UI
  return (
    <div>
      <h3>{name}</h3>
      <p>{rating} ⭐ • {location}</p>
    </div>
  );
}
```

### 4.2 Two-Way Communication (Props Down, Callbacks Up)

**Pattern:** Child calls parent callback function to communicate changes

**Example: MyBookings → PaymentModal**

```javascript
// MyBookings.js Lines 762-764: Parent defines handler
const handlePaymentProofSubmit = (bookingData) => {
  setBookings(prev => prev.map(b => 
    b.id === bookingData.id ? { ...b, ...bookingData } : b
  ));
};

// MyBookings.js Lines 780: Parent passes callback to child
<PaymentModal
  booking={selectedBooking}
  onSelectPayment={handlePaymentProofSubmit}
  onCancel={() => setIsPaymentModalOpen(false)}
/>

// PaymentModal.js Line 20: Child receives callback
const PaymentModal = ({ booking, onSelectPayment, onCancel }) => {
  // Line 88: Child calls parent callback
  const handleConfirm = () => {
    onSelectPayment({
      paymentMethod: selectedMethod,
      ...
    });
  };
};
```

### 4.3 State Lifting

**Concept:** When multiple components need shared state, move state to their common parent

**Example in MyWork.js:**

```javascript
// Line 341: Parent holds all transactions
const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);

// Line 843: Handler to update transactions
const handleReviewCashConfirmation = (transactionId, decision) => {
  setTransactions((prev) =>
    prev.map((txn) => {
      if (txn.id !== transactionId) return txn;
      
      if (decision === 'approve') {
        return {
          ...txn,
          cashConfirmationStatus: 'approved',
          isPaid: true,
          transactionId: txn.transactionId || buildCashTransactionId(transactionId),
        };
      }
      return {
        ...txn,
        cashConfirmationStatus: 'denied',
        isPaid: false,
      };
    })
  );
};
```

---

## 5. NAMING CONVENTIONS (camelCase)

### 5.1 camelCase Definition

**Rule:** First word lowercase, subsequent words capitalized, NO spaces or underscores

**Correct:** `isLoggedIn`, `currentView`, `handlePaymentClick`
**Incorrect:** `is_logged_in`, `IsLoggedIn`, `currentview`

### 5.2 camelCase Usage in TrabaWho

#### **State Variables (Line 40-50 in App.js):**
```javascript
const [isLoggedIn, setIsLoggedIn] = useState(false);           // bool: is + Noun
const [isLoadingTransition, setIsLoadingTransition] = useState(false);  // Descriptive
const [currentView, setCurrentView] = useState('client-dashboard');    // current + Noun
const [previousView, setPreviousView] = useState('client-dashboard');  // previous + Noun
const [sellerProfile, setSellerProfile] = useState(null);     // Noun (data object)
const [userLocation, setUserLocation] = useState(null);       // Noun + Noun
const [themeMode, setThemeMode] = useState(() => ...);        // Mode/setting
const [appTheme, setAppTheme] = useState(() => ...);          // App-level theme
const [appLanguage, setAppLanguage] = useState(() => ...);    // App-level language
const [isSellerOnboardingOpen, setIsSellerOnboardingOpen] = useState(false);  // bool state
```

#### **Event Handler Functions (Line 1144 in MyBookings.js):**
```javascript
handlePaymentProofSubmit()      // handle + Verb + Noun
handleScheduleNewSession()      // handle + Verb + Adjective + Noun
handleBookingAction()           // handle + Verb + Noun
handleSelectSlot()              // handle + Verb + Noun
handleConfirmPayment()          // handle + Verb + Noun (common pattern)
onSelectPayment()               // on + Verb + Noun (callback pattern)
onCancel()                      // on + Verb (callback)
onClose()                       // on + Verb (callback)
```

#### **Computed Variables/Functions (Line 903-905 in MyWork.js):**
```javascript
const allCashTransactions = weekTransactions.filter(...);  // all + Noun
const cashConfirmationNotifications = 
  cashPaymentView === 'pending'
    ? allCashTransactions.filter(...)  // Explicit name showing what's included
    : allCashTransactions.filter(...);

const getCurrentPaymentStatus = () => { ... };  // get + Noun (getter pattern)
const isMonthlyRecurringTxn = (txn) => { ... }; // is + Adjective describing check
const isLastCycleEntry = (txn) => { ... };     // is + Adjective describing check
```

#### **Boolean Flags (Naming Pattern: `is` + Adjective):**
```javascript
isLoggedIn       // User authentication state
isLoading        // Data loading state
isOpen           // Modal/drawer visibility
isProcessing     // Long operation state
isValid          // Form validation
isSelected       // Selection state
isHovered        // Hover state
isDisabled       // Disabled state
isVisible        // Visibility
```

#### **Component Props (Line 30-50 in PaymentModal.js):**
```javascript
allowsAdvanceGcash          // allows + Noun (boolean)
allowsAfterServiceCash      // describes what's allowed
allowsAfterServiceGcash     // clear permission naming
afterServicePaymentType     // compound noun describing mode
selectedMethod              // selected + Noun
afterServiceChannel         // after + Verb + Noun (channel type)
isProcessing                // is + Adjective (state)
showProcessing              // show + Noun (visibility)
hoveredKey                  // hovered + Noun (which element hovered)
```

#### **Array/Map Variable Names:**
```javascript
bookings[]                  // Plural form (collection of items)
transactions[]              // Plural form
services[]                  // Plural form
skeletonCards[]             // Plural + descriptor

bookingToDelete             // Specific singular item being operated on
selectedBooking             // Specific selected item
currentProfile              // Current/active singular item
targetTransaction           // Target for operation
```

#### **Object Property Names (Line 307 in MyBookings.js):**
```javascript
const bookingObject = {
  id: '123',
  clientName: 'Alice',              // descriptive compound noun
  createdAt: '2026-03-28',          // timestamp property
  isPaid: true,                     // is + adjective
  isDone: false,                    // is + adjective
  paymentMethod: 'gcash-advance',   // payment + adjective/noun
  transactionId: 'TXN-001',         // transaction + ID suffix
  cashConfirmationStatus: 'approved', // what + status
  submittedCashAmount: 950,         // submitted + what + scale
  expectedCashAmount: 1000,         // expected + what + scale
  nextChargeDate: '2026-04-28',     // next + what + scale
);
```

### 5.3 Naming Patterns Summary

| Pattern | Purpose | Example |
|---------|---------|---------|
| `is` + Adj | Boolean flags | `isLoggedIn`, `isLoading` |
| `has` + Noun | Possession check | `hasPaymentMethod` |
| `can` + Verb | Capability check | `canSubmitPayment` |
| `should` + Verb | Condition check | `shouldShowSkeleton` |
| `get` + Noun | Computed getter | `getCurrentPaymentStatus` |
| `handle` + Verb + Noun | Event handler | `handlePaymentSubmit` |
| `on` + Verb + Noun | Callback from child | `onSelectPayment` |
| Plural | Collections | `bookings`, `transactions` |
| Noun chain | Specific items | `selectedBooking`, `targetTransaction` |

---

## 6. DYNAMIC RENDERING

### 6.1 What is Dynamic Rendering?

**Definition:** Content that changes based on state/props without page reload

### 6.2 View Switching (State-Driven Navigation)

**Location:** App.js Lines 115-230

**Process:**
1. State stores current view: `currentView` (Line 42)
2. Button clicks update view: `setCurrentView('my-bookings')`
3. Conditional JSX renders correct page based on state

```javascript
// Line 115-230: Dynamic page rendering based on currentView state
{isLoggedIn ? (
  <>
    <Header currentView={currentView} onViewChange={setCurrentView} />
    {currentView === 'client-dashboard' && (
      <Dashboard onViewChange={setCurrentView} />
    )}
    {currentView === 'my-bookings' && (
      <MyBookings onViewChange={setCurrentView} />
    )}
    {currentView === 'my-work' && (
      <MyWork onViewChange={setCurrentView} />
    )}
    {currentView === 'profile' && (
      <Profile onViewChange={setCurrentView} />
    )}
    {currentView === 'settings' && (
      <Settings onViewChange={setCurrentView} />
    )}
  </>
) : (
  <LandingPage onLoginClick={() => setIsLoggedIn(true)} />
)}
```

### 6.3 Conditional Component Rendering

**Pattern 1: Ternary Operator**

```javascript
// MyWork.js Line 904-905: Show pending or history based on state
const cashConfirmationNotifications = 
  cashPaymentView === 'pending'
    ? allCashTransactions.filter((txn) => txn.cashConfirmationStatus === 'pending-worker-review')
    : allCashTransactions.filter((txn) => txn.cashConfirmationStatus === 'approved' || txn.cashConfirmationStatus === 'denied');
```

**Pattern 2: Guard Clause**

```javascript
// MyBookings.js Line 749: Only show skeletons if loading
{isSkeletonLoading && (
  <SkeletonCard key={`skeleton-${index}`} />
)}
```

**Pattern 3: AND Operator (`&&`)**

```javascript
// MyWork.js Line 1165: Show buttons only in pending view
{cashPaymentView === 'pending' && (
  <div style={sx('payment-confirm-actions')}>
    <button>Approve</button>
    <button>Deny</button>
  </div>
)}
```

**Pattern 4: Map with Conditional**

```javascript
// Dashboard.js Line 444-450: Show skeleton or actual card
{serviceToDisplay.map((service, index) =>
  isSkeletonLoading ? (
    <SkeletonServiceCard key={`skeleton-${index}`} />
  ) : (
    <ServiceCard key={service.id} {...service} />
  )
)}
```

### 6.4 Cash Payment Toggle Feature (NEW)

**Location:** MyWork.js Lines 357, 904-905, 1096-1125

**Implementation:**

```javascript
// Step 1: State for view toggle (Line 357)
const [cashPaymentView, setCashPaymentView] = useState('pending'); // 'pending' or 'history'

// Step 2: Filter logic based on state (Lines 904-905)
const cashConfirmationNotifications = 
  cashPaymentView === 'pending'
    ? allCashTransactions.filter((txn) => txn.cashConfirmationStatus === 'pending-worker-review')
    : allCashTransactions.filter((txn) => txn.cashConfirmationStatus === 'approved' || txn.cashConfirmationStatus === 'denied');

// Step 3: Render toggle buttons (Lines 1096-1116)
<div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
  <button
    style={{
      backgroundColor: cashPaymentView === 'pending' ? '#2563eb' : '#e2e8f0',
      color: cashPaymentView === 'pending' ? '#ffffff' : '#0f172a',
    }}
    onClick={() => setCashPaymentView('pending')}
  >
    Pending Review
  </button>
  <button
    style={{
      backgroundColor: cashPaymentView === 'history' ? '#2563eb' : '#e2e8f0',
      color: cashPaymentView === 'history' ? '#ffffff' : '#0f172a',
    }}
    onClick={() => setCashPaymentView('history')}
  >
    History
  </button>
</div>

// Step 4: Conditional UI (Lines 1165-1185)
{cashPaymentView === 'pending' && (
  <div style={sx('payment-confirm-actions')}>
    <button onClick={() => handleRequestCashConfirmationReview(txn, 'approve')}>
      Approve
    </button>
    <button onClick={() => handleRequestCashConfirmationReview(txn, 'deny')}>
      Deny
    </button>
  </div>
)}
```

---

## 7. PROPS FLOW

### 7.1 What are Props?

**Definition:** Data passed from parent to child component. Read-only from child perspective.

**Syntax:** Parent passes `<Child prop={value} />`, child receives via `function Child({ prop }) {}`

### 7.2 Props Flow Example: Dashboard → ServiceCard

**Parent Component (Dashboard.js):**

```javascript
// Line 444-450: Parent passes multiple props
<ServiceCard 
  key={service.id}
  id={service.id}                    // Unique identifier
  name={service.name}                // Display name
  rating={service.rating}            // Star rating
  location={service.location}        // Geographic location
  serviceType={service.serviceType}  // Service category
  price={service.price}              // Cost
  image={service.image}              // Profile image
/>
```

**Child Component (ServiceCard.js):**

```javascript
// Line 5: Child receives props as function parameter
function ServiceCard({ 
  id, 
  name, 
  rating, 
  location, 
  serviceType, 
  price, 
  image 
}) {
  return (
    <div>
      <img src={image} alt={name} />
      <h3>{name}</h3>
      <p>{serviceType}</p>
      <p>{rating} ⭐ • {location}</p>
      <p>₱{price}/hour</p>
    </div>
  );
}
```

### 7.3 Props Destructuring

**Pattern: Pull specific props from object**

```javascript
// With destructuring (cleaner)
function PaymentModal({ booking, onSelectPayment, onCancel }) {
  const paymentMethod = booking.paymentMethod;
}

// Without destructuring (verbose)
function PaymentModal(props) {
  const paymentMethod = props.booking.paymentMethod;
}
```

### 7.4 Default Props

**Pattern: Provide fallback values**

```javascript
// In MyWork.js Line 899
const gcashNumber = currentProfile?.gcashNumber || '09054891105';  // Use || for fallback

// Using ?? (nullish coalescing)
const city = sellerProfile?.city ?? 'Bulacan';  // Falls back only if null/undefined

// Using || (logical OR)
const serviceType = (sellerProfile?.serviceType || 'Others') ? (sellerProfile?.customServiceType) : 'General';
```

### 7.5 Props Validation (Implicit)

**Example from WorkerDashboard.js:**

```javascript
// Line 6: Component expects specific props
function WorkerDashboard({ sellerProfile, onBackToClient, onLogout }) {
  // Line 8: Props are used, if undefined, results in runtime errors
  const workerName = sellerProfile?.fullName || 'New Seller';
  
  // This shows props should be validated before use
  return (
    <div>
      <button onClick={onBackToClient}>Client Dashboard</button>
      <button onClick={onLogout}>Logout</button>
    </div>
  );
}

// Parent passes required props
<WorkerDashboard 
  sellerProfile={currentProfile}
  onBackToClient={() => setCurrentView('client-dashboard')}
  onLogout={() => handleLogout()}
/>
```

---

## 8. CONDITIONAL RENDERING

### 8.1 if/else Inside JSX

**Method 1: Ternary Operator (Recommended)**

```javascript
// MyBookings.js Lines 749-755
{isSkeletonLoading ? (
  <SkeletonCard key={`skeleton-${index}`} />
) : (
  <BookingCard key={booking.id} {...booking} />
)}
```

**Method 2: AND Operator**

```javascript
// MyWork.js Line 1165: Show only if condition is true
{cashPaymentView === 'pending' && (
  <div style={sx('payment-confirm-actions')}>
    <button>Approve</button>
  </div>
)}
```

**Method 3: if Statement Before Return**

```javascript
// Create variable using if/else, then use in JSX
function Component() {
  let content;
  
  if (isLoading) {
    content = <SkeletonCard />;
  } else {
    content = <Card />;
  }
  
  return (
    <div>
      {content}
    </div>
  );
}
```

### 8.2 Multiple Conditions

**Example: Dashboard.js Lines 444-450**

```javascript
{serviceToDisplay.map((service, index) =>
  isSkeletonLoading ? (              // Condition 1: Is loading?
    <SkeletonServiceCard key={`skeleton-${index}`} />
  ) : (
    <ServiceCard 
      key={service.id}
      {...service}
    />
  )
)}
```

**Example: MyWork.js Lines 1136-1153**

```javascript
const statusStyle =
  txn.cashConfirmationStatus === 'approved'        // Condition 1
    ? sx('confirm-status-pill', 'confirm-status-approved')
    : txn.cashConfirmationStatus === 'denied'      // Condition 2
      ? sx('confirm-status-pill', 'confirm-status-denied')
      : sx('confirm-status-pill', 'confirm-status-pending');  // Default

// Shows different badge based on status
<span style={statusStyle}>
  {txn.cashConfirmationStatus === 'approved' ? 'Approved' :
   txn.cashConfirmationStatus === 'denied' ? 'Denied' :
   'Pending Review'}
</span>
```

### 8.3 Showing/Hiding Elements

**Pattern: Show message when list is empty**

```javascript
// MyWork.js Line 1090-1117
{cashConfirmationNotifications.length === 0 ? (
  <div style={sx('payment-confirm-card')}>
    <p style={{ margin: 0, color: '#64748b' }}>
      {cashPaymentView === 'pending' 
        ? 'No cash confirmation requests for this week.' 
        : 'No completed cash transactions.'}
    </p>
  </div>
) : (
  <div style={sx('payment-confirm-grid')}>
    {cashConfirmationNotifications.map(txn => (
      // Render items
    ))}
  </div>
)}
```

---

## 9. DATA FLOW & STATE UPDATES

### 9.1 Unidirectional Data Flow

**Flow Direction:** Parent State → Props → Child → Event → Callback → Parent Handler → State Update → Re-render

```
┌─────────────────────────────────────────────────────────────┐
│                    1. USER CLICKS                            │
│                                                              │
│  2. EVENT TRIGGERED (onClick, onChange, etc.)              │
│        ↓                                                     │
│  3. CHILD CALLS CALLBACK                                    │
│  (e.g., onSelectPayment(data))                              │
│        ↓                                                     │
│  4. PARENT HANDLER EXECUTES                                 │
│  (e.g., handlePaymentProofSubmit())                         │
│        ↓                                                     │
│  5. STATE UPDATED (setState)                                │
│        ↓                                                     │
│  6. COMPONENT RE-RENDERS                                    │
│        ↓                                                     │
│  7. NEW PROPS PASSED TO CHILDREN                            │
│        ↓                                                     │
│  8. CHILD COMPONENTS RE-RENDER                              │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 State Update Example: Payment Approval

**Location: MyWork.js Lines 843-873**

```javascript
// Step 1: Handler function
const handleReviewCashConfirmation = (transactionId, decision) => {
  // Step 2: Create new state using setState
  setTransactions((prev) =>
    // Step 3: Map through array to find and update specific item
    prev.map((txn) => {
      if (txn.id !== transactionId) return txn;  // Return unchanged
      
      if (decision === 'approve') {
        // Step 4: Return new object with updated properties
        return {
          ...txn,  // Copy existing properties
          cashConfirmationStatus: 'approved',  // Update status
          isPaid: true,                        // Update paid flag
          transactionId: txn.transactionId || buildCashTransactionId(transactionId),
        };
      }
      
      // Step 5: Return modified object
      return {
        ...txn,
        cashConfirmationStatus: 'denied',
        isPaid: false,
        transactionId: '',
      };
    })
  );
};

// Step 6: Child calls this handler
<button onClick={() => handleRequest CashConfirmationReview(txn, 'approve')}>
  Approve
</button>

// Step 7: Component re-renders with new state
// Step 8: Filters update automatically (Line 904-905)
const cashConfirmationNotifications = 
  cashPaymentView === 'pending'
    ? allCashTransactions.filter(...)  // Now has fewer items
    : allCashTransactions.filter(...);  // Now has more items
```

### 9.3 Redux-Like Pattern (No Redux Needed)

**Custom Hook Pattern Used in TrabaWho:**

```javascript
// Instead of Redux, use local state + handlers
const [transactions, setTransactions] = useState(initialData);

// Actions (handler functions)
const approveTransaction = (id) => { ... };
const denyTransaction = (id) => { ... };
const updateTransaction = (id, updates) => { ... };

// Derived state (computed)
const pendingTransactions = transactions.filter(t => t.status === 'pending');
const approvedTransactions = transactions.filter(t => t.status === 'approved');

// This is simpler than Redux and sufficient for medium-complex apps
```

---

## 10. REUSABLE COMPONENTS

### 10.1 Component Reusability Principle

**Goal:** Write once, use in multiple places

**Benefits:**
- Reduced code duplication
- Consistent UI/UX
- Easier maintenance
- Less bugs

### 10.2 Skeleton Components (Reusable Example)

**All skeleton components follow the same pattern:**

1. **SkeletonCard.js** - Booking/transaction cards
   - Location: `src/components/SkeletonCard.js`
   - Used in: Dashboard, MyBookings, MyWork

2. **SkeletonServiceCard.js** - Service provider cards
   - Location: `src/components/SkeletonServiceCard.js`
   - Used in: Dashboard service listings

3. **SkeletonChatMessage.js** - Chat messages
   - Location: `src/components/SkeletonChatMessage.js`
   - Used in: ChatWindow during message load

4. **SkeletonText.js** - Generic text lines
   - Location: `src/components/SkeletonText.js`
   - Used in: Any text content placeholder

5. **SkeletonAvatar.js** - Profile pictures
   - Location: `src/components/SkeletonAvatar.js`
   - Used in: User profile sections

**Why Reusable:**
- Same shimmer animation logic
- Same gradient effect
- Same cleanup pattern
- Easy to customize via inline styles

### 10.3 Modal Components (Reusable Pattern)

**Reusable Modal Pattern:**

```javascript
// Pattern: Modal receives visibility state and handler props
function GenericModal({ isOpen, onClose, onConfirm, children }) {
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {children}
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// Usage
<GenericModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  onConfirm={() => handleConfirm()}
>
  <p>Are you sure?</p>
</GenericModal>
```

**Similar Modals in TrabaWho:**
- `PaymentModal.js` - Payment method selection
- `BookingCalendarModal.js` - Calendar booking
- `ProfileEditModal.js` - Edit profile
- `SellerScheduleModal.js` - Schedule management

### 10.4 Composition Pattern

**Example: Button Component**

```javascript
// Instead of creating different buttons, compose one button with options
function Button({ 
  children,           // Button text
  onClick,           // Click handler
  variant,           // 'primary', 'secondary', 'danger'
  disabled,          // Disabled state
  size,              // 'small', 'medium', 'large'
}) {
  const styles = {
    primary: { backgroundColor: '#2563eb', color: '#fff' },
    secondary: { backgroundColor: '#e2e8f0', color: '#0f172a' },
    danger: { backgroundColor: '#dc2626', color: '#fff' },
  };
  
  const sizeStyles = {
    small: { padding: '0.5rem 1rem', fontSize: '12px' },
    medium: { padding: '0.75rem 1.5rem', fontSize: '14px' },
    large: { padding: '1rem 2rem', fontSize: '16px' },
  };
  
  return (
    <button
      style={{
        ...styles[variant || 'primary'],
        ...sizeStyles[size || 'medium'],
      }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

// Instead of 9 different button components, use props:
<Button variant="primary" size="large">Approve</Button>
<Button variant="danger" size="medium">Deny</Button>
<Button variant="secondary" size="small" disabled>Disabled</Button>
```

---

## SUMMARY TABLE: Key Concepts

| Concept | Location in Code | Purpose |
|---------|------------------|---------|
| **useState** | App.js:40-50 | Manage component state |
| **useEffect** | App.js:53-75 | Side effects & cleanup |
| **useMemo** | WorkerDashboard.js:37-43 | Memoize computation |
| **Skeleton Loading** | SkeletonCard.js:1-60 | Loading placeholder |
| **Parent-Child** | MyBookings.js:780, PaymentModal.js:20 | Data flow pattern |
| **camelCase** | All files | Naming convention |
| **Props** | ServiceCard.js:5 | Pass data to children |
| **Ternary** | Dashboard.js:444 | Conditional rendering |
| **Callback** | MyBookings.js:1144 | Child → Parent communication |
| **State Update** | MyWork.js:843 | Immutable state changes |
| **Reusable Components** | SkeletonCard.js | DRY principle |
| **Dynamic Rendering** | App.js:115-230 | State-driven UI |

---

## DEFENSE TALKING POINTS

### When Professor Asks About State Management:
*"The app uses React's useState hook for local component state instead of Redux. This is sufficient because the state is primarily component-scoped. For example, in MyWork.js line 357, we have a cashPaymentView state that determines whether to show pending or history transactions. This is more efficient than Redux for a medium-complexity app."*

### When Asked About Component Structure:
*"We follow a clear parent-child hierarchy. Parents hold business logic and state, children focus on UI. MyBookings (parent) passes booking data and callbacks to PaymentModal (child). The child calls the callback when user interacts, parent updates state, and child re-renders with new props. This is the React unidirectional data flow principle."*

### When Asked About Skeleton Loading:
*"The skeleton screen is a UX best practice. We created reusable skeleton components (SkeletonCard, SkeletonServiceCard, etc.) that show during data loading. The shimmer effect is created using useState for animation state and setInterval for 800ms toggle. When data loads, we swap the skeleton component with actual components using conditional rendering."*

### When Asked About Code Quality:
*"We maintain consistent naming conventions using camelCase throughout. State variables use descriptive names (isLoadingTransition, currentView), handlers follow 'handle' or 'on' prefixes, and booleans are named with 'is', 'has', or 'can' prefixes. This makes the code self-documenting and easier to maintain."*

### When Asked About Dynamic Rendering:
*"Content changes based on state without page reloads. The App.js component has a currentView state that determines which page to show. When clicking navigation buttons, setCurrentView updates this state, React re-renders only the necessary components, and users see instant navigation. This is achieved through conditional JSX rendering based on state values."*

---

## FILE STRUCTURE REFERENCE

```
src/
├── App.js                          # Root component, main state management
│   ├── Line 40: isLoggedIn state
│   ├── Line 42: currentView state
│   ├── Line 115: Dynamic page rendering
│   └── Line 53: Theme management effect
│
├── pages/
│   ├── MyBookings.js               # Parent component for bookings
│   │   ├── Line 33: bookings state
│   │   ├── Line 276: handlePaymentProofSubmit handler
│   │   ├── Line 749: Skeleton rendering
│   │   └── Line 780: PaymentModal with callback
│   │
│   ├── MyWork.js                   # Worker dashboard
│   │   ├── Line 357: cashPaymentView state (NEW)
│   │   ├── Line 904-905: Filter logic based on view
│   │   └── Line 1165: Conditional action buttons
│   │
│   └── Dashboard.js                # Home page
│       ├── Line 177: Skeleton loading logic
│       └── Line 444: Conditional skeleton/card rendering
│
├── components/
│   ├── SkeletonCard.js             # Reusable skeleton
│   │   ├── Line 10-16: useEffect for shimmer animation
│   │   └── Line 29-47: Gradient styles with animation
│   │
│   ├── PaymentModal.js             # Child component
│   │   ├── Line 20: Props from parent
│   │   └── Line 88: Callback to parent
│   │
│   ├── ServiceCard.js              # Presentational component
│   │   └── Line 5: Props destructuring
│   │
│   └── ... other components
│
└── data/
    └── MockWorkers.js              # Mock data (transactions, workers, etc.)
```

---

## CONCLUSION

TrabaWho demonstrates mastery of:
✅ **React Hooks** (useState, useEffect, useMemo)  
✅ **Component Architecture** (Parent-Child pattern)  
✅ **State Management** (Unidirectional data flow)  
✅ **Naming Conventions** (camelCase throughout)  
✅ **Dynamic Rendering** (Conditional JSX)  
✅ **UX Best Practices** (Skeleton loading)  
✅ **Code Reusability** (Component composition)  
✅ **Responsive Design** (Mobile-first CSS)  

**Grade these implementations on:**
- Line references proving implementation
- Consistent naming conventions
- Proper prop drilling
- State lifting when necessary
- Efficient re-rendering
- Separation of concerns
