import { Agent } from 'undici';

export const dispatcher = new Agent({
  headersTimeout: 900_000,
  bodyTimeout: 900_000,
  connect: { timeout: 900_000 },
  autoSelectFamily: true,
});
