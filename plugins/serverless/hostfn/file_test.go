// Package hostfn 提供 Serverless 运行时的 Host Functions
package hostfn

import (
	"bytes"
	"testing"
)

// Phase 8: US5 File API 测试

func TestFileService(t *testing.T) {
	t.Run("读取文件", func(t *testing.T) {
		fs := NewFileService(nil)

		// 模拟文件内容
		content := []byte("Hello, World!")
		fs.MockFile("users", "record1", "test.txt", content)

		data, err := fs.Read("users", "record1", "test.txt")
		if err != nil {
			t.Fatalf("Read() error = %v", err)
		}

		if !bytes.Equal(data, content) {
			t.Errorf("Read() = %v, want %v", data, content)
		}
	})

	t.Run("保存文件", func(t *testing.T) {
		fs := NewFileService(nil)

		file := FileData{
			Filename: "upload.txt",
			Data:     []byte("File content"),
		}

		err := fs.Save("users", "record1", file)
		if err != nil {
			t.Fatalf("Save() error = %v", err)
		}

		// 验证文件已保存
		data, err := fs.Read("users", "record1", "upload.txt")
		if err != nil {
			t.Fatalf("Read() error = %v", err)
		}

		if !bytes.Equal(data, file.Data) {
			t.Errorf("Read() = %v, want %v", data, file.Data)
		}
	})

	t.Run("文件大小限制", func(t *testing.T) {
		fs := NewFileService(nil)
		fs.SetMaxSize(1024) // 1KB 限制

		// 创建超过限制的文件
		largeData := make([]byte, 2048)
		file := FileData{
			Filename: "large.txt",
			Data:     largeData,
		}

		err := fs.Save("users", "record1", file)
		if err == nil {
			t.Error("Save() 应该返回文件大小超限错误")
		}
	})

	t.Run("文件不存在", func(t *testing.T) {
		fs := NewFileService(nil)

		_, err := fs.Read("users", "record1", "nonexistent.txt")
		if err == nil {
			t.Error("Read() 应该返回文件不存在错误")
		}
	})

	t.Run("删除文件", func(t *testing.T) {
		fs := NewFileService(nil)

		// 先保存文件
		file := FileData{
			Filename: "delete.txt",
			Data:     []byte("To be deleted"),
		}
		fs.Save("users", "record1", file)

		// 删除文件
		err := fs.Delete("users", "record1", "delete.txt")
		if err != nil {
			t.Fatalf("Delete() error = %v", err)
		}

		// 验证文件已删除
		_, err = fs.Read("users", "record1", "delete.txt")
		if err == nil {
			t.Error("Read() 应该返回文件不存在错误")
		}
	})
}

func TestFileServiceHostFunction(t *testing.T) {
	t.Run("Host Function 调用", func(t *testing.T) {
		hf := NewHostFunctions(nil)

		// 保存文件
		err := hf.FileSave("users", "record1", "test.txt", []byte("content"))
		if err != nil {
			t.Fatalf("FileSave() error = %v", err)
		}

		// 读取文件
		data, err := hf.FileRead("users", "record1", "test.txt")
		if err != nil {
			t.Fatalf("FileRead() error = %v", err)
		}

		if string(data) != "content" {
			t.Errorf("FileRead() = %s, want content", string(data))
		}
	})
}

func TestFileData(t *testing.T) {
	t.Run("文件数据结构", func(t *testing.T) {
		file := FileData{
			Filename:    "test.txt",
			Data:        []byte("Hello"),
			ContentType: "text/plain",
		}

		if file.Filename != "test.txt" {
			t.Errorf("Filename = %s, want test.txt", file.Filename)
		}

		if file.Size() != 5 {
			t.Errorf("Size() = %d, want 5", file.Size())
		}
	})
}
