# Power BI: 2 Formats Setup - Complete File Index

**Created:** March 18, 2026  
**Focus:** THEORY + TCPR/TCPL Marks Formats  
**Target:** Power BI Team  

---

## 📁 FILE STRUCTURE

All files are in: `/home/iqac/IDCS-Restart/backend/bi/`

---

## 📖 START HERE

### **README_POWERBI_2_FORMATS.md** ⭐ READ THIS FIRST
- **What it contains:** Overview, quick start, timeline
- **Who should read:** Everyone on Power BI team
- **Time to read:** 10 minutes
- **Why:** Gives you the big picture and credentials
- **Next:** Go to POWERBI_2_FORMATS_GUIDE.md

---

## 📚 MAIN GUIDES

### **1. POWERBI_2_FORMATS_GUIDE.md** ⭐ MAIN REFERENCE
- **What it contains:** Complete step-by-step instructions for both formats
- **Sections:**
  - Section 1: Connection setup (3 steps)
  - Section 2: Tables to load (9 tables listed)
  - Section 3: JSON transformation basics
  - Section 4: FORMAT 1 - THEORY (detailed steps with Power Query code)
  - Section 5: FORMAT 2 - TCPR/TCPL (detailed steps with Power Query code)
  - Section 6: Sample visualizations
  - Section 7: Power Query quick reference
  - Section 8: Troubleshooting guide
- **When to use:** Follow it section by section while working in Power BI
- **Time needed:** ~2 hours
- **Examples included:** ✓ Power Query code, ✓ Merge examples, ✓ Calculated columns

### **2. POWERBI_2_FORMATS_VISUAL.md** ⭐ QUICK REFERENCE
- **What it contains:** Visual diagrams of data flow and final structures
- **Sections:**
  - Format 1 visual data flow diagram
  - Format 2 visual data flow diagram
  - JSON structure explanation
  - Sample table outputs
  - Power BI visual examples (ASCII art)
  - Quick comparison table
  - Validation checklist
  - Time estimate
- **When to use:** While working, for quick visual reference
- **Time needed:** Use during setup (5 min to understand flow)

### **3. POWERBI_SQL_QUERIES.md** ⭐ TEST & VERIFY
- **What it contains:** SQL queries to verify data before Power BI
- **Queries included:**
  - Connection verification (2 queries)
  - THEORY subject queries (3 queries)
  - TCPR/TCPL subject queries (3 queries)
  - Data inspection queries (5 queries)
  - Analysis queries (2 optional)
- **When to use:** 
  - Before connecting Power BI (to verify database works)
  - During troubleshooting (to check data structure)
  - For direct SQL analysis (if needed)
- **How to run:** From pgAdmin or psql command line

---

## 📋 SUPPORTING DOCUMENTS

### **Legacy/Comprehensive Guides** (for reference)
- README_POWERBI_SETUP.md - Complete setup overview
- POWERBI_COMPLETE_SOLUTION.md - Full system overview
- POWERBI_TROUBLESHOOTING.md - In-depth troubleshooting
- POWERBI_DATABASE_CONNECTION_GUIDE.md - Technical connection details
- POWERBI_STEP_BY_STEP_GUIDE.md - Detailed (includes 3rd format)
- POWERBI_QUICK_REFERENCE.md - Full quick reference card

---

## 🔑 DATABASE CREDENTIALS

```
Server:     localhost
Port:       6432
Database:   college_erp
Username:   powerbi_user
Password:   PowerBI@2024
```

---

## 🎯 RECOMMENDED READING ORDER

### **For New Users (First Time):**
1. **README_POWERBI_2_FORMATS.md** (10 min) - Understand scope
2. **POWERBI_2_FORMATS_VISUAL.md** (5 min) - See data flow
3. **POWERBI_2_FORMATS_GUIDE.md Section 1-2** (15 min) - Setup connection
4. **Test connection** (open Power BI, verify connection works)
5. **POWERBI_2_FORMATS_GUIDE.md Section 3-4** (30 min) - Transform FORMAT 1
6. **Test FORMAT 1** (verify data in Power BI)
7. **POWERBI_2_FORMATS_GUIDE.md Section 5** (30 min) - Transform FORMAT 2
8. **Test FORMAT 2** (verify data in Power BI)
9. **POWERBI_2_FORMATS_GUIDE.md Section 6** (20 min) - Create visualizations
10. **POWERBI_2_FORMATS_VISUAL.md** (refer during visualization)
11. **Publish & share** ✓

**Total time: 2-2.5 hours**

---

### **For SQL Users (Verify Data First):**
1. **README_POWERBI_2_FORMATS.md** (5 min)
2. **POWERBI_SQL_QUERIES.md** (10 min)
3. Run verification queries in pgAdmin
4. Once verified, follow main guide above

---

### **For Troubleshooting:**
1. **POWERBI_2_FORMATS_GUIDE.md Troubleshooting** (start here)
2. **POWERBI_SQL_QUERIES.md** (run queries to debug)
3. **POWERBI_2_FORMATS_VISUAL.md** (verify expected flow)
4. **POWERBI_TROUBLESHOOTING.md** (detailed troubleshooting)

---

## 📊 QUICK REFERENCE BY TASK

| Task | Go To |
|------|-------|
| "How do I connect?" | README_POWERBI_2_FORMATS.md or POWERBI_2_FORMATS_GUIDE.md Section 1 |
| "What tables do I load?" | POWERBI_2_FORMATS_GUIDE.md Section 2 |
| "How do I expand JSON?" | POWERBI_2_FORMATS_GUIDE.md Section 3 |
| "Show me FORMAT 1 steps" | POWERBI_2_FORMATS_GUIDE.md Section 4 |
| "Show me FORMAT 2 steps" | POWERBI_2_FORMATS_GUIDE.md Section 5 |
| "Visualizations?" | POWERBI_2_FORMATS_GUIDE.md Section 6 |
| "I need Power Query code" | POWERBI_2_FORMATS_GUIDE.md Section 7 |
| "Something's broken" | POWERBI_2_FORMATS_GUIDE.md Section 8 Troubleshooting |
| "Show me visually" | POWERBI_2_FORMATS_VISUAL.md |
| "Test with SQL" | POWERBI_SQL_QUERIES.md |
| "More troubleshooting" | POWERBI_TROUBLESHOOTING.md |

---

## ✅ WHAT YOU'LL GET

### **Format 1: THEORY Subjects**
- Marks from CIA1 (5 COs)
- Marks from CIA2 (5 COs)
- Marks from Model Exam (5 COs)
- Student names and registration numbers
- Subject information

### **Format 2: TCPR/TCPL Subjects**
- Marks from Review 1 (4 COs)
- Marks from Review 2 (4 COs)
- Averaged CO values
- Marks from Model Exam (5 COs)
- Student classification (Improving/Stable)

### **Visualizations**
- CO Attainment heatmaps
- Performance trend charts
- Student rankings
- Progress indicators
- Comparative analysis

### **Live Dashboards**
- Published to Power BI Service
- Automatic daily refresh
- Shared access to stakeholders

---

## 🔧 TECHNICAL DETAILS

**Database:** PostgreSQL (college_erp)
**Connection:** Direct PostgreSQL in Power BI
**Data Format:** JSON (requires expansion in Power Query)
**Mark Tables:** 4 (CIA1, CIA2, Model, Lab)
**Reference Tables:** 5 (Subject, Student, User, Course, Department)
**Total Tables:** 9 to load

**Mark Structure:**
```json
{
  "data": {
    "student_id": {
      "co1": 8.5,
      "co2": 7.0,
      ... (more COs)
      "total": 40.0
    }
  }
}
```

---

## 🎓 LEARNING PATH

**Beginner → Expert**

| Level | Start With | Then Read |
|-------|-----------|-----------|
| **Beginner** | README_POWERBI_2_FORMATS <br/> + POWERBI_2_FORMATS_VISUAL | POWERBI_2_FORMATS_GUIDE Sections 1-3 |
| **Intermediate** | POWERBI_2_FORMATS_GUIDE Sections 4-5 | Create visualizations from Section 6 |
| **Advanced** | POWERBI_2_FORMATS_GUIDE Section 7 (code) | Customize queries in SQL_QUERIES file |
| **Issues?** | Troubleshooting in GUIDE | Full guide in POWERBI_TROUBLESHOOTING |

---

## 🔐 SECURITY

- ✓ Read-only user (cannot modify data)
- ✓ Password protected
- ✓ Specific table permissions
- ✓ No INSERT/UPDATE/DELETE rights

---

## ✨ FILE SIZES

| File | Type | Purpose |
|------|------|---------|
| README_POWERBI_2_FORMATS.md | Guide | Overview (5 KB) |
| POWERBI_2_FORMATS_GUIDE.md | Guide | Complete instructions (25 KB) |
| POWERBI_2_FORMATS_VISUAL.md | Reference | Visual diagrams (8 KB) |
| POWERBI_SQL_QUERIES.md | Reference | SQL queries (12 KB) |

---

## 🚀 QUICK START COMMAND

```bash
# All files location:
cd /home/iqac/IDCS-Restart/backend/bi/

# Files you need:
ls -la README_POWERBI_2_FORMATS.md
ls -la POWERBI_2_FORMATS_GUIDE.md
ls -la POWERBI_2_FORMATS_VISUAL.md
ls -la POWERBI_SQL_QUERIES.md
```

---

## 📞 HELP

- **Connection issues** → See POWERBI_2_FORMATS_GUIDE.md Troubleshooting
- **SQL questions** → See SQL_QUERIES.md for examples
- **Visual references** → See POWERBI_2_FORMATS_VISUAL.md
- **Detailed help** → See POWERBI_TROUBLESHOOTING.md

---

## 🎯 SUCCESS INDICATORS

✓ Connected when you see 9 tables in Power BI Navigator
✓ Transformed when JSON expands to individual CO columns
✓ Ready when both FORMAT 1 & FORMAT 2 have data
✓ Complete when visualizations show mark data
✓ Published when dashboard is on Power BI Service

---

## 📊 FILE USAGE MATRIX

```
┌────────────────────────────────────────┬─────────────────────────────────────┐
│ README_POWERBI_2_FORMATS              │ POWERBI_2_FORMATS_GUIDE             │
├────────────────────────────────────────┼─────────────────────────────────────┤
│ • Start here (overview)                │ • Follow step-by-step               │
│ • Get credentials                      │ • Includes all code                 │
│ • Understand scope                     │ • Complete instructions             │
│ • See timeline                         │ • Troubleshooting guide             │
│ • Quick start (3 steps)                │ • Sample visualizations             │
└────────────────────────────────────────┴─────────────────────────────────────┘

┌────────────────────────────────────────┬─────────────────────────────────────┐
│ POWERBI_2_FORMATS_VISUAL               │ POWERBI_SQL_QUERIES                 │
├────────────────────────────────────────┼─────────────────────────────────────┤
│ • Data flow diagrams                   │ • Test database first               │
│ • ASCII visuals                        │ • Verify mark availability          │
│ • Quick comparison                     │ • Inspect JSON structure            │
│ • Validation checklist                 │ • Debug data issues                 │
│ • During setup reference               │ • SQL analysis examples             │
└────────────────────────────────────────┴─────────────────────────────────────┘
```

---

## 🎉 YOU'RE ALL SET!

**Start with:** `README_POWERBI_2_FORMATS.md`  
**Then follow:** `POWERBI_2_FORMATS_GUIDE.md`  
**Reference:** `POWERBI_2_FORMATS_VISUAL.md` along the way  
**Test with:** `POWERBI_SQL_QUERIES.md` if needed  

**Estimated time to working dashboard: 2 hours**

---

**All documentation complete. Ready to begin!** 📊✨
