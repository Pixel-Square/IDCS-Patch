# 🗄️ DATABASE STRUCTURE VERIFICATION & FORMAT 1 STEP-BY-STEP GUIDE

**Date:** March 18, 2026  
**Status:** ✅ Database verified, actual tables confirmed  
**Purpose:** Exact step-by-step instructions for extracting FORMAT 1 marks

---

## ✅ DATABASE STRUCTURE VERIFICATION

### Confirmed Tables in `college_erp` Database

**Mark-Related Tables (VERIFIED):**
```
OBE_cia1publishedsheet    (Cycle 1 internal assessment data)
OBE_cia2publishedsheet    (Cycle 2 internal assessment data)
OBE_ssa1mark             (Cycle 1 semester assessment marks - student level)
OBE_ssa2mark             (Cycle 2 semester assessment marks - student level)
OBE_labpublishedsheet    (Lab assessment data)
OBE_modelpublishedsheet  (Model exam data)
```

**Reference Tables (VERIFIED):**
```
academics_studentprofile      (Student info: reg_no, name, user_id, batch_id)
academics_batch              (Batch info: batch_year_id)
academics_batchyear          (Year info)
academics_subject            (Subject: code, name, semester_id, course_id)
academics_course             (Course: department_id, category)
academics_section            (Section: id)
academics_semester           (Semester: number)
accounts_user               (User: first_name, last_name)
curriculum_curriculumdepartment (Course type: class_type - THEORY/TCPR/TCPL/etc)
```

### Table Structure Details

**OBE_cia1publishedsheet:**
```
Columns:
  id (bigint) - Primary key
  data (jsonb) - Contains mark data in JSON format
  updated_by (integer)
  updated_at (timestamp)
  subject_id (bigint)
  teaching_assignment_id (bigint)
```

**OBE_ssa1mark (Individual marks - same for ssa2, fa1, fa2, etc):**
```
Columns:
  id (bigint) - Primary key
  mark (numeric) - The actual mark value
  created_at (timestamp)
  updated_at (timestamp)
  student_id (bigint) - FK to academics_studentprofile
  subject_id (bigint) - FK to academics_subject
  teaching_assignment_id (bigint)
```

**academics_studentprofile:**
```
PK: id
Columns: reg_no, first_name, last_name, user_id (FK), batch_id (FK), section_id (FK)
```

---

## 🎯 FORMAT 1 EXTRACTION - STEP BY STEP

### IMPORTANT DISCOVERY

⚠️ **Tables DO NOT match original specification exactly:**
- **FA1/FA2 published sheet tables do NOT exist** in database (spec mentioned them)
- **SSA marks are at individual student level** (not JSON like CIA/Model/Lab)
- **Mark structure varies** by assessment type

### ACTUAL DATA SOURCES FOR FORMAT 1 (THEORY)

| Column | Source Table | Field | Notes |
|--------|--------------|-------|-------|
| year | academics_batchyear | id value | Via batch→batchyear |
| sem | academics_semester | number | Via subject→semester |
| dept | academics_course | department_id | Via subject→course |
| sec | academics_section | id | Via studentprofile→section |
| reg_no_last_12 | academics_studentprofile | SUBSTRING(reg_no, -12) | |
| name | accounts_user | CONCAT(first_name, ' ', last_name) | Via studentprofile→user |
| course_type | curriculum_curriculumdepartment | class_type | WHERE class_type='THEORY' |
| course_code | academics_subject | code | |
| course_category | academics_course | category | Via subject→course |
| course_name | academics_subject | name | |
| **c1-ssa1-co\* columns** | OBE_ssa1mark | mark | ⚠️ Only ONE mark per student per subject (not split by CO) |
| **c1-fa1-co\* columns** | ⚠️ NO FA1 TABLE EXISTS | | May need to use SSA1 twice OR find FA data elsewhere |
| **c1-cia1-co\* columns** | OBE_cia1publishedsheet | data (JSON) | CO totals calculated from JSON structure |
| **c2-ssa2-co\* columns** | OBE_ssa2mark | mark | Similar to ssa1 |
| **c2-fa2-co\* columns** | ⚠️ NO FA2 TABLE EXISTS | | |
| **c2-cia2-co\* columns** | OBE_cia2publishedsheet | data (JSON) | |
| **model columns** | OBE_modelpublishedsheet | data (JSON) | Similar to CIA |

---

## 📊 STEP-BY-STEP FORMAT 1 EXTRACTION

### PHASE 1: Get Student Identity Data

**Step 1.1: Query student, course, subject information**

```sql
-- Get student-subject mapping with all identity information
SELECT 
  -- Identity (10 columns)
  b.id as year,
  s.number as sem,
  c.department_id as dept,
  sec.id as sec,
  SUBSTRING(sp.reg_no, -12) as reg_no_last_12,
  CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as name,
  cd.class_type as course_type,
  subj.code as course_code,
  c.category as course_category,
  subj.name as course_name,
  -- Additional IDs needed for joins
  sp.id as student_id,
  subj.id as subject_id,
  ta.id as teaching_assignment_id
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
LEFT JOIN academics_teachingassignment ta ON subj.id = ta.subject_id
WHERE cd.class_type = 'THEORY'  -- Filter for THEORY subjects only
ORDER BY sp.reg_no, subj.code;
```

**Validation:**
- Check you get students with complete identity information
- Verify course_type = 'THEORY' for all rows
- Confirm reg_no values are populated

---

### PHASE 2: Add SSA Marks (Cycle 1 & 2)

**Step 2.1: Add SSA1 marks**

```sql
-- Build on previous query - add SSA1 marks
-- Note: SSA table has one mark per student per subject
-- We'll repeat this mark for both co1 and co2 as placeholder

SELECT 
  -- (same identity columns as above)
  ...
  -- SSA1 marks (Cycle 1: CO1-CO2)
  COALESCE(ssa1.mark, 0) as c1_ssa1_co1,
  COALESCE(ssa1.mark, 0) as c1_ssa1_co2,  -- Same mark for both COs (database limitation)
  COALESCE(ssa1.mark, 0) as c1_ssa1_total,
  
FROM ... (student query as above)
LEFT JOIN OBE_ssa1mark ssa1 
  ON sp.id = ssa1.student_id 
  AND subj.id = ssa1.subject_id
ORDER BY sp.reg_no, subj.code;
```

**⚠️ IMPORTANT NOTE:**
- Database stores SSA1 as **ONE mark per student per subject**, NOT split by CO
- Original spec expects 3 marks per CO (co1, co2, total)
- **Options:**
  1. Use same mark for both co1 and co2 (simpler, less accurate)
  2. Find if CO-level data exists elsewhere in database
  3. Calculate CO-wise breakdown from other sources

---

### PHASE 3: Check CIA Data Structure (JSON)

**Step 3.1: Examine CIA1 JSON data**

```sql
-- Look at actual CIA1 data structure
SELECT 
  subject_id,
  data,  -- Full JSON
  substring(data::text, 1, 500) as data_snippet  -- First 500 chars
FROM "OBE_cia1publishedsheet"
LIMIT 3;
```

**What you'll see:**
- `data` is a JSONB object
- Contains `questions` array with question metadata
- May also contain `students` object or similar with CO-wise marks

**Step 3.2: Extract CIA1 CO marks**

```sql
-- Extract CO-wise marks from CIA JSON
SELECT 
  subject_id,
  jsonb_each_text(data->'co_marks') as co_data,  -- Adjust path based on actual structure
  data->'meta' as metadata
FROM "OBE_cia1publishedsheet"
LIMIT 5;
```

**Validation:** Once you see the JSON structure, adjust extraction accordingly.

---

### PHASE 4: Get Model Exam Data

**Step 4.1: Query Model marks**

```sql
-- Similar to CIA, Model is in OBE_modelpublishedsheet
SELECT 
  subject_id,
  data::text as json_data,
  substring(data::text, 1, 500) as sample
FROM "OBE_modelpublishedsheet"
WHERE data IS NOT NULL
LIMIT 3;
```

---

## 🔄 COMPLETE WORKING QUERY FOR FORMAT 1 (THEORY)

**Once you understand JSON structure, use this template:**

```sql
-- FORMAT 1: THEORY SUBJECTS (51 Columns)
-- IMPORTANT: Adjust JSON paths based on actual data structure found in Step 3

WITH student_subject_base AS (
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
    
    -- IDs for mark joins
    sp.id as student_id,
    subj.id as subject_id,
    
    -- Cycle 1 SSA (temporary - adjust based on actual CO structure)
    COALESCE(ssa1.mark, 0)::float as c1_ssa1_total,
    
    -- Cycle 1 FA (ISSUE: Table may not exist - check first)
    NULL::float as c1_fa1_total,
    
    -- Cycle 1 CIA (will extract CO values from JSON)
    cia1.data,
    
    -- Cycle 2 SSA 
    COALESCE(ssa2.mark, 0)::float as c2_ssa2_total,
    
    -- Cycle 2 FA
    NULL::float as c2_fa2_total,
    
    -- Cycle 2 CIA
    cia2.data as cia2_data,
    
    -- Model
    model.data as model_data,
    
    -- ESE
    NULL::float as ese_total
    
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
  LEFT JOIN "OBE_cia1publishedsheet" cia1 ON subj.id = cia1.subject_id
  LEFT JOIN "OBE_cia2publishedsheet" cia2 ON subj.id = cia2.subject_id
  LEFT JOIN "OBE_modelpublishedsheet" model ON subj.id = model.subject_id
  
  WHERE cd.class_type = 'THEORY'
)

SELECT 
  year, sem, dept, sec, "reg_no_last_12_digit", name, course_type,
  course_code, course_category, course_name,
  
  --Cycle 1 (extract from JSON and SSA mark)
  c1_ssa1_total as "c1-ssa1-co1",
  c1_ssa1_total as "c1-ssa1-co2",
  c1_ssa1_total as "c1-ssa1",
  
  c1_fa1_total as "c1-fa1-co1",
  c1_fa1_total as "c1-fa1-co2",
  c1_fa1_total as "c1-fa1",
  
  -- Extract CO values from CIA1 JSON (example - adjust path)
  COALESCE((cia1.data->'co_marks'->>'co1')::float, 0) as "c1-cia1-co1",
  COALESCE((cia1.data->'co_marks'->>'co2')::float, 0) as "c1-cia1-co2",
  COALESCE((cia1.data->'co_marks'->>'total')::float, 0) as "c1-cia1",
  
  '-' as "c1-before_cqi",
  '-' as "c1-after_cqi",
  ROUND((c1_ssa1_total + 0 + 0) / 3.0, 2) as "c1-internal",
  
  -- Similar for Cycle 2...
  c2_ssa2_total as "c2-ssa2-co3",
  c2_ssa2_total as "c2-ssa2-co4",
  c2_ssa2_total as "c2-ssa2",
  
  -- ... continue with FA2, CIA2, Model, Finals...
  
  -- Placeholder until next structure is confirmed
  0 as internal,
  COALESCE(ese_total, 0) as ese
  
FROM student_subject_base
ORDER BY year, sem, course_code, name;
```

---

## 🔍 VERIFICATION STEPS

### Before Running Format 1 Query:

**Step 1: Verify FA tables exist**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE '%fa%' AND table_schema='public';
```
Expected: If FA1/FA2 tables don't exist, we need alternative approach for FA marks.

**Step 2: Sample one record with all joins**
```sql
SELECT COUNT(*) as student_count
FROM academics_studentprofile sp
JOIN academics_studentsubjectbatch ssb ON sp.id = ssb.student_id
JOIN academics_subject subj ON ssb.subject_id = subj.id
JOIN curriculum_curriculumdepartment cd 
  ON subj.course_id = cd.course_id AND subj.semester_id = cd.semester_id
WHERE cd.class_type = 'THEORY';
```
Expected: > 0 (verify THEORY subjects exist with students)

**Step 3: Check mark data availability**
```sql
SELECT 
  'SSA1' as source,
  COUNT(*) as mark_count
FROM "OBE_ssa1mark"
UNION ALL
SELECT 'CIA1', COUNT(*) FROM "OBE_cia1publishedsheet"
UNION ALL
SELECT 'Model', COUNT(*) FROM "OBE_modelpublishedsheet";
```
Expected: All > 0 (verify marks exist for extraction)

---

## 📋 ACTION ITEMS FOR YOU

1. **Run Step 3.1 query** - Examine actual CIA1 JSON structure
2. **Run Step 3.2 query** - See how CO marks are stored in JSON
3. **Adapt CO extraction paths** - Modify JSON path syntax based on findings
4. **Test with 5 students first** - Verify marks are extracted correctly
5. **Check FA tables** - Determine if FA1/FA2 tables exist or need workaround
6. **Run complete query** - Execute FORMAT 1 query once all sources confirmed

---

## 🚨 KNOWN ISSUES & WORKAROUNDS

| Issue | Status | Workaround |
|-------|--------|-----------|
| FA1/FA2 tables don't exist | ⚠️ CONFIRMED | Use SSA marks OR find FA data in different table OR leave null |
| CO marks split issue | ⚠️ CONFIRMED | SSA has total only, need to extract CO breakdown from elsewhere |
| JSON structure unknown | 🔍 TO VERIFY | Must run Step 3 queries to determine exact path |
| Student-subject relationship | ✅ FOUND | Use academics_studentsubjectbatch join table |
| Teaching assignment needed? | ❓ CHECK | Some queries use it, some don't - determine if required |

---

## 📝 NEXT DOCUMENT

Once you run the verification queries and provide results, I will:
1. Show exact JSON extraction code for CO marks
2. Provide complete FORMAT 1 query
3. Give step-by-step query-to-report transformation instructions
4. Verify row counts and data quality

**Ready to proceed? Run the queries in Step 3 and share the output!**

