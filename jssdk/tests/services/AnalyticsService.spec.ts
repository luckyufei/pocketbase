import { describe, assert, test, beforeAll, afterAll, afterEach, beforeEach, vi, expect } from "vitest";
import { FetchMock } from "../mocks";
import Client from "@/Client";
import { AnalyticsService } from "@/services/AnalyticsService";

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();

// Mock navigator.sendBeacon
const sendBeaconMock = vi.fn(() => true);

describe("AnalyticsService", function () {
    const client = new Client("http://test.local");
    let service: AnalyticsService;
    const fetchMock = new FetchMock();

    beforeAll(function () {
        fetchMock.init();
        
        // Use vi.stubGlobal for proper mocking
        vi.stubGlobal("localStorage", localStorageMock);
        vi.stubGlobal("window", {
            location: { pathname: "/test", href: "http://test.local/test" },
            addEventListener: vi.fn(),
        });
        vi.stubGlobal("document", { referrer: "http://referrer.local", title: "Test Page" });
        vi.stubGlobal("history", {
            pushState: vi.fn(),
            replaceState: vi.fn(),
        });
        
        // Mock navigator with sendBeacon
        const originalNavigator = global.navigator || {};
        vi.stubGlobal("navigator", {
            ...originalNavigator,
            sendBeacon: sendBeaconMock,
        });
    });

    afterAll(function () {
        fetchMock.restore();
        vi.unstubAllGlobals();
    });

    beforeEach(function () {
        service = new AnalyticsService(client);
        localStorageMock.clear();
        sendBeaconMock.mockClear();
    });

    afterEach(function () {
        fetchMock.clearMocks();
    });

    describe("track()", function () {
        test("Should add event to queue", function () {
            service.track("test_event", { key: "value" });
            
            // Access private queue via any cast
            const queue = (service as any).eventQueue;
            assert.equal(queue.length, 1);
            assert.equal(queue[0].event, "test_event");
            assert.deepEqual(queue[0].props, { key: "value" });
        });

        test("Should include path, referrer, title and timestamp", function () {
            service.track("click");
            
            const queue = (service as any).eventQueue;
            assert.equal(queue[0].path, "/test");
            assert.equal(queue[0].referrer, "http://referrer.local");
            assert.equal(queue[0].title, "Test Page");
            assert.isNumber(queue[0].timestamp);
        });

        test("Should not track if opted out", function () {
            localStorageMock.setItem("pb_analytics_opt_out", "true");
            
            service.track("test_event");
            
            const queue = (service as any).eventQueue;
            assert.equal(queue.length, 0);
        });
    });

    describe("trackPageView()", function () {
        test("Should track page_view event with url", function () {
            service.trackPageView();
            
            const queue = (service as any).eventQueue;
            assert.equal(queue.length, 1);
            assert.equal(queue[0].event, "page_view");
            assert.equal(queue[0].props.url, "http://test.local/test");
        });
    });

    describe("identify()", function () {
        test("Should store user props and track identify event", function () {
            service.identify({ userId: "user123", plan: "pro" });
            
            const userProps = (service as any).userProps;
            assert.equal(userProps.userId, "user123");
            assert.equal(userProps.plan, "pro");
            
            const queue = (service as any).eventQueue;
            assert.equal(queue.length, 1);
            assert.equal(queue[0].event, "identify");
        });

        test("Should not identify if opted out", function () {
            localStorageMock.setItem("pb_analytics_opt_out", "true");
            
            service.identify({ userId: "user123" });
            
            const userProps = (service as any).userProps;
            assert.isUndefined(userProps.userId);
        });
    });

    describe("optOut()", function () {
        test("Should set opt-out flag in localStorage", function () {
            service.optOut();
            
            assert.equal(localStorageMock.getItem("pb_analytics_opt_out"), "true");
        });

        test("Should clear event queue", function () {
            service.track("event1");
            service.track("event2");
            
            service.optOut();
            
            const queue = (service as any).eventQueue;
            assert.equal(queue.length, 0);
        });
    });

    describe("optIn()", function () {
        test("Should remove opt-out flag from localStorage", function () {
            localStorageMock.setItem("pb_analytics_opt_out", "true");
            
            // Mock config endpoint for init
            fetchMock.on({
                method: "GET",
                url: client.buildURL("/api/analytics/config"),
                replyCode: 200,
                replyBody: { enabled: true },
            });
            
            service.optIn();
            
            assert.isNull(localStorageMock.getItem("pb_analytics_opt_out"));
        });
    });

    describe("isOptedOut()", function () {
        test("Should return true if opted out", function () {
            localStorageMock.setItem("pb_analytics_opt_out", "true");
            
            assert.isTrue(service.isOptedOut());
        });

        test("Should return false if not opted out", function () {
            assert.isFalse(service.isOptedOut());
        });
    });

    describe("flush()", function () {
        test("Should send events via fetch", async function () {
            fetchMock.on({
                method: "POST",
                url: client.buildURL("/api/analytics/events"),
                replyCode: 200,
                replyBody: { success: true },
            });

            service.track("event1");
            service.track("event2");
            
            await service.flush();
            
            const queue = (service as any).eventQueue;
            assert.equal(queue.length, 0);
        });

        test("Should use Beacon API when useBeacon is true", async function () {
            service.track("event1");
            
            await service.flush(true);
            
            expect(sendBeaconMock).toHaveBeenCalled();
        });

        test("Should not flush if queue is empty", async function () {
            await service.flush();
            
            // No error should be thrown
            const queue = (service as any).eventQueue;
            assert.equal(queue.length, 0);
        });

        test("Should restore events on flush failure", async function () {
            fetchMock.on({
                method: "POST",
                url: client.buildURL("/api/analytics/events"),
                replyCode: 500,
                replyBody: { error: "Server error" },
            });

            service.track("event1");
            
            try {
                await service.flush();
            } catch (e) {
                // Expected to fail
            }
            
            const queue = (service as any).eventQueue;
            assert.equal(queue.length, 1);
        });
    });

    describe("init()", function () {
        test("Should check analytics enabled on server", async function () {
            fetchMock.on({
                method: "GET",
                url: client.buildURL("/api/analytics/config"),
                replyCode: 200,
                replyBody: { enabled: true },
            });

            await service.init();
            
            assert.isTrue((service as any).isInitialized);
        });

        test("Should not initialize if server analytics is disabled", async function () {
            fetchMock.on({
                method: "GET",
                url: client.buildURL("/api/analytics/config"),
                replyCode: 200,
                replyBody: { enabled: false },
            });

            await service.init();
            
            assert.isFalse((service as any).isInitialized);
        });

        test("Should not initialize if opted out", async function () {
            localStorageMock.setItem("pb_analytics_opt_out", "true");

            await service.init();
            
            assert.isFalse((service as any).isInitialized);
        });

        test("Should not re-initialize if already initialized", async function () {
            fetchMock.on({
                method: "GET",
                url: client.buildURL("/api/analytics/config"),
                replyCode: 200,
                replyBody: { enabled: true },
            });

            await service.init();
            await service.init(); // Second call should be no-op
            
            assert.isTrue((service as any).isInitialized);
        });

        test("Should generate visitor ID on init", async function () {
            fetchMock.on({
                method: "GET",
                url: client.buildURL("/api/analytics/config"),
                replyCode: 200,
                replyBody: { enabled: true },
            });

            await service.init();
            
            const visitorId = (service as any).visitorId;
            assert.isString(visitorId);
            assert.isNotEmpty(visitorId);
        });
    });

    describe("serverEnabled", function () {
        test("Should return null before init", function () {
            assert.isNull(service.serverEnabled);
        });

        test("Should return true after successful init", async function () {
            fetchMock.on({
                method: "GET",
                url: client.buildURL("/api/analytics/config"),
                replyCode: 200,
                replyBody: { enabled: true },
            });

            await service.init();
            
            assert.isTrue(service.serverEnabled);
        });

        test("Should return false if server disabled", async function () {
            fetchMock.on({
                method: "GET",
                url: client.buildURL("/api/analytics/config"),
                replyCode: 200,
                replyBody: { enabled: false },
            });

            await service.init();
            
            assert.isFalse(service.serverEnabled);
        });
    });

    describe("config options", function () {
        test("Should respect custom flushInterval", async function () {
            fetchMock.on({
                method: "GET",
                url: client.buildURL("/api/analytics/config"),
                replyCode: 200,
                replyBody: { enabled: true },
            });

            await service.init({ flushInterval: 10000 });
            
            const config = (service as any).config;
            assert.equal(config.flushInterval, 10000);
        });

        test("Should respect custom flushThreshold", async function () {
            fetchMock.on({
                method: "GET",
                url: client.buildURL("/api/analytics/config"),
                replyCode: 200,
                replyBody: { enabled: true },
            });

            await service.init({ flushThreshold: 20 });
            
            const config = (service as any).config;
            assert.equal(config.flushThreshold, 20);
        });

        test("Should respect autoPageView=false", async function () {
            fetchMock.on({
                method: "GET",
                url: client.buildURL("/api/analytics/config"),
                replyCode: 200,
                replyBody: { enabled: true },
            });

            await service.init({ autoPageView: false });
            
            // Queue should be empty since auto page view is disabled
            const queue = (service as any).eventQueue;
            assert.equal(queue.length, 0);
        });
    });
});
