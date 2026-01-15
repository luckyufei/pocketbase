<script>
    import tooltip from "@/actions/tooltip";
    import Field from "@/components/base/Field.svelte";
    import SchemaField from "@/components/collections/schema/SchemaField.svelte";

    export let field;
    export let key = "";

    // secret 字段默认隐藏
    $: if (field && field.hidden === undefined) {
        field.hidden = true;
    }
</script>

<SchemaField bind:field {key} on:rename on:remove on:duplicate {...$$restProps}>
    <svelte:fragment slot="options">
        <div class="grid grid-sm">
            <div class="col-sm-6">
                <Field class="form-field" name="fields.{key}.maxSize" let:uniqueId>
                    <label for={uniqueId}>
                        <span class="txt">Max size</span>
                        <i
                            class="ri-information-line link-hint"
                            use:tooltip={"Maximum size of the secret value in bytes. Default is 4096 (4KB)."}
                        />
                    </label>
                    <input
                        type="number"
                        id={uniqueId}
                        step="1"
                        min="1"
                        max="4096"
                        placeholder="Default to 4096"
                        value={field.maxSize || ""}
                        on:input={(e) => (field.maxSize = parseInt(e.target.value, 10))}
                    />
                </Field>
            </div>
        </div>

        <div class="alert alert-warning m-t-sm">
            <div class="icon"><i class="ri-shield-keyhole-line"></i></div>
            <div class="content">
                <p>
                    <strong>Secret fields are encrypted</strong> using AES-256-GCM with the
                    <code>PB_MASTER_KEY</code> environment variable.
                </p>
                <p class="m-t-5">
                    <i class="ri-error-warning-line txt-warning"></i>
                    Secret fields cannot be used in filters or searches.
                </p>
            </div>
        </div>
    </svelte:fragment>
</SchemaField>
