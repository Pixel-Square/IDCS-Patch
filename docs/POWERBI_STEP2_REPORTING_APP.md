# Power BI Step 2 - Reporting App (API + Admin)

Step 2 introduces a dedicated Django app: `reporting`.

## Setup command

Run:

```bash
python3 manage.py migrate reporting
```

This does two things:

- Creates/updates reporting SQL views from the Step 1 SQL script via migration.
- Seeds custom permission code `reporting.view_powerbi_data` in `accounts_permission`.

## Separate reporting portal (no admin model access)

You can use a standalone reporting-only login at:

- `/reporting-portal/login/`

This portal is independent of Django admin and gives only reporting CSV export access.

Configure portal users in `backend/.env` and restart gunicorn:

```env
# Multiple users (recommended)
REPORTING_PORTAL_USERS=bi_user1:StrongPass1,bi_user2:StrongPass2

# Optional single-user fallback
REPORTING_PORTAL_USERNAME=bi_user
REPORTING_PORTAL_PASSWORD=StrongPass
```

Portal routes:

- `/reporting-portal/login/`
- `/reporting-portal/home/`
- `/reporting-portal/export/theory/`
- `/reporting-portal/export/tcpr-tcpl/`
- `/reporting-portal/export/project-lab/`

## What was added

- API routes:
  - `/api/reporting/marks/theory/`
  - `/api/reporting/marks/tcpr-tcpl/`
  - `/api/reporting/marks/project-lab/`
- Admin routes:
  - `/admin/reporting/powerbi/`
  - CSV export links for all three formats
- Permission gate:
  - Superuser OR custom permission code `reporting.view_powerbi_data`

## API usage

Authentication:
- Option A: JWT token (same auth pattern as existing APIs)
- Option B (recommended for Power BI refresh): API key header

Configure `REPORTING_API_KEY` in backend `.env` and restart gunicorn:

```env
REPORTING_API_KEY=change-this-to-a-long-random-token
```

Headers for API key mode:

```http
X-Reporting-Api-Key: <REPORTING_API_KEY>
```

(`X-API-Key` is also accepted for backward compatibility.)

Optional query filters:
- `year`, `sem`, `dept`, `sec`, `course_type`, `course_code`, `course_category`

Output options:
- JSON (default)
- CSV with `?format=csv`

Pagination params:
- `page` (default 1)
- `page_size` (default 500, capped server-side)

Example:

```bash
curl -H "Authorization: Bearer <JWT>" \
  "https://<host>/api/reporting/marks/theory/?year=2023&dept=CSE&page=1&page_size=1000"
```

API key example:

```bash
curl -H "X-Reporting-Api-Key: <REPORTING_API_KEY>" \
  "https://<host>/api/reporting/marks/theory/?year=2023&dept=CSE&page=1&page_size=1000"
```

CSV example:

```bash
curl -L -H "Authorization: Bearer <JWT>" \
  "https://<host>/api/reporting/marks/theory/?format=csv&year=2023" \
  -o theory.csv
```

CSV with API key:

```bash
curl -L -H "X-Reporting-Api-Key: <REPORTING_API_KEY>" \
  "https://<host>/api/reporting/marks/theory/?format=csv&year=2023" \
  -o theory.csv
```

## Power BI (Option 1) implementation

Use this approach when Power BI users are on different networks and cannot access PostgreSQL directly.

1. In Power BI Desktop, use **Get Data -> Web**.
2. Use endpoint URL (example):
  - `https://<host>/api/reporting/marks/theory/?page=1&page_size=1000`
3. In request headers, add:
  - `X-Reporting-Api-Key: <REPORTING_API_KEY>`
4. Build similar queries for:
  - `/api/reporting/marks/theory/`
  - `/api/reporting/marks/tcpr-tcpl/`
  - `/api/reporting/marks/project-lab/`
5. Publish dataset to Power BI Service.
6. Configure scheduled refresh in Service using same API key auth.

### Power Query template (recommended)

In Power BI Desktop, open **Transform Data -> New Source -> Blank Query -> Advanced Editor** and use this function first:

```powerquery
let
  ReportingFetchAllPages = (
    endpoint as text,
    optional year as nullable text,
    optional sem as nullable text,
    optional dept as nullable text,
    optional sec as nullable text,
    optional course_type as nullable text,
    optional course_code as nullable text,
    optional course_category as nullable text
  ) as table =>
  let
    BaseUrl = "https://idcs.krgi.co.in",
    ApiKey = "<REPORTING_API_KEY>",
    PageSize = "1000",

    FetchPage = (p as number) as record =>
      let
        query = [
          page = Text.From(p),
          page_size = PageSize,
          year = year,
          sem = sem,
          dept = dept,
          sec = sec,
          course_type = course_type,
          course_code = course_code,
          course_category = course_category
        ],
        response = Json.Document(
          Web.Contents(
            BaseUrl,
            [
              RelativePath = endpoint,
              Query = Record.RemoveFields(
                query,
                List.Select(Record.FieldNames(query), (k) => Record.Field(query, k) = null or Record.Field(query, k) = "")
              ),
              Headers = [
                #"X-Reporting-Api-Key" = ApiKey,
                Accept = "application/json"
              ]
            ]
          )
        )
      in
        response,

    First = FetchPage(1),
    Total = Number.From(First[total]),
    Pages = Number.RoundUp(Total / Number.From(PageSize)),
    PageNumbers = if Pages < 1 then {1} else {1..Pages},
    Responses = List.Transform(PageNumbers, each FetchPage(_)),
    RowsCombined = List.Combine(List.Transform(Responses, each _[rows])),
    AsTable = if List.Count(RowsCombined) = 0 then #table({}, {}) else Table.FromRecords(RowsCombined)
  in
    AsTable
in
  ReportingFetchAllPages
```

Then create three queries:

```powerquery
let
  Source = ReportingFetchAllPages("api/reporting/marks/theory/", null, null, null, null, null, null, null)
in
  Source
```

```powerquery
let
  Source = ReportingFetchAllPages("api/reporting/marks/tcpr-tcpl/", null, null, null, null, null, null, null)
in
  Source
```

```powerquery
let
  Source = ReportingFetchAllPages("api/reporting/marks/project-lab/", null, null, null, null, null, null, null)
in
  Source
```

Notes:
- Replace `<REPORTING_API_KEY>` with the backend key value.
- If needed, pass filter values in function arguments to reduce refresh volume.
- If Power BI cached old credentials, clear Data Source Settings for `idcs.krgi.co.in` and reconnect.

### Refresh cadence for exam-driven updates

- Non-exam period: 1 refresh/day (or manual refresh only)
- Exam window (~10 days): refresh every 1-2 hours
- Post-exam finalization: one final refresh, then return to low frequency

This keeps load low while giving near-real-time updates only when required.

## Admin usage

Open:
- `/admin/reporting/powerbi/`

Actions:
- Apply optional filters
- Download CSV for Theory / TCPR-TCPL / Project-Lab

## Note about permissions

If non-superuser staff must access reporting endpoints/pages, assign this permission code through your role-permission mapping:

- `reporting.view_powerbi_data`

and assign it to the relevant role(s).
