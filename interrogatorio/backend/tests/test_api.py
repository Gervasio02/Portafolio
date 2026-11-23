from fastapi.testclient import TestClient
from app.main import app

def test_guest_game_flow():
    c=TestClient(app); token=c.post("/auth/guest").json()["token"]; h={"Authorization":"Bearer "+token}
    game=c.post("/games",json={"seed":42,"difficulty":"facil"},headers=h).json()
    result=c.post(f"/games/{game['id']}/question",json={"suspect_id":0,"message":"¿Dónde estabas?"},headers=h)
    assert result.status_code==200 and "data:" in result.text
    result=c.post(f"/games/{game['id']}/accuse",json={"suspect_id":0},headers=h)
    assert result.status_code==200 and "timeline" in result.json()
    assert c.get(f"/games/{game['id']}").status_code==401
