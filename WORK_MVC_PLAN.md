9i# Work Module MVC Refactoring Plan

## Overview
The Work module (MyWork.jsx) is currently a 2416-line monolithic component managing:
- Worker services list
- Weekly schedule management
- Calendar availability
- Inquiry/chat handling
- Transaction/payment confirmations
- Cash verification workflow
- Refund processing

**Target**: Refactor into MVC architecture with specialized controller hooks for clean separation of concerns.

---

## Current State Analysis

### MyWork.jsx Size & Complexity
- **Lines**: 2416 (massive!)
- **useState Calls**: 20+ state variables
- **Sections**: Inquiries, Weekly Schedule, Calendar, Transactions, Refunds, Cancelled
- **Components**: 6 child modals (SimulatedChat, SlotEditModal, ProfileEditModal, etc.)

### State Breakdown
**Inquiry/Chat Management** (4 variables)
- `selectedChatId` - Current chat being displayed
- `workerServices` - List of services
- `activeServiceIndex` - Current active service

**Schedule Management** (4 variables)
- `weeklySchedule` - Weekly time slots: `{ Mon: [...], Tue: [...], ... }`
- `calendarAvailability` - Date-based availability
- `weekOffset` - Week navigation offset
- `transactions` - Payment confirmations

**Modal States** (8 variables)
- `editSlotModalOpen` / `editSlotData` / `editSlotDayKey` / `editSlotId` / `slotModalType`
- `profileEditModalOpen`
- `isGcashPreviewOpen`
- `isCashQrPreviewOpen`

**Confirmation/Decision States** (3 variables)
- `doneConfirmTarget` - Mark booking as done
- `deleteConfirmTarget` - Delete slot
- `cashDecisionTarget` - Approve/deny cash

**View/Filter States** (3 variables)
- `workSectionFilter` - all | inquiries | cash-approvals | refunds | cancelled
- `cashPaymentView` - pending | history
- `hoverKey` - Hover state tracking

**Data Loading States** (4 variables)
- `sellerData` - Seller profile from DB
- `workerProfileBundle` - Complete profile bundle
- `sellerDbServices` - Services from DB
- `isLoadingSellerData` / `sellerDataError` - Loading states

**UI States** (2 variables)
- `isMobile` - Responsive breakpoint
- `isWorkNavDropdownOpen` - Dropdown menu
- `isCreateServiceOpen` / `newService` - Create service form

### Data Flow Currently
```
MyWork.jsx (2416 lines)
  ↓
  ├─ State: 20+ useState
  ├─ Effects: Multiple useEffect for data loading & sync
  ├─ Handlers: 50+ handler functions for:
  │  ├─ Chat/inquiry actions
  │  ├─ Schedule editing
  │  ├─ Modal control
  │  ├─ Confirmations
  │  └─ Data persistence (localStorage)
  ↓
  Child Components:
  ├─ SimulatedChat
  ├─ SlotEditModal
  ├─ ProfileEditModal
  ├─ CalendarAvailabilityModal
  ├─ SellerScheduleModal
  └─ ConfirmActionModal
```

---

## Proposed MVC Architecture

### Controllers (Business Logic)
1. **useWorkerServiceController** - Service list & inquiry chat management
2. **useScheduleController** - Weekly schedule editing & management
3. **useCalendarController** - Calendar availability management
4. **usePaymentConfirmationController** - Cash/transaction confirmations with localStorage sync
5. **useRefundController** - Refund request processing

### Services (Data Operations)
1. **workerService.js** - Data operations for worker profile/services
2. **scheduleService.js** - Schedule persistence logic
3. **paymentService.js** - Payment confirmation operations

### Views (Components)
- **MyWork.jsx** (orchestrator) - Reduced to ~300-400 lines
- Child components - Receive props from controllers, render UI only

---

## Implementation Phases

### Phase 1: Create Service Layer (Data)
**Files to create:**
1. `src/features/work/services/workerService.js`
2. `src/features/work/services/scheduleService.js`

**Purpose:**
- Encapsulate data operations
- Provide consistent API for controllers
- Handle localStorage persistence for schedule data
- Mock initial data (will connect to Supabase later)

**Key Functions:**
- `getWorkerProfile()` - Get current worker's profile
- `getWorkerServices()` - Fetch services list
- `updateWeeklySchedule(weekData)` - Update schedule
- `getWeeklySchedule()` - Fetch weekly schedule
- `getCalendarAvailability()` - Get calendar dates
- `updateCalendarAvailability(dates)` - Set available dates
- `getPaymentConfirmations()` - Fetch pending confirmations
- `approvePaymentConfirmation(id)` - Approve cash/payment
- `denyPaymentConfirmation(id)` - Deny payment
- `getRefundRequests()` - Get refund requests from localStorage
- `approveRefund(id)` - Mark refund approved
- `getTransactions()` - Fetch transaction history

### Phase 2: Create Controller Hooks
**Files to create:**
1. `src/features/work/hooks/useWorkerServiceController.js`
2. `src/features/work/hooks/useScheduleController.js`
3. `src/features/work/hooks/useCalendarController.js`
4. `src/features/work/hooks/usePaymentConfirmationController.js`
5. `src/features/work/hooks/useRefundController.js`
6. `src/features/work/hooks/index.js` (exports)

**useWorkerServiceController**
```javascript
State:
- services (array)
- activeServiceIndex (number)
- selectedChatId (string|null)
- isLoadingServices (boolean)

Methods:
- selectChat(serviceId) → void
- closeChat() → void
- updateService(id, data) → void
- createService(serviceData) → void
- getActiveService() → service object
```

**useScheduleController**
```javascript
State:
- weeklySchedule ({ Mon: [...], Tue: [...], ... })
- weekOffset (number)
- editSlotModalOpen (boolean)
- editSlotData (object|null)
- editSlotDayKey (string|null)
- editSlotId (string|null)
- slotModalType ('edit'|'add')

Methods:
- getWeekDateRange() → { start, end }
- openEditSlotModal(dayKey, slotId, slotData) → void
- openAddSlotModal(dayKey) → void
- closeSlotModal() → void
- updateSlot(dayKey, slotId, newData) → void
- addSlot(dayKey, timeBlock) → void
- deleteSlot(dayKey, slotId) → void
- navigateWeek(offset) → void
```

**useCalendarController**
```javascript
State:
- calendarAvailability (array of dates)
- selectedDates (Set)

Methods:
- toggleDate(date) → void
- setAvailableDates(dates[]) → void
- getAvailabilityForWeek(weekStart) → dates[]
```

**usePaymentConfirmationController**
```javascript
State:
- transactions (array)
- cashPaymentView ('pending'|'history')
- cashDecisionTarget (id|null)
- pendingConfirmations (filtered transactions)

Effect:
- Sync with localStorage (2.5s polling)
- Listen to storage events (cross-tab)

Methods:
- approveCashConfirmation(id) → void
- denyCashConfirmation(id) → void
- getConfirmationStatus(id) → status
```

**useRefundController**
```javascript
State:
- refundRequests (array)

Effect:
- Sync with localStorage (2.5s polling)

Methods:
- approveRefund(id) → void
- denyCashRefund(id) → void
- getRefundStatus(id) → status
```

### Phase 3: Refactor MyWork.jsx
**Changes:**
1. Remove all state management → Move to controllers
2. Keep only UI/view state:
   - `isMobile` - Responsive breakpoint
   - `hoverKey` - Hover effects
   - `workSectionFilter` - View filter
   - `doneConfirmTarget` - Confirmation dialogs
   - `deleteConfirmTarget` - Delete confirmations
   - `isWorkNavDropdownOpen` - Menu state
   - `successMessage` - Notification
   - `isCreateServiceOpen` - Create service form

3. Replace handler functions with useCallback wrappers that delegate to controllers
4. Update child component props to receive data from controllers

**Size Reduction:**
- Before: 2416 lines
- After: ~400-500 lines
- Removed: ~2000 lines of state + handlers → controllers

### Phase 4: Integration Testing
- Test service operations independently
- Test controller state management
- Test component rendering with controller data
- Test localStorage sync for cash/refund flows
- Verify all callbacks work correctly

### Phase 5: Child Component Updates (Optional)
- Review: SimulatedChat, SlotEditModal, ProfileEditModal, etc.
- Identify if any can extract logic → controllers
- Keep pure view components (receive props, render)

---

## Data Persistence Strategy

### Schedule Data (Local First)
**localStorage Key:** `trabawho_worker_schedule`
```json
{
  "week": 0,
  "schedule": {
    "Mon": [{ id, startTime, endTime, capacity, booked }],
    "Tue": [...],
    ...
  },
  "lastSync": "2026-05-10T10:00:00Z"
}
```

**Sync Strategy:**
- Load from localStorage on mount
- Auto-save on schedule changes
- Sync to Supabase (future) - periodic background sync
- Display "unsaved" indicator if local changes not synced

### Payment Confirmations (Cross-Tab Sync)
**localStorage Key:** `trabawho_cash_confirmation_requests`
- 2.5s polling in controller
- Storage event listener for cross-tab updates
- Same pattern as bookings module

### Refund Requests (Cross-Tab Sync)
**localStorage Key:** `trabawho_refund_requests`
- Same as payment confirmations
- Worker-side approval → visible in MyWork.jsx

---

## Success Criteria

✅ **Code Quality**
- MyWork.jsx reduced from 2416 → ~400 lines (83% reduction)
- Zero compilation errors
- All controller hooks properly export clean interfaces
- useCallback dependencies properly configured

✅ **Functionality**
- All inquiry/chat flows work identically
- Schedule editing preserves all behavior
- Payment confirmation flows unchanged
- localStorage sync transparent to UI
- Refund processing unchanged

✅ **Architecture**
- Clear separation: View ↔ Controller ↔ Service
- No business logic in components
- Reusable controllers
- Easy to test in isolation
- Easy to connect to Supabase later

✅ **Performance**
- No unnecessary re-renders
- Memoized selectors
- Efficient localStorage polling (2.5s intervals)
- Cross-tab communication via storage events

---

## Timeline Estimate

| Phase | Task | Estimate |
|-------|------|----------|
| 1 | Services + mocks | 1-2 hours |
| 2 | 5 controller hooks | 2-3 hours |
| 3 | MyWork.jsx refactor | 2-3 hours |
| 4 | Testing + fixes | 1-2 hours |
| **Total** | | **6-10 hours** |

---

## Notes

- **Parallel Structure**: This follows the exact pattern successful with bookings module
- **No Design Changes**: All UI/behavior preserved - pure refactoring
- **localStorage First**: Schedule data persists locally, worker approvals sync cross-tab
- **Incremental**: Can implement phases sequentially without breaking things
- **Testable**: Each controller can be unit-tested in isolation

---

## Next Steps

1. ✅ Review this plan
2. ⏳ Start Phase 1: Create service layer (workerService.js, scheduleService.js)
3. ⏳ Phase 2: Create all 5 controller hooks
4. ⏳ Phase 3: Refactor MyWork.jsx to use controllers
5. ⏳ Phase 4: Integration testing
