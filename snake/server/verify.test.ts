import {describe,it,expect} from 'vitest';
import {createGame,tick} from '../src/engine';
import {verifyReplay} from './verify';
describe('verificación de partidas',()=>{
 it('acepta una partida reproducible y rechaza un puntaje inventado',()=>{let g=createGame('classic',10);while(!g.over)g=tick(g);const replay={mode:'classic' as const,seed:10,ticks:g.tick,moves:[],score:g.score};expect(verifyReplay(replay).valid).toBe(true);expect(verifyReplay({...replay,score:g.score+100}).valid).toBe(false)});
 it('rechaza partidas incompletas y giros imposibles',()=>{const r={mode:'classic' as const,seed:10,ticks:2,moves:[],score:0};expect(verifyReplay(r).valid).toBe(false);expect(verifyReplay({...r,moves:[{tick:0,direction:'left' as const}]}).valid).toBe(false)});
});
