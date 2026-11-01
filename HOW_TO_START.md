# 🚀 How to Start Asklytics

## Quick Start (Automatic)

### Windows
Double-click **`START_HERE.bat`** in the Asklytics folder.

### Mac/Linux
```bash
cd Asklytics
./START_HERE.sh
```

This will automatically:
1. ✅ Create virtual environment
2. ✅ Install all dependencies
3. ✅ Start backend server (port 8000)
4. ✅ Start frontend server (port 5173)

---

## Manual Start (Step by Step)

### Step 1: Install Dependencies

#### Backend
```bash
cd Asklytics

# Create virtual environment (first time only)
python -m venv .venv

# Activate it
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

# Install packages
pip install -r backend/requirements.txt
```

#### Frontend
```bash
cd Asklytics/web
npm install
```

### Step 2: Start Backend Server

Open **Terminal 1**:
```bash
cd Asklytics/backend

# Windows:
..\\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Mac/Linux:
PYTHONPATH=. python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Wait for:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

### Step 3: Start Frontend Server

Open **Terminal 2**:
```bash
cd Asklytics/web

# Windows (PowerShell):
$env:VITE_API_BASE="http://localhost:8000"
npm run dev

# Windows (CMD):
set VITE_API_BASE=http://localhost:8000 && npm run dev

# Mac/Linux:
VITE_API_BASE="http://localhost:8000" npm run dev
```

Wait for:
```
VITE v6.3.5 ready in XXX ms

➜  Local:   http://localhost:5173/
```

---

## 🌐 Access the Application

### **Main Application**
**URL:** http://localhost:5173

This is the **Asklytics web interface** where you can:
- Register/Login
- Upload financial PDFs
- Ask questions in natural language
- View intelligent analytics

### **API Documentation**
**URL:** http://localhost:8000/docs

Interactive API documentation (Swagger UI)

### **API Health Check**
**URL:** http://localhost:8000/api/v1/health

Should return: `{"status":"healthy"}`

---

## ✅ First Time Setup

1. **Open browser:** http://localhost:5173
2. **Register account:**
   - Click "Register"
   - Email: `your-email@example.com`
   - Password: `your-password`
3. **Login** with same credentials
4. **Navigate to Chat** page
5. **Upload PDF:**
   - Click "Upload" button
   - Select any financial PDF
   - Wait for processing (~5-15 seconds)
6. **Ask questions:**
   ```
   "What is the total revenue?"
   "Show me revenue trend over time"
   "Compare revenue and expenses"
   ```

---

## 🛑 How to Stop

### Using Start Script
Press `Ctrl+C` in the terminal

### Manual
Close both terminal windows or press `Ctrl+C` in each

---

## 🐛 Troubleshooting

### Port Already in Use
If port 8000 or 5173 is busy:

**Backend (change to 8001):**
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

**Frontend:**
```bash
# Update VITE_API_BASE
VITE_API_BASE="http://localhost:8001" npm run dev
```

### Dependencies Not Installing
```bash
# Backend
pip install --upgrade pip
pip install -r backend/requirements.txt

# Frontend
npm cache clean --force
npm install
```

### "Command not found: uvicorn"
Make sure virtual environment is activated:
```bash
# Windows
.venv\Scripts\activate

# Mac/Linux
source .venv/bin/activate
```

### Frontend Won't Start
```bash
cd web
rm -rf node_modules .vite
npm install
npm run dev
```

---

## 📊 What to Expect

When both servers are running successfully:

### Backend Console
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Frontend Console
```
VITE v6.3.5 ready in 1234 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Browser
- **http://localhost:5173** → Asklytics application
- **http://localhost:8000/docs** → API documentation

---

## 🎉 Success!

You should now see the Asklytics login/register page in your browser!

**Next steps:**
1. Register an account
2. Upload a financial PDF
3. Ask intelligent questions
4. See dynamic, data-driven responses!

---

**Need help?** Check the comprehensive guides:
- `QUICKSTART.md` - 5-minute setup guide
- `TESTING_GUIDE.md` - Testing instructions
- `TRANSFORMATION_SUMMARY.md` - Technical details
