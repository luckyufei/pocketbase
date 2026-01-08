<script>
    import ApiClient from "@/utils/ApiClient";
    import tooltip from "@/actions/tooltip";
    import { pageTitle } from "@/stores/app";
    import { addSuccessToast, addErrorToast } from "@/stores/toasts";
    import { confirm } from "@/stores/confirmation";
    import PageWrapper from "@/components/base/PageWrapper.svelte";
    import RefreshButton from "@/components/base/RefreshButton.svelte";
    import SettingsSidebar from "@/components/settings/SettingsSidebar.svelte";
    import JobsStats from "@/components/jobs/JobsStats.svelte";
    import JobsFilters from "@/components/jobs/JobsFilters.svelte";

    $pageTitle = "Jobs";

    let jobs = [];
    let stats = null;
    let isLoading = false;
    let isLoadingStats = false;
    let filter = { topic: "", status: "", limit: 20, offset: 0 };
    let total = 0;
    let actionLoading = {};

    loadJobs();
    loadStats();

    async function loadJobs() {
        isLoading = true;

        try {
            const query = {};
            if (filter.topic) query.topic = filter.topic;
            if (filter.status) query.status = filter.status;
            query.limit = filter.limit;
            query.offset = filter.offset;

            const result = await ApiClient.jobs.list(query);
            jobs = result.items || [];
            total = result.total || 0;
            isLoading = false;
        } catch (err) {
            if (!err.isAbort) {
                ApiClient.error(err);
                isLoading = false;
            }
        }
    }

    async function loadStats() {
        isLoadingStats = true;

        try {
            stats = await ApiClient.jobs.stats();
            isLoadingStats = false;
        } catch (err) {
            if (!err.isAbort) {
                ApiClient.error(err);
                isLoadingStats = false;
            }
        }
    }

    async function requeueJob(job) {
        actionLoading[job.id] = "requeue";

        try {
            await ApiClient.jobs.requeue(job.id);
            addSuccessToast(`Job ${job.id} requeued successfully.`);
            actionLoading[job.id] = null;
            loadJobs();
            loadStats();
        } catch (err) {
            if (!err.isAbort) {
                ApiClient.error(err);
                actionLoading[job.id] = null;
            }
        }
    }

    async function deleteJob(job) {
        confirm(`Are you sure you want to delete job "${job.id}"?`, async () => {
            actionLoading[job.id] = "delete";

            try {
                await ApiClient.jobs.delete(job.id);
                addSuccessToast(`Job ${job.id} deleted successfully.`);
                actionLoading[job.id] = null;
                loadJobs();
                loadStats();
            } catch (err) {
                if (!err.isAbort) {
                    ApiClient.error(err);
                    actionLoading[job.id] = null;
                }
            }
        });
    }

    function onFilterChange(event) {
        filter = { ...filter, ...event.detail, offset: 0 };
        loadJobs();
    }

    function prevPage() {
        if (filter.offset > 0) {
            filter.offset = Math.max(0, filter.offset - filter.limit);
            loadJobs();
        }
    }

    function nextPage() {
        if (filter.offset + filter.limit < total) {
            filter.offset += filter.limit;
            loadJobs();
        }
    }

    function refresh() {
        loadJobs();
        loadStats();
    }

    function getStatusClass(status) {
        switch (status) {
            case "pending":
                return "label-warning";
            case "processing":
                return "label-info";
            case "completed":
                return "label-success";
            case "failed":
                return "label-danger";
            default:
                return "";
        }
    }

    function formatDate(dateStr) {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        return date.toLocaleString();
    }

    function truncateId(id) {
        if (!id || id.length <= 12) return id;
        return id.substring(0, 8) + "..." + id.substring(id.length - 4);
    }
</script>

<SettingsSidebar />

<PageWrapper>
    <header class="page-header">
        <nav class="breadcrumbs">
            <div class="breadcrumb-item">Settings</div>
            <div class="breadcrumb-item">{$pageTitle}</div>
        </nav>
    </header>

    <div class="wrapper">
        <!-- 统计卡片 -->
        <JobsStats {stats} isLoading={isLoadingStats} />

        <!-- 筛选器 -->
        <div class="panel m-t-base">
            <div class="flex m-b-sm flex-gap-10">
                <span class="txt-xl">Job Queue</span>
                <RefreshButton class="btn-sm" tooltip={"Refresh"} on:refresh={refresh} />
            </div>

            <JobsFilters {filter} on:change={onFilterChange} />

            <!-- 任务列表 -->
            <div class="table-wrapper m-t-sm">
                <table class="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Topic</th>
                            <th>Status</th>
                            <th>Retries</th>
                            <th>Run At</th>
                            <th>Created</th>
                            <th class="col-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#if isLoading}
                            <tr>
                                <td colspan="7" class="txt-center p-lg">
                                    <span class="loader loader-lg" />
                                </td>
                            </tr>
                        {:else if jobs.length === 0}
                            <tr>
                                <td colspan="7" class="txt-center txt-hint p-lg">
                                    No jobs found.
                                </td>
                            </tr>
                        {:else}
                            {#each jobs as job (job.id)}
                                <tr>
                                    <td>
                                        <span class="txt-mono txt-sm" use:tooltip={job.id}>
                                            {truncateId(job.id)}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="label">{job.topic}</span>
                                    </td>
                                    <td>
                                        <span class="label {getStatusClass(job.status)}">
                                            {job.status}
                                        </span>
                                    </td>
                                    <td>
                                        {job.retries}/{job.max_retries}
                                    </td>
                                    <td class="txt-sm">
                                        {formatDate(job.run_at)}
                                    </td>
                                    <td class="txt-sm">
                                        {formatDate(job.created)}
                                    </td>
                                    <td class="col-actions">
                                        {#if job.status === "failed"}
                                            <button
                                                type="button"
                                                class="btn btn-sm btn-circle btn-hint btn-transparent"
                                                class:btn-loading={actionLoading[job.id] === "requeue"}
                                                disabled={actionLoading[job.id]}
                                                aria-label="Requeue"
                                                use:tooltip={"Requeue"}
                                                on:click|preventDefault={() => requeueJob(job)}
                                            >
                                                <i class="ri-restart-line"></i>
                                            </button>
                                        {/if}
                                        {#if job.status === "pending" || job.status === "failed"}
                                            <button
                                                type="button"
                                                class="btn btn-sm btn-circle btn-hint btn-transparent btn-danger"
                                                class:btn-loading={actionLoading[job.id] === "delete"}
                                                disabled={actionLoading[job.id]}
                                                aria-label="Delete"
                                                use:tooltip={"Delete"}
                                                on:click|preventDefault={() => deleteJob(job)}
                                            >
                                                <i class="ri-delete-bin-line"></i>
                                            </button>
                                        {/if}
                                        {#if job.last_error}
                                            <span
                                                class="txt-danger"
                                                use:tooltip={job.last_error}
                                            >
                                                <i class="ri-error-warning-line"></i>
                                            </span>
                                        {/if}
                                    </td>
                                </tr>
                            {/each}
                        {/if}
                    </tbody>
                </table>
            </div>

            <!-- 分页 -->
            {#if total > 0}
                <div class="flex flex-gap-10 m-t-sm">
                    <span class="txt-hint txt-sm">
                        Showing {filter.offset + 1} - {Math.min(filter.offset + filter.limit, total)} of {total}
                    </span>
                    <div class="flex-fill"></div>
                    <button
                        type="button"
                        class="btn btn-sm btn-secondary"
                        disabled={filter.offset === 0}
                        on:click={prevPage}
                    >
                        Previous
                    </button>
                    <button
                        type="button"
                        class="btn btn-sm btn-secondary"
                        disabled={filter.offset + filter.limit >= total}
                        on:click={nextPage}
                    >
                        Next
                    </button>
                </div>
            {/if}
        </div>
    </div>
</PageWrapper>
