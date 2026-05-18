# 让 Claude 写 PyInstaller 的 spec 与钩子

chayuan-desktop 桌面单机版用 PyInstaller 打包 Python sidecar。Claude 协助 spec 文件。这一篇讲。

## PyInstaller 是什么

把 Python 程序打包成单文件可执行。

不需要用户装 Python 解释器。

跨平台（Windows / Mac / Linux 都生成对应平台 exe）。

chayuan-desktop 的 sidecar 用它打包。

## spec 文件

PyInstaller 的配置文件。

```python
# sidecar.spec
from PyInstaller.utils.hooks import collect_all

block_cipher = None

a = Analysis(
    ['sidecar.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('models/', 'models/'),
        ('configs/', 'configs/'),
    ],
    hiddenimports=['..., '..., '...'],
    hookspath=['hooks/'],
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz, a.scripts, a.binaries, a.zipfiles, a.datas,
    name='chayuan-sidecar',
    debug=False,
    strip=False,
    upx=True,
    onedir=True,  # onedir 模式
)
```

复杂。

## Claude 帮写 spec

提示 Claude。

```
我的 sidecar.py 用了 fastapi、pydantic、sqlalchemy、numpy、onnxruntime、llama-cpp-python。
帮我写 PyInstaller spec 文件。打包成 onedir 模式。
```

Claude 输出完整 spec。处理。

hiddenimports（PyInstaller 静态分析漏掉的）。

datas（运行时数据文件）。

binaries（动态库）。

hooks（特殊处理）。

## 钩子的写法

某些库需要自定义 hook。

```python
# hooks/hook-onnxruntime.py
from PyInstaller.utils.hooks import collect_dynamic_libs, collect_data_files

binaries = collect_dynamic_libs('onnxruntime')
datas = collect_data_files('onnxruntime')
```

Claude 帮写。

## 跨平台差异

不同 OS 的 spec 略不同。

```python
import sys

if sys.platform == 'win32':
    binaries.append(('libsomething.dll', '.'))
elif sys.platform == 'darwin':
    binaries.append(('libsomething.dylib', '.'))
else:
    binaries.append(('libsomething.so', '.'))
```

Claude 写跨平台兼容版本。

## 体积优化

PyInstaller 默认带很多冗余。Claude 帮优化。

excludes（不需要的库不打包）。

```python
excludes=['matplotlib', 'pandas', 'scipy.test']
```

upx 压缩（Windows / Linux）。

模型文件外放（不打 exe，启动时加载）。

体积 200MB → 80MB。

## 启动加速

PyInstaller 的 onedir 比 onefile 启动快（不解压）。

Claude 建议 onedir。

某些场景 lazy import 让启动更快。

## 调试 PyInstaller 问题

某次打包后运行报错。Claude 帮排查。

```
ModuleNotFoundError: No module named 'xxx.utils'

诊断：xxx 库的子模块未被静态分析发现。
解决：
spec 文件 hiddenimports 加 'xxx.utils'

或：写 hook-xxx.py 自动收集子模块。
```

## 跨架构打包

aarch64 上打 aarch64 包。x86 上打 x86 包。

PyInstaller 不支持交叉打包（直接）。Claude 建议 CI/CD 用 ARM runner 直接本机打。

## 国产化场景

党政军 chayuan-desktop 在国产 OS 打包。Claude 帮处理国产 OS 特定问题。

LoongArch 上 PyInstaller 支持有限。chayuan-desktop 路线图。

## chayuan-server 的对应

chayuan-server 部署在服务器，不打包成 exe。直接 Python 运行或 Docker。chayuan-desktop 的 PyInstaller 经验仅 desktop 用。

## 总结

让 Claude 写 PyInstaller spec 是 chayuan-desktop 在打包工程上的协作。免费开源的AI软件 让 复杂打包 不靠开发者死磕。Claude 的 spec 生成 + hook 编写 + 跨平台 + 优化让 PyInstaller 工程顺。
