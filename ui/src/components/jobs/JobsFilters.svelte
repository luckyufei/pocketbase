<script>
    import { createEventDispatcher } from "svelte";

    export let filter = { topic: "", status: "", limit: 20, offset: 0 };

    const dispatch = createEventDispatcher();

    const statusOptions = [
        { value: "", label: "All Statuses" },
        { value: "pending", label: "Pending" },
        { value: "processing", label: "Processing" },
        { value: "completed", label: "Completed" },
        { value: "failed", label: "Failed" },
    ];

    const limitOptions = [10, 20, 50, 100];

    function handleChange() {
        dispatch("change", filter);
    }

    function clearFilters() {
        filter = { topic: "", status: "", limit: 20, offset: 0 };
        dispatch("change", filter);
    }
</script>

<div class="filters flex flex-gap-10 flex-wrap">
    <div class="form-field form-field-sm">
        <label for="filter-topic">Topic</label>
        <input
            type="text"
            id="filter-topic"
            placeholder="Filter by topic..."
            bind:value={filter.topic}
            on:change={handleChange}
        />
    </div>

    <div class="form-field form-field-sm">
        <label for="filter-status">Status</label>
        <select
            id="filter-status"
            bind:value={filter.status}
            on:change={handleChange}
        >
            {#each statusOptions as opt}
                <option value={opt.value}>{opt.label}</option>
            {/each}
        </select>
    </div>

    <div class="form-field form-field-sm">
        <label for="filter-limit">Per Page</label>
        <select
            id="filter-limit"
            bind:value={filter.limit}
            on:change={handleChange}
        >
            {#each limitOptions as limit}
                <option value={limit}>{limit}</option>
            {/each}
        </select>
    </div>

    <div class="form-field form-field-sm">
        <label>&nbsp;</label>
        <button
            type="button"
            class="btn btn-sm btn-secondary"
            on:click={clearFilters}
        >
            Clear
        </button>
    </div>
</div>

<style>
    .filters {
        margin-bottom: 0.5rem;
        align-items: flex-end;
    }

    .filters :global(.form-field) {
        flex: 0 0 auto;
        min-width: 120px;
        max-width: 200px;
        margin-bottom: 0;
    }

    .filters :global(input),
    .filters :global(select) {
        height: 38px;
    }
</style>
