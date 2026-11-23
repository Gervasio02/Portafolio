import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.data import ingest, export_csv

@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(str(tmp_path / 'test.db')))

def test_dataset_clean_export_and_persistence(client):
    response = client.post('/api/datasets?filename=sample.csv', content=b'name,total\n A ,10\nA,10\nB,\n')
    assert response.status_code == 201
    data = response.json()
    assert data['report']['duplicates_removed'] == 1
    assert data['profile'][1]['sum'] == 10
    assert client.get(f"/api/datasets/{data['id']}").json()['rows'] == [['A','10'],['B','']]
    assert 'name,total' in client.get(f"/api/datasets/{data['id']}/export").text
    assert client.get('/api/datasets/999').status_code == 404

def test_reject_invalid_and_cross_origin(client):
    assert client.post('/api/datasets?filename=x.exe', content=b'abc').status_code == 422
    assert client.post('/api/datasets?filename=x.csv', content=b'a,a\n1,2').status_code == 422
    assert client.post('/api/documents', json={'text':'abc'}, headers={'Origin':'https://untrusted.example'}).status_code == 403
    assert client.post('/api/datasets', content=b'x' * (5*1024*1024+1)).status_code == 413

def test_csv_formula_export_is_inert():
    assert "'=SUM" in export_csv(['name'], [['=SUM(1)']])
    with pytest.raises(ValueError):
        ingest(b'a,b\n1,2,3', 'x.csv')

def test_human_review_and_duplicate_protection(client):
    text='Proveedor: Ficticio\nRUT: 12.345.678-5\nFolio: F-1\nFecha: 2026-11-23\nNeto: 100\nIVA: 19\nTotal: 119'
    result=client.post('/api/documents',json={'text':text})
    assert result.status_code == 201
    data=result.json()
    assert data['issues'] == []
    assert client.post('/api/documents',json={'text':text}).status_code == 409
    body={'fields':data['fields'],'decision':'approved','reason':'Comprobado con el original ficticio'}
    result=client.post(f"/api/documents/{data['id']}/review",json=body)
    assert result.status_code == 200
    assert len(result.json()['decisions']) == 1
    assert client.post(f"/api/documents/{data['id']}/review",json=body).status_code == 409

def test_missing_fields_never_filled_and_cannot_approve(client):
    data=client.post('/api/documents',json={'text':'Proveedor: Ficticio'}).json()
    assert data['fields']['total'] is None
    assert client.post(f"/api/documents/{data['id']}/review",json={'fields':data['fields'],'decision':'approved','reason':'Intento'}).status_code == 422

def test_pages_and_empty_observations(client):
    for page in ('datalab','docflow','cloudops'):
        assert client.get('/'+page).status_code == 200
    assert client.get('/api/cloudops').json()['history'] == []

def test_observations_are_measured_and_throttled(client, monkeypatch):
    import httpx
    monkeypatch.setattr(httpx, 'get', lambda *a, **k: httpx.Response(200))
    response = client.post('/api/cloudops/check')
    assert response.status_code == 200
    rows = response.json()['history']
    assert len(rows) == 5
    assert all(r['success'] == 1 and r['code'] == 200 and r['latency'] >= 0 for r in rows)
    assert client.post('/api/cloudops/check').status_code == 429

def test_excel_values_and_formulas():
    from openpyxl import Workbook
    from io import BytesIO
    workbook = Workbook()
    workbook.active.append(['name','amount'])
    workbook.active.append(['Ejemplo',100])
    stream = BytesIO()
    workbook.save(stream)
    assert ingest(stream.getvalue(), 'test.xlsx')[1] == [['Ejemplo','100']]
    workbook.active['B2'] = '=1+1'
    stream = BytesIO()
    workbook.save(stream)
    with pytest.raises(ValueError, match='fórmulas'):
        ingest(stream.getvalue(), 'test.xlsx')

def test_configured_access_protects_read_write_and_exports(tmp_path, monkeypatch):
    monkeypatch.setenv('LABS_ACCESS_TOKEN', 'private-local-demo-key-with-32-characters')
    c = TestClient(create_app(str(tmp_path / 'private.db')))
    assert c.get('/api/datasets').status_code == 401
    assert c.get('/api/cloudops').status_code == 401
    assert c.get('/api/documents').status_code == 401
    assert c.get('/api/datasets/1/export').status_code == 401
    assert c.post('/api/cloudops/check').status_code == 401
    assert c.get('/datalab').status_code == 200
    assert c.get('/api/datasets', headers={'Authorization':'Bearer wrong'}).status_code == 401
    assert c.get('/api/datasets', headers={'Authorization':'Bearer private-local-demo-key-with-32-characters'}).status_code == 200

def test_production_requires_access_key(tmp_path, monkeypatch):
    monkeypatch.setenv('APP_ENV', 'production')
    monkeypatch.delenv('LABS_ACCESS_TOKEN', raising=False)
    with pytest.raises(RuntimeError, match='LABS_ACCESS_TOKEN'):
        create_app(str(tmp_path / 'test.db'))
    monkeypatch.setenv('LABS_ACCESS_TOKEN', 'short')
    with pytest.raises(RuntimeError):
        create_app(str(tmp_path / 'test.db'))

def test_incident_lifecycle_and_service_validation(client):
    assert client.post('/api/cloudops/incidents', json={'service':'http://localhost','description':'No debe aceptar destinos'}).status_code == 422
    response = client.post('/api/cloudops/incidents', json={'service':'taskflow','description':'Fallo observado manualmente'})
    assert response.status_code == 201
    ident = response.json()['id']
    incident = client.get('/api/cloudops/incidents').json()[0]
    assert incident['source'] == 'manual' and incident['resolved_at'] is None
    assert client.post(f'/api/cloudops/incidents/{ident}/resolve').status_code == 200
    assert client.get('/api/cloudops/incidents').json()[0]['resolved_at'] is not None
    assert client.post(f'/api/cloudops/incidents/{ident}/resolve').status_code == 409

def test_failure_alerts_are_real_samples_and_do_not_duplicate(client, monkeypatch):
    import httpx
    from datetime import datetime, timedelta, timezone
    import app.main as module
    class SimulatedDatetime(datetime):
        offset = 0
        @classmethod
        def now(cls, tz=None):
            return datetime.now(tz) + timedelta(seconds=cls.offset)
    monkeypatch.setattr(module, 'datetime', SimulatedDatetime)
    monkeypatch.setattr(httpx, 'get', lambda *a, **k: httpx.Response(503))
    assert client.put('/api/cloudops/alerts/unknown', json={'enabled':True}).status_code == 422
    assert client.put('/api/cloudops/alerts/taskflow', json={'enabled':True,'consecutive_failures':0}).status_code == 422
    assert client.put('/api/cloudops/alerts/taskflow', json={'enabled':True,'consecutive_failures':2}).status_code == 200
    assert client.post('/api/cloudops/check').status_code == 200
    assert client.get('/api/cloudops/incidents').json() == []
    SimulatedDatetime.offset = 61
    assert client.post('/api/cloudops/check').status_code == 200
    incident = client.get('/api/cloudops/incidents').json()[0]
    assert incident['service'] == 'taskflow' and incident['source'] == 'alert'
    SimulatedDatetime.offset = 122
    assert client.post('/api/cloudops/check').status_code == 200
    assert len(client.get('/api/cloudops/incidents').json()) == 1
