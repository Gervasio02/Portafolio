import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { boardRoutes } from '../server/boards.js';

const board='11111111-1111-4111-8111-111111111111';
const column='22222222-2222-4222-8222-222222222222';
const user='33333333-3333-4333-8333-333333333333';
function fixture({role='OWNER',count=1,limit=1,assignee=true}={}) {
  let created=false;
  const tx={
    $queryRaw:async()=>[],
    membership:{findUnique:async({where})=>where.boardId_userId.userId===user?(role?{role}:null):(assignee?{role:'EDITOR'}:null)},
    activity:{create:async({data})=>data,findMany:async()=>[]},
    column:{findFirst:async()=>({id:column,wipLimit:limit}),update:async({data})=>data},
    card:{findFirst:async()=>({id:column}),count:async()=>count,aggregate:async()=>({_max:{position:0}}),create:async({data})=>{created=true;return {id: column,...data};}},
  };
  const app=express();app.use(express.json());app.use((req,res,next)=>{req.userId=user;next();});
  app.use(boardRoutes({$transaction:async action=>action(tx)}));
  app.use((error,req,res,next)=>{void next;res.status(error.status||500).json({error:error.message});});
  return {app,created:()=>created};
}
test('a full WIP column rejects creation before any write',async()=>{
  const f=fixture();await request(f.app).post(`/boards/${board}/cards`).send({title:'Task',columnId:column}).expect(409);assert.equal(f.created(),false);
});
test('a viewer cannot modify WIP',async()=>{
  const f=fixture({role:'VIEWER'});await request(f.app).patch(`/boards/${board}/columns/${column}`).send({wipLimit:3}).expect(403);
});
test('WIP cannot be reduced below the current card count',async()=>{
  const f=fixture({count:4});await request(f.app).patch(`/boards/${board}/columns/${column}`).send({wipLimit:2}).expect(409);
});
test('an assignee must belong to the board',async()=>{
  const f=fixture({count:0,assignee:false});await request(f.app).post(`/boards/${board}/cards`).send({title:'Task',columnId:column,assigneeId:'44444444-4444-4444-8444-444444444444'}).expect(400);assert.equal(f.created(),false);
});
test('a valid assignment with available capacity can be created',async()=>{
  const f=fixture({count:0});const response=await request(f.app).post(`/boards/${board}/cards`).send({title:'Task',columnId:column,assigneeId:user}).expect(201);assert.equal(response.body.assigneeId,user);assert.equal(f.created(),true);
});
test('viewers can read activity but cannot comment',async()=>{
  const f=fixture({role:'VIEWER'});
  await request(f.app).get(`/boards/${board}/cards/${column}/activity`).expect(200,[]);
  await request(f.app).post(`/boards/${board}/cards/${column}/comments`).send({body:'Hello'}).expect(403);
});
test('non-members cannot read private activity',async()=>{
  const f=fixture({role:null});
  await request(f.app).get(`/boards/${board}/cards/${column}/activity`).expect(404);
});
test('comments are trimmed and empty or oversized input rejected',async()=>{
  const f=fixture({role:'EDITOR'});
  const route=`/boards/${board}/cards/${column}/comments`;
  const result=await request(f.app).post(route).send({body:'  Actualización  '}).expect(201);
  assert.equal(result.body.body,'Actualización');assert.equal(result.body.actorId,user);
  for(const body of ['   ','x'.repeat(2001)]) {
    const response=await request(f.app).post(route).send({body});
    assert.notEqual(response.status,201);
  }
});
