//go:build windows

package processman

import (
	"os"
	"os/exec"
)

// setSysProcAttr sets Windows-specific process attributes
// Windows doesn't support Setpgid, so this is a no-op
func setSysProcAttr(cmd *exec.Cmd) {
	// Windows doesn't support process groups in the same way as Unix
	// No special attributes needed
}

// killProcessGroup kills a process on Windows
// Windows doesn't support process groups, so we just kill the main process
func killProcessGroup(pid int) error {
	process, err := os.FindProcess(pid)
	if err != nil {
		return err
	}
	return process.Kill()
}
