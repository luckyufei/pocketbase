<script>
    import { onMount, onDestroy } from "svelte";
    import { pageTitle } from "@/stores/app";
    import ApiClient from "@/utils/ApiClient";
    import TraceStats from "./TraceStats.svelte";
    import TraceFilters from "./TraceFilters.svelte";
    import TraceList from "./TraceList.svelte";
    import TraceDetail from "./TraceDetail.svelte";

    $pageTitle = "Trace Monitor";

    let stats = null;
    let traces = [];
    let totalItems = 0;
    let isLoading = true;
    let error = null;
    let selectedTrace = null;
    let refreshInterval;

    // 筛选参数
    let filters = {
        start_time: "",
        end_time: "",
        operation: "",
        status: "",
        trace_id: "",
        page: 1,
        perPage: 50
    };

    const REFRESH_INTERVAL = 30000; // 30 秒自动刷新

    onMount(async () => {
        await loadData();
        refreshInterval = setInterval(loadStats, REFRESH_INTERVAL);
    });

    onDestroy(() => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    });

    async function loadData() {
        try {
            error = null;
            await Promise.all([loadStats(), loadTraces()]);
        } catch (err) {
            error = err.message || "加载数据失败";
        } finally {
            isLoading = false;
        }
    }

    async function loadStats() {
        try {
            stats = await ApiClient.send("/api/traces/stats", {
                method: "GET",
                params: {
                    start_time: filters.start_time,
                    end_time: filters.end_time
                }
            });
        } catch (err) {
            if (err.status !== 404) {
                throw err;
            }
            stats = null;
        }
    }

    async function loadTraces() {
        try {
            const response = await ApiClient.send("/api/traces", {
                method: "GET",
                params: {
                    ...filters,
                    offset: (filters.page - 1) * filters.perPage,
                    limit: filters.perPage
                }
            });
            traces = response.items || [];
            totalItems = response.totalItems || 0;
        } catch (err) {
            traces = [];
            totalItems = 0;
            throw err;
        }
    }

    function handleFiltersChange(event) {
        filters = { ...filters, ...event.detail, page: 1 };
        isLoading = true;
        loadData().finally(() => {
            isLoading = false;
        });
    }

    function handlePageChange(event) {
        filters = { ...filters, page: event.detail };
        isLoading = true;
        loadTraces().finally(() => {
            isLoading = false;
        });
    }

    function handleTraceSelect(event) {
        selectedTrace = event.detail;
    }

    function handleTraceClose() {
        selectedTrace = null;
    }

    function handleRefresh() {
        isLoading = true;
        loadData().finally(() => {
            isLoading = false;
        });
    }
</script>

<div class="page-monitor">
    <header class="page-header">
        <h1>Trace 监控中心</h1>
        <div class="header-actions">
            <button 
                type="button" 
                class="btn btn-secondary btn-sm" 
                on:click={handleRefresh} 
                disabled={isLoading}
            >
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

    {#if isLoading && !stats}
        <div class="loading-placeholder">
            <div class="loader" />
            <span>加载中...</span>
        </div>
    {:else if !stats && traces.length === 0}
        <div class="empty-state">
            <i class="ri-line-chart-line" />
            <h3>暂无 Trace 数据</h3>
            <p>系统正在采集 Trace 数据，请稍后刷新页面。</p>
            <p class="txt-hint">Trace 数据会在有 HTTP 请求时自动生成</p>
        </div>
    {:else}
        <!-- 统计卡片 -->
        {#if stats}
            <section class="stats-section">
                <TraceStats {stats} />
            </section>
        {/if}

        <!-- 筛选器 -->
        <section class="filters-section">
            <TraceFilters 
                {filters} 
                on:change={handleFiltersChange}
            />
        </section>

        <!-- Trace 列表 -->
        <section class="traces-section">
            <TraceList 
                {traces}
                {totalItems}
                {isLoading}
                currentPage={filters.page}
                perPage={filters.perPage}
                on:pageChange={handlePageChange}
                on:traceSelect={handleTraceSelect}
            />
        </section>
    {/if}
</div>

<!-- Trace 详情弹窗 -->
{#if selectedTrace}
    <TraceDetail 
        trace={selectedTrace}
        on:close={handleTraceClose}
    />
{/if}

<style>
    .page-monitor {
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
        color: var(--txtPrimaryColor);
    }

    .header-actions {
        display: flex;
        gap: 12px;
        align-items: center;
    }

    .stats-section {
        margin-bottom: 24px;
    }

    .filters-section {
        margin-bottom: 24px;
    }

    .traces-section {
        margin-bottom: 24px;
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

    @media (max-width: 768px) {
        .page-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
        }
    }
</style>