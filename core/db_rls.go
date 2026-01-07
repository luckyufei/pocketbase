package core

import (
	"context"
	"fmt"
	"regexp"
	"strings"
)

// ============================================================================
// STORY-4.1: 会话上下文注入
// ============================================================================

// sessionContextKey 会话上下文键
type sessionContextKey struct{}

// SessionContext 会话上下文
type SessionContext struct {
	AuthID       string            // 用户 ID
	AuthRole     string            // 用户角色
	CustomClaims map[string]string // 自定义声明
}

// WithSessionContext 将会话上下文注入到 context.Context
func WithSessionContext(ctx context.Context, session *SessionContext) context.Context {
	return context.WithValue(ctx, sessionContextKey{}, session)
}

// GetSessionContext 从 context.Context 获取会话上下文
func GetSessionContext(ctx context.Context) *SessionContext {
	session, _ := ctx.Value(sessionContextKey{}).(*SessionContext)
	return session
}

// SetConfigSQL 生成设置会话配置的 SQL
func (s *SessionContext) SetConfigSQL() string {
	var parts []string

	// 设置 pb.auth.id
	parts = append(parts, fmt.Sprintf("SELECT set_config('pb.auth.id', '%s', true)", escapeSQL(s.AuthID)))

	// 设置 pb.auth.role
	parts = append(parts, fmt.Sprintf("SELECT set_config('pb.auth.role', '%s', true)", escapeSQL(s.AuthRole)))

	// 设置自定义声明
	for key, value := range s.CustomClaims {
		parts = append(parts, fmt.Sprintf("SELECT set_config('pb.claim.%s', '%s', true)", escapeSQL(key), escapeSQL(value)))
	}

	return strings.Join(parts, "; ")
}

// ClearSessionSQL 生成清除会话配置的 SQL
func ClearSessionSQL() string {
	return "SELECT set_config('pb.auth.id', '', true); SELECT set_config('pb.auth.role', '', true)"
}

// GetCurrentSessionSQL 生成获取当前会话的 SQL
func GetCurrentSessionSQL() string {
	return "SELECT current_setting('pb.auth.id', true) AS auth_id, current_setting('pb.auth.role', true) AS auth_role"
}

// escapeSQL 转义 SQL 字符串
func escapeSQL(s string) string {
	return strings.ReplaceAll(s, "'", "''")
}

// SessionInjector 会话注入器
type SessionInjector struct{}

// NewSessionInjector 创建会话注入器
func NewSessionInjector() *SessionInjector {
	return &SessionInjector{}
}

// InjectSQL 生成注入会话的 SQL 和参数
func (si *SessionInjector) InjectSQL(session *SessionContext) (string, []interface{}) {
	sql := "SELECT set_config($1, $2, true), set_config($3, $4, true)"
	args := []interface{}{
		"pb.auth.id", session.AuthID,
		"pb.auth.role", session.AuthRole,
	}
	return sql, args
}

// ============================================================================
// STORY-4.2: 规则编译器基础
// ============================================================================

// RuleType 规则类型
type RuleType int

const (
	RuleTypeAllow     RuleType = iota // 允许 (空规则或 true)
	RuleTypeDeny                      // 拒绝 (false)
	RuleTypeCondition                 // 条件表达式
	RuleTypeVariable                  // 变量引用
	RuleTypeLiteral                   // 字面量
)

// RuleAST 规则抽象语法树
type RuleAST struct {
	Type       RuleType
	Expression string
	Left       *RuleAST
	Right      *RuleAST
	Operator   string
	Children   []*RuleAST
}

// HasAuthReference 检查是否包含 auth 引用
func (ast *RuleAST) HasAuthReference() bool {
	if ast == nil {
		return false
	}
	if strings.Contains(ast.Expression, "@request.auth") {
		return true
	}
	if ast.Left != nil && ast.Left.HasAuthReference() {
		return true
	}
	if ast.Right != nil && ast.Right.HasAuthReference() {
		return true
	}
	for _, child := range ast.Children {
		if child.HasAuthReference() {
			return true
		}
	}
	return false
}

// HasCollectionReference 检查是否包含 collection 引用
func (ast *RuleAST) HasCollectionReference() bool {
	if ast == nil {
		return false
	}
	if strings.Contains(ast.Expression, "@collection.") {
		return true
	}
	if ast.Left != nil && ast.Left.HasCollectionReference() {
		return true
	}
	if ast.Right != nil && ast.Right.HasCollectionReference() {
		return true
	}
	for _, child := range ast.Children {
		if child.HasCollectionReference() {
			return true
		}
	}
	return false
}

// RuleParser 规则解析器
type RuleParser struct {
	authPattern       *regexp.Regexp
	collectionPattern *regexp.Regexp
}

// NewRuleParser 创建规则解析器
func NewRuleParser() *RuleParser {
	return &RuleParser{
		authPattern:       regexp.MustCompile(`@request\.auth\.(\w+)`),
		collectionPattern: regexp.MustCompile(`@collection\.(\w+)\.(\w+(?:\.\w+)*)`),
	}
}

// Parse 解析规则字符串
func (p *RuleParser) Parse(rule string) (*RuleAST, error) {
	rule = strings.TrimSpace(rule)

	// 空规则 = 允许
	if rule == "" {
		return &RuleAST{Type: RuleTypeAllow, Expression: ""}, nil
	}

	// 字面量规则
	if rule == "true" {
		return &RuleAST{Type: RuleTypeAllow, Expression: "true"}, nil
	}
	if rule == "false" {
		return &RuleAST{Type: RuleTypeDeny, Expression: "false"}, nil
	}

	// 复合规则 (&&)
	if strings.Contains(rule, "&&") {
		parts := strings.SplitN(rule, "&&", 2)
		left, err := p.Parse(strings.TrimSpace(parts[0]))
		if err != nil {
			return nil, err
		}
		right, err := p.Parse(strings.TrimSpace(parts[1]))
		if err != nil {
			return nil, err
		}
		return &RuleAST{
			Type:       RuleTypeCondition,
			Expression: rule,
			Left:       left,
			Right:      right,
			Operator:   "&&",
		}, nil
	}

	// 复合规则 (||)
	if strings.Contains(rule, "||") {
		parts := strings.SplitN(rule, "||", 2)
		left, err := p.Parse(strings.TrimSpace(parts[0]))
		if err != nil {
			return nil, err
		}
		right, err := p.Parse(strings.TrimSpace(parts[1]))
		if err != nil {
			return nil, err
		}
		return &RuleAST{
			Type:       RuleTypeCondition,
			Expression: rule,
			Left:       left,
			Right:      right,
			Operator:   "||",
		}, nil
	}

	// 条件表达式
	return &RuleAST{
		Type:       RuleTypeCondition,
		Expression: rule,
	}, nil
}

// RuleCompiler 规则编译器
type RuleCompiler struct {
	authPattern *regexp.Regexp
}

// NewRuleCompiler 创建规则编译器
func NewRuleCompiler() *RuleCompiler {
	return &RuleCompiler{
		authPattern: regexp.MustCompile(`@request\.auth\.(\w+)`),
	}
}

// Compile 编译规则 AST 为 PostgreSQL 表达式
func (c *RuleCompiler) Compile(ast *RuleAST) (string, error) {
	if ast == nil {
		return "true", nil
	}

	switch ast.Type {
	case RuleTypeAllow:
		return "true", nil
	case RuleTypeDeny:
		return "false", nil
	case RuleTypeCondition:
		return c.compileCondition(ast)
	case RuleTypeVariable:
		return c.compileVariable(ast.Expression)
	case RuleTypeLiteral:
		return ast.Expression, nil
	default:
		return "", fmt.Errorf("未知的规则类型: %d", ast.Type)
	}
}

func (c *RuleCompiler) compileCondition(ast *RuleAST) (string, error) {
	// 如果有左右子节点，递归编译
	if ast.Left != nil && ast.Right != nil {
		left, err := c.Compile(ast.Left)
		if err != nil {
			return "", err
		}
		right, err := c.Compile(ast.Right)
		if err != nil {
			return "", err
		}

		op := ast.Operator
		if op == "&&" {
			op = "AND"
		} else if op == "||" {
			op = "OR"
		}

		return fmt.Sprintf("(%s %s %s)", left, op, right), nil
	}

	// 转换表达式中的变量引用
	expr := ast.Expression

	// 转换 @request.auth.* 为 current_setting
	expr = c.authPattern.ReplaceAllStringFunc(expr, func(match string) string {
		parts := c.authPattern.FindStringSubmatch(match)
		if len(parts) >= 2 {
			field := parts[1]
			return fmt.Sprintf("current_setting('pb.auth.%s', true)", field)
		}
		return match
	})

	// 转换比较操作符
	expr = strings.ReplaceAll(expr, "!=", "<>")
	expr = strings.ReplaceAll(expr, "=", "=")

	return expr, nil
}

func (c *RuleCompiler) compileVariable(expr string) (string, error) {
	if strings.HasPrefix(expr, "@request.auth.") {
		field := strings.TrimPrefix(expr, "@request.auth.")
		return fmt.Sprintf("current_setting('pb.auth.%s', true)", field), nil
	}
	return expr, nil
}

// ============================================================================
// 策略生成器
// ============================================================================

// PolicyOperation 策略操作类型
type PolicyOperation string

const (
	PolicySelect PolicyOperation = "SELECT"
	PolicyInsert PolicyOperation = "INSERT"
	PolicyUpdate PolicyOperation = "UPDATE"
	PolicyDelete PolicyOperation = "DELETE"
	PolicyAll    PolicyOperation = "ALL"
)

// PolicyConfig 策略配置
type PolicyConfig struct {
	Name       string
	TableName  string
	Operation  PolicyOperation
	Expression string
	WithCheck  string // INSERT/UPDATE 时的 WITH CHECK 表达式
}

// RLSConfig RLS 配置
type RLSConfig struct {
	TableName string
	Policies  []*PolicyConfig
}

// PolicyGenerator 策略生成器
type PolicyGenerator struct{}

// NewPolicyGenerator 创建策略生成器
func NewPolicyGenerator() *PolicyGenerator {
	return &PolicyGenerator{}
}

// GenerateCreatePolicy 生成 CREATE POLICY 语句
func (g *PolicyGenerator) GenerateCreatePolicy(policy *PolicyConfig) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("CREATE POLICY %s ON %s", policy.Name, policy.TableName))

	if policy.Operation != "" {
		sb.WriteString(fmt.Sprintf(" FOR %s", policy.Operation))
	}

	// INSERT 只能使用 WITH CHECK，不能使用 USING
	if policy.Operation == PolicyInsert {
		sb.WriteString(fmt.Sprintf(" WITH CHECK (%s)", policy.Expression))
	} else {
		sb.WriteString(fmt.Sprintf(" USING (%s)", policy.Expression))
		if policy.WithCheck != "" && policy.Operation == PolicyUpdate {
			sb.WriteString(fmt.Sprintf(" WITH CHECK (%s)", policy.WithCheck))
		}
	}

	return sb.String()
}

// GenerateDropPolicy 生成 DROP POLICY 语句
func (g *PolicyGenerator) GenerateDropPolicy(policyName, tableName string) string {
	return fmt.Sprintf("DROP POLICY IF EXISTS %s ON %s", policyName, tableName)
}

// GenerateEnableRLS 生成 ENABLE RLS 语句
func (g *PolicyGenerator) GenerateEnableRLS(tableName string) string {
	return fmt.Sprintf("ALTER TABLE %s ENABLE ROW LEVEL SECURITY", tableName)
}

// GenerateDisableRLS 生成 DISABLE RLS 语句
func (g *PolicyGenerator) GenerateDisableRLS(tableName string) string {
	return fmt.Sprintf("ALTER TABLE %s DISABLE ROW LEVEL SECURITY", tableName)
}

// GenerateForceRLS 生成 FORCE RLS 语句 (对表所有者也生效)
func (g *PolicyGenerator) GenerateForceRLS(tableName string) string {
	return fmt.Sprintf("ALTER TABLE %s FORCE ROW LEVEL SECURITY", tableName)
}

// GenerateFullRLSConfig 生成完整的 RLS 配置
func (g *PolicyGenerator) GenerateFullRLSConfig(config *RLSConfig) []string {
	var sqls []string

	// 启用 RLS
	sqls = append(sqls, g.GenerateEnableRLS(config.TableName))

	// 创建策略
	for _, policy := range config.Policies {
		policy.TableName = config.TableName
		sqls = append(sqls, g.GenerateCreatePolicy(policy))
	}

	return sqls
}

// ============================================================================
// STORY-4.3: 跨集合规则转换
// ============================================================================

// CollectionReference 集合引用
type CollectionReference struct {
	Collection   string // 集合名称
	Field        string // 字段名称
	RelatedField string // 关联字段 (用于嵌套关系)
	RelatedTable string // 关联表名
	Value        string // 比较值
}

// ExistsQueryGenerator EXISTS 子查询生成器
type ExistsQueryGenerator struct{}

// NewExistsQueryGenerator 创建 EXISTS 子查询生成器
func NewExistsQueryGenerator() *ExistsQueryGenerator {
	return &ExistsQueryGenerator{}
}

// Generate 生成 EXISTS 子查询
func (g *ExistsQueryGenerator) Generate(ref *CollectionReference) string {
	if ref.RelatedTable != "" {
		// 关系字段查询
		return fmt.Sprintf(`EXISTS (
    SELECT 1 FROM %s c
    JOIN %s r ON c.%s = r.id
    WHERE r.%s = %s
)`, ref.Collection, ref.RelatedTable, ref.Field, ref.RelatedField, ref.Value)
	}

	// 简单查询
	return fmt.Sprintf(`EXISTS (
    SELECT 1 FROM %s
    WHERE %s = %s
)`, ref.Collection, ref.Field, ref.Value)
}

// ============================================================================
// RLS 管理器
// ============================================================================

// RLSManager RLS 管理器
type RLSManager struct {
	parser    *RuleParser
	compiler  *RuleCompiler
	generator *PolicyGenerator
	existsGen *ExistsQueryGenerator
}

// NewRLSManager 创建 RLS 管理器
func NewRLSManager() *RLSManager {
	return &RLSManager{
		parser:    NewRuleParser(),
		compiler:  NewRuleCompiler(),
		generator: NewPolicyGenerator(),
		existsGen: NewExistsQueryGenerator(),
	}
}

// CompileRule 编译 PocketBase 规则为 PostgreSQL 表达式
func (m *RLSManager) CompileRule(rule string) (string, error) {
	ast, err := m.parser.Parse(rule)
	if err != nil {
		return "", fmt.Errorf("解析规则失败: %w", err)
	}

	return m.compiler.Compile(ast)
}

// GeneratePolicy 为集合生成 RLS 策略
func (m *RLSManager) GeneratePolicy(tableName, policyName string, operation PolicyOperation, rule string) (string, error) {
	expression, err := m.CompileRule(rule)
	if err != nil {
		return "", err
	}

	policy := &PolicyConfig{
		Name:       policyName,
		TableName:  tableName,
		Operation:  operation,
		Expression: expression,
	}

	return m.generator.GenerateCreatePolicy(policy), nil
}

// GenerateCollectionRLS 为集合生成完整的 RLS 配置
func (m *RLSManager) GenerateCollectionRLS(tableName string, viewRule, createRule, updateRule, deleteRule string) ([]string, error) {
	var sqls []string

	// 启用 RLS
	sqls = append(sqls, m.generator.GenerateEnableRLS(tableName))

	// 生成各操作的策略
	if viewRule != "" {
		sql, err := m.GeneratePolicy(tableName, tableName+"_view", PolicySelect, viewRule)
		if err != nil {
			return nil, fmt.Errorf("生成 view 策略失败: %w", err)
		}
		sqls = append(sqls, sql)
	}

	if createRule != "" {
		sql, err := m.GeneratePolicy(tableName, tableName+"_create", PolicyInsert, createRule)
		if err != nil {
			return nil, fmt.Errorf("生成 create 策略失败: %w", err)
		}
		sqls = append(sqls, sql)
	}

	if updateRule != "" {
		sql, err := m.GeneratePolicy(tableName, tableName+"_update", PolicyUpdate, updateRule)
		if err != nil {
			return nil, fmt.Errorf("生成 update 策略失败: %w", err)
		}
		sqls = append(sqls, sql)
	}

	if deleteRule != "" {
		sql, err := m.GeneratePolicy(tableName, tableName+"_delete", PolicyDelete, deleteRule)
		if err != nil {
			return nil, fmt.Errorf("生成 delete 策略失败: %w", err)
		}
		sqls = append(sqls, sql)
	}

	return sqls, nil
}
