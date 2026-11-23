import {describe,it,expect} from 'vitest';
import {createGame,tick,interval} from './engine';
describe('motor determinista',()=>{
 it('reproduce el mismo resultado con la misma semilla y movimientos',()=>{let a=createGame('classic',42),b=createGame('classic',42);for(const d of ['up','left','down','right'] as const){a=tick(a,d);b=tick(b,d)}expect(a).toEqual(b)});
 it('detecta una pared en modo clásico',()=>{let g=createGame('classic',3);for(let i=0;i<11;i++)g=tick(g);expect(g.over).toBe(true)});
 it('atraviesa paredes en modo sin paredes',()=>{let g=createGame('wrap',3);for(let i=0;i<11;i++)g=tick(g);expect(g.over).toBe(false);expect(g.snake[0].x).toBe(0)});
 it('rechaza un giro opuesto',()=>{const g=tick(createGame('classic',3),'left');expect(g.direction).toBe('right')});
 it('aumenta la velocidad con puntos',()=>{const g=createGame('classic',3);expect(interval({...g,score:100})).toBeLessThan(interval(g))});
});
