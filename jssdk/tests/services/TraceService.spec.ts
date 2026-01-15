import { describe, expect, test, beforeAll, afterAll, afterEach } from "bun:test";
import { assert } from "../assert-helpers";
import { FetchMock } from "../mocks";
import Client from "@/Client";
import { TraceService } from "@/services/TraceService";

describe("TraceService", function () {
    const client = new Client("test_base_url");
    const service = new TraceService(client);
    const fetchMock = new FetchMock();

    beforeAll(function () {
        fetchMock.init();
    });

    afterAll(function () {
        fetchMock.restore();
    });

    afterEach(function () {
        fetchMock.clearMocks();
    });

    describe("getList()", function () {
        test("Should correctly return paginated list result", async function () {
            const replyBody = {
                page: 1,
                perPage: 30,
                totalItems: 100,
                totalPages: 4,
                items: [
                    {
                        trace_id: "abc123def456",
                        span_id: "span001",
                        parent_id: "",
                        name: "HTTP GET /api/test",
                        kind: "SERVER",
                        start_time: 1700000000000000,
                        duration: 12000,
                        status: "OK",
                        attributes: { "http.method": "GET" },
                        created: "2023-11-15 10:00:00.000Z",
                    },
                ],
            };

            fetchMock.on({
                method: "GET",
                url: "test_base_url/api/traces?limit=30&offset=0",
                replyCode: 200,
                replyBody: replyBody,
            });

            const list = await service.getList(1, 30);

            assert.deepEqual(list, replyBody);
        });

        test("Should correctly apply trace_id filter", async function () {
            const replyBody = {
                page: 1,
                perPage: 50,
                totalItems: 5,
                totalPages: 1,
                items: [],
            };

            fetchMock.on({
                method: "GET",
                url: "test_base_url/api/traces?limit=50&offset=0&trace_id=abc123",
                replyCode: 200,
                replyBody: replyBody,
            });

            const list = await service.getList(1, 50, { trace_id: "abc123" });

            assert.deepEqual(list, replyBody);
        });

        test("Should correctly apply status filter", async function () {
            const replyBody = {
                page: 1,
                perPage: 20,
                totalItems: 10,
                totalPages: 1,
                items: [],
            };

            fetchMock.on({
                method: "GET",
                url: "test_base_url/api/traces?limit=20&offset=0&status=ERROR",
                replyCode: 200,
                replyBody: replyBody,
            });

            const list = await service.getList(1, 20, { status: "ERROR" });

            assert.deepEqual(list, replyBody);
        });

        test("Should correctly apply root_only filter", async function () {
            const replyBody = {
                page: 1,
                perPage: 30,
                totalItems: 50,
                totalPages: 2,
                items: [],
            };

            fetchMock.on({
                method: "GET",
                url: "test_base_url/api/traces?limit=30&offset=0&root_only=true",
                replyCode: 200,
                replyBody: replyBody,
            });

            const list = await service.getList(1, 30, { root_only: true });

            assert.deepEqual(list, replyBody);
        });

        test("Should correctly apply time range filters", async function () {
            const replyBody = {
                page: 1,
                perPage: 30,
                totalItems: 25,
                totalPages: 1,
                items: [],
            };

            fetchMock.on({
                method: "GET",
                url: "test_base_url/api/traces?limit=30&offset=0&start_time=1700000000000000&end_time=1700100000000000",
                replyCode: 200,
                replyBody: replyBody,
            });

            const list = await service.getList(1, 30, {
                start_time: 1700000000000000,
                end_time: 1700100000000000,
            });

            assert.deepEqual(list, replyBody);
        });

        test("Should correctly apply attribute filters", async function () {
            const replyBody = {
                page: 1,
                perPage: 30,
                totalItems: 15,
                totalPages: 1,
                items: [],
            };

            fetchMock.on({
                method: "GET",
                url: "test_base_url/api/traces?limit=30&offset=0&attr.http.method=GET",
                replyCode: 200,
                replyBody: replyBody,
            });

            const list = await service.getList(1, 30, {
                attributes: { "http.method": "GET" },
            });

            assert.deepEqual(list, replyBody);
        });

        test("Should correctly handle pagination", async function () {
            const replyBody = {
                page: 3,
                perPage: 10,
                totalItems: 50,
                totalPages: 5,
                items: [],
            };

            fetchMock.on({
                method: "GET",
                url: "test_base_url/api/traces?limit=10&offset=20",
                replyCode: 200,
                replyBody: replyBody,
            });

            const list = await service.getList(3, 10);

            assert.deepEqual(list, replyBody);
        });
    });

    describe("getTrace()", function () {
        test("Should return complete trace with all spans", async function () {
            const replyBody = {
                trace_id: "abc123def456",
                spans: [
                    {
                        trace_id: "abc123def456",
                        span_id: "span001",
                        parent_id: "",
                        name: "HTTP GET /api/test",
                        kind: "SERVER",
                        start_time: 1700000000000000,
                        duration: 12000,
                        status: "OK",
                        attributes: {},
                        created: "2023-11-15 10:00:00.000Z",
                    },
                    {
                        trace_id: "abc123def456",
                        span_id: "span002",
                        parent_id: "span001",
                        name: "Database query",
                        kind: "CLIENT",
                        start_time: 1700000000001000,
                        duration: 5000,
                        status: "OK",
                        attributes: {},
                        created: "2023-11-15 10:00:00.000Z",
                    },
                ],
            };

            fetchMock.on({
                method: "GET",
                url: "test_base_url/api/traces/abc123def456",
                replyCode: 200,
                replyBody: replyBody,
            });

            const result = await service.getTrace("abc123def456");

            assert.deepEqual(result, replyBody);
        });

        test("Should correctly encode trace_id with special characters", async function () {
            const replyBody = {
                trace_id: "test?123",
                spans: [],
            };

            fetchMock.on({
                method: "GET",
                url: "test_base_url/api/traces/" + encodeURIComponent("test?123"),
                replyCode: 200,
                replyBody: replyBody,
            });

            const result = await service.getTrace("test?123");

            assert.deepEqual(result, replyBody);
        });

        test("Should return a 404 error if trace_id is empty", async function () {
            expect(service.getTrace("")).rejects.toThrow("Missing required trace_id.");
            expect(service.getTrace(null as any)).rejects.toThrow(
                "Missing required trace_id.",
            );
            expect(service.getTrace(undefined as any)).rejects.toThrow(
                "Missing required trace_id.",
            );
        });
    });

    describe("getStats()", function () {
        test("Should return trace statistics", async function () {
            const replyBody = {
                total_requests: 1000,
                success_count: 950,
                error_count: 50,
                p50_latency: 12000,
                p95_latency: 45000,
                p99_latency: 120000,
            };

            fetchMock.on({
                method: "GET",
                url: "test_base_url/api/traces/stats",
                replyCode: 200,
                replyBody: replyBody,
            });

            const result = await service.getStats();

            assert.deepEqual(result, replyBody);
        });

        test("Should correctly apply time range filters", async function () {
            const replyBody = {
                total_requests: 500,
                success_count: 480,
                error_count: 20,
                p50_latency: 10000,
                p95_latency: 40000,
                p99_latency: 100000,
            };

            fetchMock.on({
                method: "GET",
                url: "test_base_url/api/traces/stats?start_time=1700000000000000&end_time=1700100000000000",
                replyCode: 200,
                replyBody: replyBody,
            });

            const result = await service.getStats({
                start_time: 1700000000000000,
                end_time: 1700100000000000,
            });

            assert.deepEqual(result, replyBody);
        });

        test("Should pass custom headers", async function () {
            const replyBody = {
                total_requests: 100,
                success_count: 100,
                error_count: 0,
                p50_latency: 5000,
                p95_latency: 20000,
                p99_latency: 50000,
            };

            fetchMock.on({
                method: "GET",
                url: "test_base_url/api/traces/stats",
                additionalMatcher: (_, config) => {
                    return config?.headers?.["x-test"] === "123";
                },
                replyCode: 200,
                replyBody: replyBody,
            });

            const result = await service.getStats({
                headers: { "x-test": "123" },
            });

            assert.deepEqual(result, replyBody);
        });
    });

    describe("Client integration", function () {
        test("Should be accessible from client.traces", function () {
            const pbClient = new Client("http://localhost:8090");
            assert.instanceOf(pbClient.traces, TraceService);
        });
    });
});
