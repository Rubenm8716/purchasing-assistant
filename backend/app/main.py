
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Purchasing Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class PurchaseRequest(BaseModel):
    message: str


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "Purchasing Assistant API is running"
    }


@app.post("/purchase")
def create_purchase(request: PurchaseRequest):
    return {
        "status": "received",
        "response": f"Your purchase request was received: {request.message}"
    }
