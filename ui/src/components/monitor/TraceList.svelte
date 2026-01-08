<script>
    import { createEventDispatcher } from "svelte";
    import FormattedDate from "@/components/base/FormattedDate.svelte";
    
    export let traces = [];
    export let totalItems = 0;
    export let isLoading = false;
    export let currentPage = 1;
    export let perPage = 50;

    const dispatch = createEventDispatcher();

    $: totalPages = Math.ceil(totalItems / perPage);

    function formatDuration(microseconds) {
        if (microseconds === null || microseconds === undefined) return "-";
        
        const ms = microseconds / 1000;
        if (ms < 1) {
            return `${microseconds}μs`;
        } else if (ms < 1000) {
            return `${ms.toFixed(1)}ms`;
        } else {
            return `${(ms / 1000).toFixed(2)}s`;
        }
    }

    function getStatusClass(status) {
        switch (status) {
            case "OK":
                return "status-success";
            case "ERROR":
                return "status-error";
            case "CANCELLED":
                return "status-cancelled";
            default:
                return "status-unknown";
        }
    }

    function getStatusIcon(status) {
        switch (status) {
            case "OK":
                return "ri-check-line";
            case "ERROR":
                return "ri-error-warning-line";
            case "CANCELLED":
                return "ri-close-line";
            default:
                return "ri-question-line";
        }
    }

    function handleTraceClick(trace) {
        dispatch("traceSelect", trace);
    }

    function handlePageChange(page) {
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            dispatch("pageChange", page);
        }
    }

    function getPageNumbers() {
        const pages = [];
        const maxVisible = 5;
        
        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            const start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
            const end = Math.min(totalPages, start + maxVisible - 1);
            
            for (let i = start; i <= end; i++) {
                pages.push(i);
            }
        }
        
        return pages;
    }
</script>

<div class="trace-list">
    <div class="list-header">
        <h3>Trace 列表</h3>
        <div class="list-info">
            共 {totalItems.toLocaleString()} 条记录
        </div>
    </div>

    {#if isLoading}
        <div class="loading-overlay">
            <div class="loader" />
            <span>加载中...</span>
        </div>
    {/if}

    {#if traces.length === 0 && !isLoading}
        <div class="empty-list">
            <i class="ri-file-list-3-line" />
            <p>没有找到符合条件的 Trace 记录</p>
        </div>
    {:else}
        <div class="table-wrapper">
            <table class="traces-table">
                <thead>
                    <tr>
                        <th>Trace ID</th>
                        <th>操作名称</th>
                        <th>状态</th>
                        <th>开始时间</th>
                        <th>持续时间</th>
                        <th>Spans 数量</th>
                    </tr>
                </thead>
                <tbody>
                    {#each traces as trace (trace.trace_id)}
                        <tr 
                            class="trace-row" 
                            on:click={() => handleTraceClick(trace)}
                            role="button"
                            tabindex="0"
                        >
                            <td class="trace-id">
                                <code>{trace.trace_id.slice(0, 8)}...</code>
                            </td>
                            <td class="operation-name">
                                {trace.name || "-"}
                            </td>
                            <td class="status">
                                <span class="status-badge {getStatusClass(trace.status)}">
                                    <i class="{getStatusIcon(trace.status)}" />
                                    {trace.status}
                                </span>
                            </td>
                            <td class="start-time">
                                <FormattedDate date={trace.start_time} />
                            </td>
                            <td class="duration">
                                {formatDuration(trace.duration)}
                            </td>
                            <td class="span-count">
                                {trace.span_count || 1}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        <!-- 分页控件 -->
        {#if totalPages > 1}
            <div class="pagination">
                <button 
                    type="button"
                    class="btn btn-sm btn-secondary"
                    disabled={currentPage === 1}
                    on:click={() => handlePageChange(currentPage - 1)}
                >
                    <i class="ri-arrow-left-line" />
                    上一页
                </button>

                <div class="page-numbers">
                    {#each getPageNumbers() as page}
                        <button 
                            type="button"
                            class="btn btn-sm {page === currentPage ? 'btn-primary' : 'btn-secondary'}"
                            on:click={() => handlePageChange(page)}
                        >
                            {page}
                        </button>
                    {/each}
                </div>

                <button 
                    type="button"
                    class="btn btn-sm btn-secondary"
                    disabled={currentPage === totalPages}
                    on:click={() => handlePageChange(currentPage + 1)}
                >
                    下一页
                    <i class="ri-arrow-right-line" />
                </button>
            </div>
        {/if}
    {/if}
</div>

<style>
    .trace-list {
        background: var(--baseColor);
        border-radius: var(--baseRadius);
        border: 1px solid var(--baseAlt2Color);
        position: relative;
    }

    .list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid var(--baseAlt2Color);
    }

    .list-header h3 {
        margin: 0;
        font-size: 1.1em;
        color: var(--txtPrimaryColor);
    }

    .list-info {
        font-size: 0.875em;
        color: var(--txtHintColor);
    }

    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.8);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        z-index: 10;
        border-radius: var(--baseRadius);
    }

    .empty-list {
        text-align: center;
        padding: 60px 20px;
        color: var(--txtHintColor);
    }

    .empty-list i {
        font-size: 3em;
        margin-bottom: 16px;
        opacity: 0.5;
    }

    .table-wrapper {
        overflow-x: auto;
    }

    .traces-table {
        width: 100%;
        border-collapse: collapse;
    }

    .traces-table th {
        background: var(--baseAlt1Color);
        padding: 12px 16px;
        text-align: left;
        font-weight: 600;
        color: var(--txtPrimaryColor);
        border-bottom: 1px solid var(--baseAlt2Color);
        font-size: 0.875em;
    }

    .trace-row {
        cursor: pointer;
        transition: background-color 0.2s ease;
    }

    .trace-row:hover {
        background: var(--baseAlt1Color);
    }

    .traces-table td {
        padding: 12px 16px;
        border-bottom: 1px solid var(--baseAlt2Color);
        font-size: 0.875em;
    }

    .trace-id code {
        background: var(--baseAlt1Color);
        padding: 2px 6px;
        border-radius: 3px;
        font-family: monospace;
        font-size: 0.8em;
    }

    .operation-name {
        font-weight: 500;
        color: var(--txtPrimaryColor);
    }

    .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 0.75em;
        font-weight: 500;
    }

    .status-success {
        background: rgba(34, 197, 94, 0.1);
        color: var(--successColor);
    }

    .status-error {
        background: rgba(239, 68, 68, 0.1);
        color: var(--dangerColor);
    }

    .status-cancelled {
        background: rgba(156, 163, 175, 0.1);
        color: var(--txtHintColor);
    }

    .status-unknown {
        background: rgba(156, 163, 175, 0.1);
        color: var(--txtHintColor);
    }

    .duration {
        font-family: monospace;
        color: var(--txtHintColor);
    }

    .span-count {
        text-align: center;
        color: var(--txtHintColor);
    }

    .pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
        padding: 20px;
        border-top: 1px solid var(--baseAlt2Color);
    }

    .page-numbers {
        display: flex;
        gap: 4px;
    }

    @media (max-width: 768px) {
        .list-header {
            flex-direction: column;
            gap: 8px;
            align-items: flex-start;
        }

        .traces-table th,
        .traces-table td {
            padding: 8px 12px;
        }

        .pagination {
            flex-direction: column;
            gap: 12px;
        }

        .page-numbers {
            flex-wrap: wrap;
            justify-content: center;
        }
    }
</style>