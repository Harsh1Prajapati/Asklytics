# 🚀 Asklytics Quick Start Guide

**Get the transformed intelligent financial analytics platform running in 5 minutes!**

---

## ✅ Prerequisites Check

Before starting, ensure you have:
- [ ] Python 3.11+ installed (`python --version`)
- [ ] Node.js 18+ installed (`node --version`)
- [ ] Git installed
- [ ] Terminal/command prompt open

---

## 🏃 Quick Start (5 Steps)

### Step 1: Navigate to Project
```bash
cd Asklytics
```

### Step 2: Setup Backend (2 minutes)
```bash
# Create virtual environment (if not exists)
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Create .env file (if not exists)
echo "JWT_SECRET_KEY=your-secret-key-change-in-production" > .env
echo "OPENAI_API_KEY=sk-optional" >> .env
echo "DATABASE_URL=sqlite:///./local.db" >> .env

# Start backend
PYTHONPATH=backend uvicorn app.main:app --reload --port 8000
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

✅ Backend is running at http://localhost:8000

### Step 3: Setup Frontend (1 minute)
Open a **NEW terminal** and run:
```bash
cd Asklytics/web

# Install dependencies (first time only)
npm install

# Start development server
VITE_API_BASE="http://localhost:8000" npm run dev
```

**Windows PowerShell:**
```powershell
cd Asklytics\web
npm install
$env:VITE_API_BASE="http://localhost:8000"; npm run dev
```

**Expected Output:**
```
  VITE v6.3.5 ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

✅ Frontend is running at http://localhost:5173

### Step 4: Register & Login (30 seconds)
1. Open browser: http://localhost:5173
2. Click "Register" or "Sign Up"
3. Create account with:
   - Email: `test@example.com`
   - Password: `password123`
4. Login with same credentials

✅ You're now authenticated!

### Step 5: Test the Intelligence (2 minutes)
1. Navigate to **Chat** page
2. Click **Upload** button
3. Select any financial PDF (annual report, income statement, etc.)
4. Wait for processing (~5-15 seconds)
5. Ask questions:

**Try these:**
```
"What is the total revenue?"
→ Expect: KPI card with actual total from your PDF

"Show me revenue trend over time"
→ Expect: Line chart + trend insight

"Compare revenue and expenses"
→ Expect: Multi-line chart + comparison insight

"What is the profit margin?"
→ Expect: Percentage chart (not currency)

"Which year had the highest revenue?"
→ Expect: Table + summary identifying winner
```

✅ **Different questions = Different intelligent responses!**

---

## 🧪 Verify Transformation Success

Run the validation script:
```bash
cd Asklytics
python test_transformation.py
```

**Expected:**
```
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

## 🎯 What to Look For

### ✅ Signs of Success
- **Different Responses:** Each question gets a unique, appropriate response
- **Real Data:** Values match your uploaded PDF (not "Product A", "Acme Corp")
- **Smart Charts:** Line charts for trends, bars for comparisons, KPI cards for single values
- **Meaningful Insights:** Summaries reference actual statistics from your data
- **Dynamic KPIs:** Latest values with trend arrows and change percentages

### ❌ Signs of Failure (Should NOT Happen)
- Same response for different questions
- Hardcoded values like "$45,230" or "Product A"
- Charts when they don't make sense (e.g., pie chart for single value)
- Generic insights that could apply to any data

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check Python version
python --version
# Should be 3.11 or higher

# Reinstall dependencies
pip install --upgrade -r backend/requirements.txt

# Check port availability
# Make sure port 8000 is not in use
```

### Frontend won't start
```bash
# Clear cache
rm -rf node_modules .vite
npm install

# Check Node version
node --version
# Should be 18 or higher
```

### "No data found"
- Verify PDF uploaded successfully
- Check backend logs for extraction errors
- Try a different financial PDF (clearer tables work best)

### Charts not showing
- Check browser console (F12) for errors
- Hard refresh browser (Ctrl+Shift+R)
- Verify backend response includes `visualizations` field

---

## 📚 Next Steps

### Explore the Documentation
1. **TRANSFORMATION_SUMMARY.md** - Technical details of what changed
2. **TESTING_GUIDE.md** - Comprehensive testing scenarios
3. **TRANSFORMATION_COMPLETE.md** - Executive summary
4. **VALIDATION_COMPLETE.md** - Test results

### Try Advanced Features
- Upload multiple PDFs
- Ask complex questions: "Compare 2020 vs 2023 revenue growth"
- Test follow-up suggestions (click the suggested questions)
- Export results to CSV

### Customize
- Modify insight generation in `backend/app/services/insight_engine.py`
- Add new chart types in `backend/app/services/visualization_recommender.py`
- Customize KPI cards in `web/src/app/components/kpi-card.tsx`

---

## 🚀 Production Deployment

When ready for production:

1. **Set production environment variables:**
```bash
export JWT_SECRET_KEY=strong-random-secret
export OPENAI_API_KEY=sk-your-production-key
export DATABASE_URL=postgresql://user:pass@host/db
export CORS_ALLOW_ORIGINS=https://your-domain.com
```

2. **Build frontend:**
```bash
cd web
npm run build
# Deploy dist/ folder to static hosting (Vercel, Netlify, etc.)
```

3. **Deploy backend:**
```bash
cd backend
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app
# Or deploy to Render, Railway, AWS, etc.
```

---

## 🎉 Success!

You now have a **production-ready intelligent financial analytics platform** running locally!

**What makes it special:**
- ✅ No hardcoded responses
- ✅ Genuinely understands questions
- ✅ Generates appropriate visualizations
- ✅ Provides meaningful insights
- ✅ Accurate financial calculations
- ✅ Secure and validated SQL

**The transformation is complete. The intelligence is real. The analytics are dynamic.**

---

## 🆘 Need Help?

### Quick Checks
```bash
# Backend health
curl http://localhost:8000/api/v1/health

# Frontend build
cd web && npm run build

# Run tests
python test_transformation.py
```

### Common Commands
```bash
# Restart backend
PYTHONPATH=backend uvicorn app.main:app --reload --port 8000

# Restart frontend
cd web && VITE_API_BASE="http://localhost:8000" npm run dev

# Clear database (dev only - destroys data!)
rm local.db
```

---

**Ready to analyze! 📊**
