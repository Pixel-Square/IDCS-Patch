# QP Pattern Dynamic Loading Enhancement

## Overview
Enhanced the mark entry pages to dynamically load Question Paper (QP) patterns from the database and display loading indicators to help users understand when patterns are being fetched.

## Changes Made

### 1. CourseOBEPage.tsx
**Location:** `/home/iqac/IDCS-Restart/frontend/src/pages/CourseOBEPage.tsx`

**Issue Fixed:**
- QP type was not being correctly read from the database due to inconsistent field naming between backend models
- `CurriculumMaster` uses `qp_type` field
- `CurriculumDepartment` uses `question_paper_type` field

**Solution:**
- Added a helper function `getQpType()` that checks both field names
- Updated QP type extraction logic to handle both `question_paper_type` and `qp_type`
- Applied the same fix to elective courses fallback logic

### 2. ModelEntry.tsx
**Location:** `/home/iqac/IDCS-Restart/frontend/src/components/ModelEntry.tsx`

**Enhancements:**
- Added `iqacPatternLoading` state to track when pattern is being fetched
- Added `iqacPatternError` state to track fetch errors
- Enhanced the `useEffect` hook that fetches patterns to properly manage loading states
- Added visual indicators in the header section showing:
  - ⟳ "Loading QP pattern..." (blue) - while loading
  - ⚠ "Pattern load failed" (red) - on error
  - ✓ "Pattern loaded (N questions)" (green) - on success

**Code Location:** Lines 170-173, 308-345, 1511-1527

### 3. Cia1Entry.tsx (applies to both CIA1 and CIA2)
**Location:** `/home/iqac/IDCS-Restart/frontend/src/components/Cia1Entry.tsx`

**Enhancements:**
- Added `iqacPatternLoading` state to track when pattern is being fetched
- Added `iqacPatternError` state to track fetch errors
- Enhanced pattern loading logic with proper loading state management
- Added a dedicated status bar (`qpPatternStatusBar`) displaying:
  - Assessment type (CIA 1 or CIA 2)
  - Class type
  - QP type
  - Loading status with visual indicators:
    - ⟳ "Loading pattern..." (blue) - while loading
    - ⚠ "Pattern load failed" (red) - on error
    - ✓ "Pattern loaded (N questions)" (green) - on success

**Code Location:** Lines 296-298, 320-368, 2069-2089, 2221-2223

### 4. Cia2Entry.tsx
**Location:** `/home/iqac/IDCS-Restart/frontend/src/components/Cia2Entry.tsx`

**Note:** This is a wrapper component that passes `assessmentKey="cia2"` to `Cia1Entry`, so all CIA1 enhancements automatically apply to CIA2.

### 5. curriculum.ts TypeScript Interface
**Location:** `/home/iqac/IDCS-Restart/frontend/src/services/curriculum.ts`

**Documentation Added:**
- Added comments to `DeptRow` interface explaining why both `qp_type` and `question_paper_type` fields exist
- Clarified that `CurriculumMaster` uses `qp_type` while `CurriculumDepartment` uses `question_paper_type`

## How It Works

### Pattern Loading Flow:
1. When a course page loads, the component fetches the QP pattern from the backend using `fetchIqacQpPattern()`
2. The pattern includes:
   - `marks`: Array of maximum marks for each question
   - `cos`: Array of CO (Course Outcome) mappings for each question
3. The component generates question columns dynamically based on the pattern
4. If no pattern is found, it falls back to default questions

### Visual Feedback:
- **Loading State:** Users see a rotating icon (⟳) and "Loading QP pattern..." message
- **Error State:** If loading fails, users see a warning icon (⚠) and "Pattern load failed" message
- **Success State:** When pattern loads successfully, users see a checkmark (✓) and confirmation with question count

## Benefits

1. **Transparency:** Users can now see when the pattern is being loaded from the database
2. **Error Awareness:** Clear error messages help users understand when pattern loading fails
3. **Reduced Confusion:** The loading indicator prevents users from thinking the page is stuck
4. **Dynamic Updates:** Question columns update automatically based on IQAC-configured patterns
5. **Database Consistency:** Properly handles both legacy (`qp_type`) and current (`question_paper_type`) field names

## Testing

- Build completed successfully with no errors
- All affected components (CourseOBEPage, ModelEntry, Cia1Entry/Cia2Entry) compile without issues
- Loading states are properly managed with cleanup on component unmount

## Related Backend Endpoints

- `GET /api/obe/iqac-qp-pattern/` - Fetches QP patterns configured by IQAC
- `GET /api/curriculum/department/` - Fetches department curriculum with QP types

## Future Considerations

- Consider standardizing the field name across all backend models to use `question_paper_type` consistently
- Add retry logic for failed pattern loads
- Consider caching patterns to reduce API calls
