// Carries the current request's id through async code, so services that never see `req` (the
// LLM layer, the rate limiter) can still tag their log lines with it.
import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();

/** Runs `fn` (and everything it awaits) with `reqId` as the current request id. */
export const runWithRequestId = (reqId, fn) => storage.run({ reqId }, fn);

export const currentRequestId = () => storage.getStore()?.reqId;
