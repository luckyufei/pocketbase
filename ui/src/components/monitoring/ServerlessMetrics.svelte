<script>
    import { onMount, onDestroy } from "svelte";
    import ApiClient from "@/utils/ApiClient";
    import MetricsCard from "./MetricsCard.svelte";

    export let refreshInterval = 30000; // 刷新间隔

    let metrics = null;
    let isLoading = true;
    let error = null;
    let timer;

    onMount(async () => {
        await loadMetrics();
        timer = setInterval(loadMetrics, refreshInterval);
    });

    onDestroy(() => {
        if (timer) {
            clearInterval(timer);
        }
    });

    async function loadMetrics() {
        try {
            error = null;
            metrics = await ApiClient.send("/api/serverless/metrics", {
                method: "GET",
                params: { window: "5m" },
            });
        } catch (err) {
            if (err.status === 404) {
                // Serverless 未启用
                metrics = null;
            } else {
                error = err.message || "加载 Serverless 指标失败";
            }
        } finally {
            isLoading = false;
        }
    }

    function formatNumber(value, decimals = 2) {
        if (value === null || value === undefined) return "-";
        return Number(value).toFixed(decimals);
    }

    function formatBytes(bytes) {
        if (!bytes) return "-";
        const units = ["B", "KB", "MB", "GB"];
        let unitIndex = 0;
        let value = bytes;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
        }
        return `${value.toFixed(2)} ${units[unitIndex]}`;
    }

    function formatDuration(seconds) {
        if (!seconds) return "-";
        if (seconds < 60) return `${seconds.toFixed(0)}秒`;
        if (seconds < 3600) return `${(seconds / 60).toFixed(0)}分钟`;
        if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}小时`;
        return `${(seconds / 86400).toFixed(1)}天`;
    }

    function getErrorRateClass(rate) {
        if (rate >= 0.1) return "danger";
        if (rate >= 0.05) return "warning";
        return "success";
    }

    $: successRate = metrics?.totalRequests > 0 
        ? ((metrics.successCount / metrics.totalRequests) * 100).toFixed(1) 
        : "100";
    
    $: errorRate = metrics?.window?.errorRate ?? 0;
</script>

{#if isLoading && !metrics}
    <div class="loading-state">
        <div class="loader" />
        <span>加载 Serverless 指标...</span>
    </div>
{:else if error}
    <div class="error-state">
        <i class="ri-error-warning-line" />
        <span>{error}</span>
    </div>
{:else if !metrics}
    <div class="empty-state">
        <i class="ri-code-s-slash-line" />
        <span>Serverless 功能未启用</span>
    </div>
{:else}
    <div class="serverless-metrics">
        <h3 class="section-title">
            <i class="ri-code-s-slash-line" />
            Serverless 函数
        </h3>

        <!-- 概览卡片 -->
        <div class="metrics-cards">
            <MetricsCard
                title="总请求数"
                value={metrics.totalRequests || "0"}
                icon="ri-send-plane-line"
            />
            <MetricsCard
                title="成功率"
                value={successRate}
                unit="%"
                icon="ri-checkbox-circle-line"
            />
            <MetricsCard
                title="请求速率"
                value={formatNumber(metrics.window?.requestRate)}
                unit="/秒"
                icon="ri-speed-line"
            />
            <MetricsCard
                title="P95 延迟"
                value={formatNumber(metrics.window?.p95Latency)}
                unit="ms"
                icon="ri-timer-line"
            />
            <MetricsCard
                title="冷启动"
                value={metrics.coldStarts || "0"}
                icon="ri-temp-cold-line"
            />
            <MetricsCard
                title="运行时长"
                value={formatDuration(metrics.uptime)}
                icon="ri-time-line"
            />
        </div>

        <!-- 实例池状态 -->
        <div class="pool-section">
            <h4>实例池状态</h4>
            <div class="pool-stats">
                <div class="pool-stat">
                    <span class="label">池大小</span>
                    <span class="value">{metrics.pool?.size || 0}</span>
                </div>
                <div class="pool-stat">
                    <span class="label">可用</span>
                    <span class="value available">{metrics.pool?.available || 0}</span>
                </div>
                <div class="pool-stat">
                    <span class="label">使用中</span>
                    <span class="value in-use">{metrics.pool?.inUse || 0}</span>
                </div>
                <div class="pool-stat">
                    <span class="label">等待中</span>
                    <span class="value waiting">{metrics.pool?.waitingRequests || 0}</span>
                </div>
            </div>
            <div class="pool-bar">
                {#if metrics.pool?.size > 0}
                    <div 
                        class="bar-segment in-use" 
                        style="width: {(metrics.pool.inUse / metrics.pool.size) * 100}%"
                        title="使用中: {metrics.pool.inUse}"
                    />
                    <div 
                        class="bar-segment available" 
                        style="width: {(metrics.pool.available / metrics.pool.size) * 100}%"
                        title="可用: {metrics.pool.available}"
                    />
                {/if}
            </div>
        </div>

        <!-- 错误统计 -->
        {#if metrics.errorCount > 0 || metrics.timeoutCount > 0 || metrics.rejectedCount > 0}
            <div class="error-section">
                <h4>错误统计</h4>
                <div class="error-stats">
                    <div class="error-stat">
                        <span class="label">错误</span>
                        <span class="value error">{metrics.errorCount || 0}</span>
                    </div>
                    <div class="error-stat">
                        <span class="label">超时</span>
                        <span class="value timeout">{metrics.timeoutCount || 0}</span>
                    </div>
                    <div class="error-stat">
                        <span class="label">被拒绝</span>
                        <span class="value rejected">{metrics.rejectedCount || 0}</span>
                    </div>
                    <div class="error-stat">
                        <span class="label">错误率</span>
                        <span class="value {getErrorRateClass(errorRate)}">
                            {(errorRate * 100).toFixed(2)}%
                        </span>
                    </div>
                </div>
            </div>
        {/if}

        <!-- 延迟统计 -->
        <div class="latency-section">
            <h4>延迟统计</h4>
            <div class="latency-stats">
                <div class="latency-stat">
                    <span class="label">最小</span>
                    <span class="value">{formatNumber(metrics.latency?.min)} ms</span>
                </div>
                <div class="latency-stat">
                    <span class="label">平均</span>
                    <span class="value">{formatNumber(metrics.latency?.avg)} ms</span>
                </div>
                <div class="latency-stat">
                    <span class="label">最大</span>
                    <span class="value">{formatNumber(metrics.latency?.max)} ms</span>
                </div>
            </div>
        </div>

        <!-- 按函数统计 -->
        {#if metrics.byFunction && Object.keys(metrics.byFunction).length > 0}
            <div class="function-section">
                <h4>按函数统计</h4>
                <div class="function-table">
                    <table>
                        <thead>
                            <tr>
                                <th>函数名</th>
                                <th>请求数</th>
                                <th>成功</th>
                                <th>错误</th>
                                <th>P95延迟</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each Object.entries(metrics.byFunction) as [name, stats]}
                                <tr>
                                    <td class="function-name">{name}</td>
                                    <td>{stats.totalRequests}</td>
                                    <td class="success">{stats.successRequests}</td>
                                    <td class="error">{stats.errorRequests}</td>
                                    <td>{formatNumber(stats.p95Latency)} ms</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        {/if}

        <!-- 内存使用 -->
        <div class="memory-section">
            <h4>内存使用</h4>
            <div class="memory-stats">
                <div class="memory-stat">
                    <span class="label">当前使用</span>
                    <span class="value">{formatBytes(metrics.memory?.currentUsage)}</span>
                </div>
                <div class="memory-stat">
                    <span class="label">峰值使用</span>
                    <span class="value">{formatBytes(metrics.memory?.peakUsage)}</span>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .serverless-metrics {
        background: var(--baseColor);
        border-radius: var(--baseRadius);
        padding: 20px;
        border: 1px solid var(--baseAlt2Color);
    }

    .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 20px 0;
        font-size: 1.1em;
        color: var(--txtPrimaryColor);
    }

    .section-title i {
        color: var(--primaryColor);
    }

    .metrics-cards {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 24px;
    }

    .metrics-cards :global(.metrics-card) {
        min-width: 140px;
        flex: 1;
    }

    h4 {
        margin: 0 0 12px 0;
        font-size: 0.95em;
        color: var(--txtHintColor);
        font-weight: 500;
    }

    /* 池状态 */
    .pool-section, .error-section, .latency-section, .function-section, .memory-section {
        margin-bottom: 20px;
        padding-top: 16px;
        border-top: 1px solid var(--baseAlt2Color);
    }

    .pool-stats, .error-stats, .latency-stats, .memory-stats {
        display: flex;
        gap: 24px;
        margin-bottom: 12px;
    }

    .pool-stat, .error-stat, .latency-stat, .memory-stat {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .label {
        font-size: 0.85em;
        color: var(--txtHintColor);
    }

    .value {
        font-size: 1.2em;
        font-weight: 600;
        color: var(--txtPrimaryColor);
    }

    .value.available { color: var(--successColor); }
    .value.in-use { color: var(--primaryColor); }
    .value.waiting { color: var(--warningColor); }
    .value.error { color: var(--dangerColor); }
    .value.timeout { color: var(--warningColor); }
    .value.rejected { color: var(--dangerColor); }
    .value.success { color: var(--successColor); }
    .value.warning { color: var(--warningColor); }
    .value.danger { color: var(--dangerColor); }

    .pool-bar {
        display: flex;
        height: 8px;
        background: var(--baseAlt1Color);
        border-radius: 4px;
        overflow: hidden;
    }

    .bar-segment {
        height: 100%;
        transition: width 0.3s ease;
    }

    .bar-segment.in-use {
        background: var(--primaryColor);
    }

    .bar-segment.available {
        background: var(--successColor);
    }

    /* 函数表格 */
    .function-table {
        overflow-x: auto;
    }

    .function-table table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9em;
    }

    .function-table th,
    .function-table td {
        padding: 8px 12px;
        text-align: left;
        border-bottom: 1px solid var(--baseAlt2Color);
    }

    .function-table th {
        font-weight: 500;
        color: var(--txtHintColor);
        background: var(--baseAlt1Color);
    }

    .function-table .function-name {
        font-family: monospace;
        color: var(--primaryColor);
    }

    .function-table .success {
        color: var(--successColor);
    }

    .function-table .error {
        color: var(--dangerColor);
    }

    /* 状态 */
    .loading-state, .error-state, .empty-state {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 40px 20px;
        color: var(--txtHintColor);
        background: var(--baseColor);
        border-radius: var(--baseRadius);
        border: 1px solid var(--baseAlt2Color);
    }

    .error-state {
        color: var(--dangerColor);
    }

    .empty-state i, .error-state i {
        font-size: 1.5em;
    }

    @media (max-width: 768px) {
        .pool-stats, .error-stats, .latency-stats, .memory-stats {
            flex-wrap: wrap;
            gap: 16px;
        }

        .metrics-cards :global(.metrics-card) {
            min-width: 120px;
        }
    }
</style>
