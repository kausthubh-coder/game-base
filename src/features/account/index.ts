// Accounts: Clerk signs a player in, Convex keeps their profile, their worlds and the backup of the solo save.
// A guest plays with none of it loaded.
export { createAccount, type Account, type AccountOptions, type AccountState, type AccountStatus, type SaveDoor } from './account.ts';
export type { AccountLook } from './account.ui.ts';
export { agoText, asideKey, backupOf, readSaveText, replaceSave, sizeText, worldLine, type SaveFacts, type SaveStorage, type WorldCard } from './logic.ts';
export type { BackupLabel, BackupResult, Database, Session, SessionKeys, SessionUser } from './session.ts';
