export function assertLightsShelter(reading, bedId) {
  const must = (ok, why) => {
    if (!ok) throw Error('shelter proof: ' + why);
  };
  must(reading?.bed?.id === bedId && reading.bed.kind === 'home_bed', 'exact added bed');
  const bed = reading.bed;
  must(
    bed.x === -5 && bed.y === 22 && bed.z === -236 && bed.quarterTurns === 0,
    'authored bed footprint',
  );
  const required = [];
  for (let x = -5; x <= -2; x++) for (let z = -237; z <= -233; z++) required.push({ x, y: 25, z });
  must(reading.cells?.length === required.length, 'complete roof cell count');
  for (const at of required) {
    const matches = reading.cells.filter((c) => c.x === at.x && c.y === at.y && c.z === at.z);
    must(
      matches.length === 1 && matches[0].key === 'oak_plank',
      'required roof cell ' + JSON.stringify(at),
    );
  }
  must(reading.bedCover?.length === 2, 'both bed cells observed');
  for (const z of [bed.z, bed.z + 1]) {
    const matches = reading.bedCover.filter(
      (c) => c.x === bed.x && c.z === z && c.y === 25 && c.key === 'oak_plank',
    );
    must(matches.length === 1, 'roof covers exact bed cell ' + z);
  }
  return true;
}
