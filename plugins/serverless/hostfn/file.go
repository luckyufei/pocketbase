// Package hostfn 提供 Serverless 运行时的 Host Functions
package hostfn

import (
	"errors"
	"fmt"
	"sync"

	"github.com/pocketbase/pocketbase/core"
)

// FileData 文件数据
type FileData struct {
	Filename    string
	Data        []byte
	ContentType string
}

// Size 返回文件大小
func (f FileData) Size() int {
	return len(f.Data)
}

// FileService 文件服务
type FileService struct {
	app     core.App
	files   map[string][]byte // key: collection/record/filename
	maxSize int64
	mutex   sync.RWMutex
}

// NewFileService 创建文件服务
func NewFileService(app core.App) *FileService {
	return &FileService{
		app:     app,
		files:   make(map[string][]byte),
		maxSize: 10 * 1024 * 1024, // 默认 10MB
	}
}

// SetMaxSize 设置最大文件大小
func (fs *FileService) SetMaxSize(size int64) {
	fs.maxSize = size
}

// fileKey 生成文件键
func (fs *FileService) fileKey(collection, record, filename string) string {
	return fmt.Sprintf("%s/%s/%s", collection, record, filename)
}

// MockFile 模拟文件（用于测试）
func (fs *FileService) MockFile(collection, record, filename string, content []byte) {
	fs.mutex.Lock()
	defer fs.mutex.Unlock()
	key := fs.fileKey(collection, record, filename)
	fs.files[key] = content
}

// Read 读取文件
func (fs *FileService) Read(collection, record, filename string) ([]byte, error) {
	fs.mutex.RLock()
	defer fs.mutex.RUnlock()

	key := fs.fileKey(collection, record, filename)
	data, exists := fs.files[key]
	if !exists {
		return nil, errors.New("文件不存在")
	}

	return data, nil
}

// Save 保存文件
func (fs *FileService) Save(collection, record string, file FileData) error {
	// 检查文件大小
	if fs.maxSize > 0 && int64(len(file.Data)) > fs.maxSize {
		return errors.New("文件大小超过限制")
	}

	fs.mutex.Lock()
	defer fs.mutex.Unlock()

	key := fs.fileKey(collection, record, file.Filename)
	fs.files[key] = file.Data

	return nil
}

// Delete 删除文件
func (fs *FileService) Delete(collection, record, filename string) error {
	fs.mutex.Lock()
	defer fs.mutex.Unlock()

	key := fs.fileKey(collection, record, filename)
	delete(fs.files, key)

	return nil
}

// HostFunctions 文件方法扩展

// FileRead 读取文件
func (hf *HostFunctions) FileRead(collection, record, filename string) ([]byte, error) {
	if hf.files == nil {
		hf.files = NewFileService(hf.app)
	}
	return hf.files.Read(collection, record, filename)
}

// FileSave 保存文件
func (hf *HostFunctions) FileSave(collection, record, filename string, data []byte) error {
	if hf.files == nil {
		hf.files = NewFileService(hf.app)
	}
	return hf.files.Save(collection, record, FileData{
		Filename: filename,
		Data:     data,
	})
}
