#!/usr/bin/env python3
# 简单回显脚本，用于测试基本启动
import sys
import time

print("Hello from Python", flush=True)
sys.stdout.flush()

# 保持运行短时间后退出
time.sleep(0.5)
print("Exiting normally", flush=True)
