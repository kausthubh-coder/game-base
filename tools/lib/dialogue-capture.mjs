/** Observe the rendered line without waiting past a later film line's lifetime. */
export async function presentedDialogueLine({ expected, first, settle, waitText, waitClear, read }) {
  if (first || expected.line.kind !== 'film') await settle();
  await waitText(expected.line.text);
  await waitClear();
  const actual = await read();
  return { expected, actual, same: sameDialogueLine(expected, actual) };
}

export function sameDialogueLine(expected, actual) {
  return !!actual && actual.line.text === expected.line.text && actual.line.scene === expected.line.scene;
}

/** The real talk log includes lines the camera or renderer could have missed. */
export function dialogueCoverage(before, captured, after) {
  const prefixKept = before.every((text, i) => after[i] === text);
  const actual = after.slice(before.length);
  return { captured, actual, prefixKept, complete: prefixKept && JSON.stringify(captured) === JSON.stringify(actual) };
}
