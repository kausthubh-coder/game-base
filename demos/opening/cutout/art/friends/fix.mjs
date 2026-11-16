import path from 'node:path';
import {dirFor,specFor,saveSpec,restoreMask,inset,fromPlate,warp} from '../shared/repair.mjs';
const name='friends',dir=dirFor(name),spec=await specFor(name);
for(const l of spec.layers.filter(l=>/^(friend-|boy$)/.test(l.id))){await restoreMask(name,l);await inset(path.join(dir,l.file));}
const fox=await fromPlate(name,'fox','M1614 719 Q1610 715 1611 722 L1618 739 Q1624 754 1617 771 L1614 779 L1619 789 L1621 820 Q1612 828 1608 835 L1602 847 Q1624 851 1638 846 C1659 851 1677 840 1680 828 Q1682 815 1668 799 L1658 779 L1652 755 L1653 744 L1660 730 Q1652 728 1645 733 L1640 725 L1629 727 Z');
await warp(path.join(dir,fox.file),path.join(dir,'fox-2.webp'),(x,y,w,h)=>{const t=Math.max(0,Math.min(1,(y/h-.72)/.26));const smooth=t*t*(3-2*t);return [x-1.8*smooth,y+2.4*smooth*Math.sin(x/w*Math.PI)];});
const l=spec.layers.find(l=>l.id==='fox');l.frames=['fox-2.webp'];l.note='Original fox paint and retraced full silhouette. Tail movement uses one smooth deformation, zero pasted pixels or rectangular splice. Head and upper torso stay fixed.';
await saveSpec(name,spec);
