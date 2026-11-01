# Asklytics Testing Guide
## Comprehensive Testing Instructions for Transformed System

---

## Prerequisites

### Backend Requirements
- Python 3.11+ (3.12 recommended)
- Virtual environment activated
- All dependencies installed from `backend/requirements.txt`
- OpenAI API key (optional, for enhanced query planning)
- PostgreSQL or SQLite database

### Frontend Requirements
- Node.js 18+
- npm or pnpm
- Environment variable `VITE_API_BASE` configured

---

## Setup Instructions

### 1. Backend Setup

```bash
# Navigate to repository root
cd Asklytics

# Create and activate virtual environment (if not already done)
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Create .env file (if not exists)
cp .env.example .env

# Edit .env and set:
# JWT_SECRET_KEY=your-secret-key-here
# OPENAI_API_KEY=your-openai-key (optional)
# DATABASE_URL=sqlite:///./local.db (or PostgreSQL URL)
```

### 2. Start Backend

```bash
# From repository root
PYTHONPATH=backend uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Expected output:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

Verify: Open http://localhost:8000/docs (FastAPI interactive docs)

### 3. Frontend Setup

```bash
# Open new terminal
cd Asklytics/web

# Install dependencies
npm install

# Start development server
VITE_API_BASE="http://localhost:8000" npm run dev
```

Expected output:
```
  VITE v... ready in ...ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Verify: Open http://localhost:5173

---

## Test Scenarios

### Scenario 1: User Registration & Login

**Steps:**
1. Navigate to http://localhost:5173
2. Click "Register" or "Sign Up"
3. Create account with email and password
4. Login with credentials

**Expected Result:**
- ✅ Successful registration
- ✅ Redirected to dashboard/chat
- ✅ JWT token stored

**Validation:**
- Check browser localStorage for `asklytics_token`
- Verify authenticated API requests work

---

### Scenario 2: PDF Upload & Ingestion

**Test Data:** Use any financial PDF (annual report, income statement, etc.)

**Steps:**
1. Login to application
2. Navigate to Chat page
3. Click "Upload" button
4. Select a financial PDF
5. Wait for processing

**Expected Result:**
- ✅ Upload progress indicator shown
- ✅ Success message: "Imported [filename] (N fact(s))"
- ✅ Data available for querying
- ✅ Message suggests asking questions

**Validation:**
```sql
-- Check database (if using SQLite):
SELECT COUNT(*) FROM financial_facts;
-- Should show extracted records
```

**What to Look For:**
- No hardcoded mock data
- Actual extracted values from your PDF
- Correct periods, metrics, currencies

---

### Scenario 3: Simple Lookup Question

**Question:** "What is the total revenue?"

**Expected Response Structure:**
```json
{
  "intent": "aggregate" or "total",
  "answer_text": "Total calculated from N records...",
  "kpis": [
    {
      "label": "Total Revenue",
      "value": 12345678,
      "unit": null,
      "currency": "USD"
    }
  ],
  "table": [...],  // May or may not appear
  "visualizations": null,  // No chart for single value
  "insights": [
    {
      "insight_type": "summary",
      "content": "Analyzed N record(s). Total Revenue: $..."
    }
  ]
}
```

**Validation Checks:**
- ✅ KPI card displays prominently
- ✅ No unnecessary charts (single value shouldn't need chart)
- ✅ Insight uses actual data from your PDF
- ✅ Currency matches your PDF
- ✅ **NO HARDCODED VALUES** like "$45,230" or "Product A"

---

### Scenario 4: Trend Analysis Question

**Question:** "Show me revenue trend over time"

**Expected Response Structure:**
```json
{
  "intent": "trend",
  "answer_text": "Trend analysis complete...",
  "kpis": [
    {
      "label": "Latest Period Revenue",
      "value": 5000000,
      "change": 12.5,
      "change_period": "vs Previous Year",
      "trend": "up",
      "sentiment": "positive"
    }
  ],
  "visualizations": [
    {
      "viz_type": "line",
      "data": [
        {"period": "FY 2020", "value": 4000000},
        {"period": "FY 2021", "value": 4500000},
        {"period": "FY 2022", "value": 5000000}
      ],
      "title": "Revenue Over Time",
      "value_format": "currency",
      "currency": "USD"
    }
  ],
  "insights": [
    {
      "insight_type": "summary",
      "content": "Analyzed 3 record(s)..."
    },
    {
      "insight_type": "trend",
      "content": "Revenue shows upward trend from FY 2020 to FY 2022, with a 25.0% increase. From $4.00M to $5.00M."
    }
  ]
}
```

**Validation Checks:**
- ✅ Line chart displayed (not bar chart)
- ✅ KPI shows latest value with trend arrow
- ✅ Trend insight calculates actual growth rate
- ✅ Chart uses real periods from your PDF
- ✅ Values match extracted data

---

### Scenario 5: Comparison Question

**Question:** "Compare revenue and expenses"

**Expected Response Structure:**
```json
{
  "intent": "comparison",
  "visualizations": [
    {
      "viz_type": "multi_line",
      "data": [
        {"period": "FY 2020", "revenue": 4000000, "expenses": 3000000},
        {"period": "FY 2021", "revenue": 4500000, "expenses": 3200000},
        {"period": "FY 2022", "revenue": 5000000, "expenses": 3500000}
      ],
      "show_legend": true
    }
  ],
  "insights": [
    {
      "insight_type": "comparison",
      "content": "Comparing Revenue and Expenses: Revenue totals $13.50M (68.0%), while Expenses totals $9.70M (32.0%)."
    }
  ]
}
```

**Validation Checks:**
- ✅ Multi-line or multi-bar chart (not single series)
- ✅ Both metrics visible in chart
- ✅ Legend displayed
- ✅ Comparison insight present
- ✅ Percentages calculated correctly
- ✅ Table shows both columns

---

### Scenario 6: Profit Margin Question

**Question:** "What is the net profit margin by year?"

**Expected Response Structure:**
```json
{
  "intent": "ratio" or "margin",
  "visualizations": [
    {
      "viz_type": "line",
      "value_format": "percent",  // KEY: Not "currency"
      "data": [
        {"period": "FY 2020", "value": 15.5},
        {"period": "FY 2021", "value": 18.2},
        {"period": "FY 2022", "value": 20.1}
      ]
    }
  ],
  "kpis": [
    {
      "label": "Net Profit Margin",
      "value": 20.1,
      "unit": "%"
    }
  ]
}
```

**Validation Checks:**
- ✅ Chart Y-axis shows percentages (not currency)
- ✅ KPI card shows % symbol
- ✅ Tooltip shows "XX.XX%"
- ✅ Explanation mentions margin calculation
- ✅ Values are reasonable percentages (not huge numbers)

---

### Scenario 7: Superlative Question

**Question:** "Which year had the highest revenue?"

**Expected Response:**
- ✅ Table with 1-3 rows (not all years)
- ✅ Sorted by revenue (highest first)
- ✅ Simple bar chart (optional)
- ✅ Summary insight identifying the winner

**Validation:**
```
Example Insight: "FY 2022 had the highest revenue at $5.00M."
```

---

### Scenario 8: Financial Ratio Dashboard

**Question:** "Show me all financial ratios"

**Expected Response:**
- ✅ Table with multiple ratio columns
- ✅ Explanation about NULL values (if balance sheet data missing)
- ✅ Gross margin, operating margin, net margin, ROE, ROA, etc.
- ✅ Ratios formatted as percentages
- ✅ No hallucinated values for missing ratios

---

### Scenario 9: Follow-up Questions

**Steps:**
1. Ask: "What is the total revenue?"
2. Observe follow-up suggestions appear
3. Click: "Show me the trend over time"
4. New question executed automatically

**Validation:**
- ✅ Suggestions are contextually relevant
- ✅ Clicking suggestion populates input
- ✅ New query executes with proper intent

---

### Scenario 10: Data Limitations

**Question:** Ask about a metric not in your PDF (e.g., "Show me inventory turnover")

**Expected Response:**
- ✅ Query executes without error
- ✅ Empty or partial results returned
- ✅ Limitation warning displayed:
  ```
  ⚠️ Data Limitations
  • Some data values are missing or incomplete
  • Limited to a single data point; trend analysis not possible
  ```
- ✅ Explanation mentions missing data

---

## Automated Validation

### Run Test Script

```bash
cd Asklytics
python test_transformation.py
```

**Expected Output:**
```
📊 RESPONSE DIVERSITY ANALYSIS
----------------------------------------------------------------------
Responses with KPIs:          3
Responses with Visualizations: 2
Responses with Insights:      3

🎨 VISUALIZATION VARIETY
----------------------------------------------------------------------
  • line
  • multi_line

💡 INSIGHT VARIETY
----------------------------------------------------------------------
  • comparison
  • summary
  • trend

✅ TRANSFORMATION ASSESSMENT
----------------------------------------------------------------------
  ✅ PASS: No hardcoded responses
  ✅ PASS: Response diversity
  ✅ PASS: Visualization variety
  ✅ PASS: Insight generation
  ✅ PASS: KPI extraction

Score: 5/5 checks passed

🎉 TRANSFORMATION SUCCESSFUL!
```

---

## Regression Testing

### Check for Hardcoded Mock Data

**Red Flags (should NOT appear in responses):**
- "Product A", "Product B", etc.
- "Acme Corp", "TechStart Inc"
- Exact values like "$45,230", "$38,920"
- "Operating Costs", "Marketing" (unless in your actual PDF)

**How to Verify:**
1. Clear browser cache and localStorage
2. Upload a NEW PDF with unique company name
3. Ask various questions
4. Verify responses reference YOUR company/data
5. Check that periods match YOUR PDF (not hardcoded years)

### Verify SQL Generation

**For each question:**
1. Expand "Generated SQL Query" section
2. Verify SQL is contextually appropriate
3. Check that SQL references correct tables (`financial_facts`)
4. Ensure no invented table names (`uploaded_data`)
5. Confirm filters are applied (`is_valid = 1`, `level IN (...)`)

---

## Performance Benchmarks

### Response Time Targets

| Operation | Target | Acceptable | Action if Slower |
|-----------|--------|------------|------------------|
| PDF Upload | <5s | <15s | Check file size, OCR settings |
| Simple Query | <500ms | <2s | Check database indexes |
| Complex Query | <1s | <5s | Optimize SQL, check schema retrieval |
| Chart Rendering | <100ms | <300ms | Frontend optimization needed |

### Token Usage (OpenAI API)

| Query Type | Approx Tokens | Cost (GPT-4o-mini) |
|------------|---------------|---------------------|
| Simple lookup | 200-500 | $0.0001-0.0003 |
| Complex planning | 500-1500 | $0.0003-0.0008 |
| With full schema | 1000-2000 | $0.0005-0.0010 |

**Note:** Insight generation, KPI extraction, and visualization selection are **deterministic** (no LLM calls), adding zero token cost.

---

## Debugging Common Issues

### Issue: "No data found matching your query"

**Causes:**
- PDF upload failed silently
- Extraction didn't capture expected metrics
- Query references wrong period format

**Debugging:**
```sql
-- Check what was extracted
SELECT DISTINCT metric FROM financial_facts;
SELECT DISTINCT period FROM financial_facts;
SELECT * FROM financial_facts LIMIT 10;
```

### Issue: Charts not rendering

**Causes:**
- Empty visualization data
- Frontend component error
- Data format mismatch

**Check:**
- Browser console for errors
- Network tab → verify API response includes `visualizations`
- Verify `viz_type` is supported

### Issue: Still seeing hardcoded data

**Causes:**
- Frontend not updated
- Browser cache
- Old code path still active

**Fix:**
```bash
# Clear frontend
cd web
rm -rf node_modules .vite
npm install
npm run dev

# Hard refresh browser
# Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
```

### Issue: SQL errors

**Causes:**
- Schema mismatch
- SQLGuard too restrictive
- Invalid table references

**Check:**
```python
# In backend Python shell:
from app.db.session import engine
from app.services.rag_service import SchemaRAGService

rag = SchemaRAGService()
print(rag.get_schema_context(engine))
# Verify financial_facts table exists
```

---

## Success Criteria Checklist

Use this checklist to confirm transformation success:

### ✅ Core Intelligence
- [ ] Different questions produce different response structures
- [ ] KPI cards generated when appropriate
- [ ] Visualizations selected based on data type
- [ ] Insights reference actual query results
- [ ] No hardcoded mock data in any response

### ✅ Response Quality
- [ ] Answer text is contextually relevant
- [ ] Explanations describe actual operations
- [ ] Tables show relevant columns only
- [ ] Charts match question intent (line for trends, bar for comparisons)
- [ ] Currency and units preserved

### ✅ Financial Accuracy
- [ ] Calculations are deterministic
- [ ] Percentages formatted correctly
- [ ] No hallucinated numbers
- [ ] Null values handled gracefully
- [ ] Period comparisons are accurate

### ✅ User Experience
- [ ] Loading states displayed during processing
- [ ] Error messages are informative
- [ ] Follow-up suggestions are relevant
- [ ] Charts are responsive and readable
- [ ] Tables don't overflow on mobile

### ✅ Security
- [ ] SQL Guard blocks destructive operations
- [ ] Only SELECT queries allowed
- [ ] No SQL injection vulnerabilities
- [ ] JWT authentication working
- [ ] API keys not exposed

---

## Reporting Issues

If you find issues during testing:

1. **Document:**
   - Question asked
   - Expected response
   - Actual response
   - API response JSON (from Network tab)
   - Console errors

2. **Check:**
   - Backend logs for errors
   - Database for expected data
   - Frontend console for warnings

3. **File locations:**
   - Backend: `backend/app/api/v1/endpoints/ask.py`
   - Insight Engine: `backend/app/services/insight_engine.py`
   - Viz Recommender: `backend/app/services/visualization_recommender.py`
   - Frontend: `web/src/app/pages/chat.tsx`

---

## Conclusion

This comprehensive testing guide ensures that the Asklytics transformation is validated thoroughly. Follow each scenario systematically to confirm that the application produces intelligent, data-driven, dynamic responses rather than hardcoded templates.

**Remember:** The goal is **question-driven, data-driven intelligence**, not template-driven responses.

---

## Quick Test Commands

```bash
# Start backend
cd Asklytics
source .venv/bin/activate
PYTHONPATH=backend uvicorn app.main:app --reload --port 8000

# Start frontend (new terminal)
cd Asklytics/web
VITE_API_BASE="http://localhost:8000" npm run dev

# Run validation
cd Asklytics
python test_transformation.py
```

**Test URL:** http://localhost:5173  
**API Docs:** http://localhost:8000/docs  
**Health Check:** http://localhost:8000/api/v1/health
