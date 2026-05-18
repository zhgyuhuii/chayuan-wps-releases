# 私库与文档RAG不冲突 同一份资料不同读者

chayuan-desktop 桌面单机版的 office:* 私库跟 doc:* 文档库是不同命名空间。同一份资料在两边并存是常见场景。这一篇讲清楚。

## 场景设定

部门有一份《年度战略报告》PDF。部门里所有人都该看（部门级），管理层有自己的批注版（管理层私库），张三在自己电脑上保留了一份带个人笔记的副本（个人私库）。三份资料指向同一原文，但读者范围不同。

## 三种 KB 的并存

doc:战略报告 公开文档库。所有员工可见。最干净版（无批注）。

office:dept_management:strategy 管理层私库。带管理层批注的版本。只有管理层可见。

office:zhangsan:strategy 张三个人库。带张三个人笔记的版本。只有张三可见。

三个 KB 各自独立。

## 检索时的混选

张三可以在 KB 选择器里勾上自己的 office:zhangsan:strategy 加 doc:战略报告。两边的 chunk 都参与检索。

张三看不到 office:dept_management:strategy（无权限）。

管理层成员可以勾自己的 office:dept_management:strategy 加 doc:战略报告。

每种身份按权限看到不同 KB 组合。

## 引用气泡的差异

doc:战略报告 来源的引用气泡：蓝色边框，下载原 PDF 按钮可用。

office:zhangsan:strategy 来源的引用气泡：橙色边框，跳转到张三本机的笔记副本。

office:dept_management:strategy 来源的引用气泡（管理层看到）：橙色边框，跳转到管理层批注版。

前端按 kind 字段分流渲染，三种气泡视觉区分。

## 数据冗余的代价

同一份资料三份索引。每份占用存储。如果 PDF 很大或者批注笔记多，存储成本累积。一般可以接受，因为版本不同各有价值。

## 同步策略

doc:战略报告 由 IT 维护。每年更新一次。所有员工 folder-sync 同步部门 NAS 上的官方版本。

office:dept_management:strategy 由管理层秘书维护。批注版加上去后管理层成员各自同步。

office:zhangsan:strategy 张三自己维护。私人笔记加上去。

## 跨 KB 一致性

如果原报告改了版本，三个 KB 都要更新。chayuan-desktop 不自动同步跨 KB 内容（这是手动维护）。某些版本工具（git）可以辅助。

## 国产化场景

政府公文典型场景。一份政策文件公开，部门加批注版，个人加学习笔记版。三种 KB 命名空间天然映射。

## WPS 加载项的支持

chayuan-wps 在 WPS 里挑 KB 时按当前用户身份过滤显示。员工只看到自己有权限的 KB。检索一致。

## 总结

私库与文档 RAG 不冲突。chayuan-desktop 的命名空间设计让 同一资料不同读者 这件事在工程上自然成立。免费开源的AI软件 在精细数据组织上的能力让真实办公场景能完整覆盖。
