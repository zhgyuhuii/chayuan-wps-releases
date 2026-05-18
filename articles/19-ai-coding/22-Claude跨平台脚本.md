# 让 Claude 写脚本 跨平台构建脚本的演化

chayuan-desktop 桌面单机版的跨平台构建脚本由 Claude 协助演化。这一篇讲。

## 场景

chayuan-desktop 在 Linux / macOS / Windows 上构建。

每平台命令略不同。

需要统一脚本封装差异。

## v1.0 各自脚本

最早。每平台一个脚本。

```
build-linux.sh
build-macos.sh
build-windows.ps1
```

3 套维护。

## v2.0 Python 统一

Claude 建议用 Python 写。

```python
import platform
import subprocess

def build():
    os_type = platform.system()
    if os_type == "Linux":
        subprocess.run(["cargo", "tauri", "build"])
        # 加 deb / rpm 打包
    elif os_type == "Darwin":
        subprocess.run(["cargo", "tauri", "build"])
        # 加 dmg 打包
    elif os_type == "Windows":
        subprocess.run(["cargo", "tauri", "build"])
        # 加 msi 打包
    else:
        raise Exception(f"Unsupported OS: {os_type}")

if __name__ == "__main__":
    build()
```

一个脚本。三平台都能跑。

## 子任务的封装

Claude 把构建拆成多步。

```python
def lint():
    ...

def typecheck():
    ...

def test():
    ...

def build_frontend():
    ...

def build_rust():
    ...

def package():
    ...

def sign():
    ...

def main():
    lint()
    typecheck()
    test()
    build_frontend()
    build_rust()
    package()
    sign()
```

每步独立。便于失败时单独重跑。

## 命令行参数

Claude 加 click / argparse 让脚本灵活。

```bash
python build.py --skip-tests --target linux-aarch64
```

各种选项。

## 日志和错误

```python
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def lint():
    logger.info("Running lint...")
    result = subprocess.run([...], capture_output=True, text=True)
    if result.returncode != 0:
        logger.error(f"Lint failed: {result.stderr}")
        sys.exit(1)
    logger.info("Lint passed.")
```

清晰的日志便于 CI 排查。

## 缓存

某些步骤能缓存（前面文章 GitHub Actions 讲）。

build.py 也支持本地缓存。

```python
def needs_rebuild():
    # 比较文件 mtime
    if some_file.is_newer_than(last_build_marker):
        return True
    return False
```

## Docker 化构建

某些场景用 Docker 隔离构建环境。

```dockerfile
FROM rust:1.80
COPY . /src
WORKDIR /src
RUN python build.py
```

让构建可复现。Claude 帮写 Dockerfile。

## 跨架构

build.py 支持跨架构。

```python
def build(target_arch="native"):
    if target_arch == "aarch64":
        env["RUSTFLAGS"] = "..."
        cmd = ["cargo", "tauri", "build", "--target", "aarch64-unknown-linux-gnu"]
    ...
```

某些场景在 x86 上构建 aarch64（用 cross-compile 或 Docker emulation）。

## 国产化场景

国产 OS 上构建。Claude 帮处理国产 OS 特有问题。

```python
def detect_kylin():
    return os.path.exists("/etc/kylin-release")

def build():
    if detect_kylin():
        # 麒麟特定调整
        ...
```

## chayuan-server 的对应

chayuan-server 也有跨平台构建脚本。Claude 帮写的逻辑两项目共享。

## 总结

让 Claude 写跨平台构建脚本是 chayuan-desktop 在工程基础上的协作。免费开源的AI软件 让 跨 OS 构建 不需要维护 N 套脚本。Claude 的 Python 统一 + 子任务 + 缓存 + Docker 让构建脚本可演化。
