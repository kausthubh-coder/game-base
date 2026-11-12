// Accounts: Clerk signs a player in, and Convex keeps their profile and a copy of their save that follows
// them to every device. A guest plays with none of it loaded.
export { createAccount, type Account, type AccountOptions, type AccountState, type AccountStatus, type SaveDoor } from './account.ts';
export type { AccountLook } from './account.ui.ts';
export { agoText, asideKey, markKey, readSaveText, replaceSave, sizeText, syncStep, type CloudSave, type SaveFacts, type SaveStorage, type SyncMark, type SyncStep } from './logic.ts';
export type { Database, Session, SessionKeys, SessionUser, UploadLabel, UploadResult } from './session.ts';
