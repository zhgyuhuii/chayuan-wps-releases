# 让 Claude 写 GitHub Actions 单机版构建流水线

chayuan-desktop 桌面单机版的 GitHub Actions CI/CD 由 Claude 协助。这一篇讲。

## 构建流水线的需求

每次 PR 触发。

Lint。

类型检查。

单元测试。

集成测试。

跨平台 + 跨架构构建。

签名。

发布。

完整流程。

## Claude 写 workflow

提示 Claude。

```
为 chayuan-desktop 写 GitHub Actions workflow。
- 触发：PR + push to main + tag。
- 矩阵：[ubuntu, macos, windows] × [x86_64, aarch64]
- 步骤：lint → test → build → sign → release。
```

Claude 输出。

```yaml
name: Build and Release
on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-22.04, macos-14, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -e .
      - run: pytest

  build:
    needs: test
    strategy:
      matrix:
        target:
          - os: ubuntu-22.04
            arch: x86_64
          - os: ubuntu-22.04-arm
            arch: aarch64
          - os: macos-14
            arch: x86_64
          - os: macos-14
            arch: aarch64
          # ...
    runs-on: ${{ matrix.target.os }}
    steps:
      - uses: actions/checkout@v4
      - run: cargo tauri build --target ${{ matrix.target.arch }}-${{ ... }}
      - name: Sign
        if: matrix.target.os == 'macos-14'
        run: codesign ...
      - uses: actions/upload-artifact@v3
        with:
          name: chayuan-desktop-${{ matrix.target.arch }}-${{ ... }}
          path: ...

  release:
    if: startsWith(github.ref, 'refs/tags/')
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v3
      - uses: softprops/action-gh-release@v1
        with:
          files: |
            chayuan-desktop-*-*/
```

## 缓存

CI 跑得快需要缓存。

cargo registry。

npm packages。

Python pip wheels。

模型文件（如果 CI 需要）。

```yaml
- uses: actions/cache@v3
  with:
    path: ~/.cargo
    key: cargo-${{ runner.os }}-${{ hashFiles('Cargo.lock') }}
```

Claude 帮写缓存配置。

## 加密的 secrets

某些步骤需要 secrets。

Apple Developer ID（macOS 签名）。

Windows 代码签名证书。

Release token（GitHub）。

```yaml
- name: Sign macOS
  run: codesign --sign "${{ secrets.APPLE_ID }}" ...
```

Claude 提醒 secrets 安全管理。

## 失败诊断

CI 失败时 Claude 帮分析日志。

```
某 step 失败。错误：
[error: ...]

诊断：可能是 X 原因。
建议：修改 Y 配置。
```

提速 CI 调试。

## 自动发版

tag 触发后自动发版。

构建产物上传到 GitHub Release。

更新 CHANGELOG。

通知用户（discord、邮件等）。

Claude 帮写自动化脚本。

## 跨架构 runner

GitHub 提供 Linux ARM runner（最近支持）。chayuan-desktop CI 直接用。

```yaml
runs-on: ubuntu-22.04-arm
```

不需要 cross compile。本机编译快。

## 国产化场景

党政军内网 GitHub Actions 不可用。改用 GitLab CI（自托管）或 Jenkins。Claude 同样能写配置。

## chayuan-server 的对应

chayuan-server 也有 CI/CD。Claude 协作经验复用。两项目共享部分 workflow。

## 总结

让 Claude 写 GitHub Actions 是 chayuan-desktop 在 CI/CD 自动化上的协作。免费开源的AI软件 让 复杂构建流水线 不靠开发者背 YAML。Claude 的矩阵 / 缓存 / secrets / 失败诊断让 CI 顺。
