<script>
    import { createEventDispatcher } from "svelte";

    export let selected = "24h";

    const dispatch = createEventDispatcher();

    const options = [
        { value: "1h", label: "1 小时", hours: 1 },
        { value: "24h", label: "24 小时", hours: 24 },
        { value: "7d", label: "7 天", hours: 168 },
    ];

    function selectRange(option) {
        selected = option.value;
        dispatch("change", { value: option.value, hours: option.hours });
    }
</script>

<div class="time-range-selector">
    {#each options as option}
        <button
            type="button"
            class="btn btn-sm"
            class:btn-secondary={selected !== option.value}
            class:btn-primary={selected === option.value}
            on:click={() => selectRange(option)}
        >
            {option.label}
        </button>
    {/each}
</div>

<style>
    .time-range-selector {
        display: flex;
        gap: 8px;
    }
</style>
