## repcarparts

Project structure:

- **backend**: FastAPI + SQLAlchemy (SQLite)
- **frontend**: Vite + React

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

