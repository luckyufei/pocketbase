// PocketBase Serverless 全局类型定义
// 自动生成 - 请勿手动修改

/// <reference path="./pocketbase.d.ts" />

// Web API Polyfills
declare class Request {
    constructor(input: RequestInfo, init?: RequestInit);
    readonly method: string;
    readonly url: string;
    readonly headers: Headers;
    readonly body: ReadableStream<Uint8Array> | null;
    json(): Promise<any>;
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    clone(): Request;
}

declare class Response {
    constructor(body?: BodyInit | null, init?: ResponseInit);
    readonly status: number;
    readonly statusText: string;
    readonly headers: Headers;
    readonly body: ReadableStream<Uint8Array> | null;
    readonly ok: boolean;
    json(): Promise<any>;
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    clone(): Response;
    
    static json(data: any, init?: ResponseInit): Response;
    static redirect(url: string, status?: number): Response;
}

declare class Headers {
    constructor(init?: HeadersInit);
    append(name: string, value: string): void;
    delete(name: string): void;
    get(name: string): string | null;
    has(name: string): boolean;
    set(name: string, value: string): void;
    forEach(callback: (value: string, name: string) => void): void;
}

declare class URL {
    constructor(url: string, base?: string);
    readonly href: string;
    readonly origin: string;
    readonly protocol: string;
    readonly host: string;
    readonly hostname: string;
    readonly port: string;
    readonly pathname: string;
    readonly search: string;
    readonly searchParams: URLSearchParams;
    readonly hash: string;
    toString(): string;
}

declare class URLSearchParams {
    constructor(init?: string | Record<string, string> | [string, string][]);
    append(name: string, value: string): void;
    delete(name: string): void;
    get(name: string): string | null;
    getAll(name: string): string[];
    has(name: string): boolean;
    set(name: string, value: string): void;
    toString(): string;
    forEach(callback: (value: string, name: string) => void): void;
}

declare class TextEncoder {
    encode(input?: string): Uint8Array;
}

declare class TextDecoder {
    constructor(label?: string, options?: TextDecoderOptions);
    decode(input?: ArrayBuffer | ArrayBufferView): string;
}

interface TextDecoderOptions {
    fatal?: boolean;
    ignoreBOM?: boolean;
}

// Fetch API
declare function fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;

type RequestInfo = Request | string;

interface RequestInit {
    method?: string;
    headers?: HeadersInit;
    body?: BodyInit;
    signal?: AbortSignal;
}

interface ResponseInit {
    status?: number;
    statusText?: string;
    headers?: HeadersInit;
}

type HeadersInit = Headers | Record<string, string> | [string, string][];
type BodyInit = string | ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>;

// Console
declare const console: {
    log(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    info(...args: any[]): void;
    debug(...args: any[]): void;
};

// Timers
declare function setTimeout(callback: () => void, ms?: number): number;
declare function clearTimeout(id: number): void;
declare function setInterval(callback: () => void, ms?: number): number;
declare function clearInterval(id: number): void;

// Crypto
declare const crypto: {
    randomUUID(): string;
    getRandomValues<T extends ArrayBufferView>(array: T): T;
};

// ReadableStream (基础支持)
declare class ReadableStream<R = any> {
    constructor(underlyingSource?: UnderlyingSource<R>);
    readonly locked: boolean;
    cancel(reason?: any): Promise<void>;
    getReader(): ReadableStreamDefaultReader<R>;
    pipeThrough<T>(transform: TransformStream<R, T>): ReadableStream<T>;
    pipeTo(destination: WritableStream<R>): Promise<void>;
}

interface UnderlyingSource<R = any> {
    start?(controller: ReadableStreamDefaultController<R>): void | Promise<void>;
    pull?(controller: ReadableStreamDefaultController<R>): void | Promise<void>;
    cancel?(reason?: any): void | Promise<void>;
}

interface ReadableStreamDefaultController<R = any> {
    readonly desiredSize: number | null;
    close(): void;
    enqueue(chunk: R): void;
    error(e?: any): void;
}

interface ReadableStreamDefaultReader<R = any> {
    readonly closed: Promise<void>;
    cancel(reason?: any): Promise<void>;
    read(): Promise<ReadableStreamReadResult<R>>;
    releaseLock(): void;
}

interface ReadableStreamReadResult<T> {
    done: boolean;
    value?: T;
}

declare class WritableStream<W = any> {
    constructor();
    readonly locked: boolean;
    abort(reason?: any): Promise<void>;
    close(): Promise<void>;
    getWriter(): WritableStreamDefaultWriter<W>;
}

interface WritableStreamDefaultWriter<W = any> {
    readonly closed: Promise<void>;
    readonly desiredSize: number | null;
    readonly ready: Promise<void>;
    abort(reason?: any): Promise<void>;
    close(): Promise<void>;
    releaseLock(): void;
    write(chunk: W): Promise<void>;
}

declare class TransformStream<I = any, O = any> {
    constructor();
    readonly readable: ReadableStream<O>;
    readonly writable: WritableStream<I>;
}

// AbortController
declare class AbortController {
    readonly signal: AbortSignal;
    abort(reason?: any): void;
}

declare class AbortSignal {
    readonly aborted: boolean;
    readonly reason: any;
    addEventListener(type: 'abort', listener: () => void): void;
    removeEventListener(type: 'abort', listener: () => void): void;
}

export {};
