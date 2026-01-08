// Package triggers 提供 Serverless 触发器实现
package triggers

import (
	"testing"
	"time"
)

// Phase 13: US9 Cron Trigger 测试

func TestCronTrigger(t *testing.T) {
	t.Run("创建 Cron 触发器", func(t *testing.T) {
		trigger := NewCronTrigger("daily_report", "0 8 * * *")

		if trigger.Name != "daily_report" {
			t.Errorf("Name = %s, want daily_report", trigger.Name)
		}

		if trigger.Schedule != "0 8 * * *" {
			t.Errorf("Schedule = %s, want 0 8 * * *", trigger.Schedule)
		}
	})

	t.Run("解析 Cron 表达式", func(t *testing.T) {
		tests := []struct {
			schedule string
			valid    bool
		}{
			{"0 * * * *", true},       // 每小时
			{"0 8 * * *", true},       // 每天 8 点
			{"0 0 * * 0", true},       // 每周日
			{"*/5 * * * *", true},     // 每 5 分钟
			{"0 0 1 * *", true},       // 每月 1 号
			{"invalid", false},        // 无效
			{"", false},               // 空
			{"0 0 0 0 0 0 0", false},  // 太多字段
		}

		for _, tt := range tests {
			trigger := NewCronTrigger("test", tt.schedule)
			err := trigger.Validate()
			if (err == nil) != tt.valid {
				t.Errorf("Validate(%s) = %v, want valid=%v", tt.schedule, err, tt.valid)
			}
		}
	})

	t.Run("超时控制", func(t *testing.T) {
		trigger := NewCronTrigger("test", "* * * * *")
		trigger.SetTimeout(15 * time.Minute)

		if trigger.Timeout != 15*time.Minute {
			t.Errorf("Timeout = %v, want 15m", trigger.Timeout)
		}
	})

	t.Run("默认超时", func(t *testing.T) {
		trigger := NewCronTrigger("test", "* * * * *")

		if trigger.Timeout != DefaultCronTimeout {
			t.Errorf("Timeout = %v, want %v", trigger.Timeout, DefaultCronTimeout)
		}
	})
}

func TestCronRegistry(t *testing.T) {
	t.Run("注册 Cron 任务", func(t *testing.T) {
		registry := NewCronRegistry()

		registry.Register("daily", "0 8 * * *", func() error {
			return nil
		})

		jobs := registry.List()
		if len(jobs) != 1 {
			t.Errorf("List() 返回 %d 个任务, want 1", len(jobs))
		}

		if jobs[0].Name != "daily" {
			t.Errorf("Name = %s, want daily", jobs[0].Name)
		}
	})

	t.Run("防止重复注册", func(t *testing.T) {
		registry := NewCronRegistry()

		registry.Register("daily", "0 8 * * *", func() error { return nil })
		err := registry.Register("daily", "0 9 * * *", func() error { return nil })

		if err == nil {
			t.Error("Register() 应该返回重复注册错误")
		}
	})

	t.Run("取消注册", func(t *testing.T) {
		registry := NewCronRegistry()

		registry.Register("daily", "0 8 * * *", func() error { return nil })
		registry.Unregister("daily")

		jobs := registry.List()
		if len(jobs) != 0 {
			t.Errorf("List() 返回 %d 个任务, want 0", len(jobs))
		}
	})
}

func TestCronExecution(t *testing.T) {
	t.Run("执行 Cron 任务", func(t *testing.T) {
		executed := false
		trigger := NewCronTrigger("test", "* * * * *")
		trigger.Handler = func() error {
			executed = true
			return nil
		}

		err := trigger.Execute()
		if err != nil {
			t.Fatalf("Execute() error = %v", err)
		}

		if !executed {
			t.Error("Handler 未被执行")
		}
	})

	t.Run("防重叠执行", func(t *testing.T) {
		trigger := NewCronTrigger("test", "* * * * *")
		trigger.Handler = func() error {
			time.Sleep(100 * time.Millisecond)
			return nil
		}

		// 启动第一次执行
		go trigger.Execute()
		time.Sleep(10 * time.Millisecond)

		// 尝试第二次执行应该被跳过
		err := trigger.Execute()
		if err != ErrCronAlreadyRunning {
			t.Errorf("Execute() = %v, want ErrCronAlreadyRunning", err)
		}

		// 等待第一次执行完成
		time.Sleep(150 * time.Millisecond)

		// 现在应该可以执行
		err = trigger.Execute()
		if err != nil {
			t.Errorf("Execute() error = %v", err)
		}
	})
}

func TestCronNextRun(t *testing.T) {
	t.Run("计算下次运行时间", func(t *testing.T) {
		trigger := NewCronTrigger("test", "0 8 * * *")

		next, err := trigger.NextRun()
		if err != nil {
			t.Fatalf("NextRun() error = %v", err)
		}

		if next.IsZero() {
			t.Error("NextRun() 返回零值时间")
		}

		if next.Hour() != 8 {
			t.Errorf("NextRun().Hour() = %d, want 8", next.Hour())
		}
	})
}

func TestCronIsRunning(t *testing.T) {
	t.Run("检查运行状态", func(t *testing.T) {
		trigger := NewCronTrigger("test", "* * * * *")

		// 初始状态应该不在运行
		if trigger.IsRunning() {
			t.Error("初始状态 IsRunning() 应该为 false")
		}

		trigger.Handler = func() error {
			time.Sleep(100 * time.Millisecond)
			return nil
		}

		// 启动执行
		go trigger.Execute()
		time.Sleep(10 * time.Millisecond)

		// 应该正在运行
		if !trigger.IsRunning() {
			t.Error("执行中 IsRunning() 应该为 true")
		}

		// 等待执行完成
		time.Sleep(150 * time.Millisecond)

		// 应该不再运行
		if trigger.IsRunning() {
			t.Error("执行完成后 IsRunning() 应该为 false")
		}
	})
}

func TestCronRegistryGet(t *testing.T) {
	t.Run("获取已注册的任务", func(t *testing.T) {
		registry := NewCronRegistry()

		registry.Register("job1", "* * * * *", func() error { return nil })
		registry.Register("job2", "0 8 * * *", func() error { return nil })

		job := registry.Get("job1")
		if job == nil {
			t.Fatal("Get(job1) returned nil")
		}

		if job.Name != "job1" {
			t.Errorf("job.Name = %s, want job1", job.Name)
		}

		if job.Schedule != "* * * * *" {
			t.Errorf("job.Schedule = %s, want * * * * *", job.Schedule)
		}
	})

	t.Run("获取不存在的任务", func(t *testing.T) {
		registry := NewCronRegistry()

		job := registry.Get("nonexistent")
		if job != nil {
			t.Error("Get(nonexistent) should return nil")
		}
	})
}
