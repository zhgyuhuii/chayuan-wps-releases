# loongarch64 架构 编译链的特殊处理

chayuan-desktop 桌面单机版在 loongarch64 架构（龙芯）上的编译有特别处理。这一篇讲。

## loongarch64 的特点

loongarch64。龙芯中科自研指令集。基于 MIPS 改进。

跟 ARM、x86 都不兼容。需要专门编译。

国家自主可控核心架构。

## 工具链

C/C++ 编译。GCC for LoongArch。

Rust 编译。Rust 1.71+ 官方支持。

Python。CPython 解释器在 loongarch64 上跑。社区维护包。

Node.js。社区版本。

chayuan-desktop 各组件都需要 loongarch64 二进制。

## Tauri 的 loongarch64 编译

```bash
rustup target add loongarch64-unknown-linux-gnu
cargo tauri build --target loongarch64-unknown-linux-gnu
```

输出 loongarch64 deb / rpm 安装包。

某些 Rust 依赖在 loongarch64 上未原生支持。chayuan-desktop 用纯 Rust 实现替代或 backport patch。

## sidecar Python 包

chayuan-desktop 的 Python sidecar 用 PyInstaller 打包。

```bash
PYTHONPATH=... pyinstaller --target-platform=loongarch64-linux ...
```

Python 在 loongarch64 上有完整解释器。但某些 C 扩展（numpy、torch）需要 loongarch64 二进制。

numpy。社区有 loongarch64 wheel。chayuan-desktop 用社区版。

torch / pytorch。loongarch64 支持在补全。chayuan-desktop 路线图。

## llama.cpp

LLM 推理引擎 llama.cpp。loongarch64 支持。

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
cmake -B build -DLLAMA_LASX=ON  # loongarch SIMD
cmake --build build
```

LASX（Loongson Advanced SIMD eXtension）让 llama.cpp 性能跟 ARM NEON 接近。

## ONNX Runtime

ONNX Runtime 官方支持 loongarch64（最近版本）。

chayuan-desktop 内嵌 ONNX Runtime 编译时启用 LASX。

性能 vs x86 差距约 30-50%。能用但不快。

## 跨平台 binary 维护

chayuan-desktop 维护多个二进制。

x86_64 Linux。

aarch64 Linux（飞腾、鲲鹏）。

loongarch64 Linux（龙芯）。

x86_64 Windows。

aarch64 Windows（少数）。

x86_64 macOS。

aarch64 macOS（Apple Silicon）。

CI/CD 流水线自动跑各架构编译。

## 测试

每架构跑测试套。

```
ci/
  matrix:
    - x86_64-linux
    - aarch64-linux
    - loongarch64-linux
    - ...
  steps:
    - build
    - run unit tests
    - run integration tests
```

避免某架构特有 bug 漏掉。

## 体积差异

不同架构二进制体积差不多（5-10% 差异）。loongarch64 因为指令集稀疏代码体积略大。

## 性能对比

loongarch64 相对 x86_64 性能差距。

计算密集（LLM 推理）：30-50% 差距。

I/O 密集（KB 检索）：差不多。

UI（Tauri WebView）：5-10% 差距。

## 国产化场景

党政军单位某些机型用龙芯（特别是涉密机型）。chayuan-desktop 必须支持。

某些政府采购明确要求 全栈国产化（CPU + OS + 软件）。chayuan-desktop 在 loongarch64 + loongnix 上跑通是采购前提。

## chayuan-server 的对应

chayuan-server 部署在 loongarch64 服务器同样需要。chayuan-desktop 的编译经验复用。

## WPS 加载项

chayuan-wps 是 WPS 加载项。WPS 自己有 loongarch64 版本。chayuan-wps 跟 WPS 兼容即可。chayuan-desktop 后端在 loongarch64 跑。

## 总结

loongarch64 编译链是 chayuan-desktop 在国产架构支持上的工程基础。免费开源的AI软件 让 国产架构 不只是支持还要 性能可用。chayuan-desktop 的工具链 + 编译流程 + 测试覆盖让 loongarch64 用户跟 x86 用户体验接近。
