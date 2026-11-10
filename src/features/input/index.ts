// Input: keys, the mouse, touch and a gamepad become intents, in one place.
export { createInput, type InputOptions, type InputStorage, type InputView } from './input.view.ts';
export {
  ACTIONS, DEFAULT_BINDINGS, STICK_DEAD_ZONE, actionLabel, codeLabel, emptyIntents, emptyRaw, loadBindings, mapIntents, maskIntents,
  moveToWorld, rebind, saveBindings, unbind,
  type Action, type Bindings, type InputMode, type Intents, type RawInput,
} from './intents.sim.ts';
