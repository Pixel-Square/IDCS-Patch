# Period Swap Notification & Approval System

## Overview
Implemented a complete period swap notification and approval system that requires staff members to approve swap requests before they are executed.

## Changes Made

### Backend Changes

#### 1. New Model: PeriodSwapRequest (backend/timetable/models.py)
- Added a new model to track period swap requests
- Fields include:
  - `section`, `requested_by`, `requested_to` (ForeignKeys)
  - `from_date`, `from_period`, `from_subject_text`
  - `to_date`, `to_period`, `to_subject_text`
  - `status` (PENDING, APPROVED, REJECTED, CANCELLED)
  - `reason`, `response_message`
  - Timestamps: `created_at`, `updated_at`, `responded_at`

#### 2. Serializer: PeriodSwapRequestSerializer (backend/timetable/serializers.py)
- Serializes swap request data with computed fields:
  - `requested_by_name`, `requested_to_name`
  - `section_name`
  - `from_period_label`, `to_period_label`

#### 3. Views (backend/timetable/views.py)
Added two new API views:

**PeriodSwapRequestView**
- POST /api/timetable/swap-requests/
  - Creates a new swap request
  - Validates that requesting staff is teaching one of the periods
  - Prevents duplicate pending requests
  - Notifies the other staff member
- GET /api/timetable/swap-requests/
  - Lists swap requests (sent or received)
  - Supports status filtering (PENDING, APPROVED, REJECTED, CANCELLED)

**PeriodSwapRequestActionView**
- POST /api/timetable/swap-requests/<id>/approve/
  - Approves request and executes the swap
  - Creates SpecialTimetableEntry records
- POST /api/timetable/swap-requests/<id>/reject/
  - Rejects the request with optional message
- POST /api/timetable/swap-requests/<id>/cancel/
  - Cancels request (only by requester)

#### 4. URL Routes (backend/timetable/urls.py)
- Added routes for the new views

#### 5. Database Migration
- Created and applied migration: `0006_periodswaprequest.py`

### Frontend Changes

#### 1. SwapNotifications Component (frontend/src/components/SwapNotifications.tsx)
- Displays pending swap requests on the dashboard
- Shows only requests where current user is the receiver
- Allows approve/reject actions directly from dashboard
- Includes "View All" link to full swap requests page
- Auto-hides when no pending requests

#### 2. SwapRequestsPage (frontend/src/pages/staff/SwapRequestsPage.tsx)
- Full-featured page for managing swap requests
- Two tabs: "Received" and "Sent"
- Status filtering: ALL, PENDING, APPROVED, REJECTED, CANCELLED
- Shows complete request details including:
  - Period dates, times, and subjects
  - Request reason and response messages
  - Timestamps
- Actions:
  - Approve/Reject (for received requests)
  - Cancel (for sent requests)

#### 3. Updated Dashboard (frontend/src/pages/dashboard/Dashboard.tsx)
- Integrated SwapNotifications component
- Only shown for staff users
- Positioned above other dashboard content

#### 4. Updated TimetableView (frontend/src/pages/staff/TimetableView.tsx)
- Modified `confirmSwap()` function to send swap requests instead of immediate swaps
- Calls new API endpoint: `/api/timetable/swap-requests/`
- Shows success message indicating approval is needed
- No longer reloads timetable until request is approved

#### 5. Routing (frontend/src/App.tsx)
- Added route: `/staff/swap-requests`
- Protected route for staff users only

## User Flow

### Requesting a Swap
1. Staff member goes to their timetable
2. Selects two periods to swap (same day or cross-day)
3. Confirms the swap
4. System sends a swap request to the other staff member
5. Requester sees confirmation message
6. Request appears in their "Sent" tab

### Receiving a Swap Request
1. Staff member sees notification on dashboard (with count badge)
2. Can approve/reject directly from dashboard
3. Or click "View All" to see all requests
4. Can optionally add a message when rejecting
5. Upon approval:
   - System creates SpecialTimetableEntry records
   - Swap is executed
   - Both staff see updated timetable

### Managing Requests
- View all sent and received requests
- Filter by status
- See complete history including approved/rejected requests
- Cancel pending sent requests
- View reasons and response messages

## Key Features

✅ **Notification Badge**: Red badge shows count of pending requests
✅ **Dashboard Integration**: Requests visible immediately on dashboard
✅ **Two-way Communication**: Requester can add reason, receiver can add response
✅ **Status Tracking**: Complete audit trail of all requests
✅ **Validation**: Prevents invalid swaps (past periods, electives, custom subjects)
✅ **Permission Checks**: Only assigned staff can request/approve swaps
✅ **Duplicate Prevention**: Prevents multiple pending requests for same periods
✅ **Clean UI**: Color-coded status badges, clear action buttons
✅ **Mobile Responsive**: Works on all screen sizes

## Database Schema

```sql
CREATE TABLE timetable_periodswaprequest (
    id INTEGER PRIMARY KEY,
    section_id INTEGER NOT NULL,
    requested_by_id INTEGER NOT NULL,
    requested_to_id INTEGER NOT NULL,
    from_date DATE NOT NULL,
    from_period_id INTEGER NOT NULL,
    from_subject_text VARCHAR(256),
    to_date DATE NOT NULL,
    to_period_id INTEGER NOT NULL,
    to_subject_text VARCHAR(256),
    status VARCHAR(20) DEFAULT 'PENDING',
    reason TEXT,
    response_message TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    responded_at TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES academics_section(id),
    FOREIGN KEY (requested_by_id) REFERENCES academics_staffprofile(id),
    FOREIGN KEY (requested_to_id) REFERENCES academics_staffprofile(id),
    FOREIGN KEY (from_period_id) REFERENCES timetable_timetableslot(id),
    FOREIGN KEY (to_period_id) REFERENCES timetable_timetableslot(id)
);
```

## API Endpoints

### Create Swap Request
```
POST /api/timetable/swap-requests/
Body: {
    "section_id": 1,
    "from_date": "2026-03-15",
    "from_period_id": 5,
    "to_date": "2026-03-15",
    "to_period_id": 7,
    "reason": "Optional reason"
}
Response: {
    "success": true,
    "message": "Swap request sent to Staff Name",
    "request": { ... }
}
```

### List Swap Requests
```
GET /api/timetable/swap-requests/?status=PENDING
Response: {
    "success": true,
    "requests": [ ... ]
}
```

### Approve Request
```
POST /api/timetable/swap-requests/123/approve/
Body: {
    "message": "Optional approval message"
}
Response: {
    "success": true,
    "message": "Swap request approved and periods swapped successfully"
}
```

### Reject Request
```
POST /api/timetable/swap-requests/123/reject/
Body: {
    "message": "Optional rejection reason"
}
Response: {
    "success": true,
    "message": "Swap request rejected"
}
```

### Cancel Request
```
POST /api/timetable/swap-requests/123/cancel/
Response: {
    "success": true,
    "message": "Swap request cancelled"
}
```

## Testing Checklist

- [ ] Create swap request between two staff members
- [ ] Verify notification appears on receiver's dashboard
- [ ] Approve request and verify swap is executed
- [ ] Reject request and verify status update
- [ ] Cancel sent request
- [ ] Filter requests by status
- [ ] Test cross-day swaps
- [ ] Verify validation prevents invalid swaps
- [ ] Test on mobile devices
- [ ] Verify notifications disappear after action

## Future Enhancements

- Email/SMS notifications for new swap requests
- Bulk approval/rejection
- Swap templates for recurring swaps
- Calendar view of swaps
- Analytics on swap patterns
