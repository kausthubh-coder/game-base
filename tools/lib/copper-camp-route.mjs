// Copper's browser runner must route around the physical tent, which block nav cannot see.
const local=(p,camp)=>{const t=camp.tent,c=Math.cos(t.rotation),s=Math.sin(t.rotation),dx=p.x-t.x,dz=p.z-t.z;return{x:c*dx-s*dz,z:s*dx+c*dz};};
const world=(p,camp)=>{const t=camp.tent,c=Math.cos(t.rotation),s=Math.sin(t.rotation);return{x:t.x+c*p.x+s*p.z,z:t.z-s*p.x+c*p.z};};
export function campContains(p,camp){const q=local(p,camp),b=camp.tentClearance;return Math.abs(q.x)<b.halfWidth&&Math.abs(q.z)<b.halfDepth;}
export function campSegmentBlocked(a,b,camp){
 const p=local(a,camp),q=local(b,camp),bounds=camp.tentClearance;
 let low=0,high=1;
 for(const [key,half]of[['x',bounds.halfWidth],['z',bounds.halfDepth]]){
  const d=q[key]-p[key],h=half-1e-7;
  if(Math.abs(d)<1e-10){if(Math.abs(p[key])>=h)return false;continue;}
  const t1=(-h-p[key])/d,t2=(h-p[key])/d;
  low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));
  if(low>high)return false;
 }
 return high>=0&&low<=1;
}
export function planCampRoute(start,goal,near,camp){
 if(!(near>0))throw Error('arrival tolerance must be positive');
 if(Math.hypot(start.x-goal.x,start.z-goal.z)<near&&!campContains(start,camp))return[];
 if(campContains(start,camp))throw Error('camp route starts inside the tent');
 const b=camp.tentClearance,p=local(goal,camp),margin=.65,w=b.halfWidth+margin,d=b.halfDepth+margin;
 const corners=[{x:-w,z:-d},{x:w,z:-d},{x:w,z:d},{x:-w,z:d}].map(q=>world(q,camp));
 let ends=[{...goal,near}];
 if(campContains(goal,camp)){
  const clamp=(v,h)=>Math.max(-h,Math.min(h,v));
  ends=[{x:-w,z:clamp(p.z,d)},{x:w,z:clamp(p.z,d)},{x:clamp(p.x,w),z:-d},{x:clamp(p.x,w),z:d}]
   .map(q=>({...world(q,camp),near:.1})).filter(q=>Math.hypot(q.x-goal.x,q.z-goal.z)<near-.2);
  if(!ends.length)throw Error('no clear endpoint within original arrival tolerance');
 }
 const nodes=[start,...corners,...ends],firstEnd=1+corners.length;
 const costs=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),used=new Set();costs[0]=0;
 let ending=-1;
 for(let count=0;count<nodes.length;count++){
  let at=-1;for(let i=0;i<nodes.length;i++)if(!used.has(i)&&(at<0||costs[i]<costs[at]))at=i;
  if(at<0||!Number.isFinite(costs[at]))break;
  if(at>=firstEnd){ending=at;break;}used.add(at);
  for(let next=1;next<nodes.length;next++){
   if(used.has(next)||campSegmentBlocked(nodes[at],nodes[next],camp))continue;
   const cost=costs[at]+Math.hypot(nodes[next].x-nodes[at].x,nodes[next].z-nodes[at].z);
   if(cost<costs[next]){costs[next]=cost;previous[next]=at;}
  }
 }
 if(ending<0)throw Error('no camp route within original arrival tolerance');
 const route=[];for(let at=ending;at>0;at=previous[at])route.unshift({...nodes[at],near:at>=firstEnd?nodes[at].near:.12});
 return route;
}
