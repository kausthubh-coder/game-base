import {QUALITY_BUDGETS} from '../../src/content/quality.ts';
import {must,sha256,same} from './seed-vault-contract.mjs';
// Accept only the scene and location this chapter will actually use. Generic outdoor
// scene-29 pictures cannot stand in for earned-interior staging.
export function validateSeedPresentation(manifest,review,read) {
  must(manifest?.scene===29 && manifest.location==='seedvault-interior','scene 29 interior fixture required');
  must(manifest.source && manifest.runtime && manifest.samples?.length,'measurement provenance required');
  must(review?.pass===true,'human image review required');
  const images={};
  for(const device of ['desktop','phone'])for(const quality of ['high','low'])for(const moment of ['line-1','line-2','line-3','line-4','cleanup','repeat','repeat-cleanup']) {
    const candidates=manifest.samples.filter(s=>s.device===device && s.quality===quality && s.moment===moment);
    must(candidates.length===1,'missing/duplicate '+device+' '+quality+' '+moment);
    const s=candidates[0],size=device==='desktop'?[1366,768]:[390,844];
    same([s.width,s.height],size,'capture viewport');
    const bytes=read(s.image);must(bytes.length>0 && sha256(bytes)===s.sha256,'changed presentation image');images[s.image]=s.sha256;
    must(s.costFile && sha256(read(s.costFile))===s.costSHA,'changed raw cost frames');
    const frames=JSON.parse(read(s.costFile));must(Array.isArray(frames)&&frames.length>0,'missing raw cost frames');
    for(const f of frames){const b=QUALITY_BUDGETS[quality],c=f.costs?.total;must(f.costs?.addsUp===true&&c&&[c.drawCalls,c.triangles].every(n=>Number.isFinite(n)&&n>=0)&&c.drawCalls<=b.drawCalls&&c.triangles<=b.triangles,'raw frame quality budget exceeded');}
    must(s.costs?.addsUp===true,'cost breakdown does not add up');
    const b=QUALITY_BUDGETS[quality],c=s.costs.total;
    must(c && [c.drawCalls,c.triangles].every(v=>Number.isFinite(v)&&v>=0),'invalid actual costs');
    must(c.drawCalls<=b.drawCalls && c.triangles<=b.triangles,'quality budget exceeded');
    must(s.issues?.length===0,'presentation issues or missing inspection');
    if((moment==='cleanup'||moment==='repeat-cleanup'))must(s.cleanup?.playerVisible===true && s.cleanup?.hud===true && s.cleanup?.busy===false && s.cleanup?.talk===false && s.cleanup?.stageActors===0 && s.cleanup?.cameraReleased===true,'scene cleanup unproven');
  }
  must(new Set(manifest.samples.map(s=>s.image)).size===manifest.samples.length,'reused image across moments');
  same(images,review.images,'reviewed images');
  return true;
}
