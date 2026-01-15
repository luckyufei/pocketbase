<script>
    import { onDestroy } from "svelte";
    import tooltip from "@/actions/tooltip";

    export let id = "";
    export let value = "";
    export let required = false;
    export let placeholder = "";
    export let readonly = false;
    export let revealDuration = 5000; // 自动隐藏时间(ms)，0 表示不自动隐藏

    let isRevealed = false;
    let revealTimer = null;

    // 掩码显示：只显示前后各 3 个字符
    $: maskedValue = getMaskedValue(value);

    function getMaskedValue(val) {
        if (!val || val.length <= 8) {
            return "•".repeat(val?.length || 0);
        }
        const prefix = val.slice(0, 3);
        const suffix = val.slice(-3);
        const middle = "•".repeat(Math.min(val.length - 6, 10));
        return prefix + middle + suffix;
    }

    function toggleReveal() {
        isRevealed = !isRevealed;

        // 清除之前的定时器
        if (revealTimer) {
            clearTimeout(revealTimer);
            revealTimer = null;
        }

        // 如果显示明文且设置了自动隐藏时间
        if (isRevealed && revealDuration > 0) {
            revealTimer = setTimeout(() => {
                isRevealed = false;
                revealTimer = null;
            }, revealDuration);
        }
    }

    onDestroy(() => {
        if (revealTimer) {
            clearTimeout(revealTimer);
        }
    });
</script>

<div class="secret-input-wrapper">
    {#if isRevealed}
        <input
            type="text"
            {id}
            {required}
            {readonly}
            {placeholder}
            bind:value
            autocomplete="off"
            spellcheck="false"
        />
    {:else}
        <input
            type="password"
            {id}
            {required}
            {readonly}
            placeholder={placeholder || maskedValue}
            bind:value
            autocomplete="new-password"
        />
    {/if}

    <button
        type="button"
        class="btn btn-sm btn-circle btn-transparent reveal-btn"
        aria-label={isRevealed ? "Hide secret" : "Reveal secret"}
        use:tooltip={isRevealed ? "Hide" : "Reveal"}
        on:click={toggleReveal}
    >
        <i class={isRevealed ? "ri-eye-off-line" : "ri-eye-line"}></i>
    </button>
</div>

<style>
    .secret-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }
    .secret-input-wrapper input {
        flex: 1;
        padding-right: 40px;
    }
    .reveal-btn {
        position: absolute;
        right: 5px;
        opacity: 0.6;
    }
    .reveal-btn:hover {
        opacity: 1;
    }
</style>
