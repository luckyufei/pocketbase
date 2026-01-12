<script>
    import { onMount } from "svelte";
    import Accordion from "@/components/base/Accordion.svelte";
    import ApiClient from "@/utils/ApiClient";

    export let collection;

    let tofStatus = null;
    let isLoading = true;

    onMount(async () => {
        await loadTofStatus();
    });

    async function loadTofStatus() {
        isLoading = true;
        try {
            tofStatus = await ApiClient.tof.status();
        } catch (err) {
            // TOF 插件未启用或请求失败
            tofStatus = null;
        }
        isLoading = false;
    }

    $: isEnabled = tofStatus?.enabled || false;
</script>

{#if tofStatus !== null}
    <Accordion single>
        <svelte:fragment slot="header">
            <div class="inline-flex">
                <i class="ri-shield-keyhole-line"></i>
                <span class="txt">TOF 认证</span>
            </div>

            <div class="flex-fill" />

            {#if isLoading}
                <span class="label">加载中...</span>
            {:else if isEnabled}
                <span class="label label-success">已启用</span>
            {:else}
                <span class="label">未启用</span>
            {/if}
        </svelte:fragment>

        {#if isLoading}
            <div class="txt-hint">正在加载 TOF 配置...</div>
        {:else if isEnabled}
            <div class="content m-b-sm">
                <p class="txt-hint m-b-10">
                    TOF (腾讯统一身份认证) 已启用。用户可通过 TOF 网关进行身份验证。
                </p>

                <div class="grid grid-sm">
                    <div class="col-sm-6">
                        <div class="form-field form-field-sm disabled">
                            <label class="txt-bold">TOF_APP_KEY</label>
                            <input
                                type="text"
                                value={tofStatus.appKey || "未配置"}
                                disabled
                                class="txt-mono"
                            />
                        </div>
                    </div>
                    <div class="col-sm-6">
                        <div class="form-field form-field-sm disabled">
                            <label class="txt-bold">TOF_APP_TOKEN</label>
                            <input
                                type="text"
                                value={tofStatus.appToken || "未配置"}
                                disabled
                                class="txt-mono"
                            />
                        </div>
                    </div>
                </div>

                {#if tofStatus.devMockUser}
                    <div class="alert alert-warning m-t-10">
                        <div class="icon"><i class="ri-error-warning-line"></i></div>
                        <div class="content">
                            <p>
                                <strong>开发模式已启用</strong>：模拟用户为
                                <code>{tofStatus.devMockUser}</code>
                            </p>
                            <p class="txt-sm txt-hint m-t-5">
                                生产环境请移除 TOF_DEV_MOCK_USER 环境变量
                            </p>
                        </div>
                    </div>
                {/if}

                <div class="txt-hint txt-sm m-t-15">
                    <p>认证端点：</p>
                    <code class="txt-mono">GET /api/collections/{collection.name}/auth-with-tof</code>
                </div>
            </div>
        {:else}
            <div class="content">
                <p class="txt-hint">
                    TOF 认证未启用。要启用 TOF 认证，请设置以下环境变量后重启服务：
                </p>
                <ul class="txt-hint m-t-10">
                    <li><code>TOF_APP_KEY</code> - 太湖应用 Key</li>
                    <li><code>TOF_APP_TOKEN</code> - 太湖应用 Token</li>
                </ul>
            </div>
        {/if}
    </Accordion>
{/if}

<style>
    .txt-mono {
        font-family: monospace;
    }
</style>
