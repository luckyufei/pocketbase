import { describe, assert, test, beforeAll, afterAll, afterEach } from "vitest";
import { FetchMock } from "../mocks";
import Client from "@/Client";
import { SecretsService, Secret, SecretInfo } from "@/services/SecretsService";

describe("SecretsService", function () {
    const client = new Client("http://127.0.0.1:8090");
    const service = client.secrets;

    // 验证 SecretsService 已注册到 Client
    test("should be registered on client", function () {
        assert.instanceOf(service, SecretsService);
    });

    // 测试 create 方法
    describe("create()", function () {
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

        test("should create a secret", async function () {
            const mockResponse: Secret = {
                key: "API_KEY",
                value: "sk-abc123",
                env: "global",
                description: "Test API Key",
                created: "2025-01-08T10:00:00Z",
                updated: "2025-01-08T10:00:00Z",
            };

            fetchMock.on({
                method: "POST",
                url: "http://127.0.0.1:8090/api/secrets",
                body: { key: "API_KEY", value: "sk-abc123", description: "Test API Key" },
                replyCode: 200,
                replyBody: mockResponse,
            });

            const result = await service.create({
                key: "API_KEY",
                value: "sk-abc123",
                description: "Test API Key",
            });

            assert.deepEqual(result, mockResponse);
        });

        test("should create a secret with env", async function () {
            const mockResponse: Secret = {
                key: "DB_PASSWORD",
                value: "secret123",
                env: "production",
                created: "2025-01-08T10:00:00Z",
                updated: "2025-01-08T10:00:00Z",
            };

            fetchMock.on({
                method: "POST",
                url: "http://127.0.0.1:8090/api/secrets",
                body: { key: "DB_PASSWORD", value: "secret123", env: "production" },
                replyCode: 200,
                replyBody: mockResponse,
            });

            const result = await service.create({
                key: "DB_PASSWORD",
                value: "secret123",
                env: "production",
            });

            assert.deepEqual(result, mockResponse);
        });
    });

    // 测试 get 方法
    describe("get()", function () {
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

        test("should get a secret by key", async function () {
            const mockResponse: Secret = {
                key: "API_KEY",
                value: "sk-abc123",
                env: "global",
                created: "2025-01-08T10:00:00Z",
                updated: "2025-01-08T10:00:00Z",
            };

            fetchMock.on({
                method: "GET",
                url: "http://127.0.0.1:8090/api/secrets/API_KEY",
                replyCode: 200,
                replyBody: mockResponse,
            });

            const result = await service.get("API_KEY");

            assert.deepEqual(result, mockResponse);
        });

        test("should throw 404 for non-existent key", async function () {
            fetchMock.on({
                method: "GET",
                url: "http://127.0.0.1:8090/api/secrets/NONEXISTENT",
                replyCode: 404,
                replyBody: { message: "Secret not found" },
            });

            try {
                await service.get("NONEXISTENT");
                assert.fail("Should have thrown an error");
            } catch (err: any) {
                assert.equal(err.status, 404);
            }
        });
    });

    // 测试 getWithDefault 方法
    describe("getWithDefault()", function () {
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

        test("should return value when key exists", async function () {
            const mockResponse: Secret = {
                key: "API_KEY",
                value: "sk-abc123",
                env: "global",
                created: "2025-01-08T10:00:00Z",
                updated: "2025-01-08T10:00:00Z",
            };

            fetchMock.on({
                method: "GET",
                url: "http://127.0.0.1:8090/api/secrets/API_KEY",
                replyCode: 200,
                replyBody: mockResponse,
            });

            const result = await service.getWithDefault("API_KEY", "default-value");

            assert.equal(result, "sk-abc123");
        });

        test("should return default value when key not found", async function () {
            fetchMock.on({
                method: "GET",
                url: "http://127.0.0.1:8090/api/secrets/NONEXISTENT",
                replyCode: 404,
                replyBody: { message: "Secret not found" },
            });

            const result = await service.getWithDefault("NONEXISTENT", "default-value");

            assert.equal(result, "default-value");
        });
    });

    // 测试 list 方法
    describe("list()", function () {
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

        test("should list all secrets (masked)", async function () {
            const mockResponse: SecretInfo[] = [
                {
                    key: "API_KEY",
                    masked_value: "sk-abc***",
                    env: "global",
                    description: "API Key",
                    created: "2025-01-08T10:00:00Z",
                    updated: "2025-01-08T10:00:00Z",
                },
                {
                    key: "DB_PASSWORD",
                    masked_value: "secret***",
                    env: "production",
                    created: "2025-01-08T10:00:00Z",
                    updated: "2025-01-08T10:00:00Z",
                },
            ];

            fetchMock.on({
                method: "GET",
                url: "http://127.0.0.1:8090/api/secrets",
                replyCode: 200,
                replyBody: mockResponse,
            });

            const result = await service.list();

            assert.deepEqual(result, mockResponse);
        });
    });

    // 测试 update 方法
    describe("update()", function () {
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

        test("should update a secret", async function () {
            const mockResponse: Secret = {
                key: "API_KEY",
                value: "new-value",
                env: "global",
                created: "2025-01-08T10:00:00Z",
                updated: "2025-01-08T11:00:00Z",
            };

            fetchMock.on({
                method: "PUT",
                url: "http://127.0.0.1:8090/api/secrets/API_KEY",
                body: { value: "new-value" },
                replyCode: 200,
                replyBody: mockResponse,
            });

            const result = await service.update("API_KEY", { value: "new-value" });

            assert.deepEqual(result, mockResponse);
        });

        test("should update with description", async function () {
            const mockResponse: Secret = {
                key: "API_KEY",
                value: "new-value",
                env: "global",
                description: "Updated description",
                created: "2025-01-08T10:00:00Z",
                updated: "2025-01-08T11:00:00Z",
            };

            fetchMock.on({
                method: "PUT",
                url: "http://127.0.0.1:8090/api/secrets/API_KEY",
                body: { value: "new-value", description: "Updated description" },
                replyCode: 200,
                replyBody: mockResponse,
            });

            const result = await service.update("API_KEY", {
                value: "new-value",
                description: "Updated description",
            });

            assert.deepEqual(result, mockResponse);
        });
    });

    // 测试 delete 方法
    describe("delete()", function () {
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

        test("should delete a secret", async function () {
            fetchMock.on({
                method: "DELETE",
                url: "http://127.0.0.1:8090/api/secrets/API_KEY",
                replyCode: 204,
                replyBody: null,
            });

            const result = await service.delete("API_KEY");

            assert.equal(result, true);
        });
    });

    // 测试 exists 方法
    describe("exists()", function () {
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

        test("should return true when key exists", async function () {
            fetchMock.on({
                method: "GET",
                url: "http://127.0.0.1:8090/api/secrets/API_KEY",
                replyCode: 200,
                replyBody: { key: "API_KEY", value: "test" },
            });

            const result = await service.exists("API_KEY");

            assert.equal(result, true);
        });

        test("should return false when key not found", async function () {
            fetchMock.on({
                method: "GET",
                url: "http://127.0.0.1:8090/api/secrets/NONEXISTENT",
                replyCode: 404,
                replyBody: { message: "Secret not found" },
            });

            const result = await service.exists("NONEXISTENT");

            assert.equal(result, false);
        });
    });
});
