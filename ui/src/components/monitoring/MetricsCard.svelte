<script>
    export let title = "";
    export let value = "";
    export let unit = "";
    export let icon = "";
    export let trend = null; // "up", "down", or null
    export let trendValue = "";
</script>

<div class="metrics-card">
    <div class="card-header">
        {#if icon}
            <i class={icon} aria-hidden="true" />
        {/if}
        <span class="title">{title}</span>
    </div>
    <div class="card-body">
        <span class="value">{value}</span>
        {#if unit}
            <span class="unit">{unit}</span>
        {/if}
    </div>
    {#if trend && trendValue}
        <div class="card-footer">
            <span class="trend {trend}">
                {#if trend === "up"}
                    <i class="ri-arrow-up-line" />
                {:else if trend === "down"}
                    <i class="ri-arrow-down-line" />
                {/if}
                {trendValue}
            </span>
        </div>
    {/if}
</div>

<style>
    .metrics-card {
        background: var(--baseColor);
        border-radius: var(--baseRadius);
        padding: 20px;
        border: 1px solid var(--baseAlt2Color);
        min-width: 180px;
        flex: 1;
    }

    .card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        color: var(--txtHintColor);
        font-size: 0.9em;
    }

    .card-header i {
        font-size: 1.1em;
    }

    .card-body {
        display: flex;
        align-items: baseline;
        gap: 4px;
    }

    .value {
        font-size: 2em;
        font-weight: 600;
        color: var(--txtPrimaryColor);
    }

    .unit {
        font-size: 0.9em;
        color: var(--txtHintColor);
    }

    .card-footer {
        margin-top: 8px;
    }

    .trend {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.85em;
        padding: 2px 8px;
        border-radius: 4px;
    }

    .trend.up {
        color: var(--dangerColor);
        background: var(--dangerAltColor);
    }

    .trend.down {
        color: var(--successColor);
        background: var(--successAltColor);
    }
</style>
