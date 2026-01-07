package benchmarks

import (
	"database/sql"
	"fmt"
	"math/rand"
	"strings"
	"time"
)

// DataGenerator 测试数据生成器
type DataGenerator struct {
	db     Database
	config ScaleConfig
	rng    *rand.Rand
}

// NewDataGenerator 创建数据生成器
func NewDataGenerator(db Database, config ScaleConfig, seed int64) *DataGenerator {
	return &DataGenerator{
		db:     db,
		config: config,
		rng:    rand.New(rand.NewSource(seed)),
	}
}

// Generate 生成测试数据
func (g *DataGenerator) Generate(verbose bool) error {
	if verbose {
		fmt.Println("生成测试数据...")
	}

	// 生成用户
	if err := g.generateUsers(verbose); err != nil {
		return fmt.Errorf("failed to generate users: %w", err)
	}

	// 生成文章
	if err := g.generateArticles(verbose); err != nil {
		return fmt.Errorf("failed to generate articles: %w", err)
	}

	// 生成评论
	if err := g.generateComments(verbose); err != nil {
		return fmt.Errorf("failed to generate comments: %w", err)
	}

	// 生成文件
	if err := g.generateFiles(verbose); err != nil {
		return fmt.Errorf("failed to generate files: %w", err)
	}

	if verbose {
		fmt.Printf("数据生成完成: %d 用户, %d 文章, %d 评论, %d 文件\n",
			g.config.Users, g.config.Articles, g.config.Comments, g.config.Files)
	}

	return nil
}

func (g *DataGenerator) generateUsers(verbose bool) error {
	if verbose {
		fmt.Printf("生成 %d 用户...\n", g.config.Users)
	}

	db := g.db.DB()
	batchSize := 1000
	
	for i := 0; i < g.config.Users; i += batchSize {
		end := i + batchSize
		if end > g.config.Users {
			end = g.config.Users
		}

		tx, err := db.Begin()
		if err != nil {
			return err
		}

		stmt, err := tx.Prepare(g.getUserInsertSQL())
		if err != nil {
			tx.Rollback()
			return err
		}

		for j := i; j < end; j++ {
			id := fmt.Sprintf("user_%d", j)
			email := fmt.Sprintf("user%d@example.com", j)
			username := fmt.Sprintf("user%d", j)
			password := "hashed_password"
			name := fmt.Sprintf("User %d", j)
			avatar := fmt.Sprintf("https://avatar.example.com/%d.jpg", j)
			now := time.Now().Format(time.RFC3339)

			if _, err := stmt.Exec(id, email, username, password, name, avatar, now, now); err != nil {
				stmt.Close()
				tx.Rollback()
				return err
			}
		}

		stmt.Close()
		if err := tx.Commit(); err != nil {
			return err
		}
	}

	return nil
}

func (g *DataGenerator) generateArticles(verbose bool) error {
	if verbose {
		fmt.Printf("生成 %d 文章...\n", g.config.Articles)
	}

	db := g.db.DB()
	batchSize := 1000
	statuses := []string{"draft", "published", "archived"}
	tags := []string{"tech", "life", "news", "sports", "music", "art", "science", "travel"}

	for i := 0; i < g.config.Articles; i += batchSize {
		end := i + batchSize
		if end > g.config.Articles {
			end = g.config.Articles
		}

		tx, err := db.Begin()
		if err != nil {
			return err
		}

		stmt, err := tx.Prepare(g.getArticleInsertSQL())
		if err != nil {
			tx.Rollback()
			return err
		}

		for j := i; j < end; j++ {
			id := fmt.Sprintf("article_%d", j)
			title := fmt.Sprintf("Article Title %d - %s", j, g.randomString(20))
			content := g.randomContent(500)
			authorID := fmt.Sprintf("user_%d", g.rng.Intn(g.config.Users))
			status := statuses[g.rng.Intn(len(statuses))]
			articleTags := g.randomTags(tags, 3)
			viewCount := g.rng.Intn(10000)
			now := time.Now().Format(time.RFC3339)

			if _, err := stmt.Exec(id, title, content, authorID, status, articleTags, viewCount, now, now); err != nil {
				stmt.Close()
				tx.Rollback()
				return err
			}
		}

		stmt.Close()
		if err := tx.Commit(); err != nil {
			return err
		}
	}

	return nil
}

func (g *DataGenerator) generateComments(verbose bool) error {
	if verbose {
		fmt.Printf("生成 %d 评论...\n", g.config.Comments)
	}

	db := g.db.DB()
	batchSize := 1000

	for i := 0; i < g.config.Comments; i += batchSize {
		end := i + batchSize
		if end > g.config.Comments {
			end = g.config.Comments
		}

		tx, err := db.Begin()
		if err != nil {
			return err
		}

		stmt, err := tx.Prepare(g.getCommentInsertSQL())
		if err != nil {
			tx.Rollback()
			return err
		}

		for j := i; j < end; j++ {
			id := fmt.Sprintf("comment_%d", j)
			articleID := fmt.Sprintf("article_%d", g.rng.Intn(g.config.Articles))
			authorID := fmt.Sprintf("user_%d", g.rng.Intn(g.config.Users))
			var parentID interface{}
			if g.rng.Float64() < 0.3 && j > 0 {
				parentID = fmt.Sprintf("comment_%d", g.rng.Intn(j))
			}
			content := g.randomContent(100)
			now := time.Now().Format(time.RFC3339)

			if _, err := stmt.Exec(id, articleID, authorID, parentID, content, now, now); err != nil {
				stmt.Close()
				tx.Rollback()
				return err
			}
		}

		stmt.Close()
		if err := tx.Commit(); err != nil {
			return err
		}
	}

	return nil
}

func (g *DataGenerator) generateFiles(verbose bool) error {
	if verbose {
		fmt.Printf("生成 %d 文件记录...\n", g.config.Files)
	}

	db := g.db.DB()
	batchSize := 1000
	mimeTypes := []string{"image/jpeg", "image/png", "application/pdf", "text/plain", "video/mp4"}

	for i := 0; i < g.config.Files; i += batchSize {
		end := i + batchSize
		if end > g.config.Files {
			end = g.config.Files
		}

		tx, err := db.Begin()
		if err != nil {
			return err
		}

		stmt, err := tx.Prepare(g.getFileInsertSQL())
		if err != nil {
			tx.Rollback()
			return err
		}

		for j := i; j < end; j++ {
			id := fmt.Sprintf("file_%d", j)
			name := fmt.Sprintf("file_%d.%s", j, g.randomExtension())
			path := fmt.Sprintf("/uploads/%d/%s", j%100, name)
			size := int64(g.rng.Intn(10*1024*1024)) // 0-10MB
			mimeType := mimeTypes[g.rng.Intn(len(mimeTypes))]
			ownerID := fmt.Sprintf("user_%d", g.rng.Intn(g.config.Users))
			now := time.Now().Format(time.RFC3339)

			if _, err := stmt.Exec(id, name, path, size, mimeType, ownerID, now); err != nil {
				stmt.Close()
				tx.Rollback()
				return err
			}
		}

		stmt.Close()
		if err := tx.Commit(); err != nil {
			return err
		}
	}

	return nil
}

func (g *DataGenerator) getUserInsertSQL() string {
	if g.db.Type() == DBPostgreSQL {
		return `INSERT INTO users (id, email, username, password, name, avatar, created_at, updated_at) 
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	}
	return `INSERT INTO users (id, email, username, password, name, avatar, created_at, updated_at) 
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
}

func (g *DataGenerator) getArticleInsertSQL() string {
	if g.db.Type() == DBPostgreSQL {
		return `INSERT INTO articles (id, title, content, author_id, status, tags, view_count, created_at, updated_at) 
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`
	}
	return `INSERT INTO articles (id, title, content, author_id, status, tags, view_count, created_at, updated_at) 
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
}

func (g *DataGenerator) getCommentInsertSQL() string {
	if g.db.Type() == DBPostgreSQL {
		return `INSERT INTO comments (id, article_id, author_id, parent_id, content, created_at, updated_at) 
				VALUES ($1, $2, $3, $4, $5, $6, $7)`
	}
	return `INSERT INTO comments (id, article_id, author_id, parent_id, content, created_at, updated_at) 
			VALUES (?, ?, ?, ?, ?, ?, ?)`
}

func (g *DataGenerator) getFileInsertSQL() string {
	if g.db.Type() == DBPostgreSQL {
		return `INSERT INTO files (id, name, path, size, mime_type, owner_id, created_at) 
				VALUES ($1, $2, $3, $4, $5, $6, $7)`
	}
	return `INSERT INTO files (id, name, path, size, mime_type, owner_id, created_at) 
			VALUES (?, ?, ?, ?, ?, ?, ?)`
}

func (g *DataGenerator) randomString(length int) string {
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	result := make([]byte, length)
	for i := range result {
		result[i] = chars[g.rng.Intn(len(chars))]
	}
	return string(result)
}

func (g *DataGenerator) randomContent(maxLength int) string {
	words := []string{"lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
		"sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore", "magna", "aliqua"}
	
	length := g.rng.Intn(maxLength) + 50
	var sb strings.Builder
	for sb.Len() < length {
		sb.WriteString(words[g.rng.Intn(len(words))])
		sb.WriteString(" ")
	}
	return sb.String()[:length]
}

func (g *DataGenerator) randomTags(tags []string, maxTags int) string {
	count := g.rng.Intn(maxTags) + 1
	selected := make([]string, count)
	for i := 0; i < count; i++ {
		selected[i] = tags[g.rng.Intn(len(tags))]
	}
	return strings.Join(selected, ",")
}

func (g *DataGenerator) randomExtension() string {
	exts := []string{"jpg", "png", "pdf", "txt", "mp4", "doc", "xlsx"}
	return exts[g.rng.Intn(len(exts))]
}

// GetDataCount 获取数据统计
func GetDataCount(db *sql.DB) (users, articles, comments, files int, err error) {
	if err = db.QueryRow("SELECT COUNT(*) FROM users").Scan(&users); err != nil {
		return
	}
	if err = db.QueryRow("SELECT COUNT(*) FROM articles").Scan(&articles); err != nil {
		return
	}
	if err = db.QueryRow("SELECT COUNT(*) FROM comments").Scan(&comments); err != nil {
		return
	}
	if err = db.QueryRow("SELECT COUNT(*) FROM files").Scan(&files); err != nil {
		return
	}
	return
}
