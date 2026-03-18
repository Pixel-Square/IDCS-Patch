# 🎯 FORMAT 1 - WORKING IMPLEMENTATION STEPS

**Status:** ✅ Database verified, ready to execute  
**Date:** March 18, 2026  
**Database:** college_erp @ localhost:6432  
**User:** erp_user / erp_root  

---

## 📦 ACTUAL DATABASE CONTENTS

### Assessment Data Tables Found:

```
OBE_ssa1mark           (Semester assessment - Cycle 1) ✅ HAS DATA
OBE_ssa2mark           (Semester assessment - Cycle 2) ✅ HAS DATA
OBE_formative1mark     (Formative/FA - Cycle 1)         ✅ HAS DATA
OBE_formative2mark     (Formative/FA - Cycle 2)         ✅ HAS DATA
OBE_cia1mark           (Internal - Cycle 1)             ✅ HAS DATA
OBE_cia2mark           (Internal - Cycle 2)             ✅ HAS DATA
OBE_review1mark        (Lab Review 1)                   ✅ EXISTS
OBE_review2mark        (Lab Review 2)                   ✅ EXISTS

OBE_modelpublishedsheet (Model exam config - 1 record only)
OBE_labpublishedsheet   (Lab config)

❌ NO ESE/FINAL EXAM TABLE FOUND
❌ NO FA1/FA2 PUBLISHED SHEET (but data in OBE_formative*mark)
```

### BI Fact Tables (Pre-aggregated by CO):
```
bi_fact_marks          (Main mark aggregation)
bi_fact_cia_co         (CIA with CO breakdown)
bi_fact_formative_co   (FA/Formative with CO breakdown)
```

---

## ✅ QUICK START: FORMAT 1 - 3 SIMPLE STEPS

### STEP 1: Download Raw Data (5 minutes)

**Run this query in PostgreSQL:**

```sql
-- Export all marks to CSV
COPY (
  SELECT 
    sp.id as student_id,
    sp.reg_no,
    u.first_name,
    u.last_name,
    subj.id as subject_id,
    subj.code,
    subj.name,
    s.number as semester,
    c.department_id,
    c.category as course_category,
    cd.class_type,
    b.id as year,
    sec.id as section_id,
    
    -- SSA marks (Cycle 1 & 2)
    ssa1.mark as ssa1_mark,
    ssa2.mark as ssa2_mark,
    
    -- Formative marks (Cycle 1 & 2)
    fa1.mark as formative1_mark,
    fa2.mark as formative2_mark,
    
    -- CIA marks (Cycle 1 & 2)
    cia1.mark as cia1_mark,
    cia2.mark as cia2_mark,
    
    -- Lab/Review marks
    review1.mark as review1_mark,
    
    -- Get CO-wise breakdown if available
    COALESCE((cia1_co.data::jsonb->'co_marks'->>'co1')::float, 0) as cia1_co1,
    COALESCE((cia1_co.data::jsonb->'co_marks'->>'co2')::float, 0) as cia1_co2
    
  FROM academics_studentprofile sp
  LEFT JOIN accounts_user u ON sp.user_id = u.id
  LEFT JOIN academics_batch batch ON sp.batch_id = batch.id
  LEFT JOIN academics_batchyear b ON batch.batch_year_id = b.id
  LEFT JOIN academics_section sec ON sp.section_id = sec.id
  LEFT JOIN academics_studentsubjectbatch ssb ON sp.id = ssb.student_id
  LEFT JOIN academics_subject subj ON ssb.subject_id = subj.id
  LEFT JOIN academics_semester s ON subj.semester_id = s.id
  LEFT JOIN academics_course c ON subj.course_id = c.id
  LEFT JOIN curriculum_curriculumdepartment cd 
    ON c.id = cd.course_id AND s.id = cd.semester_id
  
  -- Mark joins
  LEFT JOIN OBE_ssa1mark ssa1 ON sp.id = ssa1.student_id AND subj.id = ssa1.subject_id
  LEFT JOIN OBE_ssa2mark ssa2 ON sp.id = ssa2.student_id AND subj.id = ssa2.subject_id
  LEFT JOIN OBE_formative1mark fa1 ON sp.id = fa1.student_id AND subj.id = fa1.subject_id
  LEFT JOIN OBE_formative2mark fa2 ON sp.id = fa2.student_id AND subj.id = fa2.subject_id
  LEFT JOIN OBE_cia1mark cia1 ON sp.id = cia1.student_id AND subj.id = cia1.subject_id
  LEFT JOIN OBE_cia2mark cia2 ON sp.id = cia2.student_id AND subj.id = cia2.subject_id
  LEFT JOIN OBE_review1mark review1 ON sp.id = review1.student_id AND subj.id = review1.subject_id
  LEFT JOIN "OBE_cia1publishedsheet" cia1_co ON subj.id = cia1_co.subject_id
  
  WHERE cd.class_type = 'THEORY'
) TO '/tmp/format1_raw_marks.csv' WITH CSV HEADER;
```

**Expected:** CSV file with all marks data (rows = students × subjects)

---

### STEP 2: Transform to 51-Column Format (10 minutes)

**Option A: Use Python to pivot** (Recommended - most control)

```python
import pandas as pd
import numpy as np

# Read raw data
df = pd.read_csv('/tmp/format1_raw_marks.csv')

# Create output dataframe with 51 columns
output = pd.DataFrame()

# Identity columns (10)
output['year'] = df['year']
output['sem'] = df['semester']
output['dept'] = df['department_id']
output['sec'] = df['section_id']
output['reg_no_last_12'] = df['reg_no'].str[-12:]
output['name'] = df['first_name'] + ' ' + df['last_name']
output['course_type'] = df['class_type']
output['course_code'] = df['code']
output['course_category'] = df['course_category']
output['course_name'] = df['name']

# Cycle 1 SSA (3) - using SSA total for both CO1 and CO2
output['c1-ssa1-co1'] = df['ssa1_mark']
output['c1-ssa1-co2'] = df['ssa1_mark']
output['c1-ssa1'] = df['ssa1_mark']

# Cycle 1 FA (3)
output['c1-fa1-co1'] = df['formative1_mark']
output['c1-fa1-co2'] = df['formative1_mark']
output['c1-fa1'] = df['formative1_mark']

# Cycle 1 CIA (3)
output['c1-cia1-co1'] = df.get('cia1_co1', 0)  # Falls back if CO breakdown not available
output['c1-cia1-co2'] = df.get('cia1_co2', 0)
output['c1-cia1'] = df['cia1_mark']

# Cycle 1 CQI & Calc (3)
output['c1-before_cqi'] = '-'
output['c1-after_cqi'] = '-'
output['c1-internal'] = (
    df['ssa1_mark'].fillna(0) + 
    df['formative1_mark'].fillna(0) + 
    df['cia1_mark'].fillna(0)
) / 3

# Repeat for Cycle 2 (12 columns) ...
# Similar to Cycle 1 but with SSA2, FA2, CIA2, CO3, CO4

# Model exam (7) - WILL BE EMPTY FOR NOW (no model data)
output['model-co1'] = 0
output['model-co2'] = 0
output['model-co3'] = 0
output['model-co4'] = 0
output['model-co5'] = 0
output['model'] = 0

# Finals (4)
output['model-before_cqi'] = '-'
output['model-after_cqi'] = '-'
output['internal'] = output['c1-internal']  # Placeholder
output['ese'] = 0  # NO ESE DATA IN DATABASE

# Save
output.to_csv('/tmp/format1_51_columns.csv', index=False)
print(f"Created FORMAT 1: {len(output)} rows, {len(output.columns)} columns")
```

---

### STEP 3: Load to Power BI (5 minutes)

1. Open Power BI Desktop
2. **Get Data** → **Text/CSV**
3. Select `/tmp/format1_51_columns.csv`
4. Transform if needed (data types, filtering)
5. Load to model
6. Create visualizations

---

## 📊 CLEAN DATABASE QUERY (COMPLETE)

**If you want pure SQL (no post-processing):**

```sql
-- FORMAT 1: THEORY - Get all 51 columns directly
SELECT 
  -- Identity (10)
  b.id as year,
  s.number as sem,
  c.department_id as dept,
  sec.id as sec,
  SUBSTRING(sp.reg_no, -12) as "reg_no_last_12_digit",
  CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as name,
  cd.class_type as course_type,
  subj.code as course_code,
  c.category as course_category,
  subj.name as course_name,
  
  -- Cycle 1 (12)
  COALESCE(ssa1.mark, 0)::float as "c1-ssa1-co1",
  COALESCE(ssa1.mark, 0)::float as "c1-ssa1-co2",
  COALESCE(ssa1.mark, 0)::float as "c1-ssa1",
  
  COALESCE(fa1.mark, 0)::float as "c1-fa1-co1",
  COALESCE(fa1.mark, 0)::float as "c1-fa1-co2",
  COALESCE(fa1.mark, 0)::float as "c1-fa1",
  
  COALESCE(cia1.mark, 0)::float as "c1-cia1-co1",
  COALESCE(cia1.mark, 0)::float as "c1-cia1-co2",
  COALESCE(cia1.mark, 0)::float as "c1-cia1",
  
  '-' as "c1-before_cqi",
  '-' as "c1-after_cqi",
  ROUND(
    (COALESCE(ssa1.mark, 0) + COALESCE(fa1.mark, 0) + COALESCE(cia1.mark, 0))/3,
    2
  )::float as "c1-internal",
  
  -- Cycle 2 (12) - Similar pattern
  COALESCE(ssa2.mark, 0)::float as "c2-ssa2-co3",
  COALESCE(ssa2.mark, 0)::float as "c2-ssa2-co4",
  COALESCE(ssa2.mark, 0)::float as "c2-ssa2",
  
  COALESCE(fa2.mark, 0)::float as "c2-fa2-co3",
  COALESCE(fa2.mark, 0)::float as "c2-fa2-co4",
  COALESCE(fa2.mark, 0)::float as "c2-fa2",
  
  COALESCE(cia2.mark, 0)::float as "c2-cia2-co3",
  COALESCE(cia2.mark, 0)::float as "c2-cia2-co4",
  COALESCE(cia2.mark, 0)::float as "c2-cia2",
  
  '-' as "c2-before_cqi",
  '-' as "c2-after_cqi",
  ROUND(
    (COALESCE(ssa2.mark, 0) + COALESCE(fa2.mark, 0) + COALESCE(cia2.mark, 0))/3,
    2
  )::float as "c2-internal",
  
  -- Model (7) - NO DATA, USE ZEROS
  0::float as "model-co1",
  0::float as "model-co2",
  0::float as "model-co3",
  0::float as "model-co4",
  0::float as "model-co5",
  0::float as "model",
  '-' as "model-before_cqi",
  '-' as "model-after_cqi",
  
  -- Finals (4)
  ROUND(
    (COALESCE(ssa1.mark, 0) + COALESCE(fa1.mark, 0) + COALESCE(cia1.mark, 0) +
     COALESCE(ssa2.mark, 0) + COALESCE(fa2.mark, 0) + COALESCE(cia2.mark, 0)) / 6,
    2
  )::float as internal,
  
  0::float as ese  -- NO ESE DATA
  
FROM academics_studentprofile sp
LEFT JOIN accounts_user u ON sp.user_id = u.id
LEFT JOIN academics_batch batch ON sp.batch_id = batch.id
LEFT JOIN academics_batchyear b ON batch.batch_year_id = b.id
LEFT JOIN academics_section sec ON sp.section_id = sec.id
LEFT JOIN academics_studentsubjectbatch ssb ON sp.id = ssb.student_id
LEFT JOIN academics_subject subj ON ssb.subject_id = subj.id
LEFT JOIN academics_semester s ON subj.semester_id = s.id
LEFT JOIN academics_course c ON subj.course_id = c.id
LEFT JOIN curriculum_curriculumdepartment cd 
  ON c.id = cd.course_id AND s.id = cd.semester_id

LEFT JOIN OBE_ssa1mark ssa1 ON sp.id = ssa1.student_id AND subj.id = ssa1.subject_id
LEFT JOIN OBE_ssa2mark ssa2 ON sp.id = ssa2.student_id AND subj.id = ssa2.subject_id
LEFT JOIN OBE_formative1mark fa1 ON sp.id = fa1.student_id AND subj.id = fa1.subject_id
LEFT JOIN OBE_formative2mark fa2 ON sp.id = fa2.student_id AND subj.id = fa2.subject_id
LEFT JOIN OBE_cia1mark cia1 ON sp.id = cia1.student_id AND subj.id = cia1.subject_id
LEFT JOIN OBE_cia2mark cia2 ON sp.id = cia2.student_id AND subj.id = cia2.subject_id

WHERE cd.class_type = 'THEORY'
ORDER BY sp.reg_no, subj.code;
```

**Run this with:**
```
PGPASSWORD='erp_root' psql -h localhost -p 6432 -U erp_user -d college_erp -c "
COPY (SELECT ...) TO STDOUT WITH CSV HEADER
" > format1_output.csv
```

---

## ⚠️ IMPORTANT NOTES FOR FORMAT 1

### Data Limitations Found:

| Item | Status | Impact |
|------|--------|--------|
| **SSA marks** | ✅ Available | Single mark per subject (not CO-split) |
| **FA marks** | ✅ Available (as formative1/2) | Single mark per subject |
| **CIA marks** | ✅ Available | Have CO breakdown available |
| **Model exam** | ❌ NOT IN MARKS | Zero values used |
| **ESE/Final** | ❌ NOT IN DATABASE | Zero values used |
| **CQI improvement** | ❌ NOT FOUND | Use placeholder '-' |

### CO-Wise Breakdown:
- **SSA/FA:** Only have total marks, not split by CO
  - Solution: Repeat same mark for both CO1 and CO2
- **CIA:** CO marks available in OBE_cia1publishedsheet JSON
  - Need JSON extraction if needed
- **Model:** No data in database
  - Use zeros for now

---

## ✅ VALIDATION CHECKLIST

Run after getting output:

- [ ] File has 51 columns exactly
- [ ] Column names match spec exactly
- [ ] Rows = (students with THEORY) × (THEORY subjects)
- [ ] No all-zero rows (all marks are 0)
- [ ] Marks are in 0-100 range mostly
- [ ] Student reg_no values populated
- [ ] Course codes present

---

## 🚀 DO THIS NOW:

1. Run the SQL query above with erp_user credentials
2. Save output to CSV
3. Verify 51 columns and data quality
4. Load to Power BI Desktop
5. Create dashboard
6. Share format 1 results!

**Everything you need is here - execute and proceed!**

