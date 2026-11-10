// Dialogue: conversations as data, the interpreter that runs one, and the box that shows it.
export { createDialogue, type DialogueOptions, type DialogueView } from './dialogue.ui.ts';
export {
  MAX_CHOICES, Talk, Typewriter, applyEffects, checkConversation, isVoiced, passes, readFlag,
  type Choice, type Condition, type Conversation, type Effect, type FlagValue, type Flags, type Line, type OfferedChoice, type Said, type Speaker,
} from './dialogue.sim.ts';
