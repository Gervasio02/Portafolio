import {createGame, tick, interval, opposite, type Direction, type Mode} from '../src/engine';

export type Move = {tick:number; direction:Direction};
export function verifyReplay(data:{mode:Mode;seed:number;ticks:number;moves:Move[];score:number}) {
 let game=createGame(data.mode,data.seed), index=0, duration=0;
 for(let n=0;n<data.ticks;n++) {
   if(game.over) return {valid:false, reason:'Movimientos después del final'};
   const move=data.moves[index];
   if(move && move.tick===n) {
     if(move.direction===game.direction || opposite(game.direction,move.direction)) return {valid:false,reason:'Giro inválido'};
     index++;
   }
   duration+=interval(game);
   if(data.mode==='timed' && duration>60000) return {valid:false,reason:'Tiempo excedido'};
   game=tick(game,move?.tick===n?move.direction:game.direction);
 }
 if(index!==data.moves.length) return {valid:false,reason:'Secuencia inválida'};
 if(data.mode==='timed' ? !game.over && duration+interval(game)<=60000 : !game.over) return {valid:false,reason:'Partida incompleta'};
 return {valid:game.score===data.score,reason:game.score===data.score?'':'Puntaje incorrecto'};
}
