<script>
    import { createEventDispatcher, onMount } from "svelte";
    import ApiClient from "@/utils/ApiClient";
    import FormattedDate from "@/components/base/FormattedDate.svelte";
    
    export let trace;

    const dispatch = createEventDispatcher();

    let spans = [];
    let isLoading = true;
    let error = null;
    let expandedSpans = new Set();

    // 瀑布图相关
    let totalDuration = 0;
    let minStartTime = 0;
    let spanHierarchy = [];

    onMount(async () => {
        await loadTraceDetails();
    });

    async function loadTraceDetails() {
        try {
            error = null;
            isLoading = true;
            
            const response = await ApiClient.send(`/api/traces/${trace.trace_id}`, {
                method: "GET"
            });
            
            spans = response.items || [];
            buildSpanHierarchy();
        } catch (err) {
            error = err.message || "加载 Trace 详情失败";
        } finally {
            isLoading = false;
        }
    }

    function buildSpanHierarchy() {
        if (spans.length === 0) return;

        // 计算时间范围
        const startTimes = spans.map(s => new Date(s.start_time).getTime());
        const endTimes = spans.map(s => new Date(s.start_time).getTime() + (s.duration / 1000));
        
        minStartTime = Math.min(...startTimes);
        const maxEndTime = Math.max(...endTimes);
        totalDuration = maxEndTime - minStartTime;

        // 构建父子关系
        const spanMap = new Map();
        spans.forEach(span => {
            spanMap.set(span.span_id, { ...span, children: [], level: 0 });
        });

        const rootSpans = [];
        spans.forEach(span => {
            const spanNode = spanMap.get(span.span_id);
            if (span.parent_id && spanMap.has(span.parent_id)) {
                const parent = spanMap.get(span.parent_id);
                parent.children.push(spanNode);
                spanNode.level = parent.level + 1;
            } else {
                rootSpans.push(spanNode);
            }
        });

        // 扁平化层级结构用于显示
        spanHierarchy = [];
        function flattenSpans(spans, level = 0) {
            spans.forEach(span => {
                span.level = level;
                spanHierarchy.push(span);
                if (expandedSpans.has(span.span_id) && span.children.length > 0) {
                    flattenSpans(span.children, level + 1);
                }
            });
        }
        flattenSpans(rootSpans);
    }

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

    function getSpanBarStyle(span) {
        const startTime = new Date(span.start_time).getTime();
        const duration = span.duration / 1000; // 转换为毫秒
        
        const leftPercent = ((startTime - minStartTime) / totalDuration) * 100;
        const widthPercent = (duration / totalDuration) * 100;
        
        return `left: ${leftPercent}%; width: ${Math.max(widthPercent, 0.5)}%;`;
    }

    function toggleSpanExpansion(spanId) {
        if (expandedSpans.has(spanId)) {
            expandedSpans.delete(spanId);
        } else {
            expandedSpans.add(spanId);
        }
        expandedSpans = expandedSpans; // 触发响应式更新
        buildSpanHierarchy(); // 重新构建显示层级
    }

    function handleClose() {
        dispatch("close");
    }
</script>

<div class="trace-detail-overlay" on:click={handleClose}>
    <div class="trace-detail-modal" on:click|stopPropagation>
        <header class="modal-header">
            <div class="header-content">
                <h2>Trace 详情</h2>
                <div class="trace-info">
                    <span class="trace-id">
                        <strong>Trace ID:</strong> 
                        <code>{trace.trace_id}</code>
                    </span>
                    <span class="trace-operation">
                        <strong>操作:</strong> {trace.name || "-"}
                    </span>
                </div>
            </div>
            <button type="button" class="btn btn-sm btn-secondary" on:click={handleClose}>
                <i class="ri-close-line" />
                关闭
            </button>
        </header>

        <div class="modal-body">
            {#if error}
                <div class="alert alert-danger">
                    <i class="ri-error-warning-line" />
                    <span>{error}</span>
                </div>
            {:else if isLoading}
                <div class="loading-placeholder">
                    <div class="loader" />
                    <span>加载 Trace 详情中...</span>
                </div>
            {:else if spans.length === 0}
                <div class="empty-state">
                    <i class="ri-file-list-3-line" />
                    <p>此 Trace 没有 Span 数据</p>
                </div>
            {:else}
                <!-- 瀑布图 -->
                <div class="waterfall-chart">
                    <div class="chart-header">
                        <h3>调用链瀑布图</h3>
                        <div class="chart-info">
                            总耗时: {formatDuration(totalDuration * 1000)} | 
                            Span 数量: {spans.length}
                        </div>
                    </div>

                    <div class="chart-content">
                        <!-- 时间轴 -->
                        <div class="timeline">
                            <div class="timeline-scale">
                                <span>0ms</span>
                                <span>{formatDuration(totalDuration * 1000)}</span>
                            </div>
                        </div>

                        <!-- Span 列表 -->
                        <div class="spans-container">
                            {#each spanHierarchy as span (span.span_id)}
                                <div class="span-row" style="margin-left: {span.level * 20}px;">
                                    <div class="span-info">
                                        <div class="span-header">
                                            {#if span.children && span.children.length > 0}
                                                <button 
                                                    class="expand-btn" 
                                                    on:click={() => toggleSpanExpansion(span.span_id)}
                                                >
                                                    <i class="{expandedSpans.has(span.span_id) ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'}" />
                                                </button>
                                            {:else}
                                                <div class="expand-placeholder"></div>
                                            {/if}
                                            
                                            <span class="span-name" title={span.name}>{span.name}</span>
                                            <span class="span-duration">{formatDuration(span.duration)}</span>
                                            <span class="status-badge {getStatusClass(span.status)}">
                                                {span.status}
                                            </span>
                                        </div>
                                        
                                        <div class="span-timeline">
                                            <div class="span-bar {getStatusClass(span.status)}" style={getSpanBarStyle(span)}></div>
                                        </div>
                                    </div>
                                    
                                    <!-- Span 属性展示 -->
                                    {#if span.attributes && Object.keys(span.attributes).length > 0}
                                        <div class="span-attributes">
                                            {#each Object.entries(span.attributes) as [key, value]}
                                                <div class="attribute-item">
                                                    <span class="attribute-key">{key}:</span>
                                                    <span class="attribute-value">{value}</span>
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</div>



<style>
    .trace-detail-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    }

    .trace-detail-modal {
        background: var(--baseColor);
        border-radius: var(--baseRadius);
        border: 1px solid var(--baseAlt2Color);
        max-width: 1200px;
        width: 100%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 20px;
        border-bottom: 1px solid var(--baseAlt2Color);
        gap: 20px;
    }

    .header-content h2 {
        margin: 0 0 8px 0;
        font-size: 1.25em;
        color: var(--txtPrimaryColor);
    }

    .trace-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 0.875em;
    }

    .trace-id code {
        background: var(--baseAlt1Color);
        padding: 2px 6px;
        border-radius: 3px;
        font-family: monospace;
        font-size: 0.9em;
    }

    .modal-body {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
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
        font-size: 3em;
        margin-bottom: 16px;
        opacity: 0.5;
    }

    .waterfall-chart {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .chart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid var(--baseAlt2Color);
    }

    .chart-header h3 {
        margin: 0;
        font-size: 1.1em;
        color: var(--txtPrimaryColor);
    }

    .chart-info {
        font-size: 0.875em;
        color: var(--txtHintColor);
    }

    .chart-content {
        flex: 1;
        overflow: auto;
        padding: 20px;
    }

    .timeline {
        margin-bottom: 16px;
        padding: 0 200px 0 20px;
    }

    .timeline-scale {
        display: flex;
        justify-content: space-between;
        font-size: 0.75em;
        color: var(--txtHintColor);
        border-bottom: 1px solid var(--baseAlt2Color);
        padding-bottom: 4px;
    }

    .spans-container {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .span-row {
        display: flex;
        flex-direction: column;
    }

    .span-info {
        display: flex;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--baseAlt2Color);
    }

    .span-attributes {
        margin-left: 24px;
        padding: 8px 12px;
        background: var(--baseAlt1Color);
        border-radius: 4px;
        margin-top: 4px;
        margin-bottom: 8px;
        font-size: 0.8em;
    }

    .attribute-item {
        display: flex;
        gap: 8px;
        margin-bottom: 2px;
    }

    .attribute-key {
        font-weight: 500;
        color: var(--txtHintColor);
        min-width: 120px;
    }

    .attribute-value {
        color: var(--txtPrimaryColor);
        word-break: break-all;
    }

    .span-header {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 200px;
        flex-shrink: 0;
        font-size: 0.875em;
    }

    .expand-btn {
        background: none;
        border: none;
        padding: 2px;
        cursor: pointer;
        color: var(--txtHintColor);
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .expand-placeholder {
        width: 16px;
        height: 16px;
    }

    .span-name {
        flex: 1;
        font-weight: 500;
        color: var(--txtPrimaryColor);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .span-duration {
        font-family: monospace;
        font-size: 0.8em;
        color: var(--txtHintColor);
        margin-right: 8px;
    }

    .span-timeline {
        flex: 1;
        position: relative;
        height: 20px;
        background: var(--baseAlt1Color);
        border-radius: 2px;
        margin-left: 20px;
    }

    .span-bar {
        position: absolute;
        top: 2px;
        bottom: 2px;
        border-radius: 2px;
        min-width: 2px;
    }

    .span-bar.status-success {
        background: var(--successColor);
    }

    .span-bar.status-error {
        background: var(--dangerColor);
    }

    .span-bar.status-cancelled {
        background: var(--txtHintColor);
    }

    .span-bar.status-unknown {
        background: var(--txtHintColor);
    }

    .status-badge {
        padding: 2px 6px;
        border-radius: 8px;
        font-size: 0.7em;
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

    @media (max-width: 768px) {
        .trace-detail-overlay {
            padding: 10px;
        }

        .modal-header {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
        }

        .span-header {
            width: 150px;
        }

        .timeline {
            padding: 0 150px 0 10px;
        }
    }
</style>