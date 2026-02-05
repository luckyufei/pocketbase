package secrets

import "testing"

func TestMaskSecretValue(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "short value",
			input:    "abc",
			expected: "***",
		},
		{
			name:     "exactly 6 chars",
			input:    "abcdef",
			expected: "***",
		},
		{
			name:     "longer value",
			input:    "abcdefghij",
			expected: "abcdef***",
		},
		{
			name:     "empty string",
			input:    "",
			expected: "***",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := MaskSecretValue(tt.input)
			if result != tt.expected {
				t.Errorf("MaskSecretValue(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}
