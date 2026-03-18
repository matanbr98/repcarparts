# 🚗 repcarparts
Repcarparts is a full-stack web application that helps users track vehicle maintenance, manage replaced car parts, and maintain a complete service history.

## ✨ Features
- Add and manage cars
- Track maintenance and service records
- Record replaced parts
- Store notes and costs
- Simple and clean dashboard UI

## 🛠 Tech Stack
- **Backend:** FastAPI (Python)
- **Frontend:** React
- **Storage:** In-memory (MVP stage)

## 📦 Project Structure

- **backend**: FastAPI + SQLAlchemy (SQLite)
- **frontend**: React

### Backend
From `backend/`:
```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
The SQLite database file will be created at `backend/app.db`.
### Frontend

From `frontend/`:
```bash
npm install
npm run dev
```

