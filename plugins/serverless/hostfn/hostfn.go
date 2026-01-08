// Package hostfn 提供 Serverless 运行时的 Host Functions
package hostfn

import (
	"github.com/pocketbase/pocketbase/core"
)

// HostFunctions 是所有 Host Functions 的统一入口
type HostFunctions struct {
	app     core.App
	fetch   *Fetch
	console *Console
	txMgr   *TransactionManager
	kv      *KVStore
	files   *FileService
	secrets *SecretService
	jobs    *JobService
	vector  *VectorSearch
}

// NewHostFunctions 创建新的 HostFunctions 实例
func NewHostFunctions(app core.App) *HostFunctions {
	return &HostFunctions{
		app:   app,
		txMgr: NewTransactionManager(),
	}
}

// Fetch 返回 Fetch 服务
func (hf *HostFunctions) Fetch() *Fetch {
	if hf.fetch == nil {
		hf.fetch = NewFetch(FetchConfig{})
	}
	return hf.fetch
}

// Console 返回 Console 服务
func (hf *HostFunctions) Console() *Console {
	if hf.console == nil {
		hf.console = NewConsole(ConsoleConfig{})
	}
	return hf.console
}

// TransactionManager 返回事务管理器
func (hf *HostFunctions) TransactionManager() *TransactionManager {
	return hf.txMgr
}

// KV 返回 KV 存储服务
func (hf *HostFunctions) KV() *KVStore {
	if hf.kv == nil {
		hf.kv = NewKVStore(hf.app)
	}
	return hf.kv
}

// Files 返回文件服务
func (hf *HostFunctions) Files() *FileService {
	if hf.files == nil {
		hf.files = NewFileService(hf.app)
	}
	return hf.files
}

// Secrets 返回密钥服务
func (hf *HostFunctions) Secrets() *SecretService {
	if hf.secrets == nil {
		hf.secrets = NewSecretService(hf.app)
	}
	return hf.secrets
}

// Jobs 返回任务队列服务
func (hf *HostFunctions) Jobs() *JobService {
	if hf.jobs == nil {
		hf.jobs = NewJobService(hf.app)
	}
	return hf.jobs
}

// Vector 返回向量搜索服务
func (hf *HostFunctions) Vector() *VectorSearch {
	if hf.vector == nil {
		hf.vector = NewVectorSearch(hf.app)
	}
	return hf.vector
}
