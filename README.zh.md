# OpenCode V2 中文增强版

这是社区独立维护的 [OpenCode](https://github.com/anomalyco/opencode) 汉化版，默认使用简体中文终端界面，也可以切回英文。除了界面翻译，你还可以折叠连续的原生工具调用，或点击子代理任务标题，直接打开对应会话。本项目不是官方发行版，与官方团队没有隶属关系，也不代表官方认可。

[English](README.md) · [功能](#功能) · [下载与校验](#下载) · [从源码构建](#从源码构建) · [贡献指南](CONTRIBUTING.md)

**[下载 Windows、macOS 或 Linux 预编译包：v2.0.22-zhcn.1](https://github.com/521ox/OpenCode-V2-zh-CN/releases/tag/v2.0.22-zhcn.1)**（未签名预发布，2026 年 10 月 4 日发布）。维护分支的源码版本是 **2.3.0**，该版本的六平台二进制尚未公开发布。

## 功能

以下介绍的是 `v2-custom-lite` 维护分支。使用旧版预编译包时，请以对应版本的发布说明为准。

| 功能 | 你可以怎么用 |
| --- | --- |
| 中英双语界面 | TUI、Mini 和 `opencode run` 的界面默认使用简体中文，也可选英文。只翻译界面文字，模型回复、工具输出和协议数据保持原样。 |
| 原生工具 | `environment_tools` 记录并重新校验程序；`direct_exec` 按已登记程序的条目 ID 和参数数组执行原生 EXE/COM，仍需执行权限。TUI 开启自动分组时，连续调用可折叠在一起，点开即可看详情。 |
| 父子会话共享工作记忆 | 同一个根会话及其派生的子会话共享一处受保护的续接笔记。代理优先使用当前对话，缺少信息时才按需读取；独立新开的会话不共享这份记忆。 |
| 子代理导航 | 点击完成通知里 `·` 后面的任务标题，直接打开对应子会话。父代理可在服务商限制内收到完整的最终回复；后续结论的送达沿用上游机制。 |
| 托管搜索 | 在支持的 OpenAI 或 xAI Responses 路由上，可以调用服务商原生搜索；是否可用取决于有效权限、模型能力和账户资格。 |
| 临时文件 | 内置指引要求代理在不再需要时删除自己为任务创建的临时文件，不是后台自动清理服务。 |

精确行为、保留的修复及非目标见 [CUSTOMIZATIONS.md](CUSTOMIZATIONS.md)。维护证据与已知失败见 [UPSTREAM_SYNC.md](UPSTREAM_SYNC.md)。

## 下载

从 **`2.x-zhcn.N` [Release](https://github.com/521ox/OpenCode-V2-zh-CN/releases)** 选择对应附件：

| 系统           | 架构       | 文件                            |
| -------------- | ---------- | ------------------------------- |
| Windows        | x64、ARM64 | `opencode-windows-<arch>.zip`   |
| Linux（glibc） | x64、ARM64 | `opencode-linux-<arch>.tar.gz`  |
| macOS          | x64、ARM64 | `opencode-darwin-<arch>.tar.gz` |

**完整解压**后运行 `cli-<platform>-<arch>/bin/opencode`，Windows 使用 `opencode.exe`。这是内嵌 WebUI 的 CLI 包，**不是 Electron 桌面安装器**；不包含 Linux musl 版本。二进制未签名，macOS 包也未经公证。

运行前与 Release 的 `SHA256SUMS` 比对：Windows 使用 `Get-FileHash -Algorithm SHA256 <archive>`，Linux 使用 `sha256sum <archive>`，macOS 使用 `shasum -a 256 <archive>`。`release-manifest.json` 与各目标元数据记录源码、运行时和文件摘要。

### 源码与公开二进制

`v2-custom-lite` 持续跟踪官方 `dev`；“lite”指尽量少改上游，不代表只做翻译。已验收的源码版本和检查结果见[上游同步记录](UPSTREAM_SYNC.md)。旧 `main` 分支和 `v1.18.4-zhcn.*` 发布包不属于这条 V2 分支。官方安装器、npm 包及更新提供的是官方构建，可能覆盖本分支的汉化和其他增强。

## 从源码构建

Windows x64 示例，需要 **Bun 1.4.4**、**Node 24** 及支持符号链接的 Git，在 PowerShell 中执行：

```powershell
git clone -c core.symlinks=true --branch v2-custom-lite https://github.com/521ox/OpenCode-V2-zh-CN.git
cd OpenCode-V2-zh-CN
$env:ELECTRON_SKIP_BINARY_DOWNLOAD = "1"
$env:HUSKY = "0"
bun install --linker hoisted --frozen-lockfile
cd packages/cli
$env:OPENCODE_VERSION = "2.3.0-custom-local.1"
$env:OPENCODE_CHANNEL = "latest"
$env:OPENCODE_TARGET = "windows-x64"
bun script/build.ts --skip-install
```

请为自己的源码版本使用独立版本号；仅使用某个已验收版本号不代表复现了该产物。官方构建入口重新创建 CLI `dist`，输出 `packages/cli/dist/cli-windows-x64/bin/opencode.exe`，包含字节码与完整内嵌 WebUI。使用 `--skip-install` 前需完成根目录安装，目标平台由 `OPENCODE_TARGET` 选择。

`OPENCODE_CHANNEL=latest` 保持常规数据库、服务和 TUI 存储身份；`local` 使用不同状态。它不表示使用自定义更新源。构建不会安装或启用程序；替换安装前请保留旧程序和用户状态的一致备份。

## 贡献与维护

**Issue → 功能分支 → PR → 必要检查及适用审查 → merge commit。**

PR 以 `v2-custom-lite` 为目标。已授权任务通过必要检查与审查后，Agent 可按任务的集成职责完成合并；重大产品决定及发布仍需单独授权。官方同步同样通过 PR，并保留上游合并祖先关系。六平台发布继续**手动触发**，不会因合并自动发布。

- [CONTRIBUTING.md](CONTRIBUTING.md)：任务负责人、PR 要求、CI 覆盖范围与合并权限。
- [AGENTS.md](AGENTS.md)：仓库工程约定。
- [UPSTREAM_SYNC.md](UPSTREAM_SYNC.md)：同步流程与验收证据。

## 验证限制

- 必要 CI 覆盖有界的 CLI／定制源码检查和 Windows 夹具，不代表全仓库、浏览器／Electron 或六平台发布验证。当前 Windows 根 lint、Site 类型检查和 Client 重连失败记录在维护文档中。
- 本地合成历史验证不证明真实用户数据迁移、未完成旧状态或回滚兼容性。历史 `v2.0.15-zhcn.1` 附件仍有旧图片压缩记录兼容性问题，请查阅维护记录，不要删除会话历史来绕过。
- 服务生命周期与重复子代理报告遵循当前上游实现；本分支不另建调度器或通知策略。

## 文档与许可

[官方 V2 文档](https://opencode.ai/v2/docs/) 说明上游用法；[CUSTOMIZATIONS.md](CUSTOMIZATIONS.md) 定义本分支差异。English 与简体中文是本分支维护的 README 入口，其余语言 README 保留上游内容。

基于 OpenCode 及其贡献者的工作，保留 [MIT 许可证](LICENSE) 和上游版权声明。
