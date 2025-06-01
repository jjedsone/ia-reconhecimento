from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import shutil
import tempfile
import os
import logging
import secrets
import uvicorn
if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)

app = FastAPI()

# Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CORS (permite frontend se conectar)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, coloque domínio correto
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBasic()

# Usuário fixo para autenticação simples
VALID_USERNAME = "admin"
VALID_PASSWORD = "1234"

def authenticate(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, VALID_USERNAME)
    correct_password = secrets.compare_digest(credentials.password, VALID_PASSWORD)
    if not (correct_username and correct_password):
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")
    return credentials.username

@app.post("/analisar")
async def analisar(file: UploadFile = File(...), username: str = Depends(authenticate)):
    try:
        temp_dir = tempfile.mkdtemp()
        temp_path = os.path.join(temp_dir, file.filename)

        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        logger.info(f"Arquivo recebido e salvo em: {temp_path}")

        # Simulação da análise de vídeo (pode integrar IA aqui)
        resultado = "humano"

        return {"resultado": resultado}

    except Exception as e:
        logger.error(f"Erro durante análise: {str(e)}")
        return {"resultado": "erro", "detalhes": str(e)}
