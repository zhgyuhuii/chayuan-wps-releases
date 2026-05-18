# 私库与角色 RBAC 单机版的简化模型

chayuan-desktop 桌面单机版的 office:* 私库支持基于角色的访问控制（RBAC）。不过单机版的 RBAC 模型比服务端简化。这一篇讲。

## 服务端版 RBAC 的复杂度

chayuan-server 的 RBAC 含。

角色定义。admin、editor、viewer、guest 等。

权限粒度。read、write、delete、share、export 各自独立。

资源对象。KB 级、chunk 级、字段级。

继承层级。部门级 → 团队级 → 个人级。

策略组合。角色 + 资源 + 动作的笛卡尔积。

陈陈复杂。需要专门的 IAM 系统。

## 单机版的简化模型

chayuan-desktop 单机版假设。

通常一个用户一台电脑。 OS 账号已经做了第一层隔离。

最多支持 多身份切换（同一台电脑张三和李四共用，分别登录）。

角色简化为三级。owner（所有者）、reader（只读）、none（无访问）。

资源粒度仅到 KB 级。不支持 chunk 级 ACL。

## 实际的权限场景

场景一。zhangsan 自己用。所有 office:zhangsan:* KB 默认 owner。完全访问。

场景二。lisi 用同一台电脑（同 OS 账号或不同 OS 账号）。chayuan-desktop 多身份模式。lisi 看不到 zhangsan 的 office:zhangsan:* KB。是 none 关系。

场景三。dept_legal 共享 KB。office:dept_legal:contracts 这个 KB 配置 owners=[zhangsan, lisi]，readers=[wangwu]。zhangsan 和 lisi 能写，wangwu 只能读。

## 配置方式

chayuan-desktop KB 设置 - 权限。每个 KB 独立配置 owners 和 readers 列表。列表内是身份 ID（zhangsan 等）。

不在两个列表里的身份对该 KB 是 none。

## 默认策略

新建 office:zhangsan:* KB。默认 owners=[zhangsan]，readers=[]。私有给自己。

新建 office:dept_legal:* KB。默认 owners=[当前操作者]，readers=[]。需要管理员手动加成员。

## 跨身份的检索

身份切换时 chayuan-desktop 重新加载有权限的 KB 列表。检索时自动过滤无权限的 KB。即使用户在 KB 选择器里打勾了某个无权限 KB，检索也跳过。

## 引用气泡的可见性

如果 zhangsan 的历史会话引用了某 chunk。后来 zhangsan 失去对该 KB 的权限（比如管理员撤了 zhangsan 的访问）。重打开会话时该引用气泡显示 您已无权访问此引用。

## 操作的权限检查

每个 API 请求都做权限检查。

read（检索）。需要 reader 或 owner。

write（加 chunk、改 chunk）。需要 owner。

delete（删 chunk、删 KB）。需要 owner。

share（修改 KB 的 ACL）。需要 owner。

export（导出 KB）。需要 owner（避免 reader 一键导出整库泄露）。

## 权限变更的审计

ACL 修改写入审计日志。谁在什么时候把谁加为 owner / reader / 移除。等保审计场景必备。

## 局限性和未来扩展

单机版当前不支持。

chunk 级 ACL。某些场景某些 chunk 应该只对部分人可见。

时效性 ACL。比如 这个权限 7 天后自动过期。

条件性 ACL。比如 仅工作时间可访问。

这些在 chayuan-server 多用户版有。chayuan-desktop 路线图按需补充。

## 国产化场景

政企的角色权限模型常用 部门 + 角色 + 项目组 三维。chayuan-desktop 的 KB 命名空间 owner[:group] 隐含了部分。复杂场景通过多 KB 组合。

## WPS 加载项

chayuan-wps 在 WPS 里挑 KB 时按当前身份过滤显示。员工只看到有权限的 KB。这是 chayuan-desktop 的 RBAC 在 WPS 内的延伸。

## 总结

私库的 RBAC 单机简化版是 chayuan-desktop 在桌面场景的合理取舍。免费开源的AI软件 想覆盖政企必须有 RBAC，但单机不必上服务端的复杂度。chayuan-desktop 的 owner / reader / none 三级模型在多数场景够用，复杂场景升级到 chayuan-server。
