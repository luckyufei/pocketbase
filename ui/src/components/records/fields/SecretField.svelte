<script>
    import Field from "@/components/base/Field.svelte";
    import SecretInput from "@/components/base/SecretInput.svelte";
    import FieldLabel from "@/components/records/fields/FieldLabel.svelte";

    export let field;
    export let value = "";
</script>

<Field class="form-field {field.required ? 'required' : ''}" name={field.name} let:uniqueId>
    <FieldLabel {uniqueId} {field} />

    <SecretInput
        id={uniqueId}
        required={field.required}
        bind:value
    />
</Field>
