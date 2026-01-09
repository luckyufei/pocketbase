<script>
    export let title = "";
    export let value = "-";
    export let trend = null;
    export let icon = "ri-bar-chart-line";
    export let invertTrend = false;

    $: trendClass = getTrendClass(trend, invertTrend);
    $: trendIcon = getTrendIcon(trend);
    $: trendValue = formatTrend(trend);

    function getTrendClass(t, invert) {
        if (t === null || t === undefined || t === 0) return "";
        const isPositive = t > 0;
        if (invert) {
            return isPositive ? "trend-negative" : "trend-positive";
        }
        return isPositive ? "trend-positive" : "trend-negative";
    }

    function getTrendIcon(t) {
        if (t === null || t === undefined || t === 0) return "";
        return t > 0 ? "ri-arrow-up-line" : "ri-arrow-down-line";
    }

    function formatTrend(t) {
        if (t === null || t === undefined) return "";
        const abs = Math.abs(t * 100);
        return abs.toFixed(1) + "%";
    }
</script>

<div class="analytics-card">
    <div class="card-icon">
        <i class={icon} />
    </div>
    <div class="card-content">
        <div class="card-title">{title}</div>
        <div class="card-value">{value}</div>
        {#if trend !== null && trend !== undefined}
            <div class="card-trend {trendClass}">
                {#if trendIcon}
                    <i class={trendIcon} />
                {/if}
                {trendValue}
            </div>
        {/if}
    </div>
</div>

<style>
    .analytics-card {
        background: var(--baseAlt1Color);
        border-radius: var(--baseRadius);
        padding: var(--baseSpacing);
        display: flex;
        gap: var(--smSpacing);
        align-items: flex-start;
    }
    .card-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--primaryColor);
        color: var(--baseColor);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        flex-shrink: 0;
    }
    .card-content {
        flex: 1;
        min-width: 0;
    }
    .card-title {
        font-size: 0.75rem;
        color: var(--txtHintColor);
        margin-bottom: 0.25rem;
    }
    .card-value {
        font-size: 1.5rem;
        font-weight: 700;
        line-height: 1.2;
    }
    .card-trend {
        font-size: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        margin-top: 0.25rem;
    }
    .card-trend.trend-positive {
        color: var(--successColor);
    }
    .card-trend.trend-negative {
        color: var(--dangerColor);
    }
</style>
