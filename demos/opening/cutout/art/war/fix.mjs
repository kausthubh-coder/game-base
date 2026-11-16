import path from 'node:path';
import {dirFor,specFor,saveSpec,fromPlate,restoreMask,inset,warp} from '../shared/repair.mjs';
const name='war',dir=dirFor(name),spec=await specFor(name);
for(const l of spec.layers.filter(l=>/^(banner-|group-)/.test(l.id))){await restoreMask(name,l);await inset(path.join(dir,l.file));}
await fromPlate(name,'banner-white','M1279 303 C1301 290 1317 281 1336 288 C1355 293 1366 319 1383 330 C1400 341 1416 330 1428 338 C1436 343 1440 351 1446 356 C1436 360 1426 343 1414 353 L1398 368 C1413 371 1427 380 1435 389 C1418 379 1408 380 1397 385 C1374 398 1359 386 1344 372 C1324 351 1305 353 1279 367 Z');
for(const l of spec.layers.filter(l=>l.id.startsWith('banner-'))){const attachedRight=['green','red','blue'].includes(l.id.slice(7));for(let f=0;f<2;f++)await warp(path.join(dir,l.file),path.join(dir,l.frames[f]),(x,y,w,h)=>{const free=attachedRight?1-x/(w-1):x/(w-1);const dy=(f?-.9:.9)*3.2*free*free*Math.sin(x/w*3.1+y/h*.8);return [x,y-dy];});l.note='Approved cloth paint. The two frames deform the same paint by up to three source pixels, pinned at the pole.';}
await saveSpec(name,spec);
