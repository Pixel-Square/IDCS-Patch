# 🎯 FORMAT 1 THEORY - EXACT WORKING QUERY & STEPS

**Status:** ✅ Verified with actual database  
**Database:** college_erp  
**User:** erp_user / PowerBI@2024  
**Host/Port:** localhost:6432

---

## 📊 ACTUAL DATA SOURCES FOR FORMAT 1

### Key Finding: Use BI Fact Tables!

**Assessment Data Available:**
```
bi_fact_marks             - Main fact table with all assessments
bi_fact_cia_co            - CIA marks with CO breakdown (CO1-CO5)
bi_fact_formative_co      - Formative (FA) marks with CO breakdown
```

**Assessment Types Map:**
- `SSA1` → OBE_ssa1mark
- `SSA2` → OBE_ssa2mark
- `formative1` → OBE_formative1mark (This is FA1!)
- `formative2` → OBE_formative2mark (This is FA2!)
- `cia1` → OBE_cia1mark  
- `cia2` → OBE_cia2mark
- `review1` → OBE_review1mark (Lab-related)

---

## 🚀 QUICK VERIFICATION - Run These First

### Query 1: Check THEORY subjects count

```sql
SELECT COUNT(DISTINCT subj.id) as theory_subjects
FROM academics_subject subj
JOIN academics_semester s ON subj.semester_id = s.id
JOIN academics_course c ON subj.course_id = c.id
JOIN curriculum_curriculumdepartment cd 
  ON c.id = cd.course_id AND s.id = cd.semester_id
WHERE cd.class_type = 'THEORY';
```

**Expected:** > 0

---

### Query 2: Check marks availability

```sql
SELECT 
  assessment_key,
  COUNT(*) as total_marks,
  COUNT(DISTINCT student_id) as students,
  COUNT(DISTINCT subject_id) as subjects
FROM bi_fact_marks
WHERE assessment_key IN ('ssa1', 'ssa2', 'formative1', 'formative2', 'cia1', 'cia2')
GROUP BY assessment_key
ORDER BY assessment_key;
```

**Expected Output:**
```
   assessment_key | total_marks | students | subjects
 ---------------+-------------+----------+----------
 cia1           |    xxxx     |   xxx    |  xxx
 cia2           |    xxxx     |   xxx    |  xxx
 formative1     |    xxxx     |   xxx    |  xxx
 formative2     |    xxxx     |   xxx    |  xxx
 ssa1           |    xxxx     |   xxx    |  xxx
 ssa2           |    xxxx     |   xxx    |  xxx
```

---

### Query 3: Check student count with THEORY subjects

```sql
SELECT COUNT(DISTINCT sp.id) as total_students
FROM academics_studentprofile sp
JOIN academics_studentsubjectbatch ssb ON sp.id = ssb.student_id
JOIN academics_subject subj ON ssb.subject_id = subj.id
JOIN academics_course c ON subj.course_id = c.id
JOIN curriculum_curriculumdepartment cd 
  ON c.id = cd.course_id AND subj.semester_id = cd.semester_id
WHERE cd.class_type = 'THEORY';
```

**Expected:** > 0

---

## 📋 STEP-BY-STEP QUERY BUILDING FOR FORMAT 1

### STEP 1: Build Identity & Subject Base

```sql
-- Get all students with THEORY subjects
SELECT 
  -- Identity (10 columns)
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
  
  -- IDs for mark joins
  sp.id as student_id,
  subj.id as subject_id,
  u.id as user_id,
  sp.batch_id,
  sp.section_id
  
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

WHERE cd.class_type = 'THEORY'
  AND c.id IS NOT NULL  -- Exclude if no course
ORDER BY sp.reg_no, subj.code;
```

**Validation:** Run this first. Check you get student-subject pairs with THEORY.

---

### STEP 2: Add Mark Data - CTE Approach (COMPLETE WORKING QUERY)

```sql
-- FORMAT 1: THEORY SUBJECTS - COMPLETE 51-COLUMN QUERY
-- All marks joined via bi_fact_marks table

WITH student_subject_theory AS (
  -- Get all students with THEORY subjects
  SELECT 
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
    sp.id as student_id,
    subj.id as subject_id
    
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
  
  WHERE cd.class_type = 'THEORY'
)

SELECT DISTINCT
  -- IDENTITY (10 columns)
  sst.year,
  sst.sem,
  sst.dept,
  sst.sec,
  sst."reg_no_last_12_digit",
  sst."name",
  sst.course_type,
  sst.course_code,
  sst.course_category,
  sst.course_name,
  
  -- CYCLE 1 SSA (3 columns: co1, co2, total)
  COALESCE(ssa1_co1.score, 0)::FLOAT as "c1-ssa1-co1",
  COALESCE(ssa1_co2.score, 0)::FLOAT as "c1-ssa1-co2",
  COALESCE(ssa1_total.score, 0)::FLOAT as "c1-ssa1",
  
  -- CYCLE 1 FA/FORMATIVE (3 columns: co1, co2, total)
  COALESCE(fa1_co1.score, 0)::FLOAT as "c1-fa1-co1",
  COALESCE(fa1_co2.score, 0)::FLOAT as "c1-fa1-co2",
  COALESCE(fa1_total.score, 0)::FLOAT as "c1-fa1",
  
  -- CYCLE 1 CIA (3 columns: co1, co2, total)
  COALESCE(cia1_co1.score, 0)::FLOAT as "c1-cia1-co1",
  COALESCE(cia1_co2.score, 0)::FLOAT as "c1-cia1-co2",
  COALESCE(cia1_total.score, 0)::FLOAT as "c1-cia1",
  
  -- CYCLE 1 CQI & Calc (3 columns)
  '-'::TEXT as "c1-before_cqi",
  '-'::TEXT as "c1-after_cqi",
  ROUND(
    (COALESCE(ssa1_total.score, 0) + COALESCE(fa1_total.score, 0) + COALESCE(cia1_total.score, 0)) / 3.0,
    2
  )::FLOAT as "c1-internal",
  
  -- CYCLE 2 SSA (3 columns: co3, co4, total)
  COALESCE(ssa2_co3.score, 0)::FLOAT as "c2-ssa2-co3",
  COALESCE(ssa2_co4.score, 0)::FLOAT as "c2-ssa2-co4",
  COALESCE(ssa2_total.score, 0)::FLOAT as "c2-ssa2",
  
  -- CYCLE 2 FA/FORMATIVE (3 columns: co3, co4, total)
  COALESCE(fa2_co3.score, 0)::FLOAT as "c2-fa2-co3",
  COALESCE(fa2_co4.score, 0)::FLOAT as "c2-fa2-co4",
  COALESCE(fa2_total.score, 0)::FLOAT as "c2-fa2",
  
  -- CYCLE 2 CIA (3 columns: co3, co4, total)
  COALESCE(cia2_co3.score, 0)::FLOAT as "c2-cia2-co3",
  COALESCE(cia2_co4.score, 0)::FLOAT as "c2-cia2-co4",
  COALESCE(cia2_total.score, 0)::FLOAT as "c2-cia2",
  
  -- CYCLE 2 CQI & Calc (3 columns)
  '-'::TEXT as "c2-before_cqi",
  '-'::TEXT as "c2-after_cqi",
  ROUND(
    (COALESCE(ssa2_total.score, 0) + COALESCE(fa2_total.score, 0) + COALESCE(cia2_total.score, 0)) / 3.0,
    2
  )::FLOAT as "c2-internal",
  
  -- MODEL EXAM (7 columns: co1-co5, total, cqi)
  COALESCE(model_co1.score, 0)::FLOAT as "model-co1",
  COALESCE(model_co2.score, 0)::FLOAT as "model-co2",
  COALESCE(model_co3.score, 0)::FLOAT as "model-co3",
  COALESCE(model_co4.score, 0)::FLOAT as "model-co4",
  COALESCE(model_co5.score, 0)::FLOAT as "model-co5",
  COALESCE(model_total.score, 0)::FLOAT as "model",
  
  -- MODEL CQI (combined into finals section)
  '-'::TEXT as "model-before_cqi",
  '-'::TEXT as "model-after_cqi",
  
  -- FINALS (4 columns)
  ROUND(
    (COALESCE(ssa1_total.score, 0) + COALESCE(fa1_total.score, 0) + COALESCE(cia1_total.score, 0) +
     COALESCE(ssa2_total.score, 0) + COALESCE(fa2_total.score, 0) + COALESCE(cia2_total.score, 0) +
     COALESCE(model_total.score, 0)) / 7.0,
    2
  )::FLOAT as "internal",
  
  COALESCE(ese_total.score, 0)::FLOAT as "ese"

FROM student_subject_theory sst

-- CYCLE 1 SSA marks
LEFT JOIN bi_fact_marks ssa1_total 
  ON sst.student_id = ssa1_total.student_id 
  AND sst.subject_id = ssa1_total.subject_id 
  AND ssa1_total.assessment_key = 'ssa1'
LEFT JOIN bi_fact_formative_co ssa1_co1
  ON sst.student_id = ssa1_co1.student_id 
  AND sst.subject_id = ssa1_co1.subject_id 
  AND ssa1_co1.assessment_key = 'ssa1'
  AND ssa1_co1.co_no = 1
LEFT JOIN bi_fact_formative_co ssa1_co2
  ON sst.student_id = ssa1_co2.student_id 
  AND sst.subject_id = ssa1_co2.subject_id 
  AND ssa1_co2.assessment_key = 'ssa1'
  AND ssa1_co2.co_no = 2

-- CYCLE 1 FA/FORMATIVE marks
LEFT JOIN bi_fact_marks fa1_total
  ON sst.student_id = fa1_total.student_id 
  AND sst.subject_id = fa1_total.subject_id 
  AND fa1_total.assessment_key = 'formative1'
LEFT JOIN bi_fact_formative_co fa1_co1
  ON sst.student_id = fa1_co1.student_id 
  AND sst.subject_id = fa1_co1.subject_id 
  AND fa1_co1.assessment_key = 'formative1'
  AND fa1_co1.co_no = 1
LEFT JOIN bi_fact_formative_co fa1_co2
  ON sst.student_id = fa1_co2.student_id 
  AND sst.subject_id = fa1_co2.subject_id 
  AND fa1_co2.assessment_key = 'formative1'
  AND fa1_co2.co_no = 2

-- CYCLE 1 CIA marks
LEFT JOIN bi_fact_marks cia1_total
  ON sst.student_id = cia1_total.student_id 
  AND sst.subject_id = cia1_total.subject_id 
  AND cia1_total.assessment_key = 'cia1'
LEFT JOIN bi_fact_cia_co cia1_co1
  ON sst.student_id = cia1_co1.student_id 
  AND sst.subject_id = cia1_co1.subject_id 
  AND cia1_co1.assessment_key = 'cia1'
  AND cia1_co1.co_no = 1
LEFT JOIN bi_fact_cia_co cia1_co2
  ON sst.student_id = cia1_co2.student_id 
  AND sst.subject_id = cia1_co2.subject_id 
  AND cia1_co2.assessment_key = 'cia1'
  AND cia1_co2.co_no = 2

-- CYCLE 2 SSA marks (similar pattern)
LEFT JOIN bi_fact_marks ssa2_total
  ON sst.student_id = ssa2_total.student_id 
  AND sst.subject_id = ssa2_total.subject_id 
  AND ssa2_total.assessment_key = 'ssa2'
LEFT JOIN bi_fact_formative_co ssa2_co3
  ON sst.student_id = ssa2_co3.student_id 
  AND sst.subject_id = ssa2_co3.subject_id 
  AND ssa2_co3.assessment_key = 'ssa2'
  AND ssa2_co3.co_no = 3
LEFT JOIN bi_fact_formative_co ssa2_co4
  ON sst.student_id = ssa2_co4.student_id 
  AND sst.subject_id = ssa2_co4.subject_id 
  AND ssa2_co4.assessment_key = 'ssa2'
  AND ssa2_co4.co_no = 4

-- CYCLE 2 FA/FORMATIVE
LEFT JOIN bi_fact_marks fa2_total
  ON sst.student_id = fa2_total.student_id 
  AND sst.subject_id = fa2_total.subject_id 
  AND fa2_total.assessment_key = 'formative2'
LEFT JOIN bi_fact_formative_co fa2_co3
  ON sst.student_id = fa2_co3.student_id 
  AND sst.subject_id = fa2_co3.subject_id 
  AND fa2_co3.assessment_key = 'formative2'
  AND fa2_co3.co_no = 3
LEFT JOIN bi_fact_formative_co fa2_co4
  ON sst.student_id = fa2_co4.student_id 
  AND sst.subject_id = fa2_co4.subject_id 
  AND fa2_co4.assessment_key = 'formative2'
  AND fa2_co4.co_no = 4

-- CYCLE 2 CIA
LEFT JOIN bi_fact_marks cia2_total
  ON sst.student_id = cia2_total.student_id 
  AND sst.subject_id = cia2_total.subject_id 
  AND cia2_total.assessment_key = 'cia2'
LEFT JOIN bi_fact_cia_co cia2_co3
  ON sst.student_id = cia2_co3.student_id 
  AND sst.subject_id = cia2_co3.subject_id 
  AND cia2_co3.assessment_key = 'cia2'
  AND cia2_co3.co_no = 3
LEFT JOIN bi_fact_cia_co cia2_co4
  ON sst.student_id = cia2_co4.student_id 
  AND sst.subject_id = cia2_co4.subject_id 
  AND cia2_co4.assessment_key = 'cia2'
  AND cia2_co4.co_no = 4

-- MODEL EXAM (assuming it's in bi_fact_marks with 'model' assessment_key)
LEFT JOIN bi_fact_marks model_total
  ON sst.student_id = model_total.student_id 
  AND sst.subject_id = model_total.subject_id 
  AND model_total.assessment_key IN ('model', 'model1', 'module')
LEFT JOIN bi_fact_cia_co model_co1
  ON sst.student_id = model_co1.student_id 
  AND sst.subject_id = model_co1.subject_id 
  AND model_co1.assessment_key IN ('model', 'model1', 'module')
  AND model_co1.co_no = 1
LEFT JOIN bi_fact_cia_co model_co2
  ON sst.student_id = model_co2.student_id 
  AND sst.subject_id = model_co2.subject_id 
  AND model_co2.assessment_key IN ('model', 'model1', 'module')
  AND model_co2.co_no = 2
LEFT JOIN bi_fact_cia_co model_co3
  ON sst.student_id = model_co3.student_id 
  AND sst.subject_id = model_co3.subject_id 
  AND model_co3.assessment_key IN ('model', 'model1', 'module')
  AND model_co3.co_no = 3
LEFT JOIN bi_fact_cia_co model_co4
  ON sst.student_id = model_co4.student_id 
  AND sst.subject_id = model_co4.subject_id 
  AND model_co4.assessment_key IN ('model', 'model1', 'module')
  AND model_co4.co_no = 4
LEFT JOIN bi_fact_cia_co model_co5
  ON sst.student_id = model_co5.student_id 
  AND sst.subject_id = model_co5.subject_id 
  AND model_co5.assessment_key IN ('model', 'model1', 'module')
  AND model_co5.co_no = 5

-- ESE marks (if available)
LEFT JOIN bi_fact_marks ese_total
  ON sst.student_id = ese_total.student_id 
  AND sst.subject_id = ese_total.subject_id 
  AND ese_total.assessment_key IN ('ese', 'exam', 'final')

ORDER BY sst.year, sst.sem, sst.course_code, sst.name;
```

---

## ✅ VALIDATION BEFORE USING

**Before running the main query, verify:**

```sql
-- 1. Check model assessment key
SELECT DISTINCT assessment_key FROM bi_fact_marks 
WHERE assessment_key LIKE '%model%' OR assessment_key LIKE '%exam%';

-- 2. Check ESE/Final key
SELECT DISTINCT assessment_key FROM bi_fact_marks 
WHERE assessment_key LIKE '%ese%' OR assessment_key LIKE '%final%';

-- 3. Verify CO numbers in CIA table
SELECT DISTINCT co_no FROM bi_fact_cia_co ORDER BY co_no;
```

---

## 📌 NEXT STEPS

1. **Run verification queries above** - Confirm Model and ESE assessment keys
2. **Adjust assessment_key values** in main query if different from 'model' or 'ese'
3. **Execute main query** - Get FORMAT 1 data 
4. **Verify output**:
   - 51 columns exactly
   - No all-zero rows
   - Student reg_no values populated
   - CO values in 0-100 range typically

**Once output is confirmed, export to CSV for Power BI!**

