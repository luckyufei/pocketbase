<script>
    import { onMount } from "svelte";
    import ApiClient from "@/utils/ApiClient";
    import tooltip from "@/actions/tooltip";

    let databaseType = "";
    let isLoading = true;

    onMount(async () => {
        try {
            const health = await ApiClient.health.check();
            databaseType = health?.data?.databaseType || "";
        } catch (err) {
            console.warn("Failed to load database type:", err);
        } finally {
            isLoading = false;
        }
    });

    $: displayText = databaseType === "PostgreSQL" ? "PG" : "SQLite";
    $: iconClass = databaseType === "PostgreSQL" ? "ri-database-line" : "ri-file-line";
    $: tooltipText = databaseType ? `数据库类型: ${databaseType}` : "数据库类型未知";
</script>

{#if !isLoading && databaseType}
    <div 
        class="database-indicator"
        use:tooltip={{ text: tooltipText, position: "right" }}
    >
        <i class={iconClass} />
        <span class="db-text">{displayText}</span>
    </div>
{/if}

<style>
    .database-indicator {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        margin: 8px 0;
        background: var(--baseAlt1Color);
        border: 1px solid var(--baseAlt2Color);
        border-radius: var(--baseRadius);
        font-size: 0.75rem;
        color: var(--txtHintColor);
        cursor: help;
        transition: all 0.15s ease;
    }

    .database-indicator:hover {
        background: var(--baseAlt2Color);
        color: var(--txtPrimaryColor);
    }

    .database-indicator i {
        font-size: 0.8rem;
    }

    .db-text {
        font-weight: 500;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
</style>