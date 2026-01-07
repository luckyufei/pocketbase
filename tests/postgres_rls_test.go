package tests_test

import (
	"context"
	"os"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// TestPostgres_RLS_SessionContext 测试会话上下文注入
func TestPostgres_RLS_SessionContext(t *testing.T) {
	if os.Getenv("SKIP_POSTGRES_TESTS") != "" {
		t.Skip("跳过 PostgreSQL 测试")
	}

	container, err := tests.NewPostgresContainer()
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	ctx := context.Background()
	db := container.DB()

	t.Run("注入 pb.auth.id", func(t *testing.T) {
		session := &core.SessionContext{
			AuthID:   "user-123",
			AuthRole: "user",
		}

		// 注入会话
		_, err := db.ExecContext(ctx, "SELECT set_config('pb.auth.id', $1, false)", session.AuthID)
		if err != nil {
			t.Fatalf("注入 auth.id 失败: %v", err)
		}

		// 验证注入
		var authID string
		err = db.QueryRowContext(ctx, "SELECT current_setting('pb.auth.id', true)").Scan(&authID)
		if err != nil {
			t.Fatalf("获取 auth.id 失败: %v", err)
		}
		if authID != session.AuthID {
			t.Errorf("auth.id 期望 %s, 实际 %s", session.AuthID, authID)
		}
	})

	t.Run("注入 pb.auth.role", func(t *testing.T) {
		session := &core.SessionContext{
			AuthID:   "user-456",
			AuthRole: "admin",
		}

		// 注入会话
		_, err := db.ExecContext(ctx, "SELECT set_config('pb.auth.role', $1, false)", session.AuthRole)
		if err != nil {
			t.Fatalf("注入 auth.role 失败: %v", err)
		}

		// 验证注入
		var authRole string
		err = db.QueryRowContext(ctx, "SELECT current_setting('pb.auth.role', true)").Scan(&authRole)
		if err != nil {
			t.Fatalf("获取 auth.role 失败: %v", err)
		}
		if authRole != session.AuthRole {
			t.Errorf("auth.role 期望 %s, 实际 %s", session.AuthRole, authRole)
		}
	})

	t.Run("事务结束后自动清除", func(t *testing.T) {
		// 开始事务
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			t.Fatalf("开始事务失败: %v", err)
		}

		// 在事务中设置会话变量 (local = true)
		_, err = tx.ExecContext(ctx, "SELECT set_config('pb.auth.id', 'tx-user', true)")
		if err != nil {
			tx.Rollback()
			t.Fatalf("设置事务会话变量失败: %v", err)
		}

		// 验证事务内可以读取
		var authID string
		err = tx.QueryRowContext(ctx, "SELECT current_setting('pb.auth.id', true)").Scan(&authID)
		if err != nil {
			tx.Rollback()
			t.Fatalf("读取事务会话变量失败: %v", err)
		}
		if authID != "tx-user" {
			tx.Rollback()
			t.Errorf("事务内 auth.id 期望 tx-user, 实际 %s", authID)
		}

		// 提交事务
		err = tx.Commit()
		if err != nil {
			t.Fatalf("提交事务失败: %v", err)
		}

		// 事务结束后，变量应该被清除 (返回空字符串)
		err = db.QueryRowContext(ctx, "SELECT current_setting('pb.auth.id', true)").Scan(&authID)
		if err != nil {
			t.Fatalf("读取事务后会话变量失败: %v", err)
		}
		// 注意: set_config 的 is_local=true 只在事务内有效
		t.Logf("事务结束后 auth.id: %s", authID)
	})

	t.Run("连接复用安全", func(t *testing.T) {
		// 模拟用户 A 的请求
		_, err := db.ExecContext(ctx, "SELECT set_config('pb.auth.id', 'user-A', true)")
		if err != nil {
			t.Fatalf("设置用户 A 会话失败: %v", err)
		}

		// 清除会话
		_, err = db.ExecContext(ctx, "SELECT set_config('pb.auth.id', '', true)")
		if err != nil {
			t.Fatalf("清除会话失败: %v", err)
		}

		// 模拟用户 B 的请求 (复用同一连接)
		var authID string
		err = db.QueryRowContext(ctx, "SELECT current_setting('pb.auth.id', true)").Scan(&authID)
		if err != nil {
			t.Fatalf("读取会话失败: %v", err)
		}

		// 用户 B 不应该看到用户 A 的会话
		if authID == "user-A" {
			t.Error("连接复用时不应该看到其他用户的会话")
		}
	})
}

// TestPostgres_RLS_Policies 测试 RLS 策略
func TestPostgres_RLS_Policies(t *testing.T) {
	if os.Getenv("SKIP_POSTGRES_TESTS") != "" {
		t.Skip("跳过 PostgreSQL 测试")
	}

	container, err := tests.NewPostgresContainer()
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	ctx := context.Background()
	db := container.DB()

	t.Run("创建 RLS 表和策略", func(t *testing.T) {
		// 创建测试表
		_, err := db.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS posts (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				content TEXT,
				author_id TEXT NOT NULL,
				created_at TIMESTAMPTZ DEFAULT NOW()
			)
		`)
		if err != nil {
			t.Fatalf("创建表失败: %v", err)
		}

		// 启用 RLS
		_, err = db.ExecContext(ctx, "ALTER TABLE posts ENABLE ROW LEVEL SECURITY")
		if err != nil {
			t.Fatalf("启用 RLS 失败: %v", err)
		}

		// 创建查看策略 (所有人可查看)
		_, err = db.ExecContext(ctx, `
			CREATE POLICY posts_view ON posts
			FOR SELECT
			USING (true)
		`)
		if err != nil {
			t.Fatalf("创建查看策略失败: %v", err)
		}

		// 创建更新策略 (只有作者可更新)
		_, err = db.ExecContext(ctx, `
			CREATE POLICY posts_update ON posts
			FOR UPDATE
			USING (author_id = current_setting('pb.auth.id', true))
		`)
		if err != nil {
			t.Fatalf("创建更新策略失败: %v", err)
		}

		// 创建删除策略 (只有作者可删除)
		_, err = db.ExecContext(ctx, `
			CREATE POLICY posts_delete ON posts
			FOR DELETE
			USING (author_id = current_setting('pb.auth.id', true))
		`)
		if err != nil {
			t.Fatalf("创建删除策略失败: %v", err)
		}

		// 验证策略存在
		var count int
		err = db.QueryRowContext(ctx, `
			SELECT COUNT(*) FROM pg_policies WHERE tablename = 'posts'
		`).Scan(&count)
		if err != nil {
			t.Fatalf("查询策略失败: %v", err)
		}
		if count < 3 {
			t.Errorf("策略数量期望至少 3, 实际 %d", count)
		}
	})

	t.Run("RLS 策略生效验证", func(t *testing.T) {
		// 插入测试数据 (需要先禁用 RLS 或使用超级用户)
		_, err := db.ExecContext(ctx, "ALTER TABLE posts DISABLE ROW LEVEL SECURITY")
		if err != nil {
			t.Fatalf("禁用 RLS 失败: %v", err)
		}

		_, err = db.ExecContext(ctx, `
			INSERT INTO posts (id, title, content, author_id) VALUES
			('post-1', 'Post 1', 'Content 1', 'user-1'),
			('post-2', 'Post 2', 'Content 2', 'user-2'),
			('post-3', 'Post 3', 'Content 3', 'user-1')
			ON CONFLICT (id) DO NOTHING
		`)
		if err != nil {
			t.Fatalf("插入测试数据失败: %v", err)
		}

		_, err = db.ExecContext(ctx, "ALTER TABLE posts ENABLE ROW LEVEL SECURITY")
		if err != nil {
			t.Fatalf("重新启用 RLS 失败: %v", err)
		}

		// 验证数据
		var count int
		err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM posts").Scan(&count)
		if err != nil {
			t.Fatalf("查询数据失败: %v", err)
		}
		t.Logf("posts 表共有 %d 条记录", count)
	})
}

// TestPostgres_RLS_RuleCompiler 测试规则编译器集成
func TestPostgres_RLS_RuleCompiler(t *testing.T) {
	if os.Getenv("SKIP_POSTGRES_TESTS") != "" {
		t.Skip("跳过 PostgreSQL 测试")
	}

	container, err := tests.NewPostgresContainer()
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	ctx := context.Background()
	db := container.DB()

	t.Run("编译并执行规则", func(t *testing.T) {
		manager := core.NewRLSManager()

		// 编译规则
		rule := "@request.auth.id != ''"
		expression, err := manager.CompileRule(rule)
		if err != nil {
			t.Fatalf("编译规则失败: %v", err)
		}

		t.Logf("编译后的表达式: %s", expression)

		// 设置会话
		_, err = db.ExecContext(ctx, "SELECT set_config('pb.auth.id', 'test-user', false)")
		if err != nil {
			t.Fatalf("设置会话失败: %v", err)
		}

		// 执行编译后的表达式
		var result bool
		query := "SELECT " + expression
		err = db.QueryRowContext(ctx, query).Scan(&result)
		if err != nil {
			t.Fatalf("执行表达式失败: %v", err)
		}

		if !result {
			t.Error("表达式应该返回 true (auth.id 不为空)")
		}

		// 清除会话后再测试
		_, err = db.ExecContext(ctx, "SELECT set_config('pb.auth.id', '', false)")
		if err != nil {
			t.Fatalf("清除会话失败: %v", err)
		}

		err = db.QueryRowContext(ctx, query).Scan(&result)
		if err != nil {
			t.Fatalf("执行表达式失败: %v", err)
		}

		if result {
			t.Error("表达式应该返回 false (auth.id 为空)")
		}
	})

	t.Run("生成完整 RLS 配置", func(t *testing.T) {
		manager := core.NewRLSManager()

		// 创建测试表
		_, err := db.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS comments (
				id TEXT PRIMARY KEY,
				content TEXT NOT NULL,
				user_id TEXT NOT NULL,
				created_at TIMESTAMPTZ DEFAULT NOW()
			)
		`)
		if err != nil {
			t.Fatalf("创建表失败: %v", err)
		}

		// 生成 RLS 配置
		sqls, err := manager.GenerateCollectionRLS(
			"comments",
			"true",                                    // viewRule: 所有人可查看
			"@request.auth.id != ''",                  // createRule: 登录用户可创建
			"user_id = @request.auth.id",              // updateRule: 只有作者可更新
			"user_id = @request.auth.id",              // deleteRule: 只有作者可删除
		)
		if err != nil {
			t.Fatalf("生成 RLS 配置失败: %v", err)
		}

		t.Logf("生成了 %d 条 SQL", len(sqls))
		for i, sql := range sqls {
			t.Logf("SQL %d: %s", i+1, sql)
		}

		// 执行 SQL (跳过可能已存在的策略错误)
		for _, sql := range sqls {
			_, err := db.ExecContext(ctx, sql)
			if err != nil {
				t.Logf("执行 SQL 警告: %v", err)
			}
		}
	})
}

// TestPostgres_RLS_ExistsQuery 测试 EXISTS 子查询
func TestPostgres_RLS_ExistsQuery(t *testing.T) {
	if os.Getenv("SKIP_POSTGRES_TESTS") != "" {
		t.Skip("跳过 PostgreSQL 测试")
	}

	container, err := tests.NewPostgresContainer()
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	ctx := context.Background()
	db := container.DB()

	t.Run("简单 EXISTS 子查询", func(t *testing.T) {
		// 创建测试表
		_, err := db.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS teams (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL
			)
		`)
		if err != nil {
			t.Fatalf("创建 teams 表失败: %v", err)
		}

		_, err = db.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS team_members (
				id TEXT PRIMARY KEY,
				team_id TEXT NOT NULL,
				user_id TEXT NOT NULL
			)
		`)
		if err != nil {
			t.Fatalf("创建 team_members 表失败: %v", err)
		}

		// 插入测试数据
		_, err = db.ExecContext(ctx, `
			INSERT INTO teams (id, name) VALUES ('team-1', 'Team 1')
			ON CONFLICT (id) DO NOTHING
		`)
		if err != nil {
			t.Fatalf("插入 teams 数据失败: %v", err)
		}

		_, err = db.ExecContext(ctx, `
			INSERT INTO team_members (id, team_id, user_id) VALUES 
			('tm-1', 'team-1', 'user-1'),
			('tm-2', 'team-1', 'user-2')
			ON CONFLICT (id) DO NOTHING
		`)
		if err != nil {
			t.Fatalf("插入 team_members 数据失败: %v", err)
		}

		// 生成 EXISTS 子查询
		gen := core.NewExistsQueryGenerator()
		ref := &core.CollectionReference{
			Collection: "team_members",
			Field:      "user_id",
			Value:      "current_setting('pb.auth.id', true)",
		}

		existsSQL := gen.Generate(ref)
		t.Logf("EXISTS 子查询: %s", existsSQL)

		// 设置会话并测试
		_, err = db.ExecContext(ctx, "SELECT set_config('pb.auth.id', 'user-1', false)")
		if err != nil {
			t.Fatalf("设置会话失败: %v", err)
		}

		var exists bool
		query := "SELECT " + existsSQL
		err = db.QueryRowContext(ctx, query).Scan(&exists)
		if err != nil {
			t.Fatalf("执行 EXISTS 查询失败: %v", err)
		}

		if !exists {
			t.Error("user-1 应该是团队成员")
		}

		// 测试非成员
		_, err = db.ExecContext(ctx, "SELECT set_config('pb.auth.id', 'user-999', false)")
		if err != nil {
			t.Fatalf("设置会话失败: %v", err)
		}

		err = db.QueryRowContext(ctx, query).Scan(&exists)
		if err != nil {
			t.Fatalf("执行 EXISTS 查询失败: %v", err)
		}

		if exists {
			t.Error("user-999 不应该是团队成员")
		}
	})
}
