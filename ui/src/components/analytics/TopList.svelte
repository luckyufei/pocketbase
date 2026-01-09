<script>
    export let items = [];
    export let labelKey = "label";
    export let valueKey = "value";
    export let secondaryKey = null;
    export let secondaryLabel = "";
    export let showType = false;
    export let typeKey = "type";
    export let showPercent = false;
    export let total = 0;

    function formatNumber(value) {
        if (value === null || value === undefined) return "-";
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + "M";
        }
        if (value >= 1000) {
            return (value / 1000).toFixed(1) + "K";
        }
        return value.toString();
    }

    function getPercent(value) {
        if (!total || !value) return "0%";
        return ((value / total) * 100).toFixed(1) + "%";
    }

    function getTypeIcon(type) {
        switch (type) {
            case "search":
                return "ri-search-line";
            case "social":
                return "ri-share-line";
            case "direct":
                return "ri-cursor-line";
            default:
                return "ri-link";
        }
    }
</script>

<div class="top-list">
    {#if items.length === 0}
        <div class="empty-state">暂无数据</div>
    {:else}
        {#each items as item, i}
            <div class="list-item">
                <span class="item-rank">{i + 1}</span>
                <div class="item-content">
                    {#if showType}
                        <i class={getTypeIcon(item[typeKey])} />
                    {/if}
                    <span class="item-label" title={item[labelKey]}>
                        {item[labelKey] || "(unknown)"}
                    </span>
                </div>
                <div class="item-values">
                    <span class="item-value">{formatNumber(item[valueKey])}</span>
                    {#if secondaryKey && item[secondaryKey] !== undefined}
                        <span class="item-secondary">
                            {secondaryLabel}: {formatNumber(item[secondaryKey])}
                        </span>
                    {/if}
                    {#if showPercent}
                        <span class="item-percent">{getPercent(item[valueKey])}</span>
                    {/if}
                </div>
            </div>
        {/each}
    {/if}
</div>

<style>
    .top-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .empty-state {
        text-align: center;
        padding: 2rem;
        color: var(--txtHintColor);
    }
    .list-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        background: var(--baseColor);
        border-radius: var(--smRadius);
    }
    .item-rank {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--baseAlt2Color);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        font-weight: 600;
        flex-shrink: 0;
    }
    .item-content {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .item-content i {
        color: var(--txtHintColor);
        flex-shrink: 0;
    }
    .item-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 0.875rem;
    }
    .item-values {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-shrink: 0;
    }
    .item-value {
        font-weight: 600;
        font-size: 0.875rem;
    }
    .item-secondary {
        font-size: 0.75rem;
        color: var(--txtHintColor);
    }
    .item-percent {
        font-size: 0.75rem;
        color: var(--txtHintColor);
        min-width: 45px;
        text-align: right;
    }
</style>
