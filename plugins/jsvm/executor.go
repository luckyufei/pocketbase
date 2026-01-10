package jsvm

import (
	"context"
	"time"

	"github.com/dop251/goja"
)

// ExecuteOptions 执行选项
type ExecuteOptions struct {
	// Timeout 自定义超时时间，覆盖默认值
	Timeout time.Duration
}

// SafeExecutor 安全执行器，支持超时中断
type SafeExecutor struct {
	pool           *vmsPool
	defaultTimeout time.Duration
}

// NewSafeExecutor 创建新的安全执行器
func NewSafeExecutor(pool *vmsPool, defaultTimeout time.Duration) *SafeExecutor {
	if defaultTimeout <= 0 {
		defaultTimeout = 5 * time.Second
	}
	return &SafeExecutor{
		pool:           pool,
		defaultTimeout: defaultTimeout,
	}
}

// Execute 执行脚本字符串，支持超时中断
func (e *SafeExecutor) Execute(ctx context.Context, script string, opts *ExecuteOptions) (goja.Value, error) {
	timeout := e.defaultTimeout
	if opts != nil && opts.Timeout > 0 {
		timeout = opts.Timeout
	}

	var result goja.Value
	var execErr error

	err := e.pool.run(func(vm *goja.Runtime) error {
		// 清除之前可能残留的中断状态
		vm.ClearInterrupt()

		// 创建带超时的 context
		execCtx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()

		// 启动中断监控 goroutine
		done := make(chan struct{})
		go func() {
			select {
			case <-execCtx.Done():
				vm.Interrupt("execution timeout or cancelled")
			case <-done:
				// 正常完成，不需要中断
			}
		}()

		// 执行脚本
		result, execErr = vm.RunString(script)

		// 通知监控 goroutine 停止
		close(done)

		// 清除中断状态，以便 VM 可以复用
		vm.ClearInterrupt()

		return execErr
	})

	if err != nil {
		return nil, err
	}

	return result, execErr
}

// ExecuteProgram 执行预编译程序，支持超时中断
func (e *SafeExecutor) ExecuteProgram(ctx context.Context, program *goja.Program, opts *ExecuteOptions) (goja.Value, error) {
	timeout := e.defaultTimeout
	if opts != nil && opts.Timeout > 0 {
		timeout = opts.Timeout
	}

	var result goja.Value
	var execErr error

	err := e.pool.run(func(vm *goja.Runtime) error {
		// 清除之前可能残留的中断状态
		vm.ClearInterrupt()

		// 创建带超时的 context
		execCtx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()

		// 启动中断监控 goroutine
		done := make(chan struct{})
		go func() {
			select {
			case <-execCtx.Done():
				vm.Interrupt("execution timeout or cancelled")
			case <-done:
				// 正常完成，不需要中断
			}
		}()

		// 执行预编译程序
		result, execErr = vm.RunProgram(program)

		// 通知监控 goroutine 停止
		close(done)

		// 清除中断状态，以便 VM 可以复用
		vm.ClearInterrupt()

		return execErr
	})

	if err != nil {
		return nil, err
	}

	return result, execErr
}
