
from fastapi import FastAPI, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError
from io import BytesIO
from pathlib import Path

app = FastAPI(title="Purchasing Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


# Pydantic Classes
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[Message]


# Receipt info for verication
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".pdf",
}

IMAGE_FORMATS = {
    ".jpg": "JPEG",
    ".jpeg": "JPEG",
    ".png": "PNG",
    ".webp": "WEBP",
}


async def validate_receipt(file: UploadFile):
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()

    # 1. Check the file extension
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {filename}"
        )

    # 2. Read up to 10 MB + 1 byte
    contents = await file.read(MAX_FILE_SIZE + 1)

    if not contents:
        raise HTTPException(
            status_code=400,
            detail=f"File is empty: {filename}"
        )

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds 10 MB: {filename}"
        )

    # 3. Verify image contents
    if extension in IMAGE_FORMATS:
        try:
            with Image.open(BytesIO(contents)) as image:
                if image.format != IMAGE_FORMATS[extension]:
                    raise HTTPException(
                        status_code=400,
                        detail=f"File format does not match extension: {filename}"
                    )

                image.verify()

        except (UnidentifiedImageError, OSError, ValueError):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid image file: {filename}"
            )

    # 4. Basic PDF signature check
    elif extension == ".pdf":
        if not contents.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid PDF file: {filename}"
            )

    # Reset the file position for later processing
    await file.seek(0)


@app.post("/chat")
async def chat(
    messages: str = Form(...),
    receipts: list[UploadFile] | None = File(None)
):
    # Convert the JSON string into validated messages
    request = ChatRequest.model_validate_json(messages)
    messages = request.messages
    if not messages:
        return{"response": "Please send a message."}

    latest_message = messages[-1].content
    previous_messages = messages[:-1]

    # Receipt Verification
    if receipts:
            for file in receipts:
                await validate_receipt(file)

            filenames = [file.filename for file in receipts]

            return {
                "response": (
                    f"Validated {len(receipts)} file(s): "
                    f"{', '.join(filenames)}"
                )
            }
        #filenames = [file.filename for file in receipts]
        #return {
        #    "response": f"Received {len(receipts)} file(s): {', '.join(filenames)}"
        #}
    if not previous_messages:
        response = (
            "I can help with that."
            "What project is this purchase for?"
        )
    else: 
        response = (
            f"Thanks for the additional information: "
            f"'{latest_message}'."
            f"I now have {len(messages)} messages"
            f"in our conversation"
        )
    return {"response": response}