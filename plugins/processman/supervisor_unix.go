//go:build !windows

package processman

import (
	"os/exec"
	"syscall"
)

// setSysProcAttr sets Unix-specific process attributes
// Sets Setpgid to ensure the entire process tree can be killed
func setSysProcAttr(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

// killProcessGroup kills a process group using Unix signals
// Uses negative PID to send signal to the entire process group
func killProcessGroup(pid int) error {
	// First try SIGTERM (graceful termination)
	if err := syscall.Kill(-pid, syscall.SIGTERM); err != nil {
		// Fall back to SIGKILL
		return syscall.Kill(-pid, syscall.SIGKILL)
	}
	return nil
}
