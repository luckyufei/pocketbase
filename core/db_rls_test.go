package core

import (
	"context"
	"testing"
)

// ============================================================================
// STORY-4.1: 会话上下文注入测试
// ============================================================================

// TestSessionContext 测试会话上下文
func TestSessionContext(t *testing.T) {
	t.Run("创建会话上下文", func(t *testing.T) {
		ctx := &SessionContext{
			AuthID:   "user-123",
			AuthRole: "user",
		}

		if ctx.AuthID == "" {
			t.Error("AuthID 不应为空")
		}
		if ctx.AuthRole == "" {
			t.Error("AuthRole 不应为空")
		}
	})

	t.Run("从 context.Context 获取会话", func(t *testing.T) {
		session := &SessionContext{
			AuthID:   "user-456",
			AuthRole: "admin",
		}

		ctx := context.Background()
		ctx = WithSessionContext(ctx, session)

		retrieved := GetSessionContext(ctx)
		if retrieved == nil {
			t.Fatal("应该能获取会话上下文")
		}
		if retrieved.AuthID != session.AuthID {
			t.Errorf("AuthID 期望 %s, 实际 %s", session.AuthID, retrieved.AuthID)
		}
		if retrieved.AuthRole != session.AuthRole {
			t.Errorf("AuthRole 期望 %s, 实际 %s", session.AuthRole, retrieved.AuthRole)
		}
	})

	t.Run("空上下文返回 nil", func(t *testing.T) {
		ctx := context.Background()
		session := GetSessionContext(ctx)
		if session != nil {
			t.Error("空上下文应该返回 nil")
		}
	})
}

// TestSessionContextSQL 测试会话上下文 SQL 生成
func TestSessionContextSQL(t *testing.T) {
	t.Run("生成 set_config SQL", func(t *testing.T) {
		session := &SessionContext{
			AuthID:   "user-123",
			AuthRole: "user",
		}

		sql := session.SetConfigSQL()
		if sql == "" {
			t.Error("SQL 不应为空")
		}

		// 验证 SQL 包含必要元素
		if !containsAll(sql, "set_config", "pb.auth.id", "pb.auth.role") {
			t.Errorf("SQL 应包含 set_config 和会话变量: %s", sql)
		}
	})

	t.Run("生成清除会话 SQL", func(t *testing.T) {
		sql := ClearSessionSQL()
		if sql == "" {
			t.Error("清除会话 SQL 不应为空")
		}

		if !containsAll(sql, "set_config", "pb.auth.id", "pb.auth.role") {
			t.Errorf("清除会话 SQL 应包含 set_config: %s", sql)
		}
	})

	t.Run("获取当前会话 SQL", func(t *testing.T) {
		sql := GetCurrentSessionSQL()
		if sql == "" {
			t.Error("获取会话 SQL 不应为空")
		}

		if !containsAll(sql, "current_setting", "pb.auth.id") {
			t.Errorf("获取会话 SQL 应包含 current_setting: %s", sql)
		}
	})
}

// TestSessionInjector 测试会话注入器
func TestSessionInjector(t *testing.T) {
	t.Run("创建注入器", func(t *testing.T) {
		injector := NewSessionInjector()
		if injector == nil {
			t.Fatal("注入器不应为 nil")
		}
	})

	t.Run("注入会话", func(t *testing.T) {
		injector := NewSessionInjector()

		session := &SessionContext{
			AuthID:   "user-789",
			AuthRole: "editor",
		}

		// 模拟注入 (不实际执行 SQL)
		sql, args := injector.InjectSQL(session)
		if sql == "" {
			t.Error("注入 SQL 不应为空")
		}
		if len(args) < 2 {
			t.Error("应该有至少 2 个参数")
		}
	})
}

// ============================================================================
// STORY-4.2: 规则编译器基础测试
// ============================================================================

// TestRuleParser 测试规则解析器
func TestRuleParser(t *testing.T) {
	t.Run("解析空规则", func(t *testing.T) {
		parser := NewRuleParser()

		ast, err := parser.Parse("")
		if err != nil {
			t.Errorf("解析空规则不应报错: %v", err)
		}
		if ast == nil {
			t.Error("AST 不应为 nil")
		}
		if ast.Type != RuleTypeAllow {
			t.Error("空规则应该是 Allow 类型")
		}
	})

	t.Run("解析 @request.auth.id 规则", func(t *testing.T) {
		parser := NewRuleParser()

		rule := "@request.auth.id != ''"
		ast, err := parser.Parse(rule)
		if err != nil {
			t.Fatalf("解析规则失败: %v", err)
		}

		if ast.Type != RuleTypeCondition {
			t.Error("应该是条件类型")
		}
		if !ast.HasAuthReference() {
			t.Error("应该包含 auth 引用")
		}
	})

	t.Run("解析 @request.auth.role 规则", func(t *testing.T) {
		parser := NewRuleParser()

		rule := "@request.auth.role = 'admin'"
		ast, err := parser.Parse(rule)
		if err != nil {
			t.Fatalf("解析规则失败: %v", err)
		}

		if !ast.HasAuthReference() {
			t.Error("应该包含 auth 引用")
		}
	})

	t.Run("解析字面量规则", func(t *testing.T) {
		parser := NewRuleParser()

		// 测试 true
		ast, err := parser.Parse("true")
		if err != nil {
			t.Fatalf("解析 true 失败: %v", err)
		}
		if ast.Type != RuleTypeAllow {
			t.Error("true 应该是 Allow 类型")
		}

		// 测试 false
		ast, err = parser.Parse("false")
		if err != nil {
			t.Fatalf("解析 false 失败: %v", err)
		}
		if ast.Type != RuleTypeDeny {
			t.Error("false 应该是 Deny 类型")
		}
	})

	t.Run("解析复合规则", func(t *testing.T) {
		parser := NewRuleParser()

		rule := "@request.auth.id != '' && @request.auth.role = 'admin'"
		ast, err := parser.Parse(rule)
		if err != nil {
			t.Fatalf("解析复合规则失败: %v", err)
		}

		if ast.Type != RuleTypeCondition {
			t.Error("应该是条件类型")
		}
		if ast.Operator != "&&" {
			t.Errorf("操作符期望 &&, 实际 %s", ast.Operator)
		}
	})
}

// TestRuleCompiler 测试规则编译器
func TestRuleCompiler(t *testing.T) {
	t.Run("编译 @request.auth.id 转换", func(t *testing.T) {
		compiler := NewRuleCompiler()

		ast := &RuleAST{
			Type:       RuleTypeCondition,
			Expression: "@request.auth.id != ''",
			Left: &RuleAST{
				Type:       RuleTypeVariable,
				Expression: "@request.auth.id",
			},
			Operator: "!=",
			Right: &RuleAST{
				Type:       RuleTypeLiteral,
				Expression: "''",
			},
		}

		sql, err := compiler.Compile(ast)
		if err != nil {
			t.Fatalf("编译失败: %v", err)
		}

		// 验证转换为 current_setting
		if !containsAll(sql, "current_setting", "pb.auth.id") {
			t.Errorf("应该转换为 current_setting: %s", sql)
		}
	})

	t.Run("编译字面量规则", func(t *testing.T) {
		compiler := NewRuleCompiler()

		// true
		ast := &RuleAST{Type: RuleTypeAllow}
		sql, err := compiler.Compile(ast)
		if err != nil {
			t.Fatalf("编译 true 失败: %v", err)
		}
		if sql != "true" {
			t.Errorf("true 规则应编译为 'true', 实际: %s", sql)
		}

		// false
		ast = &RuleAST{Type: RuleTypeDeny}
		sql, err = compiler.Compile(ast)
		if err != nil {
			t.Fatalf("编译 false 失败: %v", err)
		}
		if sql != "false" {
			t.Errorf("false 规则应编译为 'false', 实际: %s", sql)
		}
	})
}

// TestPolicyGenerator 测试策略生成器
func TestPolicyGenerator(t *testing.T) {
	t.Run("生成 CREATE POLICY 语句", func(t *testing.T) {
		gen := NewPolicyGenerator()

		policy := &PolicyConfig{
			Name:       "users_view_policy",
			TableName:  "users",
			Operation:  PolicySelect,
			Expression: "current_setting('pb.auth.id', true) = user_id",
		}

		sql := gen.GenerateCreatePolicy(policy)
		if sql == "" {
			t.Error("CREATE POLICY SQL 不应为空")
		}

		if !containsAll(sql, "CREATE POLICY", "users_view_policy", "ON", "users", "FOR SELECT", "USING") {
			t.Errorf("CREATE POLICY SQL 格式不正确: %s", sql)
		}
	})

	t.Run("生成 DROP POLICY 语句", func(t *testing.T) {
		gen := NewPolicyGenerator()

		sql := gen.GenerateDropPolicy("users_view_policy", "users")
		if sql == "" {
			t.Error("DROP POLICY SQL 不应为空")
		}

		if !containsAll(sql, "DROP POLICY", "IF EXISTS", "users_view_policy", "ON", "users") {
			t.Errorf("DROP POLICY SQL 格式不正确: %s", sql)
		}
	})

	t.Run("生成 ALTER TABLE ENABLE RLS 语句", func(t *testing.T) {
		gen := NewPolicyGenerator()

		sql := gen.GenerateEnableRLS("users")
		if sql == "" {
			t.Error("ENABLE RLS SQL 不应为空")
		}

		if !containsAll(sql, "ALTER TABLE", "users", "ENABLE ROW LEVEL SECURITY") {
			t.Errorf("ENABLE RLS SQL 格式不正确: %s", sql)
		}
	})

	t.Run("生成完整的 RLS 配置", func(t *testing.T) {
		gen := NewPolicyGenerator()

		config := &RLSConfig{
			TableName: "posts",
			Policies: []*PolicyConfig{
				{
					Name:       "posts_view",
					Operation:  PolicySelect,
					Expression: "true",
				},
				{
					Name:       "posts_insert",
					Operation:  PolicyInsert,
					Expression: "current_setting('pb.auth.id', true) != ''",
				},
				{
					Name:       "posts_update",
					Operation:  PolicyUpdate,
					Expression: "current_setting('pb.auth.id', true) = author_id",
				},
				{
					Name:       "posts_delete",
					Operation:  PolicyDelete,
					Expression: "current_setting('pb.auth.id', true) = author_id",
				},
			},
		}

		sqls := gen.GenerateFullRLSConfig(config)
		if len(sqls) < 5 { // 1 ENABLE RLS + 4 policies
			t.Errorf("应该生成至少 5 条 SQL, 实际 %d", len(sqls))
		}
	})
}

// ============================================================================
// STORY-4.3: 跨集合规则转换测试
// ============================================================================

// TestCollectionRuleParser 测试跨集合规则解析
func TestCollectionRuleParser(t *testing.T) {
	t.Run("解析 @collection 语法", func(t *testing.T) {
		parser := NewRuleParser()

		rule := "@collection.posts.author = @request.auth.id"
		ast, err := parser.Parse(rule)
		if err != nil {
			t.Fatalf("解析跨集合规则失败: %v", err)
		}

		if !ast.HasCollectionReference() {
			t.Error("应该包含 collection 引用")
		}
	})

	t.Run("解析嵌套关系", func(t *testing.T) {
		parser := NewRuleParser()

		rule := "@collection.comments.post.author = @request.auth.id"
		ast, err := parser.Parse(rule)
		if err != nil {
			t.Fatalf("解析嵌套关系规则失败: %v", err)
		}

		if !ast.HasCollectionReference() {
			t.Error("应该包含 collection 引用")
		}
	})
}

// TestExistsQueryGenerator 测试 EXISTS 子查询生成
func TestExistsQueryGenerator(t *testing.T) {
	t.Run("生成简单 EXISTS 子查询", func(t *testing.T) {
		gen := NewExistsQueryGenerator()

		ref := &CollectionReference{
			Collection: "posts",
			Field:      "author",
			Value:      "current_setting('pb.auth.id', true)",
		}

		sql := gen.Generate(ref)
		if sql == "" {
			t.Error("EXISTS 子查询不应为空")
		}

		if !containsAll(sql, "EXISTS", "SELECT 1", "FROM", "posts", "WHERE") {
			t.Errorf("EXISTS 子查询格式不正确: %s", sql)
		}
	})

	t.Run("生成关系字段 EXISTS 子查询", func(t *testing.T) {
		gen := NewExistsQueryGenerator()

		ref := &CollectionReference{
			Collection:    "comments",
			Field:         "post",
			RelatedField:  "author",
			Value:         "current_setting('pb.auth.id', true)",
			RelatedTable:  "posts",
		}

		sql := gen.Generate(ref)
		if sql == "" {
			t.Error("关系字段 EXISTS 子查询不应为空")
		}

		if !containsAll(sql, "EXISTS", "JOIN", "posts") {
			t.Errorf("关系字段 EXISTS 子查询应包含 JOIN: %s", sql)
		}
	})
}

// TestRLSIntegration 测试 RLS 集成
func TestRLSIntegration(t *testing.T) {
	t.Run("完整规则转换流程", func(t *testing.T) {
		// 解析规则
		parser := NewRuleParser()
		rule := "@request.auth.id != '' && user_id = @request.auth.id"
		ast, err := parser.Parse(rule)
		if err != nil {
			t.Fatalf("解析规则失败: %v", err)
		}

		// 编译规则
		compiler := NewRuleCompiler()
		expression, err := compiler.Compile(ast)
		if err != nil {
			t.Fatalf("编译规则失败: %v", err)
		}

		// 生成策略
		gen := NewPolicyGenerator()
		policy := &PolicyConfig{
			Name:       "test_policy",
			TableName:  "test_table",
			Operation:  PolicySelect,
			Expression: expression,
		}

		sql := gen.GenerateCreatePolicy(policy)
		if sql == "" {
			t.Error("生成策略 SQL 失败")
		}

		t.Logf("生成的策略 SQL: %s", sql)
	})
}

// TestConnectionReuse 测试连接复用安全
func TestConnectionReuse(t *testing.T) {
	t.Run("会话上下文隔离", func(t *testing.T) {
		// 模拟两个不同用户的会话
		session1 := &SessionContext{
			AuthID:   "user-1",
			AuthRole: "user",
		}
		session2 := &SessionContext{
			AuthID:   "user-2",
			AuthRole: "admin",
		}

		// 验证 SQL 不同
		sql1 := session1.SetConfigSQL()
		sql2 := session2.SetConfigSQL()

		if sql1 == sql2 {
			t.Error("不同用户的会话 SQL 应该不同")
		}
	})
}
