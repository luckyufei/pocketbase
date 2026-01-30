#!/usr/bin/env python3
"""
简单 Python 脚本 - 用于测试基础进程管理
输出到 stdout/stderr，运行一段时间后正常退出
"""
import sys
import time
import os

def main():
    print(f"[Python] PID: {os.getpid()}")
    print(f"[Python] Args: {sys.argv[1:]}")
    print(f"[Python] CWD: {os.getcwd()}")
    
    # 检查环境变量
    test_env = os.environ.get("TEST_ENV_VAR", "not_set")
    print(f"[Python] TEST_ENV_VAR: {test_env}")
    
    # 输出到 stderr
    print("[Python] This is stderr output", file=sys.stderr)
    
    # 模拟工作
    duration = int(os.environ.get("RUN_DURATION", "5"))
    print(f"[Python] Running for {duration} seconds...")
    
    for i in range(duration):
        print(f"[Python] Tick {i+1}/{duration}")
        time.sleep(1)
    
    print("[Python] Script completed successfully")
    sys.exit(0)

if __name__ == "__main__":
    main()
