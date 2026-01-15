import os
import threading
import subprocess
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import uvicorn

from backend.database.database_init import init_db
from backend.database.connection import init_pool, close_pool, get_db
from backend.routers import hinteval, metrics, save_and_load
from backend.database.reset_db import reset_db_logic

FRONTEND_DIR = os.path.join(os.getcwd(), "frontend", "hinteval-ui")

def reset_db():
    try:
      
        db_generator = get_db()
        conn = next(db_generator) 
        reset_db_logic(conn)
        print("✅ Database reset successfully.", flush=True)
        init_db()
        
    except StopIteration:
        print("❌ Error: get_db() returned nothing (generator is empty).")
    except Exception as e:
        print(f"❌ Database reset failed: {e}")
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_pool()
    init_db()
    
    scheduler = BackgroundScheduler()
    trigger = CronTrigger(week='*/2', day_of_week='sun', hour=22, minute=0)
    scheduler.add_job(reset_db, trigger)
    scheduler.start()
    
    yield
    
    scheduler.shutdown()
    close_pool()

app = FastAPI(title="Hint Generation and Evaluation", version="1.0", lifespan=lifespan)

app.add_middleware(SessionMiddleware, secret_key="09d25ejklsj34094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(hinteval.router)
app.include_router(metrics.router)
app.include_router(save_and_load.router)

def run_frontend():
    npm_cmd = "npm.cmd" if os.name == 'nt' else "npm"
    try:
        subprocess.run([npm_cmd, "start"], cwd=FRONTEND_DIR, check=True)
    except Exception:
        pass

if __name__ == "__main__":
    #frontend_thread = threading.Thread(target=run_frontend, daemon=True)
    #frontend_thread.start()
    uvicorn.run("app:app", host="localhost", port=8000, reload=True)