<script>
    import ApiClient from "@/utils/ApiClient";
    import tooltip from "@/actions/tooltip";
    import { pageTitle } from "@/stores/app";
    import { addSuccessToast, addErrorToast } from "@/stores/toasts";
    import { confirm } from "@/stores/confirmation";
    import PageWrapper from "@/components/base/PageWrapper.svelte";
    import RefreshButton from "@/components/base/RefreshButton.svelte";
    import SettingsSidebar from "@/components/settings/SettingsSidebar.svelte";
    import SecretUpsertPanel from "@/components/secrets/SecretUpsertPanel.svelte";

    $pageTitle = "Secrets";

    let secrets = [];
    let isLoading = false;
    let isEnabled = true;
    let upsertPanel;
    let actionLoading = {};

    loadSecrets();

    async function loadSecrets() {
        isLoading = true;

        try {
            secrets = await ApiClient.secrets.list();
            isEnabled = true;
            isLoading = false;
        } catch (err) {
            if (!err.isAbort) {
                if (err.status === 503) {
                    isEnabled = false;
                    secrets = [];
                } else {
                    ApiClient.error(err);
                }
                isLoading = false;
            }
        }
    }

    async function deleteSecret(secret) {
        confirm(`Are you sure you want to delete secret "${secret.key}"?`, async () => {
            actionLoading[secret.key] = "delete";

            try {
                await ApiClient.secrets.delete(secret.key);
                addSuccessToast(`Secret "${secret.key}" deleted successfully.`);
                actionLoading[secret.key] = null;
                loadSecrets();
            } catch (err) {
                if (!err.isAbort) {
                    ApiClient.error(err);
                    actionLoading[secret.key] = null;
                }
            }
        });
    }

    function openCreatePanel() {
        upsertPanel?.show();
    }

    function openEditPanel(secret) {
        upsertPanel?.show(secret);
    }

    function formatDate(dateStr) {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        return date.toLocaleString();
    }

    function getEnvClass(env) {
        switch (env) {
            case "production":
            case "prod":
                return "label-danger";
            case "development":
            case "dev":
                return "label-warning";
            default:
                return "label-success";
        }
    }
</script>

<SettingsSidebar />

<PageWrapper>
    <header class="page-header">
        <nav class="breadcrumbs">
            <div class="breadcrumb-item">Settings</div>
            <div class="breadcrumb-item">{$pageTitle}</div>
        </nav>
        <div class="flex-fill" />
        {#if isEnabled}
            <button type="button" class="btn btn-expanded" on:click={openCreatePanel}>
                <i class="ri-add-line" />
                <span class="txt">New secret</span>
            </button>
        {/if}
    </header>

    <div class="wrapper">
        {#if !isEnabled}
            <!-- 功能未启用提示 -->
            <div class="alert alert-warning m-b-base">
                <div class="icon">
                    <i class="ri-lock-line" />
                </div>
                <div class="content">
                    <p class="txt-bold">Secrets feature is disabled</p>
                    <p class="m-t-5">
                        To enable encrypted secret storage, set the <code>PB_MASTER_KEY</code> environment variable
                        with a 64-character hex string (32 bytes).
                    </p>
                    <p class="m-t-5 txt-hint">
                        Example: <code>export PB_MASTER_KEY=$(openssl rand -hex 32)</code>
                    </p>
                </div>
            </div>
        {:else}
            <!-- Secrets 列表 -->
            <div class="panel">
                <div class="flex m-b-sm flex-gap-10">
                    <span class="txt-xl">
                        <i class="ri-key-2-line" /> Encrypted Secrets
                    </span>
                    <RefreshButton class="btn-sm" tooltip={"Refresh"} on:refresh={loadSecrets} />
                </div>

                <p class="txt-hint m-b-base">
                    Secrets are encrypted with AES-256-GCM. Values are never exposed in the UI.
                </p>

                <div class="table-wrapper">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Key</th>
                                <th>Value</th>
                                <th>Environment</th>
                                <th>Description</th>
                                <th>Updated</th>
                                <th class="col-actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#if isLoading}
                                <tr>
                                    <td colspan="6" class="txt-center p-lg">
                                        <span class="loader loader-lg" />
                                    </td>
                                </tr>
                            {:else if secrets.length === 0}
                                <tr>
                                    <td colspan="6" class="txt-center txt-hint p-lg">
                                        No secrets found. Click "New secret" to create one.
                                    </td>
                                </tr>
                            {:else}
                                {#each secrets as secret (secret.key + secret.env)}
                                    <tr>
                                        <td>
                                            <span class="txt-mono txt-bold">{secret.key}</span>
                                        </td>
                                        <td>
                                            <span class="txt-mono txt-hint">
                                                <i class="ri-lock-password-line" />
                                                {secret.masked_value || "***"}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="label {getEnvClass(secret.env)}">
                                                {secret.env || "global"}
                                            </span>
                                        </td>
                                        <td class="txt-hint txt-ellipsis" style="max-width: 200px;">
                                            {secret.description || "-"}
                                        </td>
                                        <td class="txt-sm">
                                            {formatDate(secret.updated)}
                                        </td>
                                        <td class="col-actions">
                                            <button
                                                type="button"
                                                class="btn btn-sm btn-circle btn-hint btn-transparent"
                                                aria-label="Overwrite"
                                                use:tooltip={"Overwrite value"}
                                                on:click|preventDefault={() => openEditPanel(secret)}
                                            >
                                                <i class="ri-edit-line" />
                                            </button>
                                            <button
                                                type="button"
                                                class="btn btn-sm btn-circle btn-hint btn-transparent btn-danger"
                                                class:btn-loading={actionLoading[secret.key] === "delete"}
                                                disabled={actionLoading[secret.key]}
                                                aria-label="Delete"
                                                use:tooltip={"Delete"}
                                                on:click|preventDefault={() => deleteSecret(secret)}
                                            >
                                                <i class="ri-delete-bin-line" />
                                            </button>
                                        </td>
                                    </tr>
                                {/each}
                            {/if}
                        </tbody>
                    </table>
                </div>
            </div>
        {/if}
    </div>
</PageWrapper>

<SecretUpsertPanel bind:this={upsertPanel} on:save={loadSecrets} />
