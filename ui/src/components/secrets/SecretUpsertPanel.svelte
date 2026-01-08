<script>
    import { createEventDispatcher } from "svelte";
    import ApiClient from "@/utils/ApiClient";
    import { addSuccessToast, addErrorToast } from "@/stores/toasts";
    import { setErrors, errors } from "@/stores/errors";
    import OverlayPanel from "@/components/base/OverlayPanel.svelte";
    import Field from "@/components/base/Field.svelte";

    const dispatch = createEventDispatcher();

    let panel;
    let isLoading = false;
    let isNew = true;
    let originalKey = "";

    let formData = {
        key: "",
        value: "",
        env: "global",
        description: "",
    };

    const envOptions = [
        { label: "Global", value: "global" },
        { label: "Development", value: "dev" },
        { label: "Production", value: "prod" },
    ];

    export function show(secret = null) {
        setErrors({});

        if (secret) {
            isNew = false;
            originalKey = secret.key;
            formData = {
                key: secret.key,
                value: "", // 值不回显，需要重新输入
                env: secret.env || "global",
                description: secret.description || "",
            };
        } else {
            isNew = true;
            originalKey = "";
            formData = {
                key: "",
                value: "",
                env: "global",
                description: "",
            };
        }

        panel?.show();
    }

    export function hide() {
        panel?.hide();
    }

    async function save() {
        if (isLoading) return;

        isLoading = true;
        setErrors({});

        try {
            if (isNew) {
                await ApiClient.secrets.create({
                    key: formData.key,
                    value: formData.value,
                    env: formData.env,
                    description: formData.description,
                });
                addSuccessToast(`Secret "${formData.key}" created successfully.`);
            } else {
                await ApiClient.secrets.update(originalKey, {
                    value: formData.value,
                    description: formData.description,
                });
                addSuccessToast(`Secret "${originalKey}" updated successfully.`);
            }

            isLoading = false;
            hide();
            dispatch("save");
        } catch (err) {
            if (!err.isAbort) {
                isLoading = false;
                if (err.data?.data) {
                    setErrors(err.data.data);
                }
                addErrorToast(err.data?.message || "Failed to save secret.");
            }
        }
    }
</script>

<OverlayPanel
    bind:this={panel}
    popup
    class="secret-upsert-panel"
    beforeHide={() => !isLoading}
    on:hide
    on:show
>
    <svelte:fragment slot="header">
        <h4>{isNew ? "New Secret" : `Overwrite "${originalKey}"`}</h4>
    </svelte:fragment>

    <form id="secretForm" on:submit|preventDefault={save}>
        {#if isNew}
            <Field class="form-field required" name="key" let:uniqueId>
                <label for={uniqueId}>Key</label>
                <input
                    type="text"
                    id={uniqueId}
                    bind:value={formData.key}
                    placeholder="e.g., OPENAI_API_KEY"
                    required
                    pattern="[A-Z0-9_]+"
                    title="Use uppercase letters, numbers, and underscores"
                />
                <div class="help-block">
                    Recommended format: <code>VENDOR_TYPE</code> (e.g., OPENAI_API_KEY)
                </div>
            </Field>
        {:else}
            <Field class="form-field" name="key" let:uniqueId>
                <label for={uniqueId}>Key</label>
                <input type="text" id={uniqueId} value={originalKey} disabled />
            </Field>
        {/if}

        <Field class="form-field required" name="value" let:uniqueId>
            <label for={uniqueId}>
                Value
                {#if !isNew}
                    <span class="txt-hint txt-sm">(enter new value to overwrite)</span>
                {/if}
            </label>
            <input
                type="password"
                id={uniqueId}
                bind:value={formData.value}
                placeholder="Enter secret value"
                required
                autocomplete="new-password"
            />
            <div class="help-block">
                <i class="ri-lock-line" /> Value will be encrypted with AES-256-GCM
            </div>
        </Field>

        {#if isNew}
            <Field class="form-field" name="env" let:uniqueId>
                <label for={uniqueId}>Environment</label>
                <select id={uniqueId} bind:value={formData.env}>
                    {#each envOptions as opt}
                        <option value={opt.value}>{opt.label}</option>
                    {/each}
                </select>
                <div class="help-block">
                    Use different environments to isolate dev/prod secrets
                </div>
            </Field>
        {/if}

        <Field class="form-field" name="description" let:uniqueId>
            <label for={uniqueId}>Description</label>
            <input
                type="text"
                id={uniqueId}
                bind:value={formData.description}
                placeholder="Optional description"
            />
        </Field>
    </form>

    <svelte:fragment slot="footer">
        <button type="button" class="btn btn-transparent" disabled={isLoading} on:click={hide}>
            <span class="txt">Cancel</span>
        </button>
        <button
            type="submit"
            form="secretForm"
            class="btn btn-expanded"
            class:btn-loading={isLoading}
            disabled={isLoading}
        >
            <span class="txt">{isNew ? "Create" : "Overwrite"}</span>
        </button>
    </svelte:fragment>
</OverlayPanel>

<style>
    :global(.secret-upsert-panel) {
        min-width: 450px;
    }
</style>
