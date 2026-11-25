import os

# Las pruebas generales no deben chocar con el límite de peticiones;
# test_limites.py lo activa de forma explícita.
os.environ.setdefault("RATE_LIMIT", "off")
