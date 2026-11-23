export type Direction = 'up' | 'down' | 'left' | 'right';
export type Mode = 'classic' | 'wrap' | 'timed';
export type Point = { x: number; y: number };
export type Food = Point & { kind: 'normal' | 'gold' | 'slow' | 'shield' };
export type Game = { snake: Point[]; direction: Direction; food: Food; score: number; tick: number; seed: number; mode: Mode; over: boolean; won: boolean; shield: boolean; slow: number };
export const SIZE = 20;
const vectors: Record<Direction, Point> = { up: {x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
export const opposite = (a: Direction, b: Direction) => vectors[a].x + vectors[b].x === 0 && vectors[a].y + vectors[b].y === 0;
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
function random(seed: number): number { let x = seed >>> 0 || 1; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0; }
function spawn(snake: Point[], seed: number): {food: Food; seed: number} | null {
  const free: Point[] = [];
  for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) if (!snake.some(p=>p.x===x && p.y===y)) free.push({x,y});
  if (!free.length) return null;
  const next = random(seed); const kindRoll = random(next); const kinds: Food['kind'][] = ['gold','slow','shield'];
  return { food: {...free[next % free.length], kind: kindRoll % 10 < 3 ? kinds[kindRoll % 3] : 'normal'}, seed: kindRoll };
}
export function createGame(mode: Mode, seed: number): Game {
  const snake = [{x:9,y:10},{x:8,y:10},{x:7,y:10}]; const spawned = spawn(snake,seed)!;
  return {snake,direction:'right',food:spawned.food,score:0,tick:0,seed:spawned.seed,mode,over:false,won:false,shield:false,slow:0};
}
export function tick(game: Game, requested: Direction = game.direction): Game {
  if (game.over) return game;
  const direction = opposite(game.direction,requested) ? game.direction : requested;
  const v=vectors[direction]; let head={x:game.snake[0].x+v.x,y:game.snake[0].y+v.y};
  if (game.mode === 'wrap') head={x:(head.x+SIZE)%SIZE,y:(head.y+SIZE)%SIZE};
  const eats=same(head,game.food); const body=eats ? game.snake : game.snake.slice(0,-1);
  const wall=head.x<0 || head.y<0 || head.x>=SIZE || head.y>=SIZE;
  const hit=wall || body.some(p=>same(p,head));
  if (hit) {
    // A shield absorbs one collision by keeping the snake in place for this tick.
    return {...game,direction, tick:game.tick+1,over:!game.shield,shield:false,slow:Math.max(0,game.slow-1)};
  }
  const snake=[head,...body]; let score=game.score; let shield=game.shield; let slow=Math.max(0,game.slow-1); let food=game.food; let seed=game.seed; let won=false;
  if (eats) {
    score += food.kind==='gold' ? 30 : 10;
    if (food.kind==='shield') shield=true;
    if (food.kind==='slow') slow=30;
    const spawned=spawn(snake,seed); if (spawned) {food=spawned.food;seed=spawned.seed;} else won=true;
  }
  return {...game,snake,direction,food,seed,score,shield,slow,tick:game.tick+1,won,over:won};
}
export function interval(game: Game): number { return Math.max(65, 160 - Math.floor(game.score / 50) * 10) * (game.slow ? 1.5 : 1); }
