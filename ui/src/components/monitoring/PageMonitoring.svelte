<script>
    import { onMount, onDestroy } from "svelte";
    import { pageTitle } from "@/stores/app";
    import ApiClient from "@/utils/ApiClient";
    import MetricsCard from "./MetricsCard.svelte";
    import MetricsChart from "./MetricsChart.svelte";
    import TimeRangeSelector from "./TimeRangeSelector.svelte";
    import ServerlessMetrics from "./ServerlessMetrics.svelte";

    $pageTitle = "System Monitoring";

    let currentMetrics = null;
    let historyData = [];
    let isLoading = true;
    let error = null;
    let selectedRange = "24h";
    let selectedHours = 24;
    let refreshInterval;

    const REFRESH_INTERVAL = 30000; // 30 秒自动刷新

    onMount(async () => {
        await loadData();
        refreshInterval = setInterval(loadData, REFRESH_INTERVAL);
    });

    onDestroy(() => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    });

    async function loadData() {
        try {
            error = null;
            await Promise.all([loadCurrentMetrics(), loadHistoryData()]);
        } catch (err) {
            error = err.message || "加载数据失败";
        } finally {
            isLoading = false;
        }
    }

    async function loadCurrentMetrics() {
        try {
            currentMetrics = await ApiClient.send("/api/system/metrics/current", {
                method: "GET",
            });
        } catch (err) {
            if (err.status !== 404) {
                throw err;
            }
            currentMetrics = null;
        }
    }

    async function loadHistoryData() {
        try {
            const response = await ApiClient.send("/api/system/metrics", {
                method: "GET",
                params: {
                    hours: selectedHours,
                    limit: 10000,
                },
            });
            historyData = response.items || [];
        } catch (err) {
            historyData = [];
            throw err;
        }
    }

    function handleRangeChange(event) {
        selectedRange = event.detail.value;
        selectedHours = event.detail.hours;
        isLoading = true;
        loadHistoryData().finally(() => {
            isLoading = false;
        });
    }

    function formatValue(value, decimals = 2) {
        if (value === null || value === undefined) return "-";
        return Number(value).toFixed(decimals);
    }
</script>

<div class="page-monitoring">
    <header class="page-header">
        <h1>系统监控</h1>
        <div class="header-actions">
            <TimeRangeSelector selected={selectedRange} on:change={handleRangeChange} />
            <button type="button" class="btn btn-secondary btn-sm" on:click={loadData} disabled={isLoading}>
                <i class="ri-refresh-line" />
                刷新
            </button>
        </div>
    </header>

    {#if error}
        <div class="alert alert-danger m-b-base">
            <i class="ri-error-warning-line" />
            <span>{error}</span>
        </div>
    {/if}

    {#if isLoading && !currentMetrics}
        <div class="loading-placeholder">
            <div class="loader" />
            <span>加载中...</span>
        </div>
    {:else if !currentMetrics && historyData.length === 0}
        <div class="empty-state">
            <i class="ri-bar-chart-box-line" />
            <h3>暂无监控数据</h3>
            <p>系统正在采集数据，请稍后刷新页面。</p>
            <p class="txt-hint">数据采集间隔为 1 分钟</p>
        </div>
    {:else}
        <!-- 实时指标卡片 -->
        <section class="metrics-cards">
            <MetricsCard
                title="CPU 使用率"
                value={formatValue(currentMetrics?.cpu_usage_percent)}
                unit="%"
                icon="ri-cpu-line"
            />
            <MetricsCard
                title="内存分配"
                value={formatValue(currentMetrics?.memory_alloc_mb)}
                unit="MB"
                icon="ri-ram-line"
            />
            <MetricsCard
                title="Goroutines"
                value={currentMetrics?.goroutines_count || "-"}
                icon="ri-stack-line"
            />
            <MetricsCard
                title="WAL 大小"
                value={formatValue(currentMetrics?.sqlite_wal_size_mb)}
                unit="MB"
                icon="ri-database-2-line"
            />
            <MetricsCard
                title="数据库连接"
                value={currentMetrics?.sqlite_open_conns || "-"}
                icon="ri-links-line"
            />
            <MetricsCard
                title="P95 延迟"
                value={formatValue(currentMetrics?.p95_latency_ms)}
                unit="ms"
                icon="ri-timer-line"
            />
            <MetricsCard
                title="5xx 错误"
                value={currentMetrics?.http_5xx_count || "0"}
                unit="/min"
                icon="ri-error-warning-line"
            />
        </section>

        <!-- 趋势图表 -->
        {#if historyData.length > 0}
            <section class="metrics-charts">
                <div class="chart-row">
                    <MetricsChart
                        data={historyData}
                        metric="cpu_usage_percent"
                        title="CPU 使用率趋势"
                        unit="%"
                        color="#3b82f6"
                    />
                    <MetricsChart
                        data={historyData}
                        metric="memory_alloc_mb"
                        title="内存分配趋势"
                        unit="MB"
                        color="#10b981"
                    />
                </div>
                <div class="chart-row">
                    <MetricsChart
                        data={historyData}
                        metric="goroutines_count"
                        title="Goroutines 数量趋势"
                        unit=""
                        color="#8b5cf6"
                    />
                    <MetricsChart
                        data={historyData}
                        metric="p95_latency_ms"
                        title="P95 延迟趋势"
                        unit="ms"
                        color="#f59e0b"
                    />
                </div>
                <div class="chart-row">
                    <MetricsChart
                        data={historyData}
                        metric="sqlite_wal_size_mb"
                        title="WAL 文件大小趋势"
                        unit="MB"
                        color="#06b6d4"
                    />
                    <MetricsChart
                        data={historyData}
                        metric="http_5xx_count"
                        title="5xx 错误趋势"
                        unit=""
                        color="#ef4444"
                    />
                </div>
            </section>
        {:else}
            <div class="no-history-data">
                <i class="ri-line-chart-line" />
                <p>暂无历史数据，请等待数据采集。</p>
            </div>
        {/if}

        <!-- Serverless 指标 -->
        <section class="serverless-section">
            <ServerlessMetrics refreshInterval={REFRESH_INTERVAL} />
        </section>
    {/if}
</div>

<style>
    .page-monitoring {
        padding: 20px;
        max-width: 1400px;
        margin: 0 auto;
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
    }

    .page-header h1 {
        margin: 0;
        font-size: 1.5em;
    }

    .header-actions {
        display: flex;
        gap: 12px;
        align-items: center;
    }

    .metrics-cards {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 24px;
    }

    .metrics-charts {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .chart-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 16px;
    }

    .loading-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        color: var(--txtHintColor);
    }

    .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: var(--txtHintColor);
    }

    .empty-state i {
        font-size: 4em;
        margin-bottom: 16px;
        opacity: 0.5;
    }

    .empty-state h3 {
        margin: 0 0 8px 0;
        color: var(--txtPrimaryColor);
    }

    .empty-state p {
        margin: 0 0 8px 0;
    }

    .no-history-data {
        text-align: center;
        padding: 40px 20px;
        color: var(--txtHintColor);
        background: var(--baseColor);
        border-radius: var(--baseRadius);
        border: 1px solid var(--baseAlt2Color);
    }

    .no-history-data i {
        font-size: 2em;
        margin-bottom: 12px;
        opacity: 0.5;
    }

    .serverless-section {
        margin-top: 24px;
    }

    @media (max-width: 768px) {
        .page-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
        }

        .chart-row {
            grid-template-columns: 1fr;
        }
    }
</style>
