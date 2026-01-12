<script>
    import { createEventDispatcher } from "svelte";
    
    export let filters;
    export let compact = false;

    const dispatch = createEventDispatcher();

    let localFilters = { ...filters };

    // 预设时间范围
    const timeRanges = [
        { label: "1小时", value: "1h", hours: 1 },
        { label: "6小时", value: "6h", hours: 6 },
        { label: "24小时", value: "24h", hours: 24 },
        { label: "7天", value: "7d", hours: 168 },
    ];

    // 状态选项
    const statusOptions = [
        { label: "全部", value: "" },
        { label: "成功", value: "OK" },
        { label: "错误", value: "ERROR" },
    ];

    let selectedTimeRange = "24h";

    function handleTimeRangeChange() {
        const range = timeRanges.find(r => r.value === selectedTimeRange);
        if (range) {
            const now = new Date();
            const startTime = new Date(now.getTime() - range.hours * 60 * 60 * 1000);
            
            localFilters.start_time = startTime.toISOString().slice(0, 16);
            localFilters.end_time = now.toISOString().slice(0, 16);
            
            applyFilters();
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
        handleTimeRangeChange();
    }

    function handleInputChange() {
        clearTimeout(handleInputChange.timeout);
        handleInputChange.timeout = setTimeout(applyFilters, 500);
    }

    // 初始化时间范围
    if (!localFilters.start_time && !localFilters.end_time) {
        handleTimeRangeChange();
    }
</script>

<div class="trace-filters" class:compact>
    <div class="filters-row">
        <!-- 时间范围 -->
        <div class="filter-group time-range">
            <div class="btn-group">
                {#each timeRanges as range}
                    <button 
                        type="button"
                        class="btn btn-xs"
                        class:btn-primary={selectedTimeRange === range.value}
                        class:btn-secondary={selectedTimeRange !== range.value}
                        on:click={() => { selectedTimeRange = range.value; handleTimeRangeChange(); }}
                    >
                        {range.label}
                    </button>
                {/each}
            </div>
        </div>

        <!-- 操作名称 -->
        <div class="filter-group flex-grow">
            <input 
                type="text" 
                class="form-field form-field-sm"
                placeholder="操作名称..."
                bind:value={localFilters.operation}
                on:input={handleInputChange}
            />
        </div>

        <!-- 状态 -->
        <div class="filter-group">
            <select 
                class="form-field form-field-sm" 
                bind:value={localFilters.status}
                on:change={applyFilters}
            >
                {#each statusOptions as option}
                    <option value={option.value}>{option.label}</option>
                {/each}
            </select>
        </div>

        <!-- Trace ID -->
        <div class="filter-group">
            <input 
                type="text" 
                class="form-field form-field-sm"
                placeholder="Trace ID..."
                bind:value={localFilters.trace_id}
                on:input={handleInputChange}
            />
        </div>

        <!-- 重置 -->
        <button type="button" class="btn btn-xs btn-hint" on:click={resetFilters}>
            <i class="ri-refresh-line" />
        </button>
    </div>
</div>

<style>
    .trace-filters {
        background: var(--baseColor);
        border-radius: var(--baseRadius);
        border: 1px solid var(--baseAlt2Color);
        padding: 10px 12px;
    }

    .trace-filters.compact {
        padding: 8px 10px;
    }

    .filters-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }

    .filter-group {
        display: flex;
        align-items: center;
    }

    .filter-group.flex-grow {
        flex: 1;
        min-width: 150px;
    }

    .filter-group input,
    .filter-group select {
        width: 100%;
    }

    .filter-group select {
        min-width: 80px;
    }

    .filter-group input[placeholder="Trace ID..."] {
        width: 140px;
    }

    .btn-group {
        display: flex;
        gap: 2px;
    }

    .form-field-sm {
        padding: 6px 10px;
        font-size: var(--smFontSize);
        height: auto;
    }

    @media (max-width: 900px) {
        .filters-row {
            gap: 8px;
        }

        .filter-group.time-range {
            width: 100%;
        }

        .filter-group.time-range .btn-group {
            flex: 1;
        }

        .filter-group.time-range .btn-group .btn {
            flex: 1;
        }
    }
</style>
