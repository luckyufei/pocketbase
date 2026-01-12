<script>
    import { onMount, onDestroy } from "svelte";
    import { pageTitle } from "@/stores/app";
    import ApiClient from "@/utils/ApiClient";
    import PageWrapper from "@/components/base/PageWrapper.svelte";
    import RefreshButton from "@/components/base/RefreshButton.svelte";
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

    $: totalPages = Math.ceil(totalItems / filters.perPage);
</script>

<PageWrapper class="flex-content">
    <header class="page-header">
        <nav class="breadcrumbs">
            <div class="breadcrumb-item">Trace 监控中心</div>
        </nav>

        <RefreshButton on:refresh={handleRefresh} />

        <div class="btns-group">
            {#if stats}
                <span class="label label-success m-r-5">
                    成功: {stats.success_count?.toLocaleString() || 0}
                </span>
                <span class="label label-danger">
                    错误: {stats.error_count?.toLocaleString() || 0}
                </span>
            {/if}
        </div>
    </header>

    {#if error}
        <div class="alert alert-danger m-b-sm">
            <i class="ri-error-warning-line" />
            <span>{error}</span>
        </div>
    {/if}

    {#if isLoading && !stats}
        <div class="placeholder-section">
            <span class="loader loader-lg" />
            <h1>加载中...</h1>
        </div>
    {:else if !stats && traces.length === 0}
        <div class="placeholder-section">
            <div class="icon">
                <i class="ri-line-chart-line" />
            </div>
            <h1 class="m-b-10">暂无 Trace 数据</h1>
            <p class="txt-hint">系统正在采集 Trace 数据，请稍后刷新页面。</p>
        </div>
    {:else}
        <!-- 统计卡片 - 压缩显示 -->
        {#if stats}
            <div class="stats-bar m-b-sm">
                <TraceStats {stats} compact={true} />
            </div>
        {/if}

        <!-- 筛选器 - 内联显示 -->
        <div class="filters-bar m-b-sm">
            <TraceFilters 
                {filters} 
                compact={true}
                on:change={handleFiltersChange}
            />
        </div>

        <!-- Trace 列表 - 占据剩余空间并内部滚动 -->
        <TraceList 
            {traces}
            {totalItems}
            {isLoading}
            currentPage={filters.page}
            perPage={filters.perPage}
            on:pageChange={handlePageChange}
            on:traceSelect={handleTraceSelect}
        />
    {/if}

    <svelte:fragment slot="footer">
        <span class="txt-sm txt-hint m-r-auto">
            共 {totalItems.toLocaleString()} 条记录
            {#if totalPages > 1}
                · 第 {filters.page} / {totalPages} 页
            {/if}
        </span>
    </svelte:fragment>
</PageWrapper>

<!-- Trace 详情弹窗 -->
{#if selectedTrace}
    <TraceDetail 
        trace={selectedTrace}
        on:close={handleTraceClose}
    />
{/if}

<style>
    .stats-bar {
        flex-shrink: 0;
    }

    .filters-bar {
        flex-shrink: 0;
    }

    .placeholder-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex-grow: 1;
        text-align: center;
        color: var(--txtHintColor);
    }

    .placeholder-section .icon {
        font-size: 4em;
        opacity: 0.5;
        margin-bottom: 16px;
    }

    .placeholder-section h1 {
        margin: 0;
        font-size: 1.25rem;
    }
</style>
