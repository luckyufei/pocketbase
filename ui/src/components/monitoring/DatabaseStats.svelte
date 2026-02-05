<script>
    import { onMount } from "svelte";
    import ApiClient from "@/utils/ApiClient";
    import MetricsCard from "./MetricsCard.svelte";

    export let compact = false;
    export let refreshInterval = 30000;

    let dbStats = null;
    let dbType = "sqlite";
    let isLoading = true;
    let error = null;

    onMount(async () => {
        await loadDatabaseStats();
        
        // 设置定期刷新
        if (refreshInterval > 0) {
            const interval = setInterval(loadDatabaseStats, refreshInterval);
            return () => clearInterval(interval);
        }
    });

    async function loadDatabaseStats() {
        try {
            error = null;
            const response = await ApiClient.send("/api/system/metrics/database", {
                method: "GET",
            });
            dbStats = response.stats;
            dbType = response.type;
        } catch (err) {
            error = err.message || "加载数据库统计失败";
            console.error("Database stats error:", err);
        } finally {
            isLoading = false;
        }
    }

    function formatBytes(bytes) {
        if (!bytes) return "-";
        const mb = bytes / (1024 * 1024);
        return mb.toFixed(2);
    }

    function formatPercent(value) {
        if (value === null || value === undefined) return "-";
        return Number(value).toFixed(1);
    }

    function getCacheHitRatioStatus(ratio) {
        if (ratio > 95) return "success";
        if (ratio > 85) return "warning";
        return "error";
    }

    // SQLite 专用指标
    $: sqliteStats = dbType === "sqlite" ? [
        {
            title: "WAL 大小",
            value: formatBytes(dbStats?.wal_size),
            unit: "MB",
            icon: "ri-file-line"
        },
        {
            title: "数据库大小", 
            value: formatBytes(dbStats?.database_size),
            unit: "MB",
            icon: "ri-database-2-line"
        },
        {
            title: "活跃连接",
            value: dbStats?.open_connections || "-",
            icon: "ri-links-line"
        },
        {
            title: "页面数",
            value: dbStats?.page_count || "-",
            icon: "ri-pages-line"
        }
    ] : [];

    // PostgreSQL 专用指标
    $: postgresStats = dbType === "postgresql" ? [
        {
            title: "活跃连接",
            value: `${dbStats?.active_connections || 0}/${dbStats?.max_connections || 100}`,
            icon: "ri-links-line"
        },
        {
            title: "数据库大小",
            value: formatBytes(dbStats?.database_size),
            unit: "MB", 
            icon: "ri-database-2-line"
        },
        {
            title: "缓存命中率",
            value: formatPercent(dbStats?.cache_hit_ratio),
            unit: "%",
            icon: "ri-dashboard-line"
        },
        {
            title: "平均查询时间",
            value: formatPercent(dbStats?.avg_query_time),
            unit: "ms",
            icon: "ri-timer-line"
        }
    ] : [];

    // 当前使用的统计数据
    $: currentStats = dbType === "postgresql" ? postgresStats : sqliteStats;
</script>

<div class="database-stats" class:compact>
    {#if isLoading}
        <div class="loading-state">
            <div class="skeleton-card" />
            <div class="skeleton-card" />
            <div class="skeleton-card" />
            <div class="skeleton-card" />
        </div>
    {:else if error}
        <div class="error-state">
            <i class="ri-error-warning-line" />
            <span>{error}</span>
            <button type="button" class="btn btn-sm btn-secondary" on:click={loadDatabaseStats}>
                重试
            </button>
        </div>
    {:else if currentStats.length > 0}
        <div class="stats-grid">
            {#each currentStats as stat}
                <MetricsCard
                    title={stat.title}
                    value={stat.value}
                    unit={stat.unit}
                    icon={stat.icon}
                />
            {/each}
        </div>
        
        {#if !compact}
            <div class="db-info">
                <span class="db-type-badge" class:sqlite={dbType === "sqlite"} class:postgresql={dbType === "postgresql"}>
                    <i class="ri-database-2-line" />
                    {dbType === "sqlite" ? "SQLite" : "PostgreSQL"}
                </span>
            </div>
        {/if}
    {:else}
        <div class="empty-state">
            <i class="ri-database-2-line" />
            <span>暂无数据库统计数据</span>
        </div>
    {/if}
</div>

<style>
    .database-stats {
        width: 100%;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
    }

    .compact .stats-grid {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 8px;
    }

    .loading-state {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
    }

    .skeleton-card {
        height: 80px;
        background: linear-gradient(90deg, var(--baseAlt1Color) 25%, var(--baseAlt2Color) 50%, var(--baseAlt1Color) 75%);
        background-size: 200% 100%;
        animation: skeleton-loading 1.5s infinite;
        border-radius: var(--baseRadius);
    }

    @keyframes skeleton-loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }

    .error-state {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: var(--dangerAltColor);
        color: var(--dangerColor);
        border-radius: var(--baseRadius);
        font-size: 0.875em;
    }

    .error-state i {
        font-size: 1.1em;
    }

    .empty-state {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 20px;
        color: var(--txtHintColor);
        font-size: 0.875em;
    }

    .empty-state i {
        font-size: 1.2em;
        opacity: 0.7;
    }

    .db-info {
        margin-top: 12px;
        display: flex;
        justify-content: center;
    }

    .db-type-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        font-size: 0.75em;
        font-weight: 500;
        border-radius: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .db-type-badge.sqlite {
        background: var(--successAltColor);
        color: var(--successColor);
    }

    .db-type-badge.postgresql {
        background: var(--infoAltColor);
        color: var(--infoColor);
    }

    .db-type-badge i {
        font-size: 1em;
    }

    @media (max-width: 768px) {
        .stats-grid {
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 8px;
        }
    }
</style>