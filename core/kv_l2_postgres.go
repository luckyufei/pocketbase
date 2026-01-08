package core

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// kvL2Postgres L2 数据库存储层
// 支持 PostgreSQL 和 SQLite
type kvL2Postgres struct {
	app App
}

// newKVL2Postgres 创建 L2 存储实例
func newKVL2Postgres(app App) *kvL2Postgres {
	return &kvL2Postgres{app: app}
}

// nowExpr 返回当前时间的 SQL 表达式
func (l2 *kvL2Postgres) nowExpr() string {
	if l2.app.IsPostgres() {
		return "NOW()"
	}
	return "datetime('now')"
}

// ==================== 基础操作 ====================

// Get 从数据库获取值
func (l2 *kvL2Postgres) Get(key string) (any, error) {
	var valueJSON string
	var query string

	if l2.app.IsPostgres() {
		query = `
			SELECT value FROM _kv
			WHERE key = {:key}
			  AND (expire_at IS NULL OR expire_at > NOW())
		`
	} else {
		query = `
			SELECT value FROM _kv
			WHERE key = {:key}
			  AND (expire_at IS NULL OR expire_at > datetime('now'))
		`
	}

	err := l2.app.DB().NewQuery(query).Bind(map[string]any{"key": key}).Row(&valueJSON)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrKVNotFound
		}
		return nil, err
	}

	// 解析 JSON
	var value any
	if err := json.Unmarshal([]byte(valueJSON), &value); err != nil {
		return nil, err
	}

	return value, nil
}

// Set 写入数据库（永不过期）
func (l2 *kvL2Postgres) Set(key string, value any) error {
	valueJSON, err := json.Marshal(value)
	if err != nil {
		return err
	}

	var query string
	if l2.app.IsPostgres() {
		query = `
			INSERT INTO _kv (key, value, updated)
			VALUES ({:key}, {:value}::jsonb, NOW())
			ON CONFLICT (key) DO UPDATE
			SET value = EXCLUDED.value, updated = NOW(), expire_at = NULL
		`
	} else {
		query = `
			INSERT INTO _kv (key, value, updated, expire_at)
			VALUES ({:key}, {:value}, datetime('now'), NULL)
			ON CONFLICT (key) DO UPDATE
			SET value = EXCLUDED.value, updated = datetime('now'), expire_at = NULL
		`
	}

	_, err = l2.app.DB().NewQuery(query).Bind(map[string]any{
		"key":   key,
		"value": string(valueJSON),
	}).Execute()

	return err
}

// SetEx 写入数据库（带过期时间）
func (l2 *kvL2Postgres) SetEx(key string, value any, ttl time.Duration) error {
	valueJSON, err := json.Marshal(value)
	if err != nil {
		return err
	}

	expireAt := time.Now().Add(ttl)

	var query string
	var expireAtStr string
	if l2.app.IsPostgres() {
		query = `
			INSERT INTO _kv (key, value, updated, expire_at)
			VALUES ({:key}, {:value}::jsonb, NOW(), {:expire_at})
			ON CONFLICT (key) DO UPDATE
			SET value = EXCLUDED.value, updated = NOW(), expire_at = EXCLUDED.expire_at
		`
		expireAtStr = expireAt.Format(time.RFC3339)
	} else {
		// SQLite: 使用与 datetime('now') 兼容的格式
		query = `
			INSERT INTO _kv (key, value, updated, expire_at)
			VALUES ({:key}, {:value}, datetime('now'), {:expire_at})
			ON CONFLICT (key) DO UPDATE
			SET value = EXCLUDED.value, updated = datetime('now'), expire_at = EXCLUDED.expire_at
		`
		expireAtStr = expireAt.UTC().Format("2006-01-02 15:04:05")
	}

	_, err = l2.app.DB().NewQuery(query).Bind(map[string]any{
		"key":       key,
		"value":     string(valueJSON),
		"expire_at": expireAtStr,
	}).Execute()

	return err
}

// Delete 删除 Key
func (l2 *kvL2Postgres) Delete(key string) error {
	_, err := l2.app.DB().NewQuery(`
		DELETE FROM _kv WHERE key = {:key}
	`).Bind(map[string]any{"key": key}).Execute()

	return err
}

// Exists 检查 Key 是否存在
func (l2 *kvL2Postgres) Exists(key string) (bool, error) {
	var exists int
	var query string

	if l2.app.IsPostgres() {
		query = `
			SELECT 1 FROM _kv
			WHERE key = {:key}
			  AND (expire_at IS NULL OR expire_at > NOW())
			LIMIT 1
		`
	} else {
		query = `
			SELECT 1 FROM _kv
			WHERE key = {:key}
			  AND (expire_at IS NULL OR expire_at > datetime('now'))
			LIMIT 1
		`
	}

	err := l2.app.DB().NewQuery(query).Bind(map[string]any{"key": key}).Row(&exists)

	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

// ==================== TTL 操作 ====================

// TTL 获取剩余过期时间
func (l2 *kvL2Postgres) TTL(key string) (time.Duration, error) {
	var expireAtStr sql.NullString
	var query string

	if l2.app.IsPostgres() {
		query = `
			SELECT expire_at::text FROM _kv
			WHERE key = {:key}
			  AND (expire_at IS NULL OR expire_at > NOW())
		`
	} else {
		query = `
			SELECT expire_at FROM _kv
			WHERE key = {:key}
			  AND (expire_at IS NULL OR expire_at > datetime('now'))
		`
	}

	err := l2.app.DB().NewQuery(query).Bind(map[string]any{"key": key}).Row(&expireAtStr)

	if err != nil {
		if err == sql.ErrNoRows {
			return 0, ErrKVNotFound
		}
		return 0, err
	}

	if !expireAtStr.Valid || expireAtStr.String == "" {
		return -1, nil // 永不过期
	}

	// 解析时间
	expireAt, err := time.Parse(time.RFC3339, expireAtStr.String)
	if err != nil {
		// 尝试 SQLite 格式 (UTC 时间)
		expireAt, err = time.ParseInLocation("2006-01-02 15:04:05", expireAtStr.String, time.UTC)
		if err != nil {
			return 0, err
		}
	}

	return time.Until(expireAt), nil
}

// Expire 更新过期时间
func (l2 *kvL2Postgres) Expire(key string, ttl time.Duration) error {
	expireAt := time.Now().Add(ttl)

	var query string
	var expireAtStr string
	if l2.app.IsPostgres() {
		query = `
			UPDATE _kv
			SET expire_at = {:expire_at}, updated = NOW()
			WHERE key = {:key}
		`
		expireAtStr = expireAt.Format(time.RFC3339)
	} else {
		query = `
			UPDATE _kv
			SET expire_at = {:expire_at}, updated = datetime('now')
			WHERE key = {:key}
		`
		// SQLite: 使用与 datetime('now') 兼容的 UTC 格式
		expireAtStr = expireAt.UTC().Format("2006-01-02 15:04:05")
	}

	result, err := l2.app.DB().NewQuery(query).Bind(map[string]any{
		"key":       key,
		"expire_at": expireAtStr,
	}).Execute()

	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrKVNotFound
	}

	return nil
}

// ==================== 计数器操作 ====================

// IncrBy 原子递增
func (l2 *kvL2Postgres) IncrBy(key string, delta int64) (int64, error) {
	var newValue int64

	if l2.app.IsPostgres() {
		// PostgreSQL: 使用 UPSERT 实现原子递增
		err := l2.app.DB().NewQuery(`
			INSERT INTO _kv (key, value, updated)
			VALUES ({:key}, to_jsonb({:delta}::bigint), NOW())
			ON CONFLICT (key) DO UPDATE
			SET value = to_jsonb(COALESCE((_kv.value)::text::bigint, 0) + {:delta}),
			    updated = NOW()
			RETURNING (value)::text::bigint
		`).Bind(map[string]any{
			"key":   key,
			"delta": delta,
		}).Row(&newValue)

		if err != nil {
			return 0, err
		}
	} else {
		// SQLite: 使用事务实现原子递增
		err := l2.app.RunInTransaction(func(txApp App) error {
			// 先尝试获取当前值
			var valueStr sql.NullString
			err := txApp.DB().NewQuery(`
				SELECT value FROM _kv WHERE key = {:key}
			`).Bind(map[string]any{"key": key}).Row(&valueStr)

			if err == sql.ErrNoRows {
				// Key 不存在，插入新值
				newValue = delta
				valueJSON, _ := json.Marshal(newValue)
				_, err = txApp.DB().NewQuery(`
					INSERT INTO _kv (key, value, updated)
					VALUES ({:key}, {:value}, datetime('now'))
				`).Bind(map[string]any{
					"key":   key,
					"value": string(valueJSON),
				}).Execute()
				return err
			} else if err != nil {
				return err
			}

			// 解析当前值
			var currentValue int64
			if valueStr.Valid {
				json.Unmarshal([]byte(valueStr.String), &currentValue)
			}

			newValue = currentValue + delta
			valueJSON, _ := json.Marshal(newValue)

			_, err = txApp.DB().NewQuery(`
				UPDATE _kv SET value = {:value}, updated = datetime('now')
				WHERE key = {:key}
			`).Bind(map[string]any{
				"key":   key,
				"value": string(valueJSON),
			}).Execute()

			return err
		})

		if err != nil {
			return 0, err
		}
	}

	return newValue, nil
}

// ==================== Hash 操作 ====================

// HSet 设置 Hash 字段
func (l2 *kvL2Postgres) HSet(key, field string, value any) error {
	valueJSON, err := json.Marshal(value)
	if err != nil {
		return err
	}

	if l2.app.IsPostgres() {
		_, err = l2.app.DB().NewQuery(`
			INSERT INTO _kv (key, value, updated)
			VALUES ({:key}, jsonb_build_object({:field}, {:value}::jsonb), NOW())
			ON CONFLICT (key) DO UPDATE
			SET value = _kv.value || jsonb_build_object({:field}, {:value}::jsonb),
			    updated = NOW()
		`).Bind(map[string]any{
			"key":   key,
			"field": field,
			"value": string(valueJSON),
		}).Execute()
	} else {
		// SQLite: 使用 json_set
		err = l2.app.RunInTransaction(func(txApp App) error {
			// 先获取当前值
			var currentJSON sql.NullString
			txApp.DB().NewQuery(`
				SELECT value FROM _kv WHERE key = {:key}
			`).Bind(map[string]any{"key": key}).Row(&currentJSON)

			var data map[string]any
			if currentJSON.Valid {
				json.Unmarshal([]byte(currentJSON.String), &data)
			}
			if data == nil {
				data = make(map[string]any)
			}

			// 解析 value
			var v any
			json.Unmarshal(valueJSON, &v)
			data[field] = v

			newJSON, _ := json.Marshal(data)

			_, err := txApp.DB().NewQuery(`
				INSERT INTO _kv (key, value, updated)
				VALUES ({:key}, {:value}, datetime('now'))
				ON CONFLICT (key) DO UPDATE
				SET value = EXCLUDED.value, updated = datetime('now')
			`).Bind(map[string]any{
				"key":   key,
				"value": string(newJSON),
			}).Execute()

			return err
		})
	}

	return err
}

// HGet 获取 Hash 字段
func (l2 *kvL2Postgres) HGet(key, field string) (any, error) {
	var valueJSON string
	var query string

	if l2.app.IsPostgres() {
		query = `
			SELECT value->{:field} FROM _kv
			WHERE key = {:key}
			  AND (expire_at IS NULL OR expire_at > NOW())
		`
		err := l2.app.DB().NewQuery(query).Bind(map[string]any{
			"key":   key,
			"field": field,
		}).Row(&valueJSON)

		if err != nil {
			if err == sql.ErrNoRows {
				return nil, ErrKVNotFound
			}
			return nil, err
		}
	} else {
		// SQLite: 先获取整个 JSON，再提取字段
		query = `
			SELECT value FROM _kv
			WHERE key = {:key}
			  AND (expire_at IS NULL OR expire_at > datetime('now'))
		`
		err := l2.app.DB().NewQuery(query).Bind(map[string]any{"key": key}).Row(&valueJSON)

		if err != nil {
			if err == sql.ErrNoRows {
				return nil, ErrKVNotFound
			}
			return nil, err
		}

		var data map[string]any
		if err := json.Unmarshal([]byte(valueJSON), &data); err != nil {
			return nil, err
		}

		v, ok := data[field]
		if !ok {
			return nil, ErrKVNotFound
		}
		return v, nil
	}

	if valueJSON == "" || valueJSON == "null" {
		return nil, ErrKVNotFound
	}

	var value any
	if err := json.Unmarshal([]byte(valueJSON), &value); err != nil {
		return nil, err
	}

	return value, nil
}

// HGetAll 获取 Hash 所有字段
func (l2 *kvL2Postgres) HGetAll(key string) (map[string]any, error) {
	var valueJSON string
	var query string

	if l2.app.IsPostgres() {
		query = `
			SELECT value FROM _kv
			WHERE key = {:key}
			  AND (expire_at IS NULL OR expire_at > NOW())
		`
	} else {
		query = `
			SELECT value FROM _kv
			WHERE key = {:key}
			  AND (expire_at IS NULL OR expire_at > datetime('now'))
		`
	}

	err := l2.app.DB().NewQuery(query).Bind(map[string]any{"key": key}).Row(&valueJSON)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrKVNotFound
		}
		return nil, err
	}

	var result map[string]any
	if err := json.Unmarshal([]byte(valueJSON), &result); err != nil {
		return nil, err
	}

	return result, nil
}

// HDel 删除 Hash 字段
func (l2 *kvL2Postgres) HDel(key string, fields ...string) error {
	if len(fields) == 0 {
		return nil
	}

	if l2.app.IsPostgres() {
		// PostgreSQL: 使用 - 操作符删除字段
		removeExpr := "value"
		for _, field := range fields {
			removeExpr += " - '" + field + "'"
		}

		_, err := l2.app.DB().NewQuery(`
			UPDATE _kv
			SET value = ` + removeExpr + `,
			    updated = NOW()
			WHERE key = {:key}
		`).Bind(map[string]any{"key": key}).Execute()

		return err
	}

	// SQLite: 先获取 JSON，删除字段后写回
	return l2.app.RunInTransaction(func(txApp App) error {
		var valueJSON string
		err := txApp.DB().NewQuery(`
			SELECT value FROM _kv WHERE key = {:key}
		`).Bind(map[string]any{"key": key}).Row(&valueJSON)

		if err != nil {
			return err
		}

		var data map[string]any
		if err := json.Unmarshal([]byte(valueJSON), &data); err != nil {
			return err
		}

		for _, field := range fields {
			delete(data, field)
		}

		newJSON, _ := json.Marshal(data)

		_, err = txApp.DB().NewQuery(`
			UPDATE _kv SET value = {:value}, updated = datetime('now')
			WHERE key = {:key}
		`).Bind(map[string]any{
			"key":   key,
			"value": string(newJSON),
		}).Execute()

		return err
	})
}

// HIncrBy Hash 字段原子递增
func (l2 *kvL2Postgres) HIncrBy(key, field string, delta int64) (int64, error) {
	var newValue int64

	if l2.app.IsPostgres() {
		err := l2.app.DB().NewQuery(`
			INSERT INTO _kv (key, value, updated)
			VALUES ({:key}, jsonb_build_object({:field}, {:delta}), NOW())
			ON CONFLICT (key) DO UPDATE
			SET value = _kv.value || jsonb_build_object({:field}, 
			    COALESCE((_kv.value->{:field})::text::bigint, 0) + {:delta}),
			    updated = NOW()
			RETURNING (value->{:field})::text::bigint
		`).Bind(map[string]any{
			"key":   key,
			"field": field,
			"delta": delta,
		}).Row(&newValue)

		if err != nil {
			return 0, err
		}
	} else {
		// SQLite: 使用事务
		err := l2.app.RunInTransaction(func(txApp App) error {
			var valueJSON sql.NullString
			txApp.DB().NewQuery(`
				SELECT value FROM _kv WHERE key = {:key}
			`).Bind(map[string]any{"key": key}).Row(&valueJSON)

			var data map[string]any
			if valueJSON.Valid {
				json.Unmarshal([]byte(valueJSON.String), &data)
			}
			if data == nil {
				data = make(map[string]any)
			}

			// 获取当前字段值
			var currentValue int64
			if v, ok := data[field]; ok {
				switch tv := v.(type) {
				case float64:
					currentValue = int64(tv)
				case int64:
					currentValue = tv
				}
			}

			newValue = currentValue + delta
			data[field] = newValue

			newJSON, _ := json.Marshal(data)

			_, err := txApp.DB().NewQuery(`
				INSERT INTO _kv (key, value, updated)
				VALUES ({:key}, {:value}, datetime('now'))
				ON CONFLICT (key) DO UPDATE
				SET value = EXCLUDED.value, updated = datetime('now')
			`).Bind(map[string]any{
				"key":   key,
				"value": string(newJSON),
			}).Execute()

			return err
		})

		if err != nil {
			return 0, err
		}
	}

	return newValue, nil
}

// ==================== 分布式锁 ====================

// Lock 尝试获取锁
func (l2 *kvL2Postgres) Lock(key, owner string, ttl time.Duration) (bool, error) {
	expireAt := time.Now().Add(ttl)
	ownerJSON, _ := json.Marshal(owner)

	// 先尝试删除过期的锁
	if l2.app.IsPostgres() {
		l2.app.DB().NewQuery(`
			DELETE FROM _kv WHERE key = {:key} AND expire_at < NOW()
		`).Bind(map[string]any{"key": key}).Execute()
	} else {
		l2.app.DB().NewQuery(`
			DELETE FROM _kv WHERE key = {:key} AND expire_at < datetime('now')
		`).Bind(map[string]any{"key": key}).Execute()
	}

	// 尝试插入锁
	var query string
	var expireAtStr string
	if l2.app.IsPostgres() {
		query = `
			INSERT INTO _kv (key, value, expire_at, updated)
			VALUES ({:key}, {:owner}::jsonb, {:expire_at}, NOW())
			ON CONFLICT (key) DO NOTHING
		`
		expireAtStr = expireAt.Format(time.RFC3339)
	} else {
		query = `
			INSERT INTO _kv (key, value, expire_at, updated)
			VALUES ({:key}, {:owner}, {:expire_at}, datetime('now'))
			ON CONFLICT (key) DO NOTHING
		`
		// SQLite: 使用与 datetime('now') 兼容的 UTC 格式
		expireAtStr = expireAt.UTC().Format("2006-01-02 15:04:05")
	}

	result, err := l2.app.DB().NewQuery(query).Bind(map[string]any{
		"key":       key,
		"owner":     string(ownerJSON),
		"expire_at": expireAtStr,
	}).Execute()

	if err != nil {
		return false, err
	}

	rowsAffected, _ := result.RowsAffected()
	return rowsAffected > 0, nil
}

// Unlock 释放锁
func (l2 *kvL2Postgres) Unlock(key, owner string) error {
	ownerJSON, _ := json.Marshal(owner)

	result, err := l2.app.DB().NewQuery(`
		DELETE FROM _kv
		WHERE key = {:key} AND value = {:owner}
	`).Bind(map[string]any{
		"key":   key,
		"owner": string(ownerJSON),
	}).Execute()

	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		// 锁不存在或不是持有者
		return ErrKVNotFound
	}

	return nil
}

// ==================== 批量操作 ====================

// MSet 批量设置
func (l2 *kvL2Postgres) MSet(pairs map[string]any) error {
	if len(pairs) == 0 {
		return nil
	}

	// 使用事务批量写入
	return l2.app.RunInTransaction(func(txApp App) error {
		for key, value := range pairs {
			valueJSON, err := json.Marshal(value)
			if err != nil {
				return err
			}

			var query string
			if txApp.IsPostgres() {
				query = `
					INSERT INTO _kv (key, value, updated)
					VALUES ({:key}, {:value}::jsonb, NOW())
					ON CONFLICT (key) DO UPDATE
					SET value = EXCLUDED.value, updated = NOW()
				`
			} else {
				query = `
					INSERT INTO _kv (key, value, updated)
					VALUES ({:key}, {:value}, datetime('now'))
					ON CONFLICT (key) DO UPDATE
					SET value = EXCLUDED.value, updated = datetime('now')
				`
			}

			_, err = txApp.DB().NewQuery(query).Bind(map[string]any{
				"key":   key,
				"value": string(valueJSON),
			}).Execute()

			if err != nil {
				return err
			}
		}
		return nil
	})
}

// MGet 批量获取
func (l2 *kvL2Postgres) MGet(keys ...string) (map[string]any, error) {
	if len(keys) == 0 {
		return map[string]any{}, nil
	}

	// 构建 IN 查询
	placeholders := make([]string, len(keys))
	params := map[string]any{}
	for i, key := range keys {
		placeholder := fmt.Sprintf("key%d", i)
		placeholders[i] = "{:" + placeholder + "}"
		params[placeholder] = key
	}

	var query string
	if l2.app.IsPostgres() {
		query = `
			SELECT key, value FROM _kv
			WHERE key IN (` + strings.Join(placeholders, ",") + `)
			  AND (expire_at IS NULL OR expire_at > NOW())
		`
	} else {
		query = `
			SELECT key, value FROM _kv
			WHERE key IN (` + strings.Join(placeholders, ",") + `)
			  AND (expire_at IS NULL OR expire_at > datetime('now'))
		`
	}

	rows, err := l2.app.DB().NewQuery(query).Bind(params).Rows()

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]any)
	for rows.Next() {
		var key string
		var valueJSON string
		if err := rows.Scan(&key, &valueJSON); err != nil {
			return nil, err
		}

		var value any
		if err := json.Unmarshal([]byte(valueJSON), &value); err != nil {
			continue
		}
		result[key] = value
	}

	return result, nil
}

// ==================== 其他操作 ====================

// Keys 按模式匹配查询
func (l2 *kvL2Postgres) Keys(pattern string) ([]string, error) {
	// 将 * 通配符转换为 SQL LIKE 模式
	likePattern := strings.ReplaceAll(pattern, "*", "%")

	var query string
	if l2.app.IsPostgres() {
		query = `
			SELECT key FROM _kv
			WHERE key LIKE {:pattern}
			  AND (expire_at IS NULL OR expire_at > NOW())
		`
	} else {
		query = `
			SELECT key FROM _kv
			WHERE key LIKE {:pattern}
			  AND (expire_at IS NULL OR expire_at > datetime('now'))
		`
	}

	rows, err := l2.app.DB().NewQuery(query).Bind(map[string]any{"pattern": likePattern}).Rows()

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []string
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, err
		}
		keys = append(keys, key)
	}

	return keys, nil
}

// ==================== 过期清理 ====================

// CleanupExpired 清理过期数据
func (l2 *kvL2Postgres) CleanupExpired() error {
	var query string
	if l2.app.IsPostgres() {
		query = `DELETE FROM _kv WHERE expire_at < NOW()`
	} else {
		query = `DELETE FROM _kv WHERE expire_at < datetime('now')`
	}

	_, err := l2.app.DB().NewQuery(query).Execute()
	return err
}
