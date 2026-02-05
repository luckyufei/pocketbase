<script>
    import { onMount } from "svelte";
    import ApiClient from "@/utils/ApiClient";

    export let compact = false;

    let dbStats = null;
    let dbType = "sqlite"; // 默认 SQLite
    let isLoading = true;
    let error = null;

    onMount(async () => {
        await loadDatabaseStats();
    });

    async function loadDatabaseStats() {
        try {
            isLoading = true;
            error = null;
            
            // 获取数据库类型和统计信息
            const response = await ApiClient.send("/api/system/metrics/database", {
                method: "GET"
            });
            
            dbStats = response.stats;
            dbType = response.type || "sqlite";
        } catch (err) {
            error = err.message || "加载数据库统计失败";
            console.error("Database stats error:", err);
        } finally {
            isLoading = false;
        }
    }

    function formatBytes(bytes) {
        if (bytes === null || bytes === undefined) return "-";
        if (bytes === 0) return "0 B";
        
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    }

    function formatNumber(value) {
        if (value === null || value === undefined) return "-";
        return Number(value).toLocaleString();
    }

    function formatPercentage(value) {
        if (value === null || value === undefined) return "-";
        return `${value.toFixed(1)}%`;
    }

    // SQLite 特定的统计卡片
    $: sqliteStats = [
        {
            icon: "ri-database-2-line",
            label: "WAL 大小",
            value: formatBytes(dbStats?.wal_size),
            type: "info"
        },
        {
            icon: "ri-links-line", 
            label: "活跃连接",
            value: formatNumber(dbStats?.open_connections),
            type: "info"
        },
        {
            icon: "ri-file-list-3-line",
            label: "页面数",
            value: formatNumber(dbStats?.page_count),
            type: "info"
        },
        {
            icon: "ri-archive-line",
            label: "数据库大小", 
            value: formatBytes(dbStats?.database_size),
            type: "info"
        }
    ];

    // PostgreSQL 特定的统计卡片
    $: postgresStats = [
        {
            icon: "ri-links-line",
            label: "活跃连接",
            value: formatNumber(dbStats?.active_connections),
            type: "info"
        },
        {
            icon: "ri-group-line", 
            label: "连接池大小",
            value: formatNumber(dbStats?.max_connections),
            type: "info"
        },
        {
            icon: "ri-database-2-line",
            label: "数据库大小",
            value: formatBytes(dbStats?.database_size),
            type: "info"
        },
        {
            icon: "ri-cpu-line",
            label: "缓存命中率",
            value: formatPercentage(dbStats?.cache_hit_ratio),
            type: dbStats?.cache_hit_ratio > 95 ? "success" : 
                  dbStats?.cache_hit_ratio > 85 ? "warning" : "error"
        },
        {
            icon: "ri-time-line",
            label: "平均查询时间",
            value: dbStats?.avg_query_time ? `${dbStats.avg_query_time.toFixed(2)}ms` : "-",
            type: "info"
        },
        {
            icon: "ri-lock-line",
            label: "锁等待",
            value: formatNumber(dbStats?.lock_waits),
            type: dbStats?.lock_waits > 0 ? "warning" : "success"
        }
    ];

    $: currentStats = dbType === "postgresql" ? postgresStats : sqliteStats;
</script>

<div class="database-stats" class:compact>
    <div class="stats-header">
        <div class="db-type-badge" class:sqlite={dbType === "sqlite"} class:postgresql={dbType === "postgresql"}>
            <i class="ri-database-2-line" />
            <span>{dbType === "postgresql" ? "PostgreSQL" : "SQLite"}</span>
        </div>
        
        {#if error}
            <div class="error-indicator">
                <i class="ri-error-warning-line" />
                <span>加载失败</span>
            </div>
        {:else if isLoading}
            <div class="loading-indicator">
                <span class="loader loader-sm" />
                <span>加载中...</span>
            </div>
        {/if}
    </div>

    {#if error}
        <div class="error-message">
            <i class="ri-error-warning-line" />
            <span>{error}</span>
        </div>
    {:else if isLoading}
        <div class="loading-placeholder">
            <div class="stats-grid">
                {#each Array(4) as _}
                    <div class="stat-card loading">
                        <div class="stat-icon skeleton" />
                        <div class="stat-content">
                            <div class="stat-value skeleton" />
                            <div class="stat-label skeleton" />
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {:else}
        <div class="stats-grid">
            {#each currentStats as stat}
                <div class="stat-card" class:success={stat.type === "success"} 
                     class:warning={stat.type === "warning"} class:error={stat.type === "error"}>
                    <div class="stat-icon">
                        <i class={stat.icon} />
                    </div>
                    <div class="stat-content">
                        <div class="stat-value">{stat.value}</div>
                        <div class="stat-label">{stat.label}</div>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .database-stats {
        background: var(--baseColor);
        border-radius: var(--baseRadius);
        border: 1px solid var(--baseAlt2Color);
        padding: 12px;
    }

    .database-stats.compact {
        padding: 8px;
    }

    .stats-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
    }

    .compact .stats-header {
        margin-bottom: 8px;
    }

    .db-type-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        border-radius: var(--baseRadius);
        font-size: 0.8em;
        font-weight: 600;
        text-transform: uppercase;
    }

    .db-type-badge.sqlite {
        background: #e3f2fd;
        color: #1976d2;
        border: 1px solid #bbdefb;
    }

    .db-type-badge.postgresql {
        background: #f3e5f5;
        color: #7b1fa2;
        border: 1px solid #e1bee7;
    }

    .error-indicator, .loading-indicator {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75em;
        color: var(--txtHintColor);
    }

    .error-indicator {
        color: var(--dangerColor);
    }

    .error-message {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: var(--dangerAlt1Color);
        color: var(--dangerColor);
        border-radius: var(--baseRadius);
        font-size: 0.85em;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 10px;
    }

    .compact .stats-grid {
        gap: 8px;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    }

    @media (max-width: 768px) {
        .stats-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    .stat-card {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: var(--baseAlt1Color);
        border-radius: var(--baseRadius);
        border: 1px solid var(--baseAlt2Color);
        transition: all 0.2s ease;
    }

    .compact .stat-card {
        padding: 8px 10px;
        gap: 6px;
    }

    .stat-card.success {
        border-color: var(--successColor);
        background: var(--successAlt1Color);
    }

    .stat-card.warning {
        border-color: var(--warningColor);
        background: var(--warningAlt1Color);
    }

    .stat-card.error {
        border-color: var(--dangerColor);
        background: var(--dangerAlt1Color);
    }

    .stat-card.loading {
        pointer-events: none;
    }

    .stat-icon {
        font-size: 1.25em;
        color: var(--txtHintColor);
        flex-shrink: 0;
    }

    .compact .stat-icon {
        font-size: 1.1em;
    }

    .success .stat-icon {
        color: var(--successColor);
    }

    .warning .stat-icon {
        color: var(--warningColor);
    }

    .error .stat-icon {
        color: var(--dangerColor);
    }

    .stat-content {
        flex: 1;
        min-width: 0;
    }

    .stat-value {
        font-size: 1.1em;
        font-weight: 600;
        color: var(--txtPrimaryColor);
        line-height: 1.2;
    }

    .compact .stat-value {
        font-size: 1em;
    }

    .stat-label {
        font-size: 0.75em;
        color: var(--txtHintColor);
        margin-top: 2px;
    }

    /* 骨架屏样式 */
    .skeleton {
        background: linear-gradient(90deg, var(--baseAlt2Color) 25%, var(--baseAlt1Color) 50%, var(--baseAlt2Color) 75%);
        background-size: 200% 100%;
        animation: skeleton-loading 1.5s infinite;
        border-radius: 4px;
    }

    .stat-icon.skeleton {
        width: 20px;
        height: 20px;
    }

    .stat-value.skeleton {
        height: 16px;
        width: 60px;
        margin-bottom: 4px;
    }

    .stat-label.skeleton {
        height: 12px;
        width: 40px;
    }

    @keyframes skeleton-loading {
        0% {
            background-position: -200% 0;
        }
        100% {
            background-position: 200% 0;
        }
    }
</style>