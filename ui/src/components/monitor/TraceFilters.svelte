<script>
    import { createEventDispatcher } from "svelte";
    
    export let filters;

    const dispatch = createEventDispatcher();

    let localFilters = { ...filters };

    // 预设时间范围
    const timeRanges = [
        { label: "最近 1 小时", value: "1h", hours: 1 },
        { label: "最近 6 小时", value: "6h", hours: 6 },
        { label: "最近 24 小时", value: "24h", hours: 24 },
        { label: "最近 7 天", value: "7d", hours: 168 },
        { label: "自定义", value: "custom", hours: 0 }
    ];

    // 状态选项
    const statusOptions = [
        { label: "全部状态", value: "" },
        { label: "成功 (OK)", value: "OK" },
        { label: "错误 (ERROR)", value: "ERROR" },
        { label: "取消 (CANCELLED)", value: "CANCELLED" }
    ];

    let selectedTimeRange = "24h";
    let showCustomTime = false;

    function handleTimeRangeChange() {
        const range = timeRanges.find(r => r.value === selectedTimeRange);
        if (range) {
            if (range.value === "custom") {
                showCustomTime = true;
            } else {
                showCustomTime = false;
                const now = new Date();
                const startTime = new Date(now.getTime() - range.hours * 60 * 60 * 1000);
                
                localFilters.start_time = startTime.toISOString().slice(0, 16);
                localFilters.end_time = now.toISOString().slice(0, 16);
                
                applyFilters();
            }
        }
    }

    function applyFilters() {
        dispatch("change", localFilters);
    }

    function resetFilters() {
        localFilters = {
            start_time: "",
            end_time: "",
            operation: "",
            status: "",
            trace_id: "",
            page: 1,
            perPage: 50
        };
        selectedTimeRange = "24h";
        showCustomTime = false;
        handleTimeRangeChange();
    }

    function handleInputChange() {
        // 延迟应用筛选，避免频繁请求
        clearTimeout(handleInputChange.timeout);
        handleInputChange.timeout = setTimeout(applyFilters, 500);
    }

    // 初始化时间范围
    if (!localFilters.start_time && !localFilters.end_time) {
        handleTimeRangeChange();
    }
</script>

<div class="trace-filters">
    <div class="filters-header">
        <h3>筛选条件</h3>
        <button type="button" class="btn btn-sm btn-secondary" on:click={resetFilters}>
            <i class="ri-refresh-line" />
            重置
        </button>
    </div>

    <div class="filters-grid">
        <!-- 时间范围选择 -->
        <div class="filter-group">
            <label class="filter-label">时间范围</label>
            <select 
                class="form-field" 
                bind:value={selectedTimeRange} 
                on:change={handleTimeRangeChange}
            >
                {#each timeRanges as range}
                    <option value={range.value}>{range.label}</option>
                {/each}
            </select>
        </div>

        <!-- 自定义时间范围 -->
        {#if showCustomTime}
            <div class="filter-group">
                <label class="filter-label">开始时间</label>
                <input 
                    type="datetime-local" 
                    class="form-field"
                    bind:value={localFilters.start_time}
                    on:change={applyFilters}
                />
            </div>

            <div class="filter-group">
                <label class="filter-label">结束时间</label>
                <input 
                    type="datetime-local" 
                    class="form-field"
                    bind:value={localFilters.end_time}
                    on:change={applyFilters}
                />
            </div>
        {/if}

        <!-- 操作名称 -->
        <div class="filter-group">
            <label class="filter-label">操作名称</label>
            <input 
                type="text" 
                class="form-field"
                placeholder="如: GET /api/collections"
                bind:value={localFilters.operation}
                on:input={handleInputChange}
            />
        </div>

        <!-- 状态筛选 -->
        <div class="filter-group">
            <label class="filter-label">状态</label>
            <select 
                class="form-field" 
                bind:value={localFilters.status}
                on:change={applyFilters}
            >
                {#each statusOptions as option}
                    <option value={option.value}>{option.label}</option>
                {/each}
            </select>
        </div>

        <!-- Trace ID 搜索 -->
        <div class="filter-group">
            <label class="filter-label">Trace ID</label>
            <input 
                type="text" 
                class="form-field"
                placeholder="输入完整的 Trace ID"
                bind:value={localFilters.trace_id}
                on:input={handleInputChange}
            />
        </div>
    </div>
</div>

<style>
    .trace-filters {
        background: var(--baseColor);
        border-radius: var(--baseRadius);
        border: 1px solid var(--baseAlt2Color);
        padding: 20px;
    }

    .filters-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .filters-header h3 {
        margin: 0;
        font-size: 1.1em;
        color: var(--txtPrimaryColor);
    }

    .filters-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
    }

    .filter-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .filter-label {
        font-size: 0.875em;
        font-weight: 500;
        color: var(--txtPrimaryColor);
    }

    .form-field {
        padding: 8px 12px;
        border: 1px solid var(--baseAlt2Color);
        border-radius: var(--baseRadius);
        background: var(--baseAlt1Color);
        color: var(--txtPrimaryColor);
        font-size: 0.875em;
        transition: border-color 0.2s ease;
    }

    .form-field:focus {
        outline: none;
        border-color: var(--primaryColor);
    }

    .form-field::placeholder {
        color: var(--txtHintColor);
    }

    @media (max-width: 768px) {
        .filters-grid {
            grid-template-columns: 1fr;
            gap: 12px;
        }

        .filters-header {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
        }
    }
</style>