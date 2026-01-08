import PocketBase, { LocalAuthStore, isTokenExpired } from "pocketbase";
// ---
import { protectedFilesCollectionsCache } from "@/stores/collections";
import { setErrors } from "@/stores/errors";
import { setSuperuser } from "@/stores/superuser";
import { addErrorToast } from "@/stores/toasts";
import CommonHelper from "@/utils/CommonHelper";
import { replace } from "svelte-spa-router";
import { get } from "svelte/store";

const superuserFileTokenKey = "pb_superuser_file_token";

/**
 * Clears the authorized state and redirects to the login page.
 *
 * @param {Boolean} [redirect] Whether to redirect to the login page.
 */
PocketBase.prototype.logout = function (redirect = true) {
    this.authStore.clear();

    if (redirect) {
        replace("/login");
    }
};

/**
 * Generic API error response handler.
 *
 * @param  {Error}   err        The API error itself.
 * @param  {Boolean} notify     Whether to add a toast notification.
 * @param  {String}  defaultMsg Default toast notification message if the error doesn't have one.
 */
PocketBase.prototype.error = function (err, notify = true, defaultMsg = "") {
    if (!err || !(err instanceof Error) || err.isAbort) {
        return;
    }

    const statusCode = (err?.status << 0) || 400;
    const responseData = err?.data || {};
    const msg = responseData.message || err.message || defaultMsg;

    // add toast error notification
    if (notify && msg) {
        addErrorToast(msg);
    }

    // populate form field errors
    if (!CommonHelper.isEmpty(responseData.data)) {
        setErrors(responseData.data);
    }

    // unauthorized
    if (statusCode === 401) {
        this.cancelAllRequests();
        return this.logout();
    }

    // forbidden
    if (statusCode === 403) {
        this.cancelAllRequests();
        return replace("/");
    }
};

/**
 * @return {Promise<String>}
 */
PocketBase.prototype.getSuperuserFileToken = async function (collectionId = "") {
    let needToken = true;

    if (collectionId) {
        const protectedCollections = get(protectedFilesCollectionsCache);
        needToken = typeof protectedCollections[collectionId] !== "undefined"
            ? protectedCollections[collectionId]
            : true;
    }

    if (!needToken) {
        return "";
    }

    let token = localStorage.getItem(superuserFileTokenKey) || "";

    // request a new token only if the previous one is missing or will expire soon
    if (!token || isTokenExpired(token, 10)) {
        // remove previously stored token (if any)
        token && localStorage.removeItem(superuserFileTokenKey);

        if (!this._superuserFileTokenRequest) {
            this._superuserFileTokenRequest = this.files.getToken();
        }

        token = await this._superuserFileTokenRequest;
        localStorage.setItem(superuserFileTokenKey, token);
        this._superuserFileTokenRequest = null;
    }

    return token;
}

// Custom auth store to sync the svelte superuser store state with the authorized superuser instance.
class AppAuthStore extends LocalAuthStore {
    /**
     * @inheritdoc
     */
    constructor(storageKey = "__pb_superuser_auth__") {
        super(storageKey);

        this.save(this.token, this.record);
    }

    /**
     * @inheritdoc
     */
    save(token, record) {
        super.save(token, record);

        if (record?.collectionName == "_superusers") {
            setSuperuser(record);
        }
    }

    /**
     * @inheritdoc
     */
    clear() {
        super.clear();

        setSuperuser(null);
    }
}

const pb = new PocketBase(import.meta.env.PB_BACKEND_URL, new AppAuthStore());

// Add secrets service (not yet in the published SDK)
pb.secrets = {
    async list(options = {}) {
        return pb.send("/api/secrets", { method: "GET", ...options });
    },
    async get(key, options = {}) {
        return pb.send(`/api/secrets/${encodeURIComponent(key)}`, { method: "GET", ...options });
    },
    async create(data, options = {}) {
        return pb.send("/api/secrets", { method: "POST", body: data, ...options });
    },
    async update(key, data, options = {}) {
        return pb.send(`/api/secrets/${encodeURIComponent(key)}`, { method: "PUT", body: data, ...options });
    },
    async delete(key, options = {}) {
        return pb.send(`/api/secrets/${encodeURIComponent(key)}`, { method: "DELETE", ...options });
    },
};

// Add jobs service (not yet in the published SDK)
pb.jobs = {
    async list(options = {}) {
        const query = {};
        if (options.topic) query.topic = options.topic;
        if (options.status) query.status = options.status;
        if (options.limit !== undefined) query.limit = options.limit;
        if (options.offset !== undefined) query.offset = options.offset;
        return pb.send("/api/jobs", { method: "GET", query, ...options });
    },
    async get(id, options = {}) {
        return pb.send(`/api/jobs/${encodeURIComponent(id)}`, { method: "GET", ...options });
    },
    async enqueue(topic, payload, options = {}) {
        const body = { topic, payload };
        if (options.run_at) body.run_at = options.run_at;
        if (options.max_retries !== undefined) body.max_retries = options.max_retries;
        return pb.send("/api/jobs/enqueue", { method: "POST", body, ...options });
    },
    async requeue(id, options = {}) {
        return pb.send(`/api/jobs/${encodeURIComponent(id)}/requeue`, { method: "POST", ...options });
    },
    async delete(id, options = {}) {
        return pb.send(`/api/jobs/${encodeURIComponent(id)}`, { method: "DELETE", ...options });
    },
    async stats(options = {}) {
        return pb.send("/api/jobs/stats", { method: "GET", ...options });
    },
};

if (pb.authStore.isValid) {
    pb.collection(pb.authStore.record.collectionName || "_superusers")
        .authRefresh()
        .catch((err) => {
            console.warn("Failed to refresh the existing auth token:", err);

            // clear the store only on invalidated/expired token
            const status = err?.status << 0;
            if (status == 401 || status == 403) {
                pb.authStore.clear();
            }
        });
}

export default pb;
