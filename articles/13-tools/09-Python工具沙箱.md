# 自定义 Python 工具 安全沙箱的边界

chayuan-desktop 桌面单机版的自定义 Python 工具运行在沙箱里。这一篇讲沙箱的边界。

## 场景

用户写一段 Python 让 LLM 调用。

```python
def calculate_stats(data):
    return {"mean": sum(data)/len(data), "max": max(data)}
```

让 LLM 在分析数据时调这个函数。chayuan-desktop 让用户能注册自定义 Python 工具。

## 注册方式

设置 - 工具 - 自定义 Python 工具。

代码框写函数。schema 自动从函数签名推断（用 docstring 和类型注解）。

```python
def calculate_stats(data: list[float]) -> dict:
    """计算列表的统计信息。
    
    Args:
        data: 数字列表
    
    Returns:
        含 mean 和 max 的字典
    """
    return {"mean": sum(data)/len(data), "max": max(data)}
```

chayuan-desktop 解析后生成工具描述。

## 沙箱的实现

Python 自定义工具运行在受限 Python 环境。

限制一：禁止 import 危险模块（os.system、subprocess、socket 等）。

限制二：禁止文件系统访问（除非显式授权）。

限制三：禁止网络访问（除非显式授权）。

限制四：CPU 时间限制（默认 5 秒）。

限制五：内存限制（默认 100MB）。

超限工具被强制中止。

## RestrictedPython 库

chayuan-desktop 用 RestrictedPython（Plone 项目维护）实现沙箱。

代码经 AST 重写，移除危险调用。

执行时只允许白名单内置（math、statistics、json、datetime 等）。

第三方库需要用户显式声明（chayuan-desktop 校验该库是否安全）。

## 允许的库

默认允许的库白名单。

数学和统计：math、statistics、numpy、pandas（受限）、scipy。

文本处理：re、string、textwrap、jieba。

日期：datetime、calendar。

JSON：json。

类型：collections、typing。

数据结构：itertools、functools。

更多需要用户在配置里开启。

## 用户开启额外库

某些场景用户需要 requests 发 HTTP。但 requests 能任意调用网络，有风险。

chayuan-desktop 设置里能开。

```yaml
custom_python_tools:
  allowed_libs:
    - requests
  network_allowed: ["api.corp.com"]  # 只允许调这些域名
```

启用后 requests 能用，但只能调白名单域名。

## 工具调试

某 Python 工具运行出错。chayuan-desktop UI 显示。

```
Python 工具执行失败：
  TypeError: 'NoneType' object is not iterable
  
  完整堆栈：
    File "<custom>", line 5, in calculate_stats
      return {"mean": sum(data)/len(data), ...}
```

让用户能看到错误改代码。

## 工具的存储

代码本地存。

```
~/.chayuan/custom_tools/python/
  calculate_stats.py
  parse_csv.py
  ...
```

每个工具一个文件。版本管理（git 或类似）。

## 性能

沙箱有 5-15% 性能损耗。日常工具够用。

CPU 密集型任务（大数据处理）建议走原生 Python（chayuan-desktop 内嵌的 sidecar）而非沙箱。

## 国产化场景

党政军场景对自定义代码安全要求高。chayuan-desktop 的沙箱让 用户能写代码 也 不会破坏系统。

某些场景禁止用户自定义代码（合规要求）。chayuan-desktop 能在配置里全局禁用自定义工具。

## chayuan-server 的对应

chayuan-server 多用户场景下自定义工具是企业级（管理员审核后部署）。chayuan-desktop 单机用户级。

## WPS 加载项

chayuan-wps 在 WPS 里调用自定义 Python 工具走 chayuan-desktop。员工的工具能在 WPS 里复用。

## 总结

自定义 Python 工具的沙箱边界是 chayuan-desktop 在 用户能扩展但不能破坏 上的工程平衡。免费开源的AI软件 让 写代码扩展 AI 能力 是简单事，又不让代码搞坏系统。chayuan-desktop 的 RestrictedPython + 资源限制 + 网络白名单让自定义 Python 工具安全。
