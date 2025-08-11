const state = {
  requestsLog: [],
  ONE_MINUTE_MS: 60 * 1000, // Re-added this from your original class
  requestsToday: 0,
  lastDailyReset: new Date(), // Stores the last reset date
  REQUESTS_PER_DAY_LIMIT: 1000,
};

/**
 * Ensures the daily request count is reset at the beginning of a new day.
 * Sets a timer to check for the next daily reset.
 */
function ensureDailyReset() {
  const now = new Date();

  if (
    now.getDate() !== state.lastDailyReset.getDate() ||
    now.getMonth() !== state.lastDailyReset.getMonth() ||
    now.getFullYear() !== state.lastDailyReset.getFullYear()
  ) {
    state.requestsToday = 0;
    state.lastDailyReset = now;
    console.log('Daily request count reset.');
  }
  // Set a timer to check for daily reset at the start of the next day
  const msUntilMidnight =
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0) -
    now;
  setTimeout(() => {
    ensureDailyReset(); // Recurse to set the next day's timer
  }, msUntilMidnight);
}

// Initialize the daily reset on module load
ensureDailyReset();

/**
 * Determines if a new request can be made based on configured rate limits.
 * Call this function *before* making the API request.
 *
 * @param {number} tokensRequired - The number of tokens (e.g., bytes, complexity units) the current request will consume.
 * @returns {{allowed: boolean, reason?: string, inputLimit?: number, acceptableChunkSize?: number, tokensUsed?: number, requestsUsed?: number}} An object indicating if the request is allowed and details if it is.
 */
export function canMakeRequest(tokensRequired, aiInputLimit, rpmLimit) {
  const now = Date.now();

  // 1. Clean up old requests from the sliding window
  state.requestsLog = state.requestsLog.filter(
    (entry) => now - entry.timestamp < state.ONE_MINUTE_MS // Use ONE_MINUTE_MS from state
  );

  // 2. Check RPM limit
  if (state.requestsLog.length >= rpmLimit) {
    return { allowed: false, reason: 'RPM limit exceeded' };
  }

  // Check for excessively large individual requests
  if (tokensRequired > aiInputLimit) {
    return {
      allowed: false,
      reason: 'Request is too large',
      inputLimit: aiInputLimit,
      acceptableChunkSize: Math.ceil(tokensRequired / aiInputLimit),
    };
  }

  // 3. Check Tokens Per Minute limit
  const currentTokensInWindow = state.requestsLog.reduce(
    (sum, entry) => sum + entry.tokens,
    0
  );
  if (currentTokensInWindow + tokensRequired > aiInputLimit) {
    return { allowed: false, reason: 'Tokens per minute limit exceeded' };
  }

  ensureDailyReset();
  if (state.requestsToday >= state.REQUESTS_PER_DAY_LIMIT) {
    return { allowed: false, reason: 'Requests per day limit exceeded' };
  }

  // If all checks pass, allow and "pre-consume"
  state.requestsLog.push({ timestamp: now, tokens: tokensRequired });
  state.requestsToday += 1;

  return { allowed: true, tokensUsed: tokensRequired, requestsUsed: 1 };
}

// Export getter functions for external access to state data (optional, but good for logging)
export function getTotalTokensUsedInMinute() {
  // Ensure requestsLog is cleaned up before returning total
  const now = Date.now();
  state.requestsLog = state.requestsLog.filter(
    (entry) => now - entry.timestamp < state.ONE_MINUTE_MS
  );
  return state.requestsLog.reduce((sum, entry) => sum + entry.tokens, 0);
}

export function getRequestsThisMinute() {
  // Ensure requestsLog is cleaned up before returning length
  const now = Date.now();
  state.requestsLog = state.requestsLog.filter(
    (entry) => now - entry.timestamp < state.ONE_MINUTE_MS
  );
  return state.requestsLog.length;
}

export function getRequestsToday() {
  return state.requestsToday;
}
