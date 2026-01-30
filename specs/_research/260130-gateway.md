这是为您准备的 **SpecKit** 规范文档。基于您的架构哲学（"Complexity to System, Simplicity to User"）和当前的技术痛点（HTTP 协议不一致性），该文档旨在定义一个高可用、零维护的统一 AI 网关模块。

---

# [SPEC] PocketBase Unified AI Gateway (Transparent Proxy)

## 1. Essence (核心实质)

**"The Protocol Normalizer"**
一个内嵌于 PocketBase 的高性能反向代理模块。它通过**协议归一化**（强制剥离压缩、重写 Host 头、流式刷新），将本地 Sidecar (Python/Agno) 和远程 LLM (OpenAI/Claude) 的异构接口统一为标准的 PocketBase API，实现 "Single Artifact" 部署且无需 Nginx。

---

## 2. ROI (价值分析)

* **Reliability (Anti-Stupidity):** 通过在网关层强制剥离 `Accept-Encoding`，彻底根除 Go `httputil` 中经典的 "Body Size Mismatch" 和 "Unexpected EOF" 错误，确保 100% 的请求成功率。
* **Simplicity (DevExp):** 前端只需对接唯一的 `/api/ai/*` 接口。无需处理 CORS、API Key 泄露或复杂的流式连接建立，所有脏活（Auth注入、协议适配）由 PB 内部消化。
* **Efficiency:** 复用 Go 的 `Keep-Alive` 连接池，相比每次新建 `http.Client` 请求，显著降低延迟并提升吞吐量。

---

## 3. Spec (技术规格)

### 3.1 Architecture Diagram

```mermaid
graph LR
    Client[Frontend / IDE] -- SSE/HTTP --> PB[PocketBase Gateway]
    
    subgraph "Internal Logic (The Normalizer)"
        PB -- Auth Check --> Auth[PB Auth Guard]
        Auth -- Pass --> Proxy[ReverseProxy]
        Proxy -- "Strip Gzip & Rewrite Host" --> Normalize[Protocol Normalizer]
    end

    Normalize -- "Plain HTTP (Sidecar)" --> Local[Python Agent (Agno)]
    Normalize -- "HTTPS + Token (Remote)" --> OpenAI[OpenAI / Claude API]
    
    Local -- "Stream" --> PB
    OpenAI -- "Stream" --> PB

```

### 3.2 Functional Requirements

1. **Unified Routing (统一路由):**
* Pattern: `/api/ai/{target}/*`
* Example:
* `/api/ai/local/agent/run` -> `http://127.0.0.1:8001/agent/run`
* `/api/ai/openai/v1/chat/completions` -> `https://api.openai.com/v1/chat/completions`




2. **Protocol Normalization (协议归一化):**
* **Force Identity:** 必须强制删除请求头中的 `Accept-Encoding`，迫使上游返回 Plain Text（非 Gzip）。这是解决 Size Mismatch 的唯一解。
* **Host Rewrite:** 必须将 `Host` 头重写为上游服务的 Host（解决 Cloudflare/AWS 403 问题）。


3. **Streaming Support (流式支持):**
* 必须配置 `FlushInterval` (建议 100ms) 以支持 SSE (Server-Sent Events) 的实时吐字。


4. **Security (安全):**
* **Inbound:** 复用 PocketBase 的鉴权 (`auth-collection` token)。
* **Outbound:** 代理层自动注入外部 API Key (如 OpenAI Key)，前端对 Key 无感知。



### 3.3 Implementation Reference (Go)

该模块应作为 `core.ServeEvent` 的 Hook 注入。

```go
type ProxyConfig struct {
    Target    string // Upstream URL
    ApiKey    string // Optional Bearer Token
    StripGzip bool   // Default: true (Critical for stability)
}

func NewAIGateway(config ProxyConfig) *httputil.ReverseProxy {
    targetURL, _ := url.Parse(config.Target)
    
    proxy := &httputil.ReverseProxy{
        Director: func(req *http.Request) {
            // 1. Core Protocol Alignment
            req.URL.Scheme = targetURL.Scheme
            req.URL.Host = targetURL.Host
            req.Host = targetURL.Host // Critical for Cloudflare/AWS
            
            // 2. The "Anti-Stupidity" Fix: Strip Compression
            if config.StripGzip {
                req.Header.Del("Accept-Encoding") 
            }
            
            // 3. Auth Injection
            if config.ApiKey != "" {
                req.Header.Set("Authorization", "Bearer " + config.ApiKey)
            }
            
            // 4. Clean Hop-by-hop headers
            req.Header.Del("Connection")
        },
        // Optimize for SSE
        FlushInterval: 100 * time.Millisecond,
        // Shared Transport for Connection Pooling
        Transport: &http.Transport{
            MaxIdleConns: 100,
            IdleConnTimeout: 90 * time.Second,
            ForceAttemptHTTP2: true, // Specific optimization for OpenAI
        },
        ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
            // Structured Error Response
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(http.StatusBadGateway)
            w.Write([]byte(`{"error": "AI Gateway Error", "details": "` + err.Error() + `"}`))
        },
    }
    return proxy
}

```

### 3.4 Limitations & Constraints

1. **No Deep Inspection:** 由于使用了 `ReverseProxy`，PB 无法轻易记录 Response Body (Chat Content) 到数据库。
* *Solution:* 聊天记录归档应由前端（UI渲染后异步回传）或 Python Sidecar（自己写库）负责。


2. **Bandwidth:** 禁用 Gzip 会导致带宽消耗增加（约 3-5 倍）。
* *Verdict:* 对于文本流（Token），这点带宽即使在公网也是微不足道的，相比于稳定性的提升，ROI 极高。

