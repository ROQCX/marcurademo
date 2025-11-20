/**
 * Rate limiter for LLM provider calls
 * Prevents exceeding API rate limits
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 60, // 60 requests per minute (OpenAI free tier is 3 RPM, paid tiers vary)
  windowMs: 60 * 1000, // 1 minute
};

// In-memory rate limit store
// In production with multiple instances, use Redis or similar
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Get rate limit config from environment or use defaults
 */
function getRateLimitConfig(): RateLimitConfig {
  return {
    maxRequests: process.env.LLM_RATE_LIMIT_MAX_REQUESTS
      ? parseInt(process.env.LLM_RATE_LIMIT_MAX_REQUESTS, 10)
      : DEFAULT_RATE_LIMIT.maxRequests,
    windowMs: process.env.LLM_RATE_LIMIT_WINDOW_MS
      ? parseInt(process.env.LLM_RATE_LIMIT_WINDOW_MS, 10)
      : DEFAULT_RATE_LIMIT.windowMs,
  };
}

/**
 * Check if request should be rate limited
 */
function checkRateLimit(
  key: string = "default",
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): { allowed: boolean; remaining: number; resetTime: number; waitMs?: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // Clean up expired entries periodically (1% chance)
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
  }

  if (!record || record.resetTime < now) {
    // New window or expired window
    const resetTime = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime,
    };
  }

  if (record.count >= config.maxRequests) {
    const waitMs = record.resetTime - now;
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
      waitMs,
    };
  }

  // Increment count
  record.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Rate limit decorator for async functions
 * Throws error if rate limit exceeded
 */
export async function withRateLimit<T>(
  fn: () => Promise<T>,
  key: string = "default"
): Promise<T> {
  const config = getRateLimitConfig();
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    const waitSeconds = Math.ceil((result.waitMs || 0) / 1000);
    throw new Error(
      `Rate limit exceeded. Please wait ${waitSeconds} seconds before making another request. ` +
      `Limit: ${config.maxRequests} requests per ${config.windowMs / 1000} seconds.`
    );
  }

  try {
    return await fn();
  } catch (error) {
    // On error, don't count towards rate limit (optional - you might want to count errors too)
    // For now, we'll count all attempts
    throw error;
  }
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(key: string = "default"): {
  remaining: number;
  resetTime: number;
  limit: number;
} {
  const config = getRateLimitConfig();
  const record = rateLimitStore.get(key);
  const now = Date.now();

  if (!record || record.resetTime < now) {
    return {
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
      limit: config.maxRequests,
    };
  }

  return {
    remaining: Math.max(0, config.maxRequests - record.count),
    resetTime: record.resetTime,
    limit: config.maxRequests,
  };
}

