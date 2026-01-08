<script>
    export let stats = null;
    export let isLoading = false;

    function formatPercent(rate) {
        if (rate === undefined || rate === null) return "-";
        return (rate * 100).toFixed(1) + "%";
    }
</script>

<div class="stats-grid">
    {#if isLoading}
        <div class="stats-card">
            <span class="skeleton-loader" />
        </div>
        <div class="stats-card">
            <span class="skeleton-loader" />
        </div>
        <div class="stats-card">
            <span class="skeleton-loader" />
        </div>
        <div class="stats-card">
            <span class="skeleton-loader" />
        </div>
    {:else if stats}
        <div class="stats-card">
            <div class="stats-value txt-warning">{stats.pending || 0}</div>
            <div class="stats-label">Pending</div>
        </div>
        <div class="stats-card">
            <div class="stats-value txt-info">{stats.processing || 0}</div>
            <div class="stats-label">Processing</div>
        </div>
        <div class="stats-card">
            <div class="stats-value txt-success">{stats.completed || 0}</div>
            <div class="stats-label">Completed</div>
        </div>
        <div class="stats-card">
            <div class="stats-value txt-danger">{stats.failed || 0}</div>
            <div class="stats-label">Failed</div>
        </div>
        <div class="stats-card">
            <div class="stats-value">{stats.total || 0}</div>
            <div class="stats-label">Total</div>
        </div>
        <div class="stats-card">
            <div class="stats-value txt-success">{formatPercent(stats.success_rate)}</div>
            <div class="stats-label">Success Rate</div>
        </div>
    {:else}
        <div class="stats-card">
            <div class="stats-value">-</div>
            <div class="stats-label">No data</div>
        </div>
    {/if}
</div>

<style>
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .stats-card {
        background: var(--baseAlt1Color);
        border-radius: var(--baseRadius);
        padding: 1rem;
        text-align: center;
    }

    .stats-value {
        font-size: 1.5rem;
        font-weight: 600;
        line-height: 1.2;
    }

    .stats-label {
        font-size: 0.75rem;
        color: var(--txtHintColor);
        margin-top: 0.25rem;
    }
</style>
