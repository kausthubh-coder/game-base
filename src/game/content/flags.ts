// The flags act 1's systems share, in one place: each name, who writes it, and what it means. A system finishes
// another's quest step by setting a flag here, so the quest builder never imports another system. Build a name
// with `FLAG` rather than by hand, so a wrong id is a type error.
//
// The table `FLAGS` is the same list in words. docs/act1-foundation.md prints it, and a test checks every
// builder below has a row.

import type {
  ChoiceId, FarmId, FightNumber, KeystoneNumber, LedgerSection, MemoryId, PersonId, QuestId,
  SceneNumber, ShrineId, VaultId,
} from './ids.ts';
import type { OrderId } from './goods.ts';

export const FLAG = {
  // quests and scenes (the quest builder; the quest system writes the `quest.*` ones)
  questStarted: (quest: QuestId) => `quest.${quest}.started`,
  questDone: (quest: QuestId) => `quest.${quest}.done`,
  questStep: (quest: QuestId) => `quest.${quest}.step`,
  /** A stub step's own flag, until its builder gives it a real condition. */
  step: (quest: QuestId, step: string) => `step.${quest}.${step}`,
  scene: (scene: SceneNumber) => `scene.${scene}`,
  choice: (choice: ChoiceId) => `choice.${choice}`,
  /** The opening film has played. The opening's view sets it. */
  opening: 'story.opening',
  /** The name the hero signed on the deed, and the look picked at the mirror. The opening sets them. */
  heroName: 'hero.name',
  heroLook: 'hero.look',
  // fights (the fights builder)
  fightWon: (fight: FightNumber) => `fight.${fight}.won`,
  fightDenied: (fight: FightNumber) => `fight.${fight}.denied`,
  /** A fight with phases: how many are done. The Stag's has three. */
  fightPhase: (fight: FightNumber) => `fight.${fight}.phase`,
  /** A calmed beast of this kind has gone home to work: the thistlehog, the rootsnare, Bramble the boar. The farms read it. */
  beastHome: (kind: string) => `beast.${kind}.home`,
  /** The day number of the last meal the hero ate. A meal that day adds a heart. */
  mealDay: 'meal.day',
  // people and the settlement (the settlement builder)
  settler: (who: PersonId) => `settler.${who}`,
  job: (who: PersonId) => `job.${who}`,
  wish: (who: PersonId) => `wish.${who}`,
  /** One of a settler's three needs is not met: a bed under a roof, a meal today, a lamp. */
  need: (who: PersonId, what: 'bed' | 'meal' | 'lamp') => `need.${who}.${what}`,
  settlementStep: 'settlement.step',
  heartstone: 'heartstone',
  hearts: 'hearts',
  /** A settler's ask at the dinner table was granted. */
  dinner: (who: PersonId) => `dinner.${who}`,
  // farms and machines (the farms builder)
  farmBuilt: (farm: FarmId) => `farm.${farm}.built`,
  farmLiving: (farm: FarmId) => `farm.${farm}.living`,
  farmMode: (farm: FarmId) => `farm.${farm}.mode`,
  // goods and coin (the goods builder)
  coin: 'coin',
  ledgerFilled: (section: LedgerSection) => `ledger.${section}.filled`,
  pumpRunning: 'pump.running',
  /** Times a standing order of the ledger was delivered. */
  order: (id: OrderId) => `order.${id}`,
  /** Road lamps lit toward the vaults, one a night for each delivered. */
  roadLamps: 'road.lamps',
  /** Rings of land bought round the grant. */
  landRings: 'land.rings',
  /** The grade of the furniture in your homes: 1 plain, 2 good, 3 fine. */
  furnitureGrade: 'furniture.grade',
  // ruins and vaults (the ruins builder)
  memory: (stone: MemoryId) => `memory.${stone}`,
  keystone: (n: KeystoneNumber) => `keystone.${n}`,
  shrine: (shrine: ShrineId) => `shrine.${shrine}`,
  vaultCleared: (vault: VaultId) => `vault.${vault}.cleared`,
  vaultSealed: (vault: VaultId) => `vault.${vault}.sealed`,
  // the world (the region system: src/game/region/story.sim.ts)
  roadRelit: 'road.relit',
  landPumps: 'land.pumps',
  landHealed: 'land.healed',
  landGreen: 'land.green',
} as const;

export type FlagOwner = 'quests' | 'opening' | 'dialogue' | 'fights' | 'settlement' | 'farms' | 'goods' | 'ruins' | 'hall' | 'world';

export interface FlagRow {
  /** The name, with `<n>` or `<id>` where an id goes. */
  name: string;
  owner: FlagOwner;
  /** What it holds: `true`, a number, or the strings it can be. */
  value: string;
  means: string;
}

export const FLAGS: readonly FlagRow[] = [
  { name: 'quest.<id>.started', owner: 'quests', value: 'true', means: 'The quest has begun.' },
  { name: 'quest.<id>.done', owner: 'quests', value: 'true', means: 'Every step of the quest is done.' },
  { name: 'quest.<id>.step', owner: 'quests', value: 'a step id, or empty', means: 'The open step of an active quest.' },
  { name: 'step.<quest>.<step>', owner: 'quests', value: 'true', means: 'A stub step is done. Each goes away when its builder gives the step a real condition.' },
  { name: 'scene.<n>', owner: 'dialogue', value: 'true', means: 'Scene n of chapter 22 has played to its end, as talk, staged or film.' },
  { name: 'choice.<id>', owner: 'quests', value: 'one of CHOICES[id] in ids.ts', means: 'What the player chose at one of the story\'s choices. Later scenes and effects read it.' },
  { name: 'story.opening', owner: 'opening', value: 'true', means: 'The opening film has played, or was skipped.' },
  { name: 'hero.name', owner: 'opening', value: 'a name', means: 'The name the hero wrote on the deed at the grant. Lines that name the hero read it.' },
  { name: 'hero.look', owner: 'opening', value: 'a, b, c or d', means: 'The look picked at the mirror in the bunk room, one of the hero sheet\'s four.' },
  { name: 'fight.<n>.won', owner: 'fights', value: 'true', means: 'Fight n ended with the beast calmed, the machine shut down or the god freed.' },
  { name: 'fight.<n>.denied', owner: 'fights', value: 'true', means: 'The Mark was held out to a beast deeper than the Heartstone, and nothing happened. Fight 4.' },
  { name: 'fight.<n>.phase', owner: 'fights', value: 'a number', means: 'Phases of fight n done. The Stag\'s three are the chains, the overgrowth and the collar.' },
  { name: 'beast.<kind>.home', owner: 'fights', value: 'true', means: 'A beast of this kind was calmed and went home to work: the thistlehog (fight 2), the rootsnare (8), Bramble the boar (11).' },
  { name: 'meal.day', owner: 'settlement', value: 'a day number', means: 'The day the hero last ate a meal. A meal that day gives a heart.' },
  { name: 'settler.<id>', owner: 'settlement', value: 'true', means: 'This person lives on the player\'s land.' },
  { name: 'job.<id>', owner: 'settlement', value: 'a job name', means: 'The job a settler has now: kitchen or smokehouse, watch or yard, and so on.' },
  { name: 'wish.<id>', owner: 'settlement', value: 'true', means: 'This person\'s one wish has been granted.' },
  { name: 'need.<id>.<bed|meal|lamp>', owner: 'settlement', value: 'true or false', means: 'True while this settler\'s need is not met. Dialogue says the need line while it holds.' },
  { name: 'settlement.step', owner: 'settlement', value: 'camp, homestead, hamlet or freehold', means: 'How far the settlement has grown.' },
  { name: 'heartstone', owner: 'settlement', value: 'a number from 0 to 6', means: 'The Heartstone\'s level, as `settlement.heartstone()` gives it, written each time it changes.' },
  { name: 'hearts', owner: 'settlement', value: 'a number', means: 'The hearts the settlers have given: 10 for a granted ask at dinner. Level 5 needs 60.' },
  { name: 'dinner.<id>', owner: 'settlement', value: 'true', means: 'This settler\'s ask at the dinner table was granted: Gus\'s rested field, Hobb\'s window, Wren\'s pen back on Give.' },
  { name: 'farm.<id>.built', owner: 'farms', value: 'true', means: 'The farm has been built once.' },
  { name: 'farm.<id>.living', owner: 'farms', value: 'true or false', means: 'The farm is on Give and running, so it counts for the Heartstone.' },
  { name: 'farm.<id>.mode', owner: 'farms', value: 'give or take', means: 'The farm\'s setting.' },
  { name: 'coin', owner: 'goods', value: 'a number', means: 'The coin the player holds.' },
  { name: 'ledger.<section>.filled', owner: 'goods', value: 'true', means: 'A section of the queen\'s ledger is filled.' },
  { name: 'pump.running', owner: 'goods', value: 'true or false', means: 'The Order\'s pump is running in the player\'s field.' },
  { name: 'order.<id>', owner: 'goods', value: 'a number', means: 'Times a standing order of the ledger was delivered: road lamps, the town\'s next wheel. A pack order is 1 once the bag holds it all.' },
  { name: 'road.lamps', owner: 'goods', value: 'a number', means: 'Road lamps lit along the roads toward the vaults: one more a night for each delivery.' },
  { name: 'land.rings', owner: 'goods', value: 'a number', means: 'Rings of eight blocks bought round the grant. The region grows `grant()` by them.' },
  { name: 'furniture.grade', owner: 'goods', value: '1, 2 or 3', means: 'The furniture in the player\'s homes: plain, good or fine. Each use gives that many hearts.' },
  { name: 'memory.<id>', owner: 'ruins', value: 'true', means: 'The memory stone has been touched and its scene played.' },
  { name: 'keystone.<n>', owner: 'ruins', value: 'true', means: 'The player holds keystone n.' },
  { name: 'shrine.<id>', owner: 'ruins', value: 'heart or stamina', means: 'The shrine is restored, and what the player picked from it.' },
  { name: 'vault.<id>.cleared', owner: 'ruins', value: 'true', means: 'The vault\'s keeper is shut down and its keystone taken.' },
  { name: 'vault.<id>.sealed', owner: 'ruins', value: 'true', means: 'Calla\'s seal is on the vault\'s door.' },
  { name: 'road.relit', owner: 'world', value: 'true or false', means: 'The stretch of the High Road above your land glows, from scene 23 until the queen\'s ledger is full, and the land under it is grey.' },
  { name: 'land.pumps', owner: 'world', value: 'a number from 6 to 0', means: 'How many of the Order\'s pumps still stand in Hollowmere\'s edge fields. They come out as the ledger\'s sections fill.' },
  { name: 'land.healed', owner: 'world', value: 'true or false', means: 'The grey forest has its colour back: the Verdant Stag is free.' },
  { name: 'land.green', owner: 'world', value: 'a number', means: 'How many blocks round tended ground your plot\'s tired grass has greened, from the Heartstone\'s level.' },
  { name: 'night.fox, door.open, mark, custodian.awake, fox.calmed, fox.gone, heart.seen, night.over, night.told, hall.lit', owner: 'hall', value: 'true', means: 'The first night, as src/game/hall plays it. The night quest\'s steps read them.' },
];
