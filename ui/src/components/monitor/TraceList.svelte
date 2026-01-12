<script>
    import { createEventDispatcher } from "svelte";
    import Scroller from "@/components/base/Scroller.svelte";
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

<div class="trace-list-wrapper">
    {#if isLoading}
        <div class="loading-overlay">
            <div class="loader" />
        </div>
    {/if}

    {#if traces.length === 0 && !isLoading}
        <div class="empty-list">
            <i class="ri-file-list-3-line" />
            <p>没有找到符合条件的 Trace 记录</p>
        </div>
    {:else}
        <Scroller class="trace-scroller">
            <table class="table">
                <thead>
                    <tr>
                        <th class="col-id">Trace ID</th>
                        <th class="col-name">操作名称</th>
                        <th class="col-status">状态</th>
                        <th class="col-time">开始时间</th>
                        <th class="col-duration">耗时</th>
                        <th class="col-spans">Spans</th>
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
                            <td class="col-id">
                                <code class="txt-mono">{trace.trace_id.slice(0, 8)}...</code>
                            </td>
                            <td class="col-name txt-ellipsis" title={trace.name}>
                                {trace.name || "-"}
                            </td>
                            <td class="col-status">
                                <span class="label {getStatusClass(trace.status)}">
                                    <i class="{getStatusIcon(trace.status)}" />
                                    {trace.status}
                                </span>
                            </td>
                            <td class="col-time">
                                <FormattedDate date={trace.start_time} />
                            </td>
                            <td class="col-duration txt-mono">
                                {formatDuration(trace.duration)}
                            </td>
                            <td class="col-spans txt-center">
                                {trace.span_count || 1}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </Scroller>

        <!-- 分页控件 -->
        {#if totalPages > 1}
            <div class="pagination-footer">
                <button 
                    type="button"
                    class="btn btn-xs btn-secondary"
                    disabled={currentPage === 1}
                    on:click={() => handlePageChange(currentPage - 1)}
                >
                    <i class="ri-arrow-left-s-line" />
                </button>

                <div class="page-numbers">
                    {#each getPageNumbers() as page}
                        <button 
                            type="button"
                            class="btn btn-xs {page === currentPage ? 'btn-primary' : 'btn-hint'}"
                            on:click={() => handlePageChange(page)}
                        >
                            {page}
                        </button>
                    {/each}
                </div>

                <button 
                    type="button"
                    class="btn btn-xs btn-secondary"
                    disabled={currentPage === totalPages}
                    on:click={() => handlePageChange(currentPage + 1)}
                >
                    <i class="ri-arrow-right-s-line" />
                </button>
            </div>
        {/if}
    {/if}
</div>

<style>
    .trace-list-wrapper {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        min-height: 0;
        background: var(--baseColor);
        border-radius: var(--baseRadius);
        border: 1px solid var(--baseAlt2Color);
        position: relative;
    }

    .trace-list-wrapper :global(.trace-scroller) {
        flex-grow: 1;
        min-height: 0;
    }

    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        border-radius: var(--baseRadius);
    }

    .empty-list {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex-grow: 1;
        padding: 40px 20px;
        color: var(--txtHintColor);
    }

    .empty-list i {
        font-size: 2.5em;
        margin-bottom: 12px;
        opacity: 0.5;
    }

    .table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
    }

    .table th {
        position: sticky;
        top: 0;
        background: var(--baseAlt1Color);
        padding: 10px 12px;
        text-align: left;
        font-weight: 600;
        font-size: var(--smFontSize);
        color: var(--txtHintColor);
        border-bottom: 1px solid var(--baseAlt2Color);
        white-space: nowrap;
        z-index: 1;
    }

    .table td {
        padding: 10px 12px;
        border-bottom: 1px solid var(--baseAlt2Color);
        font-size: var(--smFontSize);
    }

    .col-id { width: 100px; }
    .col-name { width: auto; }
    .col-status { width: 90px; }
    .col-time { width: 150px; }
    .col-duration { width: 80px; }
    .col-spans { width: 60px; }

    .trace-row {
        cursor: pointer;
        transition: background-color 0.15s ease;
    }

    .trace-row:hover {
        background: var(--baseAlt1Color);
    }

    .txt-mono {
        font-family: var(--monospaceFontFamily);
        font-size: 0.85em;
    }

    .txt-ellipsis {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .txt-center {
        text-align: center;
    }

    .label {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 3px 6px;
        border-radius: var(--baseRadius);
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

    .status-cancelled,
    .status-unknown {
        background: var(--baseAlt2Color);
        color: var(--txtHintColor);
    }

    .pagination-footer {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 6px;
        padding: 10px;
        border-top: 1px solid var(--baseAlt2Color);
        flex-shrink: 0;
    }

    .page-numbers {
        display: flex;
        gap: 3px;
    }

    @media (max-width: 768px) {
        .col-time,
        .col-spans {
            display: none;
        }

        .table th,
        .table td {
            padding: 8px 10px;
        }
    }
</style>
