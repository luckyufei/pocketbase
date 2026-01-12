// Package main provides a standalone documentation server
package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
)

//go:embed all:dist
var distDir embed.FS

var distFS, _ = fs.Sub(distDir, "dist")

func main() {
	port := flag.String("port", "8080", "Server port")
	host := flag.String("host", "127.0.0.1", "Server host")
	flag.Parse()

	addr := fmt.Sprintf("%s:%s", *host, *port)

	// 创建文件服务器
	fileServer := http.FileServer(http.FS(distFS))

	// 处理 SPA 路由 - 对于不存在的文件返回 index.html
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 尝试打开请求的文件
		path := r.URL.Path
		if path == "/" {
			path = "/index.html"
		}

		// 检查文件是否存在
		f, err := distFS.Open(path[1:]) // 移除前导斜杠
		if err != nil {
			// 文件不存在，尝试添加 .html 后缀
			htmlPath := path + ".html"
			if f2, err2 := distFS.Open(htmlPath[1:]); err2 == nil {
				f2.Close()
				r.URL.Path = htmlPath
				fileServer.ServeHTTP(w, r)
				return
			}

			// 如果还是不存在，返回 404.html 或 index.html
			if f3, err3 := distFS.Open("404.html"); err3 == nil {
				f3.Close()
				r.URL.Path = "/404.html"
			} else {
				r.URL.Path = "/index.html"
			}
			fileServer.ServeHTTP(w, r)
			return
		}
		f.Close()

		fileServer.ServeHTTP(w, r)
	})

	fmt.Fprintf(os.Stdout, "Starting documentation server at http://%s\n", addr)
	fmt.Fprintf(os.Stdout, "Press Ctrl+C to stop\n")

	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
