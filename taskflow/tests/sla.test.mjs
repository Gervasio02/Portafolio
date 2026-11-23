import test from 'node:test';
import assert from 'node:assert/strict';
import { slaState } from '../server/operations.js';
test('SLA distinguishes absent, open, met, breached and unknown history',()=>{
  const deadline=new Date('2026-11-23T12:00:00Z');
  const card={column:{position:0},slaDueAt:deadline};
  assert.equal(slaState({...card,slaDueAt:null}),'unconfigured');
  assert.equal(slaState(card,deadline),'onTrack');
  assert.equal(slaState(card,new Date(deadline.getTime()+1)),'overdue');
  assert.equal(slaState({...card,column:{position:2}}),'unknown');
  assert.equal(slaState({...card,column:{position:2},completedAt:deadline}),'met');
  assert.equal(slaState({...card,column:{position:2},completedAt:new Date(deadline.getTime()+1)}),'breached');
});
