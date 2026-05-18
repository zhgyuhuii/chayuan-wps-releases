# 桌面端的tailwindcss工程化 主题切换的代价

chayuan-desktop 桌面单机版前端用 Tailwind CSS 做样式系统。这是 Web 开发里流行的方案，但桌面端有几个不太一样的考虑：暗色主题、字号自定义、跟系统主题联动、原生窗口边距处理。这一篇讲 chayuan-desktop 的 Tailwind 工程化。

先看选 Tailwind 的理由。组件库主题统一容易（设计 token 集中管理）、构建产物体积小（PurgeCSS 只保留用到的类）、跟 React 配合顺畅、社区资源多。这些理由对桌面端跟 Web 端一样适用。

主题切换。chayuan-desktop 支持 浅色 / 深色 / 跟随系统 三种主题。Tailwind v3 的 dark: 变体让深色样式直接写在组件里：bg-white dark:bg-gray-900。chayuan-desktop 在根 html 元素上加 .dark 类切换。跟随系统模式下监听 prefers-color-scheme media query 自动切换。

主题颜色 token。Tailwind 的默认色板太多用不上。chayuan-desktop 在 tailwind.config.js 里覆盖 colors 字段，定义自己的 brand-primary、brand-secondary、surface、text-primary、text-secondary 等语义化 token。组件用 token 不用具体颜色，主题切换只改 token 定义即可。

字号自定义。用户可以在设置里调整字号（小 / 中 / 大 / 超大）。Tailwind 默认的 text-base 是 16px，但 chayuan-desktop 用 CSS 变量配合 Tailwind plugin，让 text-base 在不同字号档位下解析为不同值。具体做法是在 :root 上设置 --base-font-size，Tailwind 配置里把 fontSize.base 设为 calc(var(--base-font-size, 16px))。

自适应字号的代价。需要重新布局组件，确保字号变化时不破坏布局。chayuan-desktop 在大字号场景下做了几个 UI 微调：对话气泡 padding 自适应、按钮 minHeight 跟字号绑定、表格行高动态计算。

跟原生窗口边距。Tauri 2 默认窗口有原生边框，但 chayuan-desktop 用了无边框窗口（decorations: false）加自定义标题栏。这意味着标题栏要自己画。Tailwind 让这个标题栏的样式跟其他组件一致，用 backdrop-blur、bg-surface/80 这种现代 CSS 实现毛玻璃效果。

暗色主题的具体颜色。Tailwind 默认的 dark:bg-gray-900 在高对比度需求下偏黑，chayuan-desktop 调到 #18191a 这种带灰度的纯黑。具体值在 tailwind.config 里集中管理。

国产化支持下的主题考虑。麒麟、UOS 系统的默认配色风格跟 macOS Linux 主流配色略有差异。chayuan-desktop 不强制做 国产风 主题，但保留了主题颜色的可定制性，企业部署时可以自定义。

构建产物。Tailwind 生成的 CSS 经过 PurgeCSS 清理后，chayuan-desktop 主界面 CSS 约 30-50KB（gzip 后 10-15KB）。这个体积对桌面应用是可忽略的。

JIT 模式。Tailwind v3 默认 JIT，按需生成 CSS 类。chayuan-desktop 的开发态体验受益于 JIT，每次改 className 立刻生效，不需要等全量构建。

Tailwind 的局限。复杂动画、复杂布局、自定义滤镜这些场景 Tailwind 写起来不那么直观。chayuan-desktop 在这些场景下用 CSS module 或 inline style 补足。Tailwind 不是唯一选择，是默认选择。

Tailwind 的版本。chayuan-desktop 当前用 Tailwind v3。v4 在路上，性能更好且配置文件简化。升级到 v4 是计划中的工作。

跟 Radix UI 的协作。chayuan-desktop 的复杂组件（下拉菜单、对话框、Tooltip）用 Radix UI 的 unstyled 组件，再用 Tailwind 加样式。这种 unstyled + Tailwind 的组合在 React 桌面应用里是流行模式。

主题切换的性能。CSS 变量切换比传统的 CSS 文件切换性能更好，不会有 FOUC（无样式闪烁）。chayuan-desktop 的主题切换在 60fps 范围内完成。

设置页的主题切换 UX。chayuan-desktop 的设置页有一个 主题 区，三个按钮（浅 / 深 / 跟随系统）实时预览。点哪个立刻切，不需要重启应用。这种即时反馈让用户摸索主题感很顺。

无障碍性（a11y）。深色主题下的对比度要保持 WCAG AA 标准。chayuan-desktop 的 brand 颜色经过对比度验证，在浅色和深色下文字都可读。

WPS AI 插件 chayuan-wps 用 Vue 3，样式系统是 SCSS + scoped style，没用 Tailwind。两个产品的样式技术栈不同，但视觉语言（颜色、字号、间距）保持一致，通过共用一份设计 token 文档对齐。

Tailwind 在 chayuan-desktop 的工程化是 务实选择 的体现：不追新但跟潮流、不过度抽象、能解决问题。免费开源的AI软件 在样式工程上的成本控制，对长期维护重要。
