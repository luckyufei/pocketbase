<script>
    export let stats;
    export let compact = false;

    function formatNumber(value) {
        if (value === null || value === undefined) return "-";
        return Number(value).toLocaleString();
    }

    function formatDuration(microseconds) {
        if (microseconds === null || microseconds === undefined) return "-";
        
        const ms = microseconds / 1000;
        if (ms < 1) {
            return `${microseconds}μs`;
        } else if (ms < 1000) {
            return `${ms.toFixed(1)}ms`;
        } else {
            return `${(ms / 1000).toFixed(2)}s`;
        }
    }

    function formatPercentage(value) {
        if (value === null || value === undefined) return "-";
        return `${(value * 100).toFixed(1)}%`;
    }

    $: successRate = stats?.total_requests > 0 
        ? stats.success_count / stats.total_requests 
        : 0;

    $: errorRate = stats?.total_requests > 0 
        ? stats.error_count / stats.total_requests 
        : 0;
</script>

<div class="trace-stats" class:compact>
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-icon">
                <i class="ri-pulse-line" />
            </div>
            <div class="stat-content">
                <div class="stat-value">{formatNumber(stats?.total_requests)}</div>
                <div class="stat-label">总请求</div>
            </div>
        </div>

        <div class="stat-card success">
            <div class="stat-icon">
                <i class="ri-check-line" />
            </div>
            <div class="stat-content">
                <div class="stat-value">{formatNumber(stats?.success_count)}</div>
                <div class="stat-label">成功 <span class="stat-percentage">{formatPercentage(successRate)}</span></div>
            </div>
        </div>

        <div class="stat-card error">
            <div class="stat-icon">
                <i class="ri-error-warning-line" />
            </div>
            <div class="stat-content">
                <div class="stat-value">{formatNumber(stats?.error_count)}</div>
                <div class="stat-label">错误 <span class="stat-percentage">{formatPercentage(errorRate)}</span></div>
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-icon">
                <i class="ri-timer-line" />
            </div>
            <div class="stat-content">
                <div class="stat-value">{formatDuration(stats?.p50_latency)}</div>
                <div class="stat-label">P50</div>
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-icon">
                <i class="ri-timer-2-line" />
            </div>
            <div class="stat-content">
                <div class="stat-value">{formatDuration(stats?.p95_latency)}</div>
                <div class="stat-label">P95</div>
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-icon">
                <i class="ri-timer-flash-line" />
            </div>
            <div class="stat-content">
                <div class="stat-value">{formatDuration(stats?.p99_latency)}</div>
                <div class="stat-label">P99</div>
            </div>
        </div>
    </div>
</div>

<style>
    .trace-stats {
        background: var(--baseColor);
        border-radius: var(--baseRadius);
        border: 1px solid var(--baseAlt2Color);
        padding: 12px;
    }

    .trace-stats.compact {
        padding: 8px;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 10px;
    }

    .compact .stats-grid {
        gap: 8px;
    }

    @media (max-width: 1200px) {
        .stats-grid {
            grid-template-columns: repeat(3, 1fr);
        }
    }

    @media (max-width: 768px) {
        .stats-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    .stat-card {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: var(--baseAlt1Color);
        border-radius: var(--baseRadius);
        border: 1px solid var(--baseAlt2Color);
    }

    .compact .stat-card {
        padding: 8px 10px;
        gap: 6px;
    }

    .stat-card.success {
        border-color: var(--successColor);
    }

    .stat-card.success .stat-icon {
        color: var(--successColor);
    }

    .stat-card.error {
        border-color: var(--dangerColor);
    }

    .stat-card.error .stat-icon {
        color: var(--dangerColor);
    }

    .stat-icon {
        font-size: 1.25em;
        color: var(--txtHintColor);
        flex-shrink: 0;
    }

    .compact .stat-icon {
        font-size: 1.1em;
    }

    .stat-content {
        flex: 1;
        min-width: 0;
    }

    .stat-value {
        font-size: 1.1em;
        font-weight: 600;
        color: var(--txtPrimaryColor);
        line-height: 1.2;
    }

    .compact .stat-value {
        font-size: 1em;
    }

    .stat-label {
        font-size: 0.75em;
        color: var(--txtHintColor);
    }

    .stat-percentage {
        color: inherit;
    }

    .success .stat-percentage {
        color: var(--successColor);
    }

    .error .stat-percentage {
        color: var(--dangerColor);
    }
</style>
