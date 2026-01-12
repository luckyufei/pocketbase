<script>
    import tooltip from "@/actions/tooltip";
    import CommonHelper from "@/utils/CommonHelper";

    export let date = "";

    // 确保 date 是字符串类型
    $: dateStr = typeof date === 'string' ? date : (date ? String(date) : "");

    $: dateOnly = dateStr ? dateStr.substring(0, 10) : null;

    $: timeOnly = dateStr ? dateStr.substring(10, 19) : null;

    const tooltipData = {
        // generate the tooltip text as getter to speed up the initial load
        // in case the component is used with large number of items
        get text() {
            return CommonHelper.formatToLocalDate(dateStr) + " Local";
        },
    };
</script>

{#if dateStr}
    <div class="datetime" use:tooltip={tooltipData}>
        <div class="date">{dateOnly}</div>
        <div class="time">{timeOnly} UTC</div>
    </div>
{:else}
    <span class="txt txt-hint">N/A</span>
{/if}

<style>
    .datetime {
        display: inline-block;
        vertical-align: top;
        white-space: nowrap;
        line-height: var(--smLineHeight);
    }
    .time {
        font-size: var(--smFontSize);
        color: var(--txtHintColor);
    }
</style>
