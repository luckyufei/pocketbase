<script>
    import ApiClient from "@/utils/ApiClient";
    import CommonHelper from "@/utils/CommonHelper";
    import tooltip from "@/actions/tooltip";
    import { addSuccessToast } from "@/stores/toasts";
    import { pageTitle } from "@/stores/app";
    import { setErrors } from "@/stores/errors";
    import Field from "@/components/base/Field.svelte";
    import PageWrapper from "@/components/base/PageWrapper.svelte";
    import SettingsSidebar from "@/components/settings/SettingsSidebar.svelte";

    $pageTitle = "Analytics settings";

    let originalFormSettings = {};
    let formSettings = {};
    let isLoading = false;
    let isSaving = false;
    let initialHash = "";

    $: initialHash = JSON.stringify(originalFormSettings);

    $: hasChanges = initialHash != JSON.stringify(formSettings);

    loadSettings();

    async function loadSettings() {
        isLoading = true;

        try {
            const settings = (await ApiClient.settings.getAll()) || {};
            init(settings);
        } catch (err) {
            ApiClient.error(err);
        }

        isLoading = false;
    }

    async function save() {
        if (isSaving || !hasChanges) {
            return;
        }

        isSaving = true;

        try {
            const settings = await ApiClient.settings.update(CommonHelper.filterRedactedProps(formSettings));
            init(settings);

            setErrors({});

            addSuccessToast("Successfully saved analytics settings.");
        } catch (err) {
            ApiClient.error(err);
        }

        isSaving = false;
    }

    function init(settings = {}) {
        formSettings = {
            analytics: settings?.analytics || {
                enabled: true,
                retention: 90,
                s3Bucket: "",
            },
        };

        originalFormSettings = JSON.parse(JSON.stringify(formSettings));
    }

    function reset() {
        formSettings = JSON.parse(JSON.stringify(originalFormSettings || {}));
    }
</script>

<SettingsSidebar />

<PageWrapper>
    <header class="page-header">
        <nav class="breadcrumbs">
            <div class="breadcrumb-item">Settings</div>
            <div class="breadcrumb-item">Analytics</div>
        </nav>
    </header>

    <div class="wrapper">
        <form class="panel" autocomplete="off" on:submit|preventDefault={save}>
            {#if isLoading}
                <div class="loader" />
            {:else}
                <div class="content txt-xl m-b-base">
                    <p class="txt-hint">
                        Configure analytics data collection and retention settings.
                    </p>
                </div>

                <div class="grid">
                    <div class="col-lg-12">
                        <Field class="form-field form-field-toggle" name="analytics.enabled" let:uniqueId>
                            <input
                                type="checkbox"
                                id={uniqueId}
                                bind:checked={formSettings.analytics.enabled}
                            />
                            <label for={uniqueId}>
                                <span class="txt">Enable analytics</span>
                                <i
                                    class="ri-information-line link-hint"
                                    use:tooltip={{
                                        text: `When enabled, the system will collect page views, events, and other analytics data. Disabling this will stop all data collection.`,
                                        position: "right",
                                    }}
                                />
                            </label>
                        </Field>
                    </div>

                    {#if formSettings.analytics.enabled}
                        <div class="col-lg-6">
                            <Field class="form-field required" name="analytics.retention" let:uniqueId>
                                <label for={uniqueId}>
                                    Data retention (days)
                                    <i
                                        class="ri-information-line link-hint"
                                        use:tooltip={{
                                            text: `Number of days to keep analytics data. Data older than this will be automatically deleted. Minimum is 1 day.`,
                                            position: "right",
                                        }}
                                    />
                                </label>
                                <input
                                    type="number"
                                    id={uniqueId}
                                    min="1"
                                    required
                                    bind:value={formSettings.analytics.retention}
                                />
                            </Field>
                        </div>

                        <div class="col-lg-6">
                            <Field class="form-field" name="analytics.s3Bucket" let:uniqueId>
                                <label for={uniqueId}>
                                    S3 Bucket (optional)
                                    <i
                                        class="ri-information-line link-hint"
                                        use:tooltip={{
                                            text: `Optional S3 bucket for storing raw analytics logs. Required for PostgreSQL mode if you want to preserve raw event data.`,
                                            position: "right",
                                        }}
                                    />
                                </label>
                                <input
                                    type="text"
                                    id={uniqueId}
                                    placeholder="my-analytics-bucket"
                                    bind:value={formSettings.analytics.s3Bucket}
                                />
                            </Field>
                        </div>
                    {/if}
                </div>

                <div class="flex m-t-base">
                    <div class="flex-fill" />

                    {#if hasChanges}
                        <button
                            type="button"
                            class="btn btn-transparent btn-hint"
                            disabled={isSaving}
                            on:click={() => reset()}
                        >
                            <span class="txt">Cancel</span>
                        </button>
                    {/if}

                    <button
                        type="submit"
                        class="btn btn-expanded"
                        class:btn-loading={isSaving}
                        disabled={!hasChanges || isSaving}
                        on:click={() => save()}
                    >
                        <span class="txt">Save changes</span>
                    </button>
                </div>
            {/if}
        </form>
    </div>
</PageWrapper>
