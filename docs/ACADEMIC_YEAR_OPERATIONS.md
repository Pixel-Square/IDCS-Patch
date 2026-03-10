# Academic Year Operations - Quick Reference

## 🗓️ Annual Academic Calendar

### **Timeline Overview**

```
JUNE - JULY (Year 1 Start)
├─ Import new first-year students
├─ Assign to S&H sections (A-L)
├─ Activate Academic Year: 2024-2025 (ODD)
└─ Status: Students in S&H Department

DECEMBER (Semester 2 Start)  
├─ Switch Academic Year: 2024-2025 (EVEN)
└─ Status: Students remain in S&H

JUNE - JULY (Year 2 Start) ⚠️ CRITICAL
├─ Create core department batches
├─ Activate Academic Year: 2025-2026 (ODD)
├─ Run promote_year1_students command
└─ Status: Students moved to core departments (AI&DS, EEE, etc.)

DECEMBER (Semester 4 Start)
├─ Switch Academic Year: 2025-2026 (EVEN)
└─ Status: Continue in core departments

... Year 3 & 4 follow same pattern (ODD → EVEN)
```

---

## 📥 Annual Student Import (Every June/July)

### **Pre-Import Checklist**
- [ ] Academic Year for Semester 1 exists and is activated
- [ ] S&H department has `is_sh_main=True`
- [ ] BatchYear created (e.g., "2024-2028")
- [ ] S&H Batch created (name="2024-2028", department=S&H, course=NULL)
- [ ] S&H Sections created (A-L, semester=1, managing_department=S&H)

### **Import Command (Django Shell)**
```python
from academics.models import *

# 1. Create BatchYear
by, _ = BatchYear.objects.get_or_create(
    name='2024-2028',
    defaults={'start_year': 2024, 'end_year': 2028}
)

# 2. Create S&H Batch
sh_dept = Department.objects.get(code='S&H')
sh_batch, _ = Batch.objects.get_or_create(
    name='2024-2028',
    department=sh_dept,
    defaults={
        'batch_year': by,
        'start_year': 2024,
        'end_year': 2028
    }
)

# 3. Create S&H Sections
sem1 = Semester.objects.get(number=1)
for letter in 'ABCDEFGHIJKL':
    Section.objects.get_or_create(
        name=letter,
        batch=sh_batch,
        defaults={
            'semester': sem1,
            'managing_department': sh_dept
        }
    )
```

### **Import Excel Template**
| Column | Required | Example | Notes |
|--------|----------|---------|-------|
| reg_no | ✅ | 2024AI01 | Unique registration number |
| username | ✅ | 2024AI01 | Usually same as reg_no |
| first_name | ✅ | Arun | Student first name |
| last_name | ✅ | Kumar | Student last name |
| email | ✅ | arun@college.edu | Valid email |
| section | ✅ | S&H/2024-2028/A | Format: dept/batch/section |
| **home_department_code** | ✅ | AI&DS | **Core dept - PERMANENT!** |
| status | ⚠️ | ACTIVE | Default: ACTIVE |

**Critical:** `home_department_code` must be the student's **final degree department**, not S&H!

### **Import Steps**
1. Prepare Excel file using template
2. Navigate to Admin → Students → Import
3. Upload file
4. Review preview (check home_department is correct!)
5. Confirm import
6. **Verify**: All students have `home_department` set

---

## 🔄 Semester Transitions (Every 6 Months)

### **Semester 1 → 2 (December)**
```python
# Deactivate Semester 1
AcademicYear.objects.filter(name='2024-2025', parity='ODD').update(is_active=False)

# Activate Semester 2
AcademicYear.objects.filter(name='2024-2025', parity='EVEN').update(is_active=True)
```

**Result:** Students auto-switch to Semester 2, remain in S&H sections

### **Semester 2 → 3 (June/July) ⚠️ REQUIRES PROMOTION**
See "Year 2 Promotion" section below!

### **All Other Transitions (Sem 3→4, 4→5, etc.)**
```python
# Toggle parity
# For ODD semesters (3,5,7): PARITY=ODD
# For EVEN semesters (4,6,8): PARITY=EVEN

AcademicYear.objects.update(is_active=False)
AcademicYear.objects.filter(name='<YEAR>', parity='<ODD/EVEN>').update(is_active=True)
```

---

## ⬆️ Year 2 Promotion (Once Per Batch)

### **Pre-Promotion Checklist**
- [ ] All first-year students have `home_department` set
- [ ] Core department courses exist (AI&DS, EEE, ECE, etc.)
- [ ] Core batches created for each department
- [ ] Academic Year for Semester 3 created and activated
- [ ] S&H sections for previous year are closed (optional)

### **Step 1: Create Core Department Batches**
```python
from academics.models import *
from curriculum.models import Regulation

batch_year = BatchYear.objects.get(name='2024-2028')
regulation = Regulation.objects.first()  # Or specific regulation

# Get all core departments (exclude S&H and sub-departments)
core_depts = Department.objects.filter(
    parent__isnull=True
).exclude(code='S&H')

for dept in core_depts:
    # Find course for this department
    course = Course.objects.filter(department=dept).first()
    if not course:
        print(f"⚠️  {dept.code}: No course found, skipping")
        continue
    
    # Create batch
    batch, created = Batch.objects.get_or_create(
        name='2024-2028',
        course=course,
        defaults={
            'batch_year': batch_year,
            'start_year': 2024,
            'end_year': 2028,
            'regulation': regulation
        }
    )
    status = "Created" if created else "Exists"
    print(f"✅ {dept.code}: {status}")
```

### **Step 2: Activate Year 2 Academic Year**
```python
# Deactivate all years
AcademicYear.objects.update(is_active=False)

# Activate Semester 3 (Year 2 ODD)
AcademicYear.objects.filter(name='2025-2026', parity='ODD').update(is_active=True)
```

### **Step 3: Dry Run Promotion**
```bash
cd backend
python manage.py promote_year1_students \
    --batch-name "2024-2028" \
    --target-sem 3 \
    --section-name "A" \
    --dry-run
```

**Review output carefully:**
- Check number of students found
- Verify home departments are correct
- Look for any "SKIP" messages (indicates missing data)

### **Step 4: Execute Promotion**
```bash
python manage.py promote_year1_students \
    --batch-name "2024-2028" \
    --target-sem 3 \
    --section-name "A"
```

### **Step 5: Verify Promotion**
```python
from academics.models import StudentProfile, Department

# Check sample students
test_students = ['2024AI01', '2024EE01', '2024EC01']
for reg_no in test_students:
    s = StudentProfile.objects.get(reg_no=reg_no)
    print(f"{reg_no}:")
    print(f"  Home Dept: {s.home_department.code}")
    print(f"  Current Section: {s.current_section}")
    print(f"  Managing Dept: {s.current_section.batch.effective_department.code}")
    print()

# Count students by department after promotion
from django.db.models import Count
Department.objects.annotate(
    student_count=Count('course__batches__sections__students')
).values('code', 'student_count')
```

### **Step 6: Notify Departments**
Send notifications to:
- Core department HODs/AHODs (students now under their management)
- S&H HOD/AHOD (students moved out)
- Faculty advisors (section assignments changed)

---

## 🔍 Data Integrity Checks

### **Pre-Semester Checks**
```python
from academics.models import *

# 1. Active Academic Year
active_ay = AcademicYear.objects.filter(is_active=True)
print(f"Active Academic Year: {active_ay.count()} (should be 1)")
for ay in active_ay:
    print(f"  → {ay.name} ({ay.parity})")

# 2. Students without home_department
orphans = StudentProfile.objects.filter(home_department__isnull=True)
print(f"\nStudents without home_department: {orphans.count()}")
if orphans.exists():
    print("  ⚠️  Fix before promotion!")

# 3. Active S&H students
sh_dept = Department.objects.get(is_sh_main=True)
sh_students = StudentSectionAssignment.objects.filter(
    end_date__isnull=True,
    section__managing_department=sh_dept
).count()
print(f"\nActive S&H students: {sh_students}")

# 4. Core department batch check (before promotion)
batch_year = BatchYear.objects.get(name='2024-2028')
core_batches = Batch.objects.filter(
    batch_year=batch_year,
    course__isnull=False
)
print(f"\nCore department batches: {core_batches.count()}")
for b in core_batches:
    print(f"  → {b.course.department.code}")
```

### **Post-Promotion Validation**
```python
from academics.models import *

batch_name = '2024-2028'

# Students still in S&H (should be 0 after promotion)
sh_remaining = StudentSectionAssignment.objects.filter(
    end_date__isnull=True,
    section__managing_department__is_sh_main=True,
    section__batch__name=batch_name
).count()
print(f"Students still in S&H: {sh_remaining} (should be 0)")

# Students in core departments
core_students = StudentSectionAssignment.objects.filter(
    end_date__isnull=True,
    section__batch__name=batch_name,
    section__managing_department__isnull=True  # Core sections have no override
).count()
print(f"Students in core departments: {core_students}")

# Section assignment history
sample = StudentProfile.objects.filter(
    section__batch__name=batch_name
).first()
if sample:
    print(f"\nSample student history ({sample.reg_no}):")
    for assignment in sample.section_assignments.order_by('start_date'):
        status = "CURRENT" if assignment.end_date is None else assignment.end_date
        print(f"  {assignment.start_date} - {status}: {assignment.section}")
```

---

## 🚨 Emergency Operations

### **Rollback Promotion (Use with caution!)**
```python
from academics.models import *
from datetime import date

# Only use if promotion just happened and needs to be reversed!
batch_name = '2024-2028'
promotion_date = date(2025, 6, 15)  # Date promotion was run

# Find all assignments created on promotion date
new_assignments = StudentSectionAssignment.objects.filter(
    start_date=promotion_date,
    section__batch__name=batch_name,
    section__semester__number=3
)

print(f"Found {new_assignments.count()} assignments to rollback")

# Reverse each one
for assignment in new_assignments:
    student = assignment.student
    
    # Delete new assignment
    assignment.delete()
    
    # Reactivate previous S&H assignment
    prev = StudentSectionAssignment.objects.filter(
        student=student,
        end_date=promotion_date
    ).order_by('-start_date').first()
    
    if prev:
        prev.end_date = None
        prev.save()
        print(f"Rolled back {student.reg_no}")
    else:
        print(f"⚠️  Could not find previous assignment for {student.reg_no}")
```

### **Fix Missing home_department**
```python
from academics.models import StudentProfile, Department

# For students without home_department, infer from section
orphans = StudentProfile.objects.filter(home_department__isnull=True)

for student in orphans:
    # Try to infer from section's batch
    if student.section:
        batch = student.section.batch
        if batch.course:
            inferred_dept = batch.course.department
            student.home_department = inferred_dept
            student.save()
            print(f"✅ {student.reg_no} → {inferred_dept.code}")
        else:
            print(f"⚠️  {student.reg_no}: In S&H batch, cannot infer. Manual fix needed.")
    else:
        print(f"❌ {student.reg_no}: No section assigned!")
```

### **Bulk Reassign to Different Section**
```python
from academics.models import *

# Move students from one section to another
source_section = Section.objects.get(batch__name='2024-2028', name='A', semester__number=3)
target_section = Section.objects.get(batch__name='2024-2028', name='B', semester__number=3)

# Get current assignments
assignments = StudentSectionAssignment.objects.filter(
    section=source_section,
    end_date__isnull=True
)

print(f"Moving {assignments.count()} students from {source_section} to {target_section}")

for assignment in assignments:
    # End current assignment
    assignment.end_date = date.today()
    assignment.save()
    
    # Create new one
    StudentSectionAssignment.objects.create(
        student=assignment.student,
        section=target_section,
        start_date=date.today()
    )
```

---

## 📊 Useful Reports

### **Students by Department and Year**
```python
from academics.models import *
from django.db.models import Count

# Group by department and batch year
report = Department.objects.annotate(
    student_count=Count('course__batches__sections__students', distinct=True)
).values('code', 'short_name', 'student_count').order_by('-student_count')

for dept in report:
    print(f"{dept['code']:10s} ({dept['short_name']:15s}): {dept['student_count']:4d} students")
```

### **Section Capacity Report**
```python
from academics.models import *
from django.db.models import Count

sections = Section.objects.annotate(
    student_count=Count('students')
).select_related('batch', 'semester').order_by('batch__name', 'semester__number', 'name')

print("Section Capacity Report")
print("=" * 60)
for section in sections:
    print(f"{section.batch.name:12s} | Sem {section.semester.number} | {section.name:3s} | {section.student_count:3d} students")
```

### **Home Department vs Current Section Mismatch**
```python
from academics.models import *

# Find students where home_department doesn't match current section's department
# (Expected for Year 1 S&H students, but not for Year 2+)

students = StudentProfile.objects.select_related(
    'home_department',
    'section__batch__course__department',
    'section__managing_department'
).exclude(home_department__isnull=True)

mismatches = []
for student in students:
    home = student.home_department
    current_dept = student.section.managing_department or (
        student.section.batch.course.department if student.section.batch.course else None
    )
    
    if current_dept and home != current_dept:
        mismatches.append({
            'reg_no': student.reg_no,
            'home': home.code,
            'current': current_dept.code,
            'section': str(student.section)
        })

print(f"Found {len(mismatches)} students with department mismatch:")
for m in mismatches[:20]:  # Show first 20
    print(f"  {m['reg_no']:15s} | Home: {m['home']:10s} | Current: {m['current']:10s} | {m['section']}")
```

---

## 💡 Best Practices

### **DO:**
- ✅ Always run `--dry-run` first for promotion
- ✅ Backup database before major operations
- ✅ Verify `home_department` is set before promotion
- ✅ Create core batches before running promotion
- ✅ Activate correct academic year before semester start
- ✅ Document special cases or manual fixes
- ✅ Test import with small batch first

### **DON'T:**
- ❌ Change student's `home_department` after Year 2 promotion
- ❌ Delete batches that have students assigned
- ❌ Run promotion without creating core batches first
- ❌ Forget to activate academic year after semester change
- ❌ Import students without `home_department_code` column
- ❌ Manually edit `StudentSectionAssignment` without using signals
- ❌ Run promotion commands on production without dry-run

---

## 📞 Support Contacts

**For Technical Issues:**
- Check `/docs/FIRST_YEAR_SH_FLOW_GUIDE.md` for detailed documentation
- Review Django logs: `backend/logs/`
- Check Sentry/error tracking if configured

**For Data Issues:**
- Run integrity checks in this document
- Review student import logs
- Check academic year activation status

**For Promotion Issues:**
- Verify all pre-promotion checklist items
- Check promotion command output carefully
- Look for "SKIP" messages indicating missing data
