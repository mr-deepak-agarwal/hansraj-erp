import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.students import router as students_router

load_dotenv()

app = FastAPI(
    title="School ERP API",
    version="1.0.0",
    description="Backend services for the School ERP, starting with student registration.",
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
