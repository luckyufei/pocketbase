// Package tests_test 测试 PostgreSQL 下的 API Rules 功能
// 这些测试覆盖了 SQLite 中已测试但 PostgreSQL 中缺失的场景
package tests_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/tests"
	"github.com/pocketbase/pocketbase/tools/dbutils"
)

// skipIfNoDockerAPIRules 检查是否应该跳过需要 Docker 的测试
func skipIfNoDockerAPIRules(t *testing.T) {
	if os.Getenv("SKIP_POSTGRES_TESTS") != "" {
		t.Skip("跳过 PostgreSQL 测试 (SKIP_POSTGRES_TESTS 已设置)")
	}
}

// createTestSchema 创建测试所需的数据库表
func createTestSchema(container *tests.PostgresContainer) error {
	// 创建辅助函数
	if err := container.ExecSQL(dbutils.CreatePGHelperFunctions()); err != nil {
		return err
	}

	// 创建 users 表
	if err := container.ExecSQL(`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			email TEXT,
			email_visibility BOOLEAN DEFAULT FALSE,
			verified BOOLEAN DEFAULT FALSE,
			created TIMESTAMPTZ DEFAULT NOW(),
			updated TIMESTAMPTZ DEFAULT NOW()
		)
	`); err != nil {
		return err
	}

	// 创建 workspaces 表
	if err := container.ExecSQL(`
		CREATE TABLE IF NOT EXISTS workspaces (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			type TEXT CHECK (type IN ('private', 'team')),
			owner TEXT REFERENCES users(id),
			status TEXT DEFAULT 'active',
			created TIMESTAMPTZ DEFAULT NOW(),
			updated TIMESTAMPTZ DEFAULT NOW()
		)
	`); err != nil {
		return err
	}

	// 创建 workspace_members 表 (用于测试 _via_ 反向关联)
	if err := container.ExecSQL(`
		CREATE TABLE IF NOT EXISTS workspace_members (
			id TEXT PRIMARY KEY,
			workspace TEXT REFERENCES workspaces(id),
			"user" TEXT REFERENCES users(id),
			role TEXT CHECK (role IN ('admin', 'member')),
			created TIMESTAMPTZ DEFAULT NOW(),
			updated TIMESTAMPTZ DEFAULT NOW()
		)
	`); err != nil {
		return err
	}

	// 创建 posts 表 (用于测试多值关联)
	if err := container.ExecSQL(`
		CREATE TABLE IF NOT EXISTS posts (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			content TEXT,
			author TEXT REFERENCES users(id),
			tags JSONB DEFAULT '[]'::jsonb,
			collaborators JSONB DEFAULT '[]'::jsonb,
			created TIMESTAMPTZ DEFAULT NOW(),
			updated TIMESTAMPTZ DEFAULT NOW()
		)
	`); err != nil {
		return err
	}

	// 创建 comments 表 (用于测试嵌套关联)
	if err := container.ExecSQL(`
		CREATE TABLE IF NOT EXISTS comments (
			id TEXT PRIMARY KEY,
			content TEXT NOT NULL,
			post TEXT REFERENCES posts(id),
			author TEXT REFERENCES users(id),
			created TIMESTAMPTZ DEFAULT NOW(),
			updated TIMESTAMPTZ DEFAULT NOW()
		)
	`); err != nil {
		return err
	}

	// 创建 demo_multi 表 (用于测试多值字段)
	if err := container.ExecSQL(`
		CREATE TABLE IF NOT EXISTS demo_multi (
			id TEXT PRIMARY KEY,
			title TEXT,
			select_many JSONB DEFAULT '[]'::jsonb,
			rel_many JSONB DEFAULT '[]'::jsonb,
			file_many JSONB DEFAULT '[]'::jsonb,
			created TIMESTAMPTZ DEFAULT NOW(),
			updated TIMESTAMPTZ DEFAULT NOW()
		)
	`); err != nil {
		return err
	}

	return nil
}

// createTestData 创建测试数据
func createTestData(container *tests.PostgresContainer) error {
	// 创建用户
	if err := container.ExecSQL(`
		INSERT INTO users (id, name, email, verified) VALUES
		('user1', 'Alice', 'alice@example.com', true),
		('user2', 'Bob', 'bob@example.com', true),
		('user3', 'Charlie', 'charlie@example.com', false)
		ON CONFLICT (id) DO NOTHING
	`); err != nil {
		return err
	}

	// 创建工作空间
	if err := container.ExecSQL(`
		INSERT INTO workspaces (id, name, type, owner) VALUES
		('ws1', 'Team Alpha', 'team', 'user1'),
		('ws2', 'Private Bob', 'private', 'user2'),
		('ws3', 'Team Beta', 'team', 'user1')
		ON CONFLICT (id) DO NOTHING
	`); err != nil {
		return err
	}

	// 创建工作空间成员关系
	if err := container.ExecSQL(`
		INSERT INTO workspace_members (id, workspace, "user", role) VALUES
		('wm1', 'ws1', 'user1', 'admin'),
		('wm2', 'ws1', 'user2', 'member'),
		('wm3', 'ws2', 'user2', 'admin'),
		('wm4', 'ws3', 'user1', 'admin'),
		('wm5', 'ws3', 'user3', 'member')
		ON CONFLICT (id) DO NOTHING
	`); err != nil {
		return err
	}

	// 创建帖子 (带多值字段)
	if err := container.ExecSQL(`
		INSERT INTO posts (id, title, author, tags, collaborators) VALUES
		('post1', 'Hello World', 'user1', '["tech", "intro"]'::jsonb, '["user2"]'::jsonb),
		('post2', 'PostgreSQL Tips', 'user2', '["database", "tech"]'::jsonb, '["user1", "user3"]'::jsonb),
		('post3', 'Private Post', 'user3', '["personal"]'::jsonb, '[]'::jsonb)
		ON CONFLICT (id) DO NOTHING
	`); err != nil {
		return err
	}

	// 创建评论
	if err := container.ExecSQL(`
		INSERT INTO comments (id, content, post, author) VALUES
		('c1', 'Great post!', 'post1', 'user2'),
		('c2', 'Thanks!', 'post1', 'user1'),
		('c3', 'Nice tips', 'post2', 'user1')
		ON CONFLICT (id) DO NOTHING
	`); err != nil {
		return err
	}

	// 创建多值测试数据
	if err := container.ExecSQL(`
		INSERT INTO demo_multi (id, title, select_many, rel_many, file_many) VALUES
		('dm1', 'Test 1', '["optionA", "optionB"]'::jsonb, '["user1", "user2"]'::jsonb, '["file1.txt", "file2.txt"]'::jsonb),
		('dm2', 'Test 2', '["optionC"]'::jsonb, '["user3"]'::jsonb, '["file3.txt"]'::jsonb)
		ON CONFLICT (id) DO NOTHING
	`); err != nil {
		return err
	}

	return nil
}

// TestPostgres_BackRelation_Via 测试 _via_ 反向关联查询
// 这是 SQLite 测试覆盖但 PostgreSQL 缺失的关键场景
func TestPostgres_BackRelation_Via(t *testing.T) {
	skipIfNoDockerAPIRules(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	if err := createTestSchema(container); err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}
	if err := createTestData(container); err != nil {
		t.Fatalf("创建测试数据失败: %v", err)
	}

	ctx := context.Background()
	db := container.DB()

	t.Run("simple back relation via single field", func(t *testing.T) {
		// 模拟: workspace_members_via_workspace.user = @request.auth.id
		// 查找用户是成员的工作空间

		// 设置当前用户
		_, err := db.ExecContext(ctx, "SELECT set_config('pb.auth.id', 'user2', false)")
		if err != nil {
			t.Fatalf("设置会话失败: %v", err)
		}

		// PostgreSQL 版本的查询 (使用 jsonb_array_elements_text 和 (value) 列定义)
		query := `
			SELECT DISTINCT w.id, w.name
			FROM workspaces w
			LEFT JOIN workspace_members wm ON w.id = wm.workspace
			WHERE wm."user" = current_setting('pb.auth.id', true)
			ORDER BY w.id
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var results []string
		for rows.Next() {
			var id, name string
			if err := rows.Scan(&id, &name); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			results = append(results, id)
		}

		// user2 是 ws1 和 ws2 的成员
		if len(results) != 2 {
			t.Errorf("期望 2 个工作空间, 得到 %d: %v", len(results), results)
		}
	})

	t.Run("back relation with json array (multi-value field)", func(t *testing.T) {
		// 模拟: posts 表的 collaborators 是 JSONB 数组
		// 查找用户是协作者的帖子

		_, err := db.ExecContext(ctx, "SELECT set_config('pb.auth.id', 'user1', false)")
		if err != nil {
			t.Fatalf("设置会话失败: %v", err)
		}

		// 使用 jsonb_array_elements_text 展开 JSONB 数组
		query := `
			SELECT DISTINCT p.id, p.title
			FROM posts p
			LEFT JOIN jsonb_array_elements_text(
				CASE WHEN jsonb_typeof(p.collaborators) = 'array' 
				THEN p.collaborators 
				ELSE jsonb_build_array(p.collaborators) END
			) je(value) ON true
			WHERE je.value = current_setting('pb.auth.id', true)
			ORDER BY p.id
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var results []string
		for rows.Next() {
			var id, title string
			if err := rows.Scan(&id, &title); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			results = append(results, id)
		}

		// user1 是 post2 的协作者
		if len(results) != 1 || (len(results) > 0 && results[0] != "post2") {
			t.Errorf("期望 [post2], 得到 %v", results)
		}
	})

	t.Run("back relation combined with owner check", func(t *testing.T) {
		// 模拟用户问题中的规则:
		// workspace.owner = @request.auth.id || @request.auth.id ?= workspace.workspace_members_via_workspace.user

		_, err := db.ExecContext(ctx, "SELECT set_config('pb.auth.id', 'user2', false)")
		if err != nil {
			t.Fatalf("设置会话失败: %v", err)
		}

		query := `
			SELECT DISTINCT w.id, w.name
			FROM workspaces w
			LEFT JOIN workspace_members wm ON w.id = wm.workspace
			WHERE 
				w.owner = current_setting('pb.auth.id', true)
				OR wm."user" = current_setting('pb.auth.id', true)
			ORDER BY w.id
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var results []string
		for rows.Next() {
			var id, name string
			if err := rows.Scan(&id, &name); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			results = append(results, id)
		}

		// user2 拥有 ws2，是 ws1 的成员
		if len(results) != 2 {
			t.Errorf("期望 2 个工作空间, 得到 %d: %v", len(results), results)
		}
	})

	t.Run("inline safe jsonb handles plain text single-value relation field", func(t *testing.T) {
		// 这是修复 "invalid input syntax for type json" 错误的关键测试
		// 问题场景: workspace_members.workspace 是单值关联字段，存储的是普通字符串（如 "ws1"）
		// 而不是 JSON 格式，直接 ::jsonb 转换会失败
		//
		// 使用内联 CASE 表达式安全处理这种情况（不依赖自定义函数）

		_, err := db.ExecContext(ctx, "SELECT set_config('pb.auth.id', 'user1', false)")
		if err != nil {
			t.Fatalf("设置会话失败: %v", err)
		}

		// 使用内联 CASE 表达式安全转换单值关联字段
		// 这模拟了 _via_ 反向关联中使用 jsonb_array_elements_text 的场景
		// 关键: 使用正则检查字符串是否以 JSON 特征字符开头（[、{、"）
		query := `
			SELECT DISTINCT w.id, w.name
			FROM workspaces w
			LEFT JOIN workspace_members wm ON w.id IN (
				SELECT je.value 
				FROM jsonb_array_elements_text(
					CASE WHEN jsonb_typeof(
						CASE WHEN wm.workspace IS NULL OR wm.workspace = '' THEN NULL 
						WHEN wm.workspace::text ~ '^[\[\{"]' THEN wm.workspace::jsonb 
						ELSE to_jsonb(wm.workspace) END
					) = 'array' 
					THEN (CASE WHEN wm.workspace IS NULL OR wm.workspace = '' THEN NULL 
						WHEN wm.workspace::text ~ '^[\[\{"]' THEN wm.workspace::jsonb 
						ELSE to_jsonb(wm.workspace) END)
					ELSE jsonb_build_array(wm.workspace) END
				) je(value)
			)
			WHERE wm."user" = current_setting('pb.auth.id', true)
			ORDER BY w.id
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var results []string
		for rows.Next() {
			var id, name string
			if err := rows.Scan(&id, &name); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			results = append(results, id)
		}

		// user1 是 ws1 和 ws3 的成员
		if len(results) != 2 {
			t.Errorf("期望 2 个工作空间, 得到 %d: %v", len(results), results)
		}
	})
}

// TestPostgres_CollectionJoin 测试 @collection 跨集合查询
func TestPostgres_CollectionJoin(t *testing.T) {
	skipIfNoDockerAPIRules(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	if err := createTestSchema(container); err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}
	if err := createTestData(container); err != nil {
		t.Fatalf("创建测试数据失败: %v", err)
	}

	ctx := context.Background()
	db := container.DB()

	t.Run("collection join with simple field", func(t *testing.T) {
		// 模拟: @collection.workspace_members.workspace ?= workspace && @collection.workspace_members.user ?= @request.auth.id

		_, err := db.ExecContext(ctx, "SELECT set_config('pb.auth.id', 'user1', false)")
		if err != nil {
			t.Fatalf("设置会话失败: %v", err)
		}

		query := `
			SELECT DISTINCT w.id, w.name
			FROM workspaces w
			LEFT JOIN workspace_members wm ON wm.workspace = w.id
			WHERE wm."user" = current_setting('pb.auth.id', true)
			ORDER BY w.id
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var results []string
		for rows.Next() {
			var id, name string
			if err := rows.Scan(&id, &name); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			results = append(results, id)
		}

		// user1 是 ws1 和 ws3 的成员
		if len(results) != 2 {
			t.Errorf("期望 2 个工作空间, 得到 %d: %v", len(results), results)
		}
	})

	t.Run("collection join with nested relation", func(t *testing.T) {
		// 模拟: @collection.comments.post.author = @request.auth.id
		// 查找帖子作者的评论

		_, err := db.ExecContext(ctx, "SELECT set_config('pb.auth.id', 'user1', false)")
		if err != nil {
			t.Fatalf("设置会话失败: %v", err)
		}

		query := `
			SELECT DISTINCT c.id, c.content
			FROM comments c
			LEFT JOIN posts p ON c.post = p.id
			WHERE p.author = current_setting('pb.auth.id', true)
			ORDER BY c.id
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var results []string
		for rows.Next() {
			var id, content string
			if err := rows.Scan(&id, &content); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			results = append(results, id)
		}

		// user1 是 post1 的作者，post1 有 c1 和 c2 两条评论
		if len(results) != 2 {
			t.Errorf("期望 2 条评论, 得到 %d: %v", len(results), results)
		}
	})
}

// TestPostgres_MultiValueOperator 测试 ?= 多值匹配操作符
func TestPostgres_MultiValueOperator(t *testing.T) {
	skipIfNoDockerAPIRules(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	if err := createTestSchema(container); err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}
	if err := createTestData(container); err != nil {
		t.Fatalf("创建测试数据失败: %v", err)
	}

	ctx := context.Background()
	db := container.DB()

	t.Run("any match on jsonb array (?=)", func(t *testing.T) {
		// 模拟: tags ?= 'tech'
		// 查找任意标签包含 'tech' 的帖子

		query := `
			SELECT p.id, p.title
			FROM posts p
			LEFT JOIN jsonb_array_elements_text(
				CASE WHEN jsonb_typeof(p.tags) = 'array' 
				THEN p.tags 
				ELSE jsonb_build_array(p.tags) END
			) je(value) ON true
			WHERE je.value = 'tech'
			ORDER BY p.id
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var results []string
		for rows.Next() {
			var id, title string
			if err := rows.Scan(&id, &title); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			results = append(results, id)
		}

		// post1 和 post2 都有 'tech' 标签
		if len(results) != 2 {
			t.Errorf("期望 2 个帖子, 得到 %d: %v", len(results), results)
		}
	})

	t.Run("any match on user relation (?=)", func(t *testing.T) {
		// 模拟: collaborators ?= @request.auth.id

		_, err := db.ExecContext(ctx, "SELECT set_config('pb.auth.id', 'user3', false)")
		if err != nil {
			t.Fatalf("设置会话失败: %v", err)
		}

		query := `
			SELECT DISTINCT p.id, p.title
			FROM posts p
			LEFT JOIN jsonb_array_elements_text(
				CASE WHEN jsonb_typeof(p.collaborators) = 'array' 
				THEN p.collaborators 
				ELSE jsonb_build_array(p.collaborators) END
			) je(value) ON true
			WHERE je.value = current_setting('pb.auth.id', true)
			ORDER BY p.id
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var results []string
		for rows.Next() {
			var id, title string
			if err := rows.Scan(&id, &title); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			results = append(results, id)
		}

		// user3 是 post2 的协作者
		if len(results) != 1 || (len(results) > 0 && results[0] != "post2") {
			t.Errorf("期望 [post2], 得到 %v", results)
		}
	})

	t.Run("combined owner OR member check with ?=", func(t *testing.T) {
		// 这是用户遇到问题的场景:
		// workspace.owner = @request.auth.id || @request.auth.id ?= workspace.workspace_members_via_workspace.user

		_, err := db.ExecContext(ctx, "SELECT set_config('pb.auth.id', 'user3', false)")
		if err != nil {
			t.Fatalf("设置会话失败: %v", err)
		}

		// user3 不拥有任何工作空间，但是 ws3 的成员
		query := `
			SELECT DISTINCT w.id, w.name
			FROM workspaces w
			LEFT JOIN workspace_members wm ON w.id = wm.workspace
			WHERE 
				w.owner = current_setting('pb.auth.id', true)
				OR wm."user" = current_setting('pb.auth.id', true)
			ORDER BY w.id
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var results []string
		for rows.Next() {
			var id, name string
			if err := rows.Scan(&id, &name); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			results = append(results, id)
		}

		// user3 是 ws3 的成员
		if len(results) != 1 || (len(results) > 0 && results[0] != "ws3") {
			t.Errorf("期望 [ws3], 得到 %v", results)
		}
	})
}

// TestPostgres_JSONArrayElements_ColumnDef 测试 jsonb_array_elements_text 的列定义
// 这是修复的关键：PostgreSQL 需要 (value) 列定义来匹配 SQLite 的 json_each 行为
func TestPostgres_JSONArrayElements_ColumnDef(t *testing.T) {
	skipIfNoDockerAPIRules(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	ctx := context.Background()
	db := container.DB()

	t.Run("jsonb_array_elements_text with column alias", func(t *testing.T) {
		// 这是修复后的正确语法
		query := `
			SELECT je.value
			FROM jsonb_array_elements_text('["a", "b", "c"]'::jsonb) AS je(value)
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var results []string
		for rows.Next() {
			var val string
			if err := rows.Scan(&val); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			results = append(results, val)
		}

		if len(results) != 3 {
			t.Errorf("期望 3 个元素, 得到 %d: %v", len(results), results)
		}
	})

	t.Run("jsonb_array_elements_text in subquery", func(t *testing.T) {
		// 模拟 API Rule 中的子查询模式
		query := `
			SELECT id FROM (
				SELECT 'test-id' AS id
			) t
			WHERE id IN (
				SELECT je.value 
				FROM jsonb_array_elements_text('["test-id", "other-id"]'::jsonb) AS je(value)
			)
		`
		var result string
		err := db.QueryRowContext(ctx, query).Scan(&result)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}

		if result != "test-id" {
			t.Errorf("期望 'test-id', 得到 '%s'", result)
		}
	})

	t.Run("jsonb_array_elements_text with CASE WHEN", func(t *testing.T) {
		// 模拟处理非数组情况
		query := `
			SELECT je.value
			FROM jsonb_array_elements_text(
				CASE WHEN jsonb_typeof('"single"'::jsonb) = 'array' 
				THEN '"single"'::jsonb 
				ELSE jsonb_build_array('"single"'::jsonb) END
			) AS je(value)
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var results []string
		for rows.Next() {
			var val string
			if err := rows.Scan(&val); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			results = append(results, val)
		}

		if len(results) != 1 {
			t.Errorf("期望 1 个元素, 得到 %d: %v", len(results), results)
		}
	})
}

// TestPostgres_NestedRelations 测试嵌套关联查询
func TestPostgres_NestedRelations(t *testing.T) {
	skipIfNoDockerAPIRules(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	if err := createTestSchema(container); err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}
	if err := createTestData(container); err != nil {
		t.Fatalf("创建测试数据失败: %v", err)
	}

	ctx := context.Background()
	db := container.DB()

	t.Run("nested relation with single fields", func(t *testing.T) {
		// 模拟: comments.post.author = @request.auth.id

		_, err := db.ExecContext(ctx, "SELECT set_config('pb.auth.id', 'user1', false)")
		if err != nil {
			t.Fatalf("设置会话失败: %v", err)
		}

		query := `
			SELECT c.id, c.content, p.title, u.name as author_name
			FROM comments c
			LEFT JOIN posts p ON c.post = p.id
			LEFT JOIN users u ON p.author = u.id
			WHERE p.author = current_setting('pb.auth.id', true)
			ORDER BY c.id
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var count int
		for rows.Next() {
			var id, content, title, authorName string
			if err := rows.Scan(&id, &content, &title, &authorName); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			count++
			t.Logf("评论: %s, 帖子: %s, 作者: %s", id, title, authorName)
		}

		// user1 的帖子 (post1) 有 2 条评论
		if count != 2 {
			t.Errorf("期望 2 条评论, 得到 %d", count)
		}
	})

	t.Run("nested relation with multi-value field", func(t *testing.T) {
		// 模拟: posts.collaborators.name (展开多值字段后访问关联表)

		query := `
			SELECT p.id, p.title, u.name as collaborator_name
			FROM posts p
			LEFT JOIN jsonb_array_elements_text(
				CASE WHEN jsonb_typeof(p.collaborators) = 'array' 
				THEN p.collaborators 
				ELSE jsonb_build_array(p.collaborators) END
			) je(value) ON true
			LEFT JOIN users u ON u.id = je.value
			WHERE u.id IS NOT NULL
			ORDER BY p.id, u.name
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var count int
		for rows.Next() {
			var id, title, collaboratorName string
			if err := rows.Scan(&id, &title, &collaboratorName); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			count++
			t.Logf("帖子: %s (%s), 协作者: %s", id, title, collaboratorName)
		}

		// post1 有 1 个协作者, post2 有 2 个协作者
		if count != 3 {
			t.Errorf("期望 3 条记录, 得到 %d", count)
		}
	})
}

// TestPostgres_MultiMatchSubquery 测试多值匹配子查询
// 这测试了 multi-match 语义，确保所有值都匹配条件
func TestPostgres_MultiMatchSubquery(t *testing.T) {
	skipIfNoDockerAPIRules(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	if err := createTestSchema(container); err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}
	if err := createTestData(container); err != nil {
		t.Fatalf("创建测试数据失败: %v", err)
	}

	ctx := context.Background()
	db := container.DB()

	t.Run("multi-match: all collaborators must be verified", func(t *testing.T) {
		// 模拟 multi-match 语义：帖子的所有协作者都必须是已验证用户
		// PocketBase 中: posts.collaborators.verified = true (without ?)

		// 这需要检查：
		// 1. 至少一个协作者是已验证的 (基本条件)
		// 2. 不存在未验证的协作者 (multi-match 约束)

		query := `
			SELECT DISTINCT p.id, p.title
			FROM posts p
			LEFT JOIN jsonb_array_elements_text(
				CASE WHEN jsonb_typeof(p.collaborators) = 'array' 
				THEN p.collaborators 
				ELSE jsonb_build_array(p.collaborators) END
			) je(value) ON true
			LEFT JOIN users u ON u.id = je.value
			WHERE 
				-- 基本条件：至少有一个已验证的协作者
				u.verified = true
				-- multi-match 约束：不存在未验证的协作者
				AND NOT EXISTS (
					SELECT 1
					FROM jsonb_array_elements_text(
						CASE WHEN jsonb_typeof(p.collaborators) = 'array' 
						THEN p.collaborators 
						ELSE jsonb_build_array(p.collaborators) END
					) je2(value)
					LEFT JOIN users u2 ON u2.id = je2.value
					WHERE u2.verified = false OR u2.verified IS NULL
				)
			ORDER BY p.id
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var results []string
		for rows.Next() {
			var id, title string
			if err := rows.Scan(&id, &title); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			results = append(results, id)
			t.Logf("帖子: %s (%s)", id, title)
		}

		// post1 的协作者是 user2 (已验证)
		// post2 的协作者是 user1 (已验证) 和 user3 (未验证) - 不符合 multi-match
		// post3 没有协作者
		if len(results) != 1 || (len(results) > 0 && results[0] != "post1") {
			t.Errorf("期望 [post1], 得到 %v", results)
		}
	})
}

// TestPostgres_EachModifier 测试 :each 修饰符
func TestPostgres_EachModifier(t *testing.T) {
	skipIfNoDockerAPIRules(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	if err := createTestSchema(container); err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}
	if err := createTestData(container); err != nil {
		t.Fatalf("创建测试数据失败: %v", err)
	}

	ctx := context.Background()
	db := container.DB()

	t.Run("each modifier on select_many field", func(t *testing.T) {
		// 模拟: select_many:each = 'optionA'

		query := `
			SELECT DISTINCT d.id, d.title
			FROM demo_multi d
			LEFT JOIN jsonb_array_elements_text(
				CASE WHEN jsonb_typeof(d.select_many) = 'array' 
				THEN d.select_many 
				ELSE jsonb_build_array(d.select_many) END
			) je(value) ON true
			WHERE je.value = 'optionA'
			ORDER BY d.id
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var results []string
		for rows.Next() {
			var id, title string
			if err := rows.Scan(&id, &title); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			results = append(results, id)
		}

		// dm1 有 optionA
		if len(results) != 1 || (len(results) > 0 && results[0] != "dm1") {
			t.Errorf("期望 [dm1], 得到 %v", results)
		}
	})

	t.Run("each modifier with comparison", func(t *testing.T) {
		// 模拟: select_many:each > 'optionA' (字典序比较)

		query := `
			SELECT DISTINCT d.id, d.title
			FROM demo_multi d
			LEFT JOIN jsonb_array_elements_text(
				CASE WHEN jsonb_typeof(d.select_many) = 'array' 
				THEN d.select_many 
				ELSE jsonb_build_array(d.select_many) END
			) je(value) ON true
			WHERE je.value > 'optionA'
			ORDER BY d.id
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var results []string
		for rows.Next() {
			var id, title string
			if err := rows.Scan(&id, &title); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			results = append(results, id)
		}

		// dm1 有 optionB (> optionA), dm2 有 optionC (> optionA)
		if len(results) != 2 {
			t.Errorf("期望 2 条记录, 得到 %d: %v", len(results), results)
		}
	})
}

// TestPostgres_LengthModifier 测试 :length 修饰符
func TestPostgres_LengthModifier(t *testing.T) {
	skipIfNoDockerAPIRules(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	if err := createTestSchema(container); err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}
	if err := createTestData(container); err != nil {
		t.Fatalf("创建测试数据失败: %v", err)
	}

	ctx := context.Background()
	db := container.DB()

	t.Run("length modifier on jsonb array", func(t *testing.T) {
		// 模拟: select_many:length > 1

		query := `
			SELECT d.id, d.title, 
				jsonb_array_length(
					CASE WHEN jsonb_typeof(d.select_many) = 'array' 
					THEN d.select_many 
					ELSE jsonb_build_array(d.select_many) END
				) as arr_len
			FROM demo_multi d
			WHERE jsonb_array_length(
				CASE WHEN jsonb_typeof(d.select_many) = 'array' 
				THEN d.select_many 
				ELSE jsonb_build_array(d.select_many) END
			) > 1
			ORDER BY d.id
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var results []string
		for rows.Next() {
			var id, title string
			var arrLen int
			if err := rows.Scan(&id, &title, &arrLen); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			results = append(results, id)
			t.Logf("记录: %s, 长度: %d", id, arrLen)
		}

		// dm1 有 2 个选项, dm2 有 1 个选项
		if len(results) != 1 || (len(results) > 0 && results[0] != "dm1") {
			t.Errorf("期望 [dm1], 得到 %v", results)
		}
	})

	t.Run("length modifier equals zero", func(t *testing.T) {
		// 模拟: collaborators:length = 0

		query := `
			SELECT p.id, p.title
			FROM posts p
			WHERE jsonb_array_length(
				CASE WHEN jsonb_typeof(p.collaborators) = 'array' 
				THEN p.collaborators 
				ELSE jsonb_build_array(p.collaborators) END
			) = 0
			ORDER BY p.id
		`
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var results []string
		for rows.Next() {
			var id, title string
			if err := rows.Scan(&id, &title); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			results = append(results, id)
		}

		// post3 没有协作者
		if len(results) != 1 || (len(results) > 0 && results[0] != "post3") {
			t.Errorf("期望 [post3], 得到 %v", results)
		}
	})
}

// TestPostgres_RequestBodyArrayFields 测试 @request.body 数组字段
func TestPostgres_RequestBodyArrayFields(t *testing.T) {
	skipIfNoDockerAPIRules(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
		MaxWait: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("无法启动 PostgreSQL 容器: %v", err)
	}
	defer container.Close()

	ctx := context.Background()
	db := container.DB()

	t.Run("request body array with :each", func(t *testing.T) {
		// 模拟: @request.body.tags:each = 'tech'
		// 使用参数化查询

		tagsJSON := `["tech", "database", "go"]`

		query := `
			SELECT je.value
			FROM jsonb_array_elements_text($1::jsonb) AS je(value)
			WHERE je.value = 'tech'
		`
		rows, err := db.QueryContext(ctx, query, tagsJSON)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		defer rows.Close()

		var results []string
		for rows.Next() {
			var val string
			if err := rows.Scan(&val); err != nil {
				t.Fatalf("扫描结果失败: %v", err)
			}
			results = append(results, val)
		}

		if len(results) != 1 || (len(results) > 0 && results[0] != "tech") {
			t.Errorf("期望 ['tech'], 得到 %v", results)
		}
	})

	t.Run("request body array with :length", func(t *testing.T) {
		// 模拟: @request.body.tags:length > 2

		tagsJSON := `["tech", "database", "go"]`

		query := `SELECT jsonb_array_length($1::jsonb) > 2`
		var result bool
		err := db.QueryRowContext(ctx, query, tagsJSON).Scan(&result)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}

		if !result {
			t.Error("期望长度 > 2 为 true")
		}
	})
}
