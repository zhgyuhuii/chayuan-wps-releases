# 自定义Python工具 安全沙箱的边界

chayuan-desktop 桌面单机版让 LLM 跑 Python 代码做计算和数据处理。这种 Python eval 工具有安全沙箱的边界。这一篇讲清楚。

工具用途。

用途一：数学计算。LLM 不擅长精确计算，但会写 Python 代码。比如 计算复利、解方程。

用途二：数据处理。pandas 做 dataframe 操作。

用途三：数据可视化。matplotlib 画图。

用途四：临时脚本。处理文件、转换格式。

安全模型。

模型一：受限模块。chayuan-desktop 默认禁用某些危险模块。os.system、subprocess.run、socket、urllib 这些被禁。LLM 不能调系统命令、不能联网。

模型二：受限文件访问。Python 沙箱默认只能读写 CHAYUAN_ROOT/sandbox 目录。读其他系统目录会被拦截。

模型三：内存上限。每个 Python 进程内存限制 1GB。超过被强制 kill。

模型四：CPU 时间限制。30 秒超时。死循环之类的代码被打断。

模型五：进程隔离。每次 Python eval 跑在独立子进程，跟 chayuan-desktop sidecar 隔离。子进程崩了不影响 sidecar。

可用的库。

数学。numpy、scipy、sympy。

数据。pandas、polars。

绘图。matplotlib、plotly。

文本处理。re、json、yaml、csv。

时间。datetime、calendar。

科学计算。statsmodels、scikit-learn。

不可用的（默认）。

网络。requests、urllib、socket。

系统。os.system、subprocess。

文件。open() 受路径限制。

线程。threading 受限制。

LLM 用 Python 工具的实际例子。

例子一：LLM 收到 计算去年我们的复合增长率。LLM 写 Python 用 销售数据 list，调 numpy 算 CAGR。chayuan-desktop 跑代码，返回数字给 LLM。LLM 总结。

例子二：LLM 收到 把这份 CSV 按地区分组求和。LLM 写 pandas 代码。chayuan-desktop 跑，结果给 LLM。

例子三：LLM 收到 画一张柱状图展示销售。LLM 写 matplotlib 代码。chayuan-desktop 跑，输出 PNG。前端展示图。

调用安全。chayuan-desktop 默认要求 Python 工具调用前用户确认（require_confirmation）。某些场景可以关掉确认（信任的工作流）。

国产化支持下的沙箱。麒麟 UOS 上 Python 沙箱用 cgroup 做资源隔离。等保合规场景下加额外审计。

WPS AI 插件 chayuan-wps 在 WPS 里也能用 Python 工具。比如让 LLM 算 Excel 数据生成图表插入 WPS 文档。

Python 工具加沙箱是 chayuan-desktop 给 LLM 的强大能力。免费开源的AI软件 让 LLM 跑代码，但严格控制 跑什么 跟 能访问什么。chayuan-desktop 在沙箱设计上的工作让 LLM 真能干活而不会出乱子。
