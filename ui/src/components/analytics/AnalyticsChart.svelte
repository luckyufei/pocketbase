<script>
    import { onMount, afterUpdate } from "svelte";

    export let data = [];
    export let days = 7;

    let chartContainer;
    let width = 0;
    let height = 200;

    $: chartData = processData(data);
    $: maxPV = Math.max(...chartData.map(d => d.pv), 1);
    $: maxUV = Math.max(...chartData.map(d => d.uv), 1);

    onMount(() => {
        if (chartContainer) {
            width = chartContainer.clientWidth;
        }
    });

    afterUpdate(() => {
        if (chartContainer) {
            width = chartContainer.clientWidth;
        }
    });

    function processData(raw) {
        if (!raw || raw.length === 0) {
            // 生成空数据
            const result = [];
            const now = new Date();
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                result.push({
                    date: formatDate(d),
                    pv: 0,
                    uv: 0,
                });
            }
            return result;
        }
        return raw;
    }

    function formatDate(d) {
        const month = (d.getMonth() + 1).toString().padStart(2, "0");
        const day = d.getDate().toString().padStart(2, "0");
        return `${month}-${day}`;
    }

    function getX(index) {
        const padding = 40;
        const usableWidth = width - padding * 2;
        const step = usableWidth / Math.max(chartData.length - 1, 1);
        return padding + index * step;
    }

    function getYPV(value) {
        const padding = 20;
        const usableHeight = height - padding * 2;
        return height - padding - (value / maxPV) * usableHeight;
    }

    function getYUV(value) {
        const padding = 20;
        const usableHeight = height - padding * 2;
        return height - padding - (value / maxUV) * usableHeight;
    }

    function generatePath(values, getY) {
        if (values.length === 0) return "";
        let path = `M ${getX(0)} ${getY(values[0])}`;
        for (let i = 1; i < values.length; i++) {
            path += ` L ${getX(i)} ${getY(values[i])}`;
        }
        return path;
    }

    $: pvPath = generatePath(chartData.map(d => d.pv), getYPV);
    $: uvPath = generatePath(chartData.map(d => d.uv), getYUV);
</script>

<div class="chart-container" bind:this={chartContainer}>
    {#if width > 0}
        <svg {width} {height}>
            <!-- Grid lines -->
            {#each [0, 0.25, 0.5, 0.75, 1] as ratio}
                <line 
                    x1="40" 
                    y1={height - 20 - ratio * (height - 40)} 
                    x2={width - 40} 
                    y2={height - 20 - ratio * (height - 40)}
                    stroke="var(--baseAlt2Color)"
                    stroke-dasharray="4"
                />
            {/each}

            <!-- PV Line -->
            <path 
                d={pvPath} 
                fill="none" 
                stroke="var(--primaryColor)" 
                stroke-width="2"
            />

            <!-- UV Line -->
            <path 
                d={uvPath} 
                fill="none" 
                stroke="var(--successColor)" 
                stroke-width="2"
            />

            <!-- Data points -->
            {#each chartData as d, i}
                <circle 
                    cx={getX(i)} 
                    cy={getYPV(d.pv)} 
                    r="3" 
                    fill="var(--primaryColor)"
                />
                <circle 
                    cx={getX(i)} 
                    cy={getYUV(d.uv)} 
                    r="3" 
                    fill="var(--successColor)"
                />
            {/each}

            <!-- X-axis labels -->
            {#each chartData as d, i}
                {#if i % Math.ceil(chartData.length / 7) === 0 || i === chartData.length - 1}
                    <text 
                        x={getX(i)} 
                        y={height - 5} 
                        text-anchor="middle" 
                        font-size="10"
                        fill="var(--txtHintColor)"
                    >
                        {d.date}
                    </text>
                {/if}
            {/each}
        </svg>
    {/if}

    <div class="chart-legend">
        <span class="legend-item">
            <span class="legend-color" style="background: var(--primaryColor)"></span>
            PV
        </span>
        <span class="legend-item">
            <span class="legend-color" style="background: var(--successColor)"></span>
            UV
        </span>
    </div>
</div>

<style>
    .chart-container {
        width: 100%;
        position: relative;
    }
    svg {
        display: block;
    }
    .chart-legend {
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin-top: 0.5rem;
    }
    .legend-item {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.75rem;
        color: var(--txtHintColor);
    }
    .legend-color {
        width: 12px;
        height: 3px;
        border-radius: 2px;
    }
</style>
