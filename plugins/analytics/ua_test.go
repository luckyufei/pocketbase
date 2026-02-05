package analytics

import (
	"testing"
)

func TestParseUserAgent(t *testing.T) {
	tests := []struct {
		name    string
		ua      string
		browser string
		os      string
		device  string
	}{
		{
			name:    "empty",
			ua:      "",
			browser: "Unknown",
			os:      "Unknown",
			device:  "unknown",
		},
		{
			name:    "Chrome on MacOS",
			ua:      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			browser: "Chrome",
			os:      "MacOS",
			device:  "desktop",
		},
		{
			name:    "Safari on iPhone",
			ua:      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
			browser: "Safari",
			os:      "iOS",
			device:  "mobile",
		},
		{
			name:    "Chrome on Android",
			ua:      "Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
			browser: "Chrome",
			os:      "Android",
			device:  "mobile",
		},
		{
			name:    "Firefox on Windows",
			ua:      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
			browser: "Firefox",
			os:      "Windows 10",
			device:  "desktop",
		},
		{
			name:    "Edge on Windows",
			ua:      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
			browser: "Edge",
			os:      "Windows 10",
			device:  "desktop",
		},
		{
			name:    "Safari on iPad",
			ua:      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
			browser: "Safari",
			os:      "iPadOS",
			device:  "tablet",
		},
		{
			name:    "WeChat on Android",
			ua:      "Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) MicroMessenger/8.0.0 Mobile Safari/537.36",
			browser: "WeChat",
			os:      "Android",
			device:  "mobile",
		},
		{
			name:    "Chrome on Linux",
			ua:      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			browser: "Chrome",
			os:      "Linux",
			device:  "desktop",
		},
		// 新增测试用例，覆盖更多分支
		{
			name:    "Opera",
			ua:      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/107.0.0.0",
			browser: "Opera",
			os:      "Windows 10",
			device:  "desktop",
		},
		{
			name:    "UCBrowser",
			ua:      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) UCBrowser/15.0.0.0 Mobile Safari/537.36",
			browser: "UCBrowser",
			os:      "Android",
			device:  "mobile",
		},
		{
			name:    "QQBrowser",
			ua:      "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) QQBrowser/10.0.0.0 Safari/537.36",
			browser: "QQBrowser",
			os:      "Windows 10",
			device:  "desktop",
		},
		{
			name:    "BaiduBrowser",
			ua:      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) BaiduBrowser/10.0 Mobile Safari/537.36",
			browser: "Baidu",
			os:      "Android",
			device:  "mobile",
		},
		{
			name:    "Chromium",
			ua:      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/120.0.0.0 Safari/537.36",
			browser: "Chromium",
			os:      "Linux",
			device:  "desktop",
		},
		{
			name:    "IE11",
			ua:      "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko",
			browser: "IE",
			os:      "Windows 10",
			device:  "desktop",
		},
		{
			name:    "MSIE",
			ua:      "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1)",
			browser: "IE",
			os:      "Windows 7",
			device:  "desktop",
		},
		{
			name:    "Windows 8.1",
			ua:      "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
			browser: "Chrome",
			os:      "Windows 8.1",
			device:  "desktop",
		},
		{
			name:    "Windows 8",
			ua:      "Mozilla/5.0 (Windows NT 6.2; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
			browser: "Chrome",
			os:      "Windows 8",
			device:  "desktop",
		},
		{
			name:    "Windows generic",
			ua:      "Mozilla/5.0 (Windows) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
			browser: "Chrome",
			os:      "Windows",
			device:  "desktop",
		},
		{
			name:    "ChromeOS",
			ua:      "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			browser: "Chrome",
			os:      "ChromeOS",
			device:  "desktop",
		},
		{
			name:    "Android Tablet",
			ua:      "Mozilla/5.0 (Linux; Android 14; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			browser: "Chrome",
			os:      "Android",
			device:  "tablet",
		},
		{
			name:    "Generic Tablet",
			ua:      "Mozilla/5.0 (Linux; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			browser: "Chrome",
			os:      "Linux",
			device:  "tablet",
		},
		{
			name:    "Unknown browser",
			ua:      "SomeCustomApp/1.0",
			browser: "Other",
			os:      "Other",
			device:  "desktop",
		},
		{
			name:    "Edge with edge/ prefix",
			ua:      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Edge/18.0.0",
			browser: "Edge",
			os:      "Windows 10",
			device:  "desktop",
		},
		{
			name:    "Opera old style",
			ua:      "Opera/9.80 (Windows NT 6.1) Presto/2.12.388 Version/12.16",
			browser: "Opera",
			os:      "Windows 7",
			device:  "desktop",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := ParseUserAgent(tt.ua)

			if info.Browser != tt.browser {
				t.Errorf("Browser = %q, want %q", info.Browser, tt.browser)
			}
			if info.OS != tt.os {
				t.Errorf("OS = %q, want %q", info.OS, tt.os)
			}
			if info.Device != tt.device {
				t.Errorf("Device = %q, want %q", info.Device, tt.device)
			}
		})
	}
}

func TestIsBotUserAgent(t *testing.T) {
	tests := []struct {
		ua   string
		want bool
	}{
		{"", false},
		{"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", true},
		{"Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)", true},
		{"Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)", true},
		{"facebookexternalhit/1.1", true},
		{"Twitterbot/1.0", true},
		{"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36", false},
		{"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1", false},
		{"Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)", true},
		{"Mozilla/5.0 (compatible; ClaudeBot/1.0; +https://anthropic.com)", true},
		{"Semrush/1.0", true},
		{"AhrefsBot/7.0", true},
	}

	for _, tt := range tests {
		t.Run(tt.ua, func(t *testing.T) {
			got := IsBotUserAgent(tt.ua)
			if got != tt.want {
				t.Errorf("IsBotUserAgent(%q) = %v, want %v", tt.ua, got, tt.want)
			}
		})
	}
}

func BenchmarkParseUserAgent(b *testing.B) {
	uas := []string{
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/121.0",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, ua := range uas {
			ParseUserAgent(ua)
		}
	}
}

func BenchmarkIsBotUserAgent(b *testing.B) {
	uas := []string{
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0",
		"Googlebot/2.1",
		"facebookexternalhit/1.1",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, ua := range uas {
			IsBotUserAgent(ua)
		}
	}
}
