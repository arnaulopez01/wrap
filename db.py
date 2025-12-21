import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

try:
    # Intentamos conectar manualmente con los datos del .env
    conn = psycopg2.connect(
        host="127.0.0.1",
        port="5432",
        user="user",
        password="pass",
        database="dwdb",
        connect_timeout=3
    )
    print("✅ ¡CONEXIÓN EXITOSA DESDE PYTHON!")
    conn.close()
except Exception as e:
    print(f"❌ FALLO DE CONEXIÓN: {e}")