import fs from 'node:fs/promises';
for(const [name,attempt]of [['hero-bow',1],['hero-staff',3],['hero-cut-back',1]])await fs.copyFile(`assets-src/fight-weapons/${name}-attempt-${attempt}.png`,`assets-src/raw/${name}-3.png`);
console.log('Restored selected new-sheet sources; published sheets are skipped by build-story. After rebuilding reverse cut, run match-recovery.mjs.');
