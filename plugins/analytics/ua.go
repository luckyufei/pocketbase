package analytics

import (
	"strings"
)

// UAInfo 表示解析后的 User-Agent 信息。
type UAInfo struct {
	Browser string // 浏览器名称
	OS      string // 操作系统
	Device  string // 设备类型: desktop, mobile, tablet
}

// ParseUserAgent 解析 User-Agent 字符串。
// 这是一个轻量级实现，不依赖外部库。
// 对于更精确的解析，可以考虑使用 github.com/mssola/user_agent。
func ParseUserAgent(ua string) UAInfo {
	if ua == "" {
		return UAInfo{
			Browser: "Unknown",
			OS:      "Unknown",
			Device:  "unknown",
		}
	}

	ua = strings.ToLower(ua)

	return UAInfo{
		Browser: detectBrowser(ua),
		OS:      detectOS(ua),
		Device:  detectDevice(ua),
	}
}

// detectBrowser 检测浏览器类型。
func detectBrowser(ua string) string {
	// 顺序很重要：先检测更具体的浏览器
	switch {
	case strings.Contains(ua, "micromessenger"):
		return "WeChat"
	case strings.Contains(ua, "edg/") || strings.Contains(ua, "edge/"):
		return "Edge"
	case strings.Contains(ua, "opr/") || strings.Contains(ua, "opera"):
		return "Opera"
	case strings.Contains(ua, "ucbrowser"):
		return "UCBrowser"
	case strings.Contains(ua, "qqbrowser"):
		return "QQBrowser"
	case strings.Contains(ua, "baidubrowser"):
		return "Baidu"
	case strings.Contains(ua, "chrome") && !strings.Contains(ua, "chromium"):
		return "Chrome"
	case strings.Contains(ua, "chromium"):
		return "Chromium"
	case strings.Contains(ua, "firefox"):
		return "Firefox"
	case strings.Contains(ua, "safari") && !strings.Contains(ua, "chrome"):
		return "Safari"
	case strings.Contains(ua, "msie") || strings.Contains(ua, "trident"):
		return "IE"
	default:
		return "Other"
	}
}

// detectOS 检测操作系统。
func detectOS(ua string) string {
	switch {
	case strings.Contains(ua, "iphone"):
		return "iOS"
	case strings.Contains(ua, "ipad"):
		return "iPadOS"
	case strings.Contains(ua, "android"):
		return "Android"
	case strings.Contains(ua, "windows nt 10"):
		return "Windows 10"
	case strings.Contains(ua, "windows nt 6.3"):
		return "Windows 8.1"
	case strings.Contains(ua, "windows nt 6.2"):
		return "Windows 8"
	case strings.Contains(ua, "windows nt 6.1"):
		return "Windows 7"
	case strings.Contains(ua, "windows"):
		return "Windows"
	case strings.Contains(ua, "mac os x"):
		return "MacOS"
	case strings.Contains(ua, "linux"):
		return "Linux"
	case strings.Contains(ua, "cros"):
		return "ChromeOS"
	default:
		return "Other"
	}
}

// detectDevice 检测设备类型。
func detectDevice(ua string) string {
	switch {
	case strings.Contains(ua, "ipad"):
		return "tablet"
	case strings.Contains(ua, "tablet"):
		return "tablet"
	case strings.Contains(ua, "mobile"):
		return "mobile"
	case strings.Contains(ua, "iphone"):
		return "mobile"
	case strings.Contains(ua, "android") && !strings.Contains(ua, "mobile"):
		// Android 平板通常不包含 "mobile"
		return "tablet"
	default:
		return "desktop"
	}
}

// IsBotUserAgent 检测是否为爬虫/机器人。
// 爬虫流量通常不应计入分析数据。
func IsBotUserAgent(ua string) bool {
	if ua == "" {
		return false
	}

	ua = strings.ToLower(ua)

	bots := []string{
		"bot", "crawler", "spider", "slurp", "googlebot",
		"bingbot", "yandex", "baidu", "duckduck", "facebookexternalhit",
		"twitterbot", "linkedinbot", "pinterest", "whatsapp",
		"telegrambot", "applebot", "semrush", "ahrefs", "mj12bot",
		"dotbot", "petalbot", "bytespider", "gptbot", "claudebot",
	}

	for _, bot := range bots {
		if strings.Contains(ua, bot) {
			return true
		}
	}

	return false
}
