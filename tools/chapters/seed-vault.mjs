import {validateSeedHandoff,must,assertKeyBeforeMemory,assertSeedContinue,flagsOf} from './seed-vault-contract.mjs';
import {auditSeedVault} from '../audit-seed-vault.mjs';
export const id='seed-vault';
export const requirements=['light-handoff','preflight','image-review','transactions','key-before-memory','middle-continue','repeat-checks','runtime','presentation-raw'];

// Uses the shared ChapterRun. Session is the existing browser lifecycle/actions,
// supplied after coordinator resource handoff. No successful default callbacks.
export async function play(run,options={}) {
  const {handoff,session,checks}=options;
  validateSeedHandoff({...handoff,startingSave:run.startingSave});
  must(session && checks,'Seed needs coordinator page session and actual preflight callbacks; source preparation is not acceptance');
  for(const name of ['rules','presentation','budgets'])must(typeof checks[name]==='function','missing '+name+' check');
  const saves={before:JSON.parse(run.startingSave)};
  const milestone=async(name,action,verify)=>run.step(name,async()=>{
    await session[action]();return session.save(name);
  },verify);
  try {
    await run.preflight(['rules','presentation','budgets'].map(name=>({name,run:checks[name]})));
    await session.startEarned();
    saves.fitted=await milestone('brass-fitting','fitWeapon',s=>{
      const b=s.game.systems.bench,w=b.weapons.find(w=>w.weapon===session.selection.weapon);
      return w?.tier===3 && w.fitting===session.selection.fitting && b.wielding===w.weapon && flagsOf(s)['step.seeds.brass']===true;
    });
    saves.stair=await milestone('wren-stair','stair',s=>flagsOf(s)['step.seeds.stair']===true);
    saves.middle=await milestone('root-entry-before-fight','enterRoots',s=>flagsOf(s)['step.seeds.seal']===true && !flagsOf(s)['fight.10.won']);
    // save() returns unedited public-save bytes parsed for assertions. Continue uses UI then saves again.
    await run.step('middle-Continue',async()=>{saves.middleContinued=await session.continue('root-entry-before-fight');saves.middle=session.continueBefore;return saves.middleContinued;},s=>assertSeedContinue(saves.middle,s));
    await milestone('keeper-10','fight',s=>flagsOf(s)['fight.10.won']===true);
    saves.keyBeforeMemory=await milestone('key-before-memory29','takeKey',assertKeyBeforeMemory);
    await milestone('memory29-four-lines-and-cleanup','memory',s=>flagsOf(s)['scene.29']===true && flagsOf(s)['memory.seedvault']===true && session.cleanupObserved===true);
    await run.step('repeats',()=>session.repeats(),result=>result===true);
    saves.finalHome=await milestone('return-home','returnHome',s=>flagsOf(s)['vault.seedvault.cleared']===true && flagsOf(s)['vault.seedvault.sealed']===true);
    await run.step('final-Continue',async()=>{saves.finalContinued=await session.continue('return-home');saves.finalHome=session.continueBefore;return saves.finalContinued;},s=>assertSeedContinue(saves.finalHome,s));
    saves.after=saves.finalContinued;
    await run.step('independent-transaction-audit',async()=>auditSeedVault({...saves,scopes:await session.scopes(),selection:session.selection}),r=>r.pass===true);
    // File production and image review remain session obligations; accept verifies bytes.
    const files=await session.evidence();
    for(const name of [...requirements,'earned-save','state','continue','inventory','desktop-high','desktop-low','phone-high','phone-low']) {
      must(files[name],'missing Seed evidence '+name);run.evidence(name,files[name]);
    }
    return run.accept();
  } finally {await session.release();}
}
