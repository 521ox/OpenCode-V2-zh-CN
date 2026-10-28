# OpenCode V2 zh-CN

**社区维护的 OpenCode V2 分支，提供中英文界面与原生工具增强。**

[English](README.md) · [简体中文](README.zh.md)

[功能](#功能) · [下载](#下载) · [构建](#从源码构建) · [贡献](CONTRIBUTING.md) · [维护](UPSTREAM_SYNC.md)

基于开源 AI 编程工具 [OpenCode](https://github.com/anomalyco/opencode)。本项目独立维护，与官方团队没有隶属关系，也不代表官方认可。维护分支为 **`v2-custom-lite`**，持续跟踪官方 **`dev`**；“lite”表示有边界的维护方式，并非仅做汉化。

## 源码与公开二进制

| 类别 | 截至 2026 年 10 月 28 日的状态 |
| --- | --- |
| 维护源码 | 已集成官方 V2 **2.2.0**，本地 Windows x64 构建 `2.2.0-custom-lite.20261028.1` 已验收。详见[源码与验收证据](UPSTREAM_SYNC.md)。 |
| 公开二进制 | [**v2.0.22-zhcn.1**](https://github.com/521ox/OpenCode-V2-zh-CN/releases/tag/v2.0.22-zhcn.1)，2026 年 10 月 4 日发布的未签名预发布版本。2.2.0 源码／本地构建**不代表六平台版本已公开发布**。 |

已发布附件见[全部 Releases](https://github.com/521ox/OpenCode-V2-zh-CN/releases)。旧 `main` 分支和 `v1.18.4-zhcn.*` Releases 不代表当前 V2 分支。官方安装器、npm 包及更新提供官方构建，可能覆盖二开功能；本分支不改变该更新策略。

## 功能

| 领域 | 定制行为 |
| --- | --- |
| 中文 / English | TUI、Mini 和 CLI-run 界面默认简体中文，可选择英文并保留英文回退；模型／工具输出与协议数据保持原样。 |
| 原生工具 | `environment_tools` 记录并重新验证程序；`direct_exec` 使用目录 ID 和参数数组执行已验证的原生 EXE/COM，仍受执行权限约束。 |
| 会话记忆 | 根会话与子会话共享受保护的精简续接记忆位置，强调优先使用当前对话、按需读取和维护当前状态。 |
| 子代理导航 | 可信的已完成结果在提供方限制内保留完整最终回复；显示会话身份，并可打开既有子会话。 |
| 托管搜索 | 受支持的原生 OpenAI/xAI Responses 路由仅在有效权限允许时提供搜索；仍取决于模型和账户资格。 |
| 临时产物 | 为 Agent 提供任务自有产物清理指引，不是自动清理服务。 |

精确行为、保留的修复及非目标见 [CUSTOMIZATIONS.md](CUSTOMIZATIONS.md)。维护证据与已知失败见 [UPSTREAM_SYNC.md](UPSTREAM_SYNC.md)。

## 下载

从 **`2.x-zhcn.N` [Release](https://github.com/521ox/OpenCode-V2-zh-CN/releases)** 选择对应附件：

| 系统 | 架构 | 文件 |
| --- | --- | --- |
| Windows | x64、ARM64 | `opencode-windows-<arch>.zip` |
| Linux（glibc） | x64、ARM64 | `opencode-linux-<arch>.tar.gz` |
| macOS | x64、ARM64 | `opencode-darwin-<arch>.tar.gz` |

**完整解压**后运行 `cli-<platform>-<arch>/bin/opencode`，Windows 使用 `opencode.exe`。这是内嵌 WebUI 的 CLI 包，**不是 Electron 桌面安装器**；不包含 Linux musl 版本。二进制未签名，macOS 包也未经公证。

运行前与 Release 的 `SHA256SUMS` 比对：Windows 使用 `Get-FileHash -Algorithm SHA256 <archive>`，Linux 使用 `sha256sum <archive>`，macOS 使用 `shasum -a 256 <archive>`。`release-manifest.json` 与各目标元数据记录源码、运行时和文件摘要。

## 从源码构建

Windows x64 示例，需要 **Bun 1.4.4**、**Node 24** 及支持符号链接的 Git，在 PowerShell 中执行：

```powershell
git clone -c core.symlinks=true --branch v2-custom-lite https://github.com/521ox/OpenCode-V2-zh-CN.git
cd OpenCode-V2-zh-CN
$env:ELECTRON_SKIP_BINARY_DOWNLOAD = "1"
$env:HUSKY = "0"
bun install --linker hoisted --frozen-lockfile
cd packages/cli
$env:OPENCODE_VERSION = "2.2.0-custom-local.1"
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

- 必要 CI 覆盖有界的 CLI／定制源码检查和 Windows 夹具，不代表全仓库、浏览器／Electron 或六平台发布验证。已知 Console 类型检查和 Client 重连失败继续保留在维护记录中。
- 本地合成历史验证不证明真实用户数据迁移、未完成旧状态或回滚兼容性。历史 `v2.0.15-zhcn.1` 附件仍有旧图片压缩记录兼容性问题，请查阅维护记录，不要删除会话历史来绕过。
- 启动／服务生命周期调整，以及后台工作重新激活子会话后的后续父会话通知，不属于这些已保留增强。

## 文档与许可

[官方 V2 文档](https://opencode.ai/v2/docs/) 说明上游用法；[CUSTOMIZATIONS.md](CUSTOMIZATIONS.md) 定义本分支差异。English 与简体中文是本分支维护的 README 入口，其余语言 README 保留上游内容。

基于 OpenCode 及其贡献者的工作，保留 [MIT 许可证](LICENSE) 和上游版权声明。
