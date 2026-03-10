# First Year S&H Flow - Complete Implementation Guide

## Overview

This document outlines the complete flow for managing first-year students through the S&H (Science & Humanities) department before transitioning them to their core departments in Year 2.

---

## System Architecture

### Key Models and Their Roles

#### 1. **StudentProfile**
- `home_department` → Permanent degree department (AI&DS, EEE, ECE, etc.) - **NEVER CHANGES**
- `section` → Current section (S&H section in Year 1, core dept in Year 2+)
- Section assignments tracked via `StudentSectionAssignment` with start/end dates

#### 2. **Department**
- `is_sh_main` → Boolean flag marking S&H as Year-1 manager
- `parent` → S&H sub-departments can reference parent S&H dept

#### 3. **Batch**
- **S&H Batches**: `department=S&H`, `course=NULL`
- **Core Batches**: `course=<Course>`, `department=NULL` (inherited from course)

#### 4. **Section**
- `managing_department` → NULL for normal sections, or override (e.g., S&H for Year 1)
- `semester` → Auto-assigned based on batch start year + active academic year

#### 5. **AcademicYear**
- `is_active` → One active year at a time
- `parity` → ODD or EVEN (determines which semester is active)

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ YEAR 0: System Setup                                            │
├─────────────────────────────────────────────────────────────────┤
│ 1. Configure S&H Department (is_sh_main=True)                   │
│ 2. Create Academic Years (2024-2025 ODD/EVEN, 2025-2026...)     │
│ 3. Create Semesters (1-8)                                       │
│ 4. Configure Courses & Core Department Batches                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ YEAR 1 - SEMESTER 1: Student Entry (S&H Management)             │
├─────────────────────────────────────────────────────────────────┤
│ Action: Import new first-year students                          │
│                                                                  │
│ CREATE:                                                          │
│ • BatchYear: "2024-2028" (start_year=2024, end_year=2028)       │
│ • Batch: name="2024-2028", department=S&H, course=NULL           │
│ • Section: batch=↑, name="A", semester=1, managing_dept=S&H     │
│                                                                  │
│ IMPORT STUDENTS WITH:                                            │
│ • reg_no: 2024AI01, 2024EE01, etc.                              │
│ • home_department: AI&DS, EEE, ECE (core dept - permanent!)     │
│ • section: S&H/2024-2028/A (temporary - will change in Year 2)  │
│                                                                  │
│ ACADEMIC YEAR: 2024-2025 (PARITY=ODD) → Auto-assigns Semester 1 │
│                                                                  │
│ VISIBLE TO: S&H HOD, S&H AHOD, S&H Staff                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ YEAR 1 - SEMESTER 2: Continue in S&H                            │
├─────────────────────────────────────────────────────────────────┤
│ Action: Activate next semester                                  │
│                                                                  │
│ • Update AcademicYear: 2024-2025 → PARITY=EVEN                  │
│ • Sections auto-calculate and show Semester 2                   │
│ • Students remain in same S&H sections                          │
│ • S&H department continues to manage                            │
│                                                                  │
│ VISIBLE TO: S&H HOD, S&H AHOD, S&H Staff                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ YEAR 2 - SEMESTER 3: Promotion to Core Departments              │
├─────────────────────────────────────────────────────────────────┤
│ Action: Run promotion command                                   │
│                                                                  │
│ COMMAND:                                                         │
│   python manage.py promote_year1_students \                     │
│     --batch-name "2024-2028" \                                  │
│     --target-sem 3 \                                            │
│     --section-name "A"                                          │
│                                                                  │
│ SYSTEM ACTIONS (PER STUDENT):                                    │
│ 1. End current S&H section assignment (set end_date=today)      │
│ 2. Read student's home_department (AI&DS, EEE, etc.)            │
│ 3. Find/create core dept batch: Course=B.E.CSE, batch_year=2024 │
│ 4. Find/create core section: dept/2024-2028/A/Semester-3        │
│ 5. Create new StudentSectionAssignment → core dept section      │
│                                                                  │
│ RESULT:                                                          │
│ • Student 2024AI01 → AI&DS/2024-2028/A (Semester 3)             │
│ • Student 2024EE01 → EEE/2024-2028/A (Semester 3)               │
│                                                                  │
│ ACADEMIC YEAR: 2025-2026 (PARITY=ODD) → Auto-assigns Semester 3 │
│                                                                  │
│ VISIBLE TO: Core Dept HOD, Core Dept AHOD, Core Dept Staff      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ YEAR 2-4: Normal Core Department Flow                           │
├─────────────────────────────────────────────────────────────────┤
│ Semesters 4-8: Students remain in their core departments        │
│ • Semester transitions handled by Academic Year parity changes  │
│ • Section updates managed by department HODs                    │
│ • Student's home_department never changes                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Implementation

### **PHASE 1: One-Time System Configuration**

#### Step 1.1: Configure S&H Department
```python
# In Django Admin or shell
from academics.models import Department

# Mark S&H as the main Year-1 managing department
sh_dept = Department.objects.get(code='S&H')
sh_dept.is_sh_main = True
sh_dept.save()

# Optional: Create S&H sub-departments
math_dept = Department.objects.create(
    code='MATH',
    name='Mathematics',
    short_name='Maths',
    parent=sh_dept
)
# Repeat for Physics, Chemistry, English, etc.
```

#### Step 1.2: Create Academic Years
```python
from academics.models import AcademicYear

# Create academic years for 4 years (adjust as needed)
AcademicYear.objects.create(name='2024-2025', parity='ODD', is_active=True)
AcademicYear.objects.create(name='2024-2025', parity='EVEN', is_active=False)
AcademicYear.objects.create(name='2025-2026', parity='ODD', is_active=False)
AcademicYear.objects.create(name='2025-2026', parity='EVEN', is_active=False)
AcademicYear.objects.create(name='2026-2027', parity='ODD', is_active=False)
AcademicYear.objects.create(name='2026-2027', parity='EVEN', is_active=False)
AcademicYear.objects.create(name='2027-2028', parity='ODD', is_active=False)
AcademicYear.objects.create(name='2027-2028', parity='EVEN', is_active=False)
```

#### Step 1.3: Create Semesters
```python
from academics.models import Semester

for i in range(1, 9):
    Semester.objects.get_or_create(number=i, defaults={'name': f'Semester {i}'})
```

#### Step 1.4: Create Core Department Courses
```python
from academics.models import Course, Department

# For each core department
ai_dept = Department.objects.get(code='AI&DS')
Course.objects.create(
    code='B.E.AIML',
    name='B.E. Artificial Intelligence and Data Science',
    department=ai_dept,
    # Add other fields as needed
)

# Repeat for all core departments (EEE, ECE, ME, CE, IT, etc.)
```

---

### **PHASE 2: Annual First-Year Student Import**

#### Step 2.1: Create S&H Batch for New Academic Year
```python
from academics.models import Batch, BatchYear, Department

# Get or create batch year
batch_year, _ = BatchYear.objects.get_or_create(
    name='2024-2028',
    defaults={'start_year': 2024, 'end_year': 2028}
)

# Create S&H batch (department-only, no course)
sh_dept = Department.objects.get(code='S&H')
sh_batch = Batch.objects.create(
    batch_year=batch_year,
    name='2024-2028',
    department=sh_dept,  # S&H department
    course=None,  # No course for Year 1
    start_year=2024,
    end_year=2028
)
```

#### Step 2.2: Create S&H Sections
```python
from academics.models import Section, Semester

sem1 = Semester.objects.get(number=1)

# Create sections A-L (adjust as needed)
for section_name in ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']:
    Section.objects.create(
        name=section_name,
        batch=sh_batch,
        semester=sem1,
        managing_department=sh_dept  # S&H manages these sections
    )
```

#### Step 2.3: Prepare Import Template

**Excel Template Columns:**
| reg_no | username | first_name | last_name | email | section | home_department_code | status |
|--------|----------|------------|-----------|-------|---------|---------------------|---------|
| 2024AI01 | 2024AI01 | Arun | Kumar | arun@example.com | S&H/2024-2028/A | AI&DS | ACTIVE |
| 2024AI02 | 2024AI02 | Priya | Sharma | priya@example.com | S&H/2024-2028/A | AI&DS | ACTIVE |
| 2024EE01 | 2024EE01 | Rahul | Verma | rahul@example.com | S&H/2024-2028/B | EEE | ACTIVE |

**Important:**
- `section`: Format as "dept/batch/section" → "S&H/2024-2028/A"
- `home_department_code`: Core department code (AI&DS, EEE, ECE, etc.)
- This `home_department` will NEVER change, even when section changes

#### Step 2.4: Import Students
```bash
# Via API endpoint
POST /api/academics/students/import/
Content-Type: multipart/form-data

file: <upload students.xlsx>
```

Or via Django Admin:
1. Navigate to Students → Import Students
2. Upload Excel file
3. Review preview
4. Confirm import

---

### **PHASE 3: Semester Transitions**

#### Step 3.1: End of Semester 1 → Start Semester 2
```python
# Simply update the academic year parity
ay = AcademicYear.objects.get(name='2024-2025', parity='ODD')
ay.is_active = False
ay.save()

ay_even = AcademicYear.objects.get(name='2024-2025', parity='EVEN')
ay_even.is_active = True
ay_even.save()

# Sections auto-calculate and students see Semester 2
# Students remain in same S&H sections, no migration needed
```

---

### **PHASE 4: Year 2 Promotion (Critical Step)**

#### Step 4.1: Create Core Department Batches (Before Promotion)
```python
from academics.models import Batch, Course, Department, BatchYear
from curriculum.models import Regulation

# Get shared resources
batch_year = BatchYear.objects.get(name='2024-2028')
regulation = Regulation.objects.get(name='R2024')  # Adjust as needed

# Create batch for each core department
core_depts = Department.objects.exclude(code='S&H').exclude(parent__isnull=False)

for dept in core_depts:
    # Find course for this department
    course = Course.objects.filter(department=dept).first()
    if not course:
        print(f"Warning: No course found for {dept.code}, skipping")
        continue
    
    # Create core batch
    Batch.objects.get_or_create(
        batch_year=batch_year,
        course=course,
        defaults={
            'name': '2024-2028',
            'start_year': 2024,
            'end_year': 2028,
            'regulation': regulation,
        }
    )
    print(f"Created batch for {dept.code}")
```

#### Step 4.2: Activate Year 2 Academic Year
```python
# Before running promotion, activate the new academic year
AcademicYear.objects.update(is_active=False)
ay = AcademicYear.objects.get(name='2025-2026', parity='ODD')
ay.is_active = True
ay.save()
```

#### Step 4.3: Run Promotion Command
```bash
cd backend
python manage.py promote_year1_students \
    --batch-name "2024-2028" \
    --target-sem 3 \
    --section-name "A" \
    --dry-run  # First run as dry-run to preview

# If dry-run looks good, run for real:
python manage.py promote_year1_students \
    --batch-name "2024-2028" \
    --target-sem 3 \
    --section-name "A"
```

**What This Does:**
1. Finds all students in S&H sections for batch "2024-2028"
2. For each student:
   - Reads their `home_department` (AI&DS, EEE, etc.)
   - Ends current S&H section assignment
   - Creates/finds core dept batch and Section/3/A
   - Assigns student to new core section
3. Students now appear under their core department HODs/staff

#### Step 4.4: Verify Promotion
```python
# Check student assignments
from academics.models import StudentProfile

student = StudentProfile.objects.get(reg_no='2024AI01')
print(f"Current section: {student.current_section}")
print(f"Home department: {student.home_department}")

# Check history
for assignment in student.section_assignments.all():
    print(f"{assignment.section} | {assignment.start_date} - {assignment.end_date or 'Current'}")
```

---

## Automation Opportunities

### Option 1: Scheduled Promotion (Using Academic Calendar)

Create a management command or Celery task:

```python
# academics/management/commands/auto_promote_if_due.py
from django.core.management.base import BaseCommand
from academic_calendar.models import AcademicCalendarEvent
from django.utils import timezone

class Command(BaseCommand):
    def handle(self, *args, **options):
        # Check if there's a "Year 2 Promotion" event scheduled for today
        today = timezone.now().date()
        promotion_events = AcademicCalendarEvent.objects.filter(
            title__icontains='Year 2 Promotion',
            start_date__lte=today,
            end_date__gte=today
        )
        
        if promotion_events.exists():
            # Run promotion for all Year 1 batches
            # ... call promote_year1_students logic here
            pass
```

Schedule with cron:
```bash
# Run every day at 2 AM
0 2 * * * cd /path/to/backend && python manage.py auto_promote_if_due
```

### Option 2: Manual UI Trigger

Create a view/button in the admin panel:

```python
# academics/admin_actions.py
from django.contrib import admin
from django.shortcuts import render, redirect
from django.contrib import messages

@admin.action(description='Promote Year 1 students to core departments')
def promote_year1_action(modeladmin, request, queryset):
    # Show confirmation page with batch selection
    if request.POST.get('confirm'):
        batch_name = request.POST.get('batch_name')
        # Run promotion logic
        # ... call promote_year1_students
        messages.success(request, f'Promoted students from batch {batch_name}')
        return redirect(request.path)
    
    return render(request, 'admin/promote_year1_confirm.html', {
        'batches': queryset,
    })
```

---

## Data Integrity Checks

### Check 1: Verify S&H Configuration
```python
from academics.models import Department

sh_dept = Department.objects.filter(is_sh_main=True).first()
if not sh_dept:
    print("❌ ERROR: No department has is_sh_main=True!")
else:
    print(f"✅ S&H Department: {sh_dept.code}")
```

### Check 2: Verify All Students Have home_department
```python
from academics.models import StudentProfile

students_without_home = StudentProfile.objects.filter(home_department__isnull=True)
if students_without_home.exists():
    print(f"⚠️  WARNING: {students_without_home.count()} students missing home_department:")
    for s in students_without_home[:10]:
        print(f"  - {s.reg_no}: section={s.section}")
else:
    print("✅ All students have home_department set")
```

### Check 3: Verify Active S&H Students
```python
from academics.models import StudentSectionAssignment, Department

sh_dept = Department.objects.get(is_sh_main=True)
active_sh = StudentSectionAssignment.objects.filter(
    end_date__isnull=True,
    section__managing_department=sh_dept
)
print(f"📊 Active S&H students: {active_sh.count()}")
```

### Check 4: Verify Core Department Batches Exist
```python
from academics.models import Batch, Department, BatchYear

batch_year = BatchYear.objects.get(name='2024-2028')
core_depts = Department.objects.exclude(code='S&H')

for dept in core_depts:
    core_batch = Batch.objects.filter(
        batch_year=batch_year,
        course__department=dept
    ).first()
    
    if core_batch:
        print(f"✅ {dept.code}: Batch exists")
    else:
        print(f"❌ {dept.code}: No batch found! Create before promotion.")
```

---

## Common Issues & Solutions

### Issue 1: Students not showing in S&H HOD view
**Cause:** Section's `managing_department` not set to S&H  
**Solution:**
```python
from academics.models import Section, Department
sh_dept = Department.objects.get(is_sh_main=True)
Section.objects.filter(batch__department=sh_dept).update(managing_department=sh_dept)
```

### Issue 2: Promotion command fails with "No batch found"
**Cause:** Core department batches not created  
**Solution:** Run Step 4.1 to create core batches before promotion

### Issue 3: Students appear in wrong semester
**Cause:** Academic year parity not updated  
**Solution:** Activate correct academic year (ODD for Sem 1,3,5,7 | EVEN for Sem 2,4,6,8)

### Issue 4: home_department is NULL after import
**Cause:** Import template missing `home_department_code` column  
**Solution:** Add column to import template and re-import, or manually update:
```python
from academics.models import StudentProfile, Department
for student in StudentProfile.objects.filter(home_department__isnull=True):
    # Infer from reg_no pattern (e.g., 2024AI01 → AI&DS)
    dept_code = student.reg_no[4:6]  # Adjust regex as needed
    dept = Department.objects.get(code__icontains=dept_code)
    student.home_department = dept
    student.save()
```

---

## Permission Management

### S&H Department Access (Year 1)
- **S&H HOD**: Full control over S&H sections
- **S&H AHOD**: Full control over S&H sections  
- **S&H Staff**: View/edit students in assigned S&H sections
- **Core Dept HOD**: Cannot see students yet (in S&H management)

### Core Department Access (Year 2+)
- **Core HOD**: Full control over core dept sections
- **Core AHOD**: Full control over core dept sections
- **Core Staff**: View/edit students in assigned core sections  
- **S&H Staff**: Cannot see students anymore (moved to core)

Permissions are role-based and automatically filtered by department!

---

## Calendar Integration

### Academic Calendar Events to Create:

1. **New Student Registration** (Before Sem 1)
   - Import deadline
   - Department: S&H
   - Trigger: Import workflow

2. **Semester 1 Start** (Academic Year activation)
   - Date: First day of classes
   - Action: Activate Academic Year 2024-2025 (ODD)

3. **Semester 2 Start**
   - Date: First day of Sem 2
   - Action: Activate Academic Year 2024-2025 (EVEN)

4. **Year 2 Promotion** (Critical!)
   - Date: Before Semester 3 starts
   - Action: Run `promote_year1_students` command
   - Department: ALL
   - Year: 1

5. **Semester 3 Start**
   - Date: First day of Year 2
   - Action: Activate Academic Year 2025-2026 (ODD)

---

## Summary Checklist

### One-Time Setup ☑️
- [ ] Mark S&H department with `is_sh_main=True`
- [ ] Create Academic Years (4 years × 2 semesters = 8 entries)
- [ ] Create Semesters (1-8)
- [ ] Create core department Courses
- [ ] Configure permissions and roles

### Annual First-Year Import ☑️
- [ ] Create BatchYear (e.g., "2024-2028")
- [ ] Create S&H Batch (department=S&H, no course)
- [ ] Create S&H Sections (A-L, all with managing_department=S&H)
- [ ] Prepare import template with home_department_code column
- [ ] Import students via API/Admin
- [ ] Verify all students have home_department set
- [ ] Activate Academic Year for Semester 1

### Semester Transitions ☑️
- [ ] Update Academic Year parity (ODD ↔ EVEN)
- [ ] Sections auto-recalculate semester numbering
- [ ] No student reassignment needed within same year

### Year 2 Promotion (Critical!) ☑️
- [ ] Create core department batches for the batch year
- [ ] Activate Year 2 Academic Year (2025-2026 ODD)
- [ ] Run `promote_year1_students` with --dry-run first
- [ ] Review dry-run output
- [ ] Run actual promotion command
- [ ] Verify students moved to core departments
- [ ] Notify HODs and staff of transition

---

## Questions & Support

For issues or questions about this flow:
1. Check "Common Issues & Solutions" section above
2. Run data integrity checks
3. Review promotion command logs
4. Check academic year activation status

**Key Files:**
- Models: `backend/academics/models.py`
- Promotion Command: `backend/academics/management/commands/promote_year1_students.py`
- Import Views: `backend/academics/student_import_views.py`
