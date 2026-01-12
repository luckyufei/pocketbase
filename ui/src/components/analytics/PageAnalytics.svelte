<script>
    import { onMount, onDestroy } from "svelte";
    import { pageTitle } from "@/stores/app";
    import ApiClient from "@/utils/ApiClient";
    import AnalyticsCard from "./AnalyticsCard.svelte";
    import AnalyticsChart from "./AnalyticsChart.svelte";
    import TopList from "./TopList.svelte";
    import TimeRangeSelector from "../monitoring/TimeRangeSelector.svelte";

    $pageTitle = "Analytics";

    let stats = null;
    let topPages = [];
    let topSources = [];
    let devices = [];
    let isLoading = true;
    let error = null;
    let selectedRange = "7d";
    let selectedDays = 7;
    let refreshInterval;

    const REFRESH_INTERVAL = 60000; // 60 秒自动刷新

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
            isLoading = true;
            await Promise.all([
                loadStats(),
                loadTopPages(),
                loadTopSources(),
                loadDevices(),
            ]);
        } catch (err) {
            error = err.message || "加载数据失败";
        } finally {
            isLoading = false;
        }
    }

    async function loadStats() {
        try {
            const response = await ApiClient.send("/api/analytics/stats", {
                method: "GET",
                params: { range: selectedRange },
            });
            stats = {
                totalPV: response.summary?.totalPV || 0,
                totalUV: response.summary?.totalUV || 0,
                bounceRate: response.summary?.bounceRate || 0,
                avgSession: response.summary?.avgDur || 0,
                daily: response.daily || [],
            };
        } catch (err) {
            if (err.status !== 404) {
                throw err;
            }
            stats = null;
        }
    }

    async function loadTopPages() {
        try {
            const response = await ApiClient.send("/api/analytics/top-pages", {
                method: "GET",
                params: { range: selectedRange, limit: 10 },
            });
            topPages = (response.pages || []).map(p => ({
                path: p.path,
                pv: p.pv,
                uv: p.visitors,
            }));
        } catch (err) {
            topPages = [];
        }
    }

    async function loadTopSources() {
        try {
            const response = await ApiClient.send("/api/analytics/top-sources", {
                method: "GET",
                params: { range: selectedRange, limit: 10 },
            });
            topSources = (response.sources || []).map(s => ({
                source: s.source,
                visits: s.visitors,
                type: classifySource(s.source),
            }));
        } catch (err) {
            topSources = [];
        }
    }

    async function loadDevices() {
        try {
            const response = await ApiClient.send("/api/analytics/devices", {
                method: "GET",
                params: { range: selectedRange },
            });
            // 合并浏览器数据为设备列表
            devices = (response.browsers || []).map(b => ({
                device: b.name,
                count: b.visitors,
            }));
        } catch (err) {
            devices = [];
        }
    }

    function classifySource(source) {
        if (!source) return "direct";
        const s = source.toLowerCase();
        if (s.includes("google") || s.includes("bing") || s.includes("baidu") || s.includes("yahoo")) {
            return "search";
        }
        if (s.includes("facebook") || s.includes("twitter") || s.includes("linkedin") || s.includes("weibo")) {
            return "social";
        }
        return "referral";
    }

    function handleRangeChange(event) {
        const value = event.detail.value;
        selectedRange = value;
        switch (value) {
            case "1d":
                selectedDays = 1;
                break;
            case "7d":
                selectedDays = 7;
                break;
            case "30d":
                selectedDays = 30;
                break;
            case "90d":
                selectedDays = 90;
                break;
            default:
                selectedDays = 7;
        }
        loadData();
    }

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

    function formatPercent(value) {
        if (value === null || value === undefined) return "-";
        return (value * 100).toFixed(1) + "%";
    }
</script>

<div class="page-analytics">
    <header class="page-header">
        <h1>流量分析</h1>
        <div class="header-actions">
            <TimeRangeSelector 
                selected={selectedRange} 
                on:change={handleRangeChange}
                options={[
                    { value: "1d", label: "Today", hours: 24 },
                    { value: "7d", label: "Last 7 Days", hours: 168 },
                    { value: "30d", label: "Last 30 Days", hours: 720 },
                    { value: "90d", label: "Last 90 Days", hours: 2160 },
                ]}
            />
            <button type="button" class="btn btn-secondary btn-sm" on:click={loadData} disabled={isLoading}>
                <i class="ri-refresh-line" />
                刷新
            </button>
        </div>
    </header>

    {#if error}
        <div class="alert alert-danger m-b-base">
            <i class="ri-error-warning-line" />
            {error}
        </div>
    {/if}

    {#if isLoading && !stats}
        <div class="loading-overlay">
            <div class="loader" />
        </div>
    {:else}
        <!-- 核心指标卡片 -->
        <div class="metrics-grid">
            <AnalyticsCard 
                title="Page Views" 
                value={formatNumber(stats?.totalPV || 0)}
                trend={stats?.pvTrend}
                icon="ri-eye-line"
            />
            <AnalyticsCard 
                title="Unique Visitors" 
                value={formatNumber(stats?.totalUV || 0)}
                trend={stats?.uvTrend}
                icon="ri-user-line"
            />
            <AnalyticsCard 
                title="Bounce Rate" 
                value={formatPercent(stats?.bounceRate || 0)}
                trend={stats?.bounceTrend}
                icon="ri-logout-box-line"
                invertTrend={true}
            />
            <AnalyticsCard 
                title="Avg. Session" 
                value={stats?.avgSession ? Math.round(stats.avgSession) + "s" : "-"}
                trend={stats?.sessionTrend}
                icon="ri-time-line"
            />
        </div>

        <!-- PV/UV 趋势图 -->
        <div class="chart-section">
            <h2>流量趋势</h2>
            <AnalyticsChart 
                data={stats?.daily || []}
                days={selectedDays}
            />
        </div>

        <!-- Top 列表 -->
        <div class="lists-grid">
            <div class="list-section">
                <h2>热门页面</h2>
                <TopList 
                    items={topPages}
                    labelKey="path"
                    valueKey="pv"
                    secondaryKey="uv"
                    secondaryLabel="UV"
                />
            </div>
            <div class="list-section">
                <h2>流量来源</h2>
                <TopList 
                    items={topSources}
                    labelKey="source"
                    valueKey="visits"
                    showType={true}
                    typeKey="type"
                />
            </div>
            <div class="list-section">
                <h2>设备分布</h2>
                <TopList 
                    items={devices}
                    labelKey="device"
                    valueKey="count"
                    showPercent={true}
                    total={stats?.totalPV || 0}
                />
            </div>
        </div>
    {/if}
</div>

<style>
    .page-analytics {
        padding: var(--baseSpacing);
        max-width: 1400px;
        margin: 0 auto;
    }
    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--baseSpacing);
        flex-wrap: wrap;
        gap: 1rem;
    }
    .page-header h1 {
        margin: 0;
        font-size: 1.5rem;
    }
    .header-actions {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }
    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--baseSpacing);
        margin-bottom: var(--baseSpacing);
    }
    @media (max-width: 1200px) {
        .metrics-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }
    @media (max-width: 600px) {
        .metrics-grid {
            grid-template-columns: 1fr;
        }
    }
    .chart-section {
        background: var(--baseAlt1Color);
        border-radius: var(--baseRadius);
        padding: var(--baseSpacing);
        margin-bottom: var(--baseSpacing);
    }
    .chart-section h2 {
        margin: 0 0 var(--smSpacing) 0;
        font-size: 1rem;
        font-weight: 600;
    }
    .lists-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--baseSpacing);
    }
    @media (max-width: 1200px) {
        .lists-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }
    @media (max-width: 768px) {
        .lists-grid {
            grid-template-columns: 1fr;
        }
    }
    .list-section {
        background: var(--baseAlt1Color);
        border-radius: var(--baseRadius);
        padding: var(--baseSpacing);
    }
    .list-section h2 {
        margin: 0 0 var(--smSpacing) 0;
        font-size: 1rem;
        font-weight: 600;
    }
    .loading-overlay {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 300px;
    }
</style>
