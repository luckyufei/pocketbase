package core

import (
	"testing"
)

func TestNormalizeURL(t *testing.T) {
	tests := []struct {
		name string
		url  string
		want string
	}{
		{"empty", "", "/"},
		{"root", "/", "/"},
		{"simple path", "/home", "/home"},
		{"path with query", "/home?ref=twitter", "/home"},
		{"path with hash", "/pricing#features", "/pricing"},
		{"path with query and hash", "/search?q=test#results", "/search"},
		{"path with trailing slash", "/about/", "/about"},
		{"full url", "https://example.com/pricing?plan=pro", "/pricing"},
		{"full url with port", "https://example.com:8080/api/v1", "/api/v1"},
		{"relative path", "home", "/home"},
		{"complex query", "/search?q=test&page=2&sort=asc", "/search"},
		{"encoded path", "/path%20with%20spaces", "/path with spaces"}, // URL 解码是预期行为
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeURL(tt.url)
			if got != tt.want {
				t.Errorf("NormalizeURL(%q) = %q, want %q", tt.url, got, tt.want)
			}
		})
	}
}

func TestExtractQuery(t *testing.T) {
	tests := []struct {
		url  string
		want string
	}{
		{"/home", ""},
		{"/search?q=test", "q=test"},
		{"/search?q=test&page=2", "q=test&page=2"},
		{"/home#section", ""},
		{"", ""},
	}

	for _, tt := range tests {
		t.Run(tt.url, func(t *testing.T) {
			got := ExtractQuery(tt.url)
			if got != tt.want {
				t.Errorf("ExtractQuery(%q) = %q, want %q", tt.url, got, tt.want)
			}
		})
	}
}

func TestExtractReferrerDomain(t *testing.T) {
	tests := []struct {
		referrer string
		want     string
	}{
		{"", "direct"},
		{"https://google.com/search?q=test", "google.com"},
		{"https://www.example.com/page", "www.example.com"},
		{"http://api.example.com:8080/v1", "api.example.com"},
		{"invalid-url", "direct"},
	}

	for _, tt := range tests {
		t.Run(tt.referrer, func(t *testing.T) {
			got := ExtractReferrerDomain(tt.referrer)
			if got != tt.want {
				t.Errorf("ExtractReferrerDomain(%q) = %q, want %q", tt.referrer, got, tt.want)
			}
		})
	}
}

func TestClassifyReferrer(t *testing.T) {
	tests := []struct {
		referrer string
		want     string
	}{
		{"", "direct"},
		{"https://google.com/search", "search"},
		{"https://www.bing.com/search", "search"},
		{"https://baidu.com/s", "search"},
		{"https://facebook.com/post/123", "social"},
		{"https://twitter.com/user/status", "social"},
		{"https://www.linkedin.com/in/user", "social"},
		{"https://example.com/page", "referral"},
		{"https://blog.example.com/article", "referral"},
	}

	for _, tt := range tests {
		t.Run(tt.referrer, func(t *testing.T) {
			got := ClassifyReferrer(tt.referrer)
			if got != tt.want {
				t.Errorf("ClassifyReferrer(%q) = %q, want %q", tt.referrer, got, tt.want)
			}
		})
	}
}

func BenchmarkNormalizeURL(b *testing.B) {
	urls := []string{
		"/home",
		"/pricing?plan=pro&ref=twitter",
		"https://example.com/search?q=test#results",
		"/api/v1/users/123",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, url := range urls {
			NormalizeURL(url)
		}
	}
}
