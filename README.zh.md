# OpenCode V2 zh-CN — 中文增强版

[English](README.md) | [简体中文](README.zh.md)

这是基于开源 AI 编程工具 [OpenCode](https://github.com/anomalyco/opencode) 的社区维护分支。本项目并非 OpenCode 团队开发，与官方团队没有隶属关系，也不代表官方认可。

## 源码与发布状态

本项目在现有 [521ox/opencode2-zh-CN 仓库](https://github.com/521ox/opencode2-zh-CN) 中以 **`v2-custom-lite`** 作为当前维护的默认分支。

- 原 `main` 分支、旧标签和 `v1.18.4-zhcn.*` Releases 保留为历史。这些二进制文件**不是**当前 V2 增强版的安装包。
- 原生二进制由 `v2-custom-lite` 分支上的 **Release enhanced V2 CLI** 工作流手动触发生成，覆盖 Windows、Linux glibc、macOS 的 x64 和 ARM64。六种目标及已下载的草稿附件全部验证通过后，才发布未签名的预发布版本。首个 V2 增强版预发布 [**`v2.0.12-zhcn.1`**](https://github.com/521ox/opencode2-zh-CN/releases/tag/v2.0.12-zhcn.1) 已于 2026 年 9 月 22 日发布，六种原生包均已提供。请使用对应的 `2.x-zhcn.N` 附件，不要把旧 `1.18.4-zhcn.*` 安装包当成当前版本。
- 官方安装器、npm 包和官方更新器提供的是官方构建，不是此二开发行版。接受官方更新可能覆盖二开功能；本分支没有改变上游更新策略。

本分支持续同步官方 V2，围绕界面本地化、原生工具、会话与子代理交互、搜索权限和执行可靠性进行了多项实质增强。维护上强调改动边界清晰、沿用官方模块职责，不整体恢复旧二开的复杂实现。内部名称 `v2-custom-lite` 表达的是这种维护方式，并不意味着只做汉化或功能很少。

旧版二进制发布工作流继续停用。新发布流程复用当前官方构建入口、固定版本的环境／产物 Actions 和 GitHub CLI，不恢复官方部署或社区运维自动化。另外四个上游验证工作流仍保留为源码参考，其分支过滤、运行器及允许使用的 Actions 尚未适配或验收为本仓库的 CI。

### 原生下载包与校验

每个新 Release 包含 `opencode-windows-{x64,arm64}.zip`、`opencode-linux-{x64,arm64}.tar.gz`、`opencode-darwin-{x64,arm64}.tar.gz`，以及六个 JSON 元数据文件、`release-manifest.json` 和 `SHA256SUMS`。完整解压后运行 `cli-<platform>-<arch>/bin/opencode`，Windows 使用 `opencode.exe`。Linux 包适用于 glibc，不是 musl。这些是内嵌 WebUI 的 CLI 包，不是 Electron 桌面安装器。

运行前请将下载包与 `SHA256SUMS` 对照：Windows 使用 `Get-FileHash -Algorithm SHA256 <archive>`，Linux 使用 `sha256sum <archive>`，macOS 使用 `shasum -a 256 <archive>`。清单记录精确源码提交、Bun 运行时、原生目标和实际文件摘要。二进制尚未代码签名，macOS 包也未经公证，系统可能显示安全提示。原生发布检查不等于完整功能测试或真实用户数据迁移认证。

## 定制内容

- **简体中文 / English 界面文字。** TUI、Mini 和 CLI-run 的界面默认使用简体中文，可选择 English，并保留英文回退。通过现有设置对话框选择语言。模型和工具输出、标识符及协议数据不翻译；Mini 在启动时读取语言。早期帮助、启动输出和原生参数解析输出的翻译范围更窄，详见下方功能文档。
- **环境目录与原生执行。** `environment_tools` 记录并重新验证已知程序；目录中没有记录不代表程序不存在。`direct_exec` 使用目录 ID 和参数数组执行已验证的原生 EXE/COM，仍受执行权限约束。Shell 语法、自定义环境、stdin 和后台执行仍由 Shell 工具处理。两者复用官方可折叠工具块；自动分组时，相邻 `direct_exec` 调用合并为执行集合，同时保留审批和失败状态的可见性。
- **子代理结果与导航。** 已完成且可信的结果保留完整最终回复及官方子会话身份信息，仍受提供方上下文限制。管理列表显示子会话 ID，完成通知中的任务标题可打开既有子会话。可见的 `×` 关闭控件复用官方动作。这些功能不代表已修复子代理后续通知恢复。
- **受保护的会话规则上下文。** 普通 Agent 请求获得根会话的规则目录位置，后代会话通过持久化父子关系共享该位置。解析过程不创建文件；用户指令和权威项目路径优先。
- **权限控制的原生托管搜索。** 受支持的原生 OpenAI 和 xAI Responses 路由仅在有效授权不受限制时声明托管搜索能力。限制性或无法确认的权限策略会阻止该能力；已禁用的搜索不会被重新加入。这不表示所有提供方都默认启用，也不保证账户或模型有使用资格。原生压缩及恢复机制沿用官方实现，没有自定义覆盖，也不声称所有提供方都支持原生压缩。
- **任务临时产物清理指引。** 提示 Agent 在现有权限内清理自己创建且不再需要的临时产物，并解释需要保留的证据。这是提示词指引，不是自动清理服务，也不保证模型一定执行。
- **少量上游缺陷修复。** 在既有模块内修复流捕获结束、客户端过期结果发布、后台标签的 Location 请求准入及 Console 策略失败与发布处理，不引入第二套策略或生命周期系统。

精确行为、搜索授权、非目标和操作边界见 [CUSTOMIZATIONS.md](CUSTOMIZATIONS.md)；源码来源与维护历史见 [UPSTREAM_SYNC.md](UPSTREAM_SYNC.md)。

## 从源码构建（Windows x64）

使用 **Bun 1.4.2** 和 Git。在自行选择的开发目录中打开 PowerShell，执行以下命令：

```powershell
git clone --branch v2-custom-lite https://github.com/521ox/opencode2-zh-CN.git
cd opencode2-zh-CN
bun install --linker hoisted --frozen-lockfile
cd packages/cli
$env:OPENCODE_VERSION = "2.0.12-custom-lite.20260922.1"
$env:OPENCODE_CHANNEL = "latest"
bun script/build.ts --target=opencode-windows-x64 --skip-install
```

示例版本标识已验收的源码基线；修改源码后构建应使用不同的自定义版本号。该命令使用现有构建脚本生成包含字节码和内嵌 WebUI 的 Windows x64 CLI。可执行文件位于相对仓库根目录的 `packages/cli/dist/cli-windows-x64/bin/opencode.exe`。构建会重新创建 CLI 的 `dist` 目录。`--skip-install` 跳过构建脚本额外安装依赖的步骤，因此需要先完成根目录的依赖安装。

保留明确的自定义 `OPENCODE_VERSION` 和 **`OPENCODE_CHANNEL=latest`**。频道决定数据库、服务和 TUI 的存储身份；`local` 使用另一套状态，不适合直接替换现有版本。这里的 `latest` 不表示已公开发布，也不是自定义更新源。构建不会自动安装、启用或验证新程序对你个人数据的兼容性。

## 验证范围与已知限制

2026 年 9 月 22 日本地 Windows x64 候选版本 `2.0.12-custom-lite.20260922.1` 基于官方 V2 `b8aa08f260130452dc87fbc20c2a4e2ff743e642`。已有验收记录覆盖 1,136 项聚焦用例、11 个包的类型检查、完整 Windows 字节码/WebUI 构建，以及隔离的已填充旧格式合成数据库冒烟验证。这些是此前已有且有范围的结果，不是此次 README 更新产生的新运行验证，也不代表六平台发布认证或 Electron Desktop 验证。

- 启动延迟和默认共享服务退出/生命周期调整仍然延期。
- 子会话被后续后台 Shell 工作重新激活后，继续向父会话发送通知的问题仍未解决。
- 已知上游测试限制及更细的验证范围继续记录在维护文档中。
- 已完成并物化的历史记录可读，不代表未完成的旧二开 sidecar 状态、已退休执行状态或迁移后的回滚完全兼容。

替换已安装程序或在真实数据上启用前，请保留旧可执行文件与用户状态的一致备份。个人配置、凭据和真实数据库不应进入源码提交或验证夹具。本次源码切换不提供迁移或转换工具。

## 文档与致谢

- [OpenCode 官方 V2 文档](https://opencode.ai/v2/docs/) 说明上游用法；本分支差异以 [CUSTOMIZATIONS.md](CUSTOMIZATIONS.md) 为准。
- [上游同步说明](UPSTREAM_SYNC.md) 记录如何维护有边界的定制功能。
- English 和简体中文是此二开分支的 README 入口。其他语言 README 保留为上游资料，不是此二开发行版的功能规范。

本项目基于 OpenCode 及其贡献者的工作，保留现有 [MIT 许可证](LICENSE) 与上游版权声明。
