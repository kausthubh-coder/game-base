// The words the chart of WorldJoin.tla uses. The statechart skill reads this file.
type Vars = {
  page: Record<string, string>;
  mode: Record<string, string>;
  sess: Record<string, string>;
  room: string[];
  stepping: boolean;
  posts: Record<string, string[]> | string[][];
  card: string[];
  closeDue: Record<string, boolean>;
  up: Record<string, boolean>;
};

export const title = 'Joining and leaving a world, and its card';

const names = (players: string[]): string => (players.length === 0 ? 'nobody' : [...players].sort().join(' and '));
const pending = (v: Vars): number => Object.keys(v.posts).length;

export const state = (v: Vars) => {
  const modes = Object.values(v.mode), pages = Object.values(v.page), sessions = Object.values(v.sess);
  const open = pages.filter((p) => p === 'open').length;
  const browser =
    open === 0 ? 'Every tab closed'
    : modes.includes('in') ? 'A tab is playing'
    : modes.includes('connecting') ? 'A tab is connecting'
    : modes.includes('stopped') ? 'A tab has stopped'
    : 'A tab is open, not connected';
  // A player whose tab went with no close on its way: only the 15-second check takes them out.
  const silent = Object.keys(v.sess).some((s) => v.sess[s] === 'in' && !v.up[s] && !v.closeDue[s]);
  const server =
    v.room.length > 0 ? `${names(v.room)} in the world` + (sessions.filter((s) => s === 'in').length < v.room.length ? ', no socket' : silent ? ', the tab gone silent' : '')
    : sessions.some((s) => s === 'checking') ? 'Asking Convex'
    : sessions.some((s) => s === 'waiting') ? 'Waiting for a hello'
    : 'Nobody in the world';
  return {
    Browser: browser,
    World: `${server}, ${v.stepping ? 'stepping' : 'asleep'}`,
    List: `The list shows ${names(v.card)}${pending(v) > 0 ? ', a card on its way' : ''}`,
  };
};

const WORDS: Record<string, string> = {
  OpenPage: 'a player opens the game',
  Connect: 'the tab opens a socket',
  ClosePage: 'the player closes the tab',
  Drop: 'the line drops',
  HearClose: 'the tab hears the server close it',
  Talk: 'the tab sends an input the server does not know',
  HelloArrives: 'the hello arrives',
  Answer: 'Convex answers',
  CloseArrives: 'the close arrives',
  HelloTimeout: '10 seconds pass with no hello',
  QuietDrop: '15 seconds pass with no input',
  CardTimer: '5 minutes pass',
  Restart: 'the world server restarts',
  Land: 'a card reaches Convex',
  Lost: 'a card post fails',
};

export const step = (action: string, from: Vars, to: Vars): string | null => {
  const told = Object.values(to.closeDue).filter(Boolean).length > Object.values(from.closeDue).filter(Boolean).length;
  if (action === 'ClosePage' || action === 'Drop') return `${WORDS[action]}${told || !Object.values(from.mode).some((m) => m === 'connecting' || m === 'in') ? '' : ', and the server is not told'}`;
  if (action === 'Answer') return to.room.length > from.room.length ? 'Convex lets the player in' : 'Convex answers: nobody gets in';
  return WORDS[action] ?? action;
};

export const group = (v: Vars): string => (v.room.length > 0 ? 'playing' : Object.values(v.sess).some((s) => s !== 'none') ? 'joining' : 'empty');
export const colors = { playing: 'teal', joining: 'orange', empty: 'tan' };
