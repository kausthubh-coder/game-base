/// <reference types="vite/client" />
// What every Convex test starts from: an empty in-memory backend, and players who are signed in.
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { api } from './_generated/api';
import schema from './schema';

/** Every Convex module, and no test or config file: those have a second dot in their name. */
export const modules = import.meta.glob(['./**/*.*s', '!./**/*.*.*']);

export const newBackend = () => convexTest(schema, modules);
export type Backend = ReturnType<typeof newBackend>;

/** The backend as a signed-in player sees it. `who` is the Clerk user id. */
export const as = (t: Backend, who: string) => t.withIdentity({ subject: who, issuer: 'https://clerk.test', name: who });

/** A signed-in player whose profile exists. */
export async function player(t: Backend, who: string) {
  const session = as(t, who);
  const profile = await session.mutation(api.profiles.ensure, {});
  return { session, id: profile._id };
}

/** The code a call was refused with, or `none` when it went through. */
export async function refusalOf(call: Promise<unknown>): Promise<string> {
  try {
    await call;
    return 'none';
  } catch (error) {
    if (error instanceof ConvexError) return String((error.data as { code?: unknown }).code);
    throw error;
  }
}
