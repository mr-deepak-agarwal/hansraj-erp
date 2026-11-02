import os
from typing import Any

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from supabase import Client, create_client

load_dotenv()

router = APIRouter(prefix="/api/students", tags=["students"])


def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        )
    return create_client(url, key)


class StudentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    gender: str = Field(..., pattern=r"^(Male|Female|Other)$")
    fathername: str = Field(..., min_length=1, max_length=120)
    adhar: str = Field(..., pattern=r"^[0-9]{12}$")
    mobile: str = Field(..., pattern=r"^[0-9]{10}$")
    emailid: EmailStr | None = None
    city: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=500)
    stdclass: str = Field(..., min_length=1, max_length=20)
    stddiv: str = Field(..., min_length=1, max_length=10)


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=dict[str, Any],
)
def register_student(payload: StudentCreate) -> dict[str, Any]:
    supabase = get_supabase()
    record = payload.model_dump(exclude_none=True)

    try:
        result = supabase.table("students").insert(record).execute()
    except Exception as exc:
        message = str(exc)
        if "students_adhar_key" in message or "duplicate" in message.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A student with this Aadhaar number is already registered.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to save student record. Please try again.",
        ) from exc

    data = result.data or []
    if not data:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Student insert returned no data.",
        )

    return {"message": "Student registered successfully.", "student": data[0]}
