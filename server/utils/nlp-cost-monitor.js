class CostMonitor {
    stats = new Map();
    DAILY_REQUEST_LIMIT = 1000; // Max requests per workspace per day
    DAILY_COST_LIMIT = 5.0; // Max $5 per workspace per day
    COST_PER_REQUEST = 0.002; // Estimated cost per request
    checkLimits(workspaceId) {
        const now = Date.now();
        const today = Math.floor(now / (24 * 60 * 60 * 1000));
        let stats = this.stats.get(workspaceId);
        // Reset daily stats if needed
        if (!stats ||
            Math.floor(stats.lastReset / (24 * 60 * 60 * 1000)) !== today) {
            stats = {
                requestCount: 0,
                lastReset: now,
                estimatedCost: 0,
            };
            this.stats.set(workspaceId, stats);
        }
        // Check request limit
        if (stats.requestCount >= this.DAILY_REQUEST_LIMIT) {
            return {
                allowed: false,
                reason: `Daily request limit reached (${this.DAILY_REQUEST_LIMIT}). Resets at midnight UTC.`,
            };
        }
        // Check cost limit
        if (stats.estimatedCost >= this.DAILY_COST_LIMIT) {
            return {
                allowed: false,
                reason: `Daily cost limit reached ($${this.DAILY_COST_LIMIT}). Resets at midnight UTC.`,
            };
        }
        return { allowed: true };
    }
    recordUsage(workspaceId) {
        const stats = this.stats.get(workspaceId);
        if (stats) {
            stats.requestCount++;
            stats.estimatedCost += this.COST_PER_REQUEST;
        }
    }
    getStats(workspaceId) {
        return this.stats.get(workspaceId) || null;
    }
}
export const costMonitor = new CostMonitor();
