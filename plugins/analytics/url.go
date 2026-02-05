package analytics

import (
	"net/url"
	"strings"
)

// NormalizeURL 规范化 URL，去除查询参数和 Hash。
// 这是分析数据聚合的基础，确保相同页面的不同访问被正确合并。
//
// 示例:
//   - "/home?ref=twitter" → "/home"
//   - "/pricing#features" → "/pricing"
//   - "/search?q=test&page=2" → "/search"
//   - "" → "/"
func NormalizeURL(rawURL string) string {
	if rawURL == "" {
		return "/"
	}

	// 解析 URL
	parsed, err := url.Parse(rawURL)
	if err != nil {
		// 解析失败时尝试简单处理
		return normalizeURLSimple(rawURL)
	}

	path := parsed.Path
	if path == "" {
		path = "/"
	}

	// 确保路径以 / 开头
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	// 去除尾部斜杠（除了根路径）
	if len(path) > 1 && strings.HasSuffix(path, "/") {
		path = strings.TrimSuffix(path, "/")
	}

	return path
}

// normalizeURLSimple 简单的 URL 规范化，用于解析失败的情况。
func normalizeURLSimple(rawURL string) string {
	// 去除协议
	u := rawURL
	if idx := strings.Index(u, "://"); idx >= 0 {
		u = u[idx+3:]
	}

	// 去除域名（如果存在）
	if idx := strings.Index(u, "/"); idx >= 0 {
		u = u[idx:]
	} else {
		return "/"
	}

	// 去除查询参数
	if idx := strings.Index(u, "?"); idx >= 0 {
		u = u[:idx]
	}

	// 去除 Hash
	if idx := strings.Index(u, "#"); idx >= 0 {
		u = u[:idx]
	}

	if u == "" {
		return "/"
	}

	return u
}

// ExtractQuery 从 URL 中提取查询参数部分。
// 用于保留原始查询参数以便深度分析。
func ExtractQuery(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	return parsed.RawQuery
}

// ExtractReferrerDomain 从 Referrer URL 中提取域名。
// 用于流量来源分析。
//
// 示例:
//   - "https://google.com/search?q=test" → "google.com"
//   - "https://www.example.com/page" → "www.example.com"
//   - "" → "direct"
func ExtractReferrerDomain(referrer string) string {
	if referrer == "" {
		return "direct"
	}

	parsed, err := url.Parse(referrer)
	if err != nil {
		return "unknown"
	}

	host := parsed.Host
	if host == "" {
		return "direct"
	}

	// 去除端口
	if idx := strings.LastIndex(host, ":"); idx >= 0 {
		host = host[:idx]
	}

	return host
}

// ClassifyReferrer 对 Referrer 进行分类。
// 返回来源类型：search, social, referral, direct
func ClassifyReferrer(referrer string) string {
	if referrer == "" {
		return "direct"
	}

	domain := ExtractReferrerDomain(referrer)
	domain = strings.ToLower(domain)

	// 搜索引擎
	searchEngines := []string{
		"google", "bing", "yahoo", "baidu", "duckduckgo",
		"yandex", "sogou", "360", "shenma",
	}
	for _, se := range searchEngines {
		if strings.Contains(domain, se) {
			return "search"
		}
	}

	// 社交媒体
	socialNetworks := []string{
		"facebook", "twitter", "instagram", "linkedin", "pinterest",
		"reddit", "weibo", "wechat", "tiktok", "youtube",
	}
	for _, sn := range socialNetworks {
		if strings.Contains(domain, sn) {
			return "social"
		}
	}

	return "referral"
}
