# 测试

PocketBase 提供了多个测试模拟对象和桩（例如 `tests.TestApp`、`tests.ApiScenario`、`tests.MockMultipartData` 等）来帮助你为应用程序编写单元测试和集成测试。

你可以在 [`github.com/pocketbase/pocketbase/tests`](https://pkg.go.dev/github.com/pocketbase/pocketbase/tests) 子包中找到更多信息，但这里有一个简单的示例。

[[toc]]

## 1. 设置

假设我们有一个自定义 API 路由 `GET /my/hello`，它需要超级用户认证：

```go
// main.go
package main

import (
    "log"
    "net/http"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/apis"
    "github.com/pocketbase/pocketbase/core"
)

func bindAppHooks(app core.App) {
    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        se.Router.Get("/my/hello", func(e *core.RequestEvent) error {
            return e.JSON(http.StatusOK, "Hello world!")
        }).Bind(apis.RequireSuperuserAuth())

        return se.Next()
    })
}

func main() {
    app := pocketbase.New()

    bindAppHooks(app)

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## 2. 准备测试数据

现在我们需要准备测试/模拟数据。有几种方法可以做到这一点，但最简单的方法是使用自定义 `test_pb_data` 目录启动应用程序，例如：

```
./pocketbase serve --dir="./test_pb_data" --automigrate=0
```

打开浏览器，通过仪表板创建测试数据（包括集合和记录）。完成后可以停止服务器（你也可以将 `test_pb_data` 提交到代码仓库）。

## 3. 集成测试

为了测试示例端点，我们需要：

- 确保它只处理 GET 请求
- 确保只有超级用户可以访问它
- 检查响应体是否正确设置

下面是针对上述测试用例的简单集成测试。我们还将使用上一步创建的测试数据。

```go
// main_test.go
package main

import (
    "net/http"
    "testing"

    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tests"
)

const testDataDir = "./test_pb_data"

func generateToken(collectionNameOrId string, email string) (string, error) {
    app, err := tests.NewTestApp(testDataDir)
    if err != nil {
        return "", err
    }
    defer app.Cleanup()

    record, err := app.FindAuthRecordByEmail(collectionNameOrId, email)
    if err != nil {
        return "", err
    }

    return record.NewAuthToken()
}

func TestHelloEndpoint(t *testing.T) {
    recordToken, err := generateToken("users", "test@example.com")
    if err != nil {
        t.Fatal(err)
    }

    superuserToken, err := generateToken(core.CollectionNameSuperusers, "test@example.com")
    if err != nil {
        t.Fatal(err)
    }

    // 设置测试 ApiScenario 应用实例
    setupTestApp := func(t testing.TB) *tests.TestApp {
        testApp, err := tests.NewTestApp(testDataDir)
        if err != nil {
            t.Fatal(err)
        }
        // 不需要清理，因为 scenario.Test() 会为我们处理
        // defer testApp.Cleanup()

        bindAppHooks(testApp)

        return testApp
    }

    scenarios := []tests.ApiScenario{
        {
            Name:            "尝试使用不同的 HTTP 方法，例如 POST",
            Method:          http.MethodPost,
            URL:             "/my/hello",
            ExpectedStatus:  405,
            ExpectedContent: []string{"\"data\":{}"},
            TestAppFactory:  setupTestApp,
        },
        {
            Name:            "尝试以游客身份访问（即无 Authorization 头）",
            Method:          http.MethodGet,
            URL:             "/my/hello",
            ExpectedStatus:  401,
            ExpectedContent: []string{"\"data\":{}"},
            TestAppFactory:  setupTestApp,
        },
        {
            Name:   "尝试以已认证的应用用户身份访问",
            Method: http.MethodGet,
            URL:    "/my/hello",
            Headers: map[string]string{
                "Authorization": recordToken,
            },
            ExpectedStatus:  401,
            ExpectedContent: []string{"\"data\":{}"},
            TestAppFactory:  setupTestApp,
        },
        {
            Name:   "尝试以已认证的超级用户身份访问",
            Method: http.MethodGet,
            URL:    "/my/hello",
            Headers: map[string]string{
                "Authorization": superuserToken,
            },
            ExpectedStatus:  200,
            ExpectedContent: []string{"Hello world!"},
            TestAppFactory:  setupTestApp,
        },
    }

    for _, scenario := range scenarios {
        scenario.Test(t)
    }
}
```
