<script>
    import { onMount, onDestroy } from "svelte";
    import Chart from "chart.js/auto";
    import "chartjs-adapter-luxon";

    export let data = [];
    export let metric = "cpu_usage_percent";
    export let title = "CPU Usage";
    export let unit = "%";
    export let color = "#3b82f6";

    let canvas;
    let chart;

    $: if (chart && data) {
        updateChart();
    }

    function updateChart() {
        if (!chart) return;

        const labels = data.map((d) => new Date(d.timestamp));
        const values = data.map((d) => d[metric] || 0);

        chart.data.labels = labels;
        chart.data.datasets[0].data = values;
        chart.update("none");
    }

    onMount(() => {
        const ctx = canvas.getContext("2d");

        chart = new Chart(ctx, {
            type: "line",
            data: {
                labels: [],
                datasets: [
                    {
                        label: title,
                        data: [],
                        borderColor: color,
                        backgroundColor: color + "20",
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: "index",
                },
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${title}: ${context.parsed.y.toFixed(2)} ${unit}`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        type: "time",
                        time: {
                            tooltipFormat: "yyyy-MM-dd HH:mm",
                            displayFormats: {
                                minute: "HH:mm",
                                hour: "HH:mm",
                                day: "MM-dd",
                            },
                        },
                        grid: {
                            display: false,
                        },
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: "rgba(0, 0, 0, 0.05)",
                        },
                        ticks: {
                            callback: (value) => `${value}${unit}`,
                        },
                    },
                },
            },
        });

        updateChart();
    });

    onDestroy(() => {
        if (chart) {
            chart.destroy();
        }
    });
</script>

<div class="chart-container">
    <h4 class="chart-title">{title}</h4>
    <div class="chart-wrapper">
        <canvas bind:this={canvas}></canvas>
    </div>
</div>

<style>
    .chart-container {
        background: var(--baseColor);
        border-radius: var(--baseRadius);
        padding: 16px;
        border: 1px solid var(--baseAlt2Color);
    }

    .chart-title {
        margin: 0 0 12px 0;
        font-size: 0.95em;
        font-weight: 500;
        color: var(--txtPrimaryColor);
    }

    .chart-wrapper {
        height: 200px;
        position: relative;
    }
</style>
