import {beforeAll,describe,it,expect} from 'vitest';
import request from 'supertest';
import type {Express} from 'express';
let app:Express;
beforeAll(async()=>{process.env.ACCESS_SECRET='test-secret-which-is-at-least-32-characters';app=(await import('./app')).default});
describe('API',()=>{
 it('responde a la comprobación de salud',async()=>{const res=await request(app).get('/api/health');expect(res.status).toBe(200);expect(res.body.ok).toBe(true)});
 it('rechaza la creación de partidas anónimas',async()=>{const res=await request(app).post('/api/games').send({});expect(res.status).toBe(401)});
 it('rechaza entradas de registro inválidas',async()=>{const res=await request(app).post('/api/auth/register').send({name:'x',password:'short'});expect(res.status).toBe(400)});
});
