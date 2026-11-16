// Diagnostic only: retain real submitted meshes and exact frame costs, including shadows.
export async function storyCosts(page) {
 return page.evaluate(async()=>{
 const g=window.__game,r=g.view.renderer,draw=r.renderBufferDirect;
 let meshes=[],last=0;
 r.renderBufferDirect=function(...args){
   const b=r.info.render.calls,t=r.info.render.triangles;
   if(b<last)meshes=[];
   draw.apply(this,args);last=r.info.render.calls;
   if(last>b){const o=args[4],path=[];for(let p=o;p;p=p.parent)path.push(p.name||p.type);
   meshes.push({id:o.id,path:path.reverse().join('/'),geometry:o.geometry?.uuid,instances:o.count,material:args[3].name,shadow:args[1]===null,calls:last-b,triangles:r.info.render.triangles-t});}
 };
 const frames=[];
 try{for(let i=0;i<45;i++){await new Promise(requestAnimationFrame);const costs=g.costs();frames.push({costs,meshes:meshes.slice(),camera:g.view.ctx.camera.position.toArray()});}}
 finally{r.renderBufferDirect=draw;}
 return frames;
 });
}
export function costIssues(frames,quality) {
 const calls=quality==='low'?80:150,triangles=quality==='low'?150000:400000;
 return frames.flatMap((f,i)=>!f.costs.addsUp||f.costs.total.drawCalls>calls||f.costs.total.triangles>triangles?[{frame:i,total:f.costs.total,addsUp:f.costs.addsUp}]:[]);
}
