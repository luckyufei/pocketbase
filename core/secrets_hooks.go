package core

// initSecretsStore 初始化 Secrets 存储
func (app *BaseApp) initSecretsStore() {
	// 初始化 Secrets 设置
	app.secretsSettings = NewSecretsSettings()
	if err := app.secretsSettings.Initialize(); err != nil {
		// 初始化失败不阻止服务启动，只记录日志
		app.Logger().Warn("Failed to initialize secrets settings", "error", err)
	}

	// 如果 Secrets 功能未启用，记录信息日志
	if !app.secretsSettings.IsEnabled() {
		if initErr := app.secretsSettings.InitError(); initErr != nil {
			if initErr == ErrMasterKeyNotSet {
				app.Logger().Info("Secrets feature disabled: PB_MASTER_KEY not set")
			} else {
				app.Logger().Warn("Secrets feature disabled", "error", initErr)
			}
		}
	}

	// 创建 SecretsStore 实例
	app.secretsStore = newSecretsStore(app, app.secretsSettings)
}

// Secrets 返回 Secrets 存储实例
func (app *BaseApp) Secrets() SecretsStore {
	return app.secretsStore
}
