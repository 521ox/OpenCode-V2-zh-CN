import { ScrollBoxRenderable, TextareaRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import type {
  ConnectionInfo,
  IntegrationCommandConnectOutput,
  IntegrationInfo,
  IntegrationOauthConnectOutput,
  IntegrationOAuthMethod,
  FormAnswer,
  FormField,
  FormFields,
  FormValue,
  LocationRef,
} from "@opencode/client"
import { openUrl } from "@opencode/util/open"
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import { useNewDesigns } from "../config"
import { useClipboard } from "../context/clipboard"
import { useData } from "../context/data"
import { useClient } from "../context/client"
import { Keymap } from "../context/keymap"
import { useLocation } from "../context/location"
import { useTheme } from "../context/theme"
import {
  DIALOG_INSET,
  DIALOG_LIST_INSET,
  DialogBleed,
  DialogFooter,
  DialogHeader,
  DialogLayout,
  useDialog,
} from "../ui/dialog"
import { DialogPrompt } from "../ui/dialog-prompt"
import { DialogSelect } from "../ui/dialog-select"
import { Link } from "../ui/link"
import { useToast } from "../ui/toast"
import { errorMessage } from "../util/error"
import { useI18n } from "../context/i18n"
import { translate, type Key, type Translator } from "../i18n"
import {
  formInitialValues,
  formLabel,
  formRows,
  formSelected,
  formToggleMultiselect,
  formValidateValue,
  type FormAnswerField,
} from "../util/form"

const INTEGRATION_PRIORITY: Record<string, number> = {
  opencode: 0,
  "opencode-go": 1,
  openai: 2,
  "github-copilot": 3,
  anthropic: 4,
  google: 5,
}

type ConnectMethod = Exclude<IntegrationInfo["methods"][number], { type: "env" }>
type IntegrationAttempt = IntegrationOauthConnectOutput["data"]
type CommandAttempt = IntegrationCommandConnectOutput["data"]
type OnIntegrationConnected = (providerID?: string) => void
const CANCELLED = Symbol("cancelled")
const CUSTOM = Symbol("custom")
const OPEN = Symbol("open")
const SUBMIT = Symbol("submit")
// Device-flow codes such as "R283-GOUEO"; when present they are copied instead of the URL.
const OAUTH_CODE = /[A-Z0-9]{4}-[A-Z0-9]{4,5}/

export function integrationOptions(list: IntegrationInfo[]) {
  return list.toSorted(
    (a, b) =>
      Number(b.metadata?.source === "mcp") - Number(a.metadata?.source === "mcp") ||
      (INTEGRATION_PRIORITY[a.id] ?? 99) - (INTEGRATION_PRIORITY[b.id] ?? 99) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  )
}

export function connectMethods(integration: IntegrationInfo): ConnectMethod[] {
  return integration.methods
    .filter((method): method is ConnectMethod => method.type !== "env")
    .toSorted((a, b) => Number(a.type === "key") - Number(b.type === "key"))
}

export function credentialConnections(integration: IntegrationInfo) {
  return integration.connections.filter(
    (connection): connection is Extract<ConnectionInfo, { type: "credential" }> => connection.type === "credential",
  )
}

// A count keeps several long labels from squeezing the integration name off the row.
export function connectionSummary(
  integration: IntegrationInfo,
  t: Translator<Key> = (key, params) => translate("en", key, params),
) {
  const connections = integration.connections
  if (connections.length > 1) return t("main.integration.connections", { count: connections.length })
  const connection = connections[0]
  if (!connection) return ""
  return connection.type === "credential" ? connection.label : `$${connection.name}`
}

export function DialogIntegration(
  props: { onConnected?: OnIntegrationConnected; integrationID?: string; autoConnect?: boolean } = {},
) {
  const { t } = useI18n()
  const data = useData()
  const currentLocation = useLocation()
  const dialog = useDialog()
  const theme = useTheme().surface("dialog")
  const location = currentLocation.ref ?? data.location.default()
  const integrations = createMemo(() =>
    integrationOptions(data.location.integration.list(location) ?? []).filter(
      (integration) => props.integrationID === undefined || integration.id === props.integrationID,
    ),
  )

  createEffect(() => {
    if (!props.autoConnect) return
    const integration = integrations()[0]
    if (!integration) return
    const methods = connectMethods(integration)
    if (credentialConnections(integration).length) {
      untrack(() => manageConnections(integration, methods, location, dialog, props.onConnected))
      return
    }
    untrack(() => selectMethod(integration, methods, location, dialog, t, props.onConnected))
  })

  const options = createMemo(() => {
    return integrations().map((integration) => {
      const methods = connectMethods(integration)
      const credentials = credentialConnections(integration)
      let category = t("main.integration.services")
      if (integration.id in INTEGRATION_PRIORITY) category = t("main.integration.popular")
      if (integration.metadata?.source === "mcp") category = "MCP"
      const status = integration.connections[0]?.status
      return {
        title: integration.name,
        value: integration.id,
        description: methods.length === 0 ? t("main.integration.environment") : undefined,
        footer: status ? t("main.integration.signInRequired") : connectionSummary(integration, t) || undefined,
        footerColor: status ? theme.text.feedback.warning.base : undefined,
        category,
        disabled: methods.length === 0 && credentials.length === 0,
        gutter:
          integration.connections.length > 0 && !status
            ? () => <text fg={theme.text.feedback.success.base}>✓</text>
            : undefined,
        onSelect: () => {
          if (credentials.length) return manageConnections(integration, methods, location, dialog, props.onConnected)
          return selectMethod(integration, methods, location, dialog, t, props.onConnected)
        },
      }
    })
  })

  return (
    <DialogSelect
      title={t("main.command.integration")}
      options={options()}
      emptyView={
        <box paddingLeft={DIALOG_LIST_INSET} paddingRight={DIALOG_LIST_INSET}>
          <text fg={theme.text.muted}>{t("main.integration.empty")}</text>
        </box>
      }
      noMatchView={
        <box paddingLeft={DIALOG_LIST_INSET} paddingRight={DIALOG_LIST_INSET}>
          <text fg={theme.text.muted}>{t("main.integration.noMatch")}</text>
        </box>
      }
    />
  )
}

function manageConnections(
  integration: IntegrationInfo,
  methods: ConnectMethod[],
  location: LocationRef,
  dialog: ReturnType<typeof useDialog>,
  onConnected?: OnIntegrationConnected,
) {
  dialog.replace(() => {
    const { t } = useI18n()
    const data = useData()
    const client = useClient()
    const toast = useToast()
    const theme = useTheme().surface("dialog")
    const shortcuts = Keymap.useShortcuts()
    const newDesigns = useNewDesigns()
    const [deleting, setDeleting] = createSignal<string>()
    const [selected, setSelected] = createSignal(methods.length ? "add" : credentialConnections(integration)[0]?.id)
    const current = createMemo(() =>
      data.location.integration.list(location)?.find((item) => item.id === integration.id),
    )

    return (
      <DialogSelect
        title={integration.name}
        current={credentialConnections(current() ?? integration)[0]?.id}
        focusCurrent={false}
        preserveSelection
        onMove={(option) => {
          setSelected(option.value)
          setDeleting(undefined)
        }}
        options={[
          ...(methods.length
            ? [
                {
                  title: t("main.account.add"),
                  value: "add",
                  onSelect: () => selectMethod(current() ?? integration, methods, location, dialog, t, onConnected),
                },
              ]
            : []),
          ...credentialConnections(current() ?? integration)
            .toSorted((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
            .map((connection) => {
              const confirming = deleting() === connection.id
              return {
                title: confirming
                  ? t("main.confirmAgain", { key: shortcuts.get("dialog.integration.delete") ?? "" })
                  : connection.label,
                value: connection.id,
                footer: connection.status ? t("main.integration.signInRequired") : undefined,
                footerColor: connection.status ? theme.text.feedback.warning.base : undefined,
                category: t("main.account.connected"),
                bg: confirming ? theme.background.action.destructive.focused : undefined,
                fg: confirming ? theme.text.action.destructive.focused : undefined,
                onSelect: () => {
                  if (connection.status?.url) return void openUrl(connection.status.url).catch(toast.error)
                  if (connection.status)
                    return selectMethod(current() ?? integration, methods, location, dialog, t, onConnected)
                  if (credentialConnections(current() ?? integration)[0]?.id === connection.id) return
                  void client.api.credential.activate({ credentialID: connection.id }).catch(toast.error)
                },
              }
            }),
        ]}
        actions={[
          {
            command: "dialog.integration.rename",
            title: t("main.rename"),
            hidden: selected() === "add",
            disabled: (option) => !option || option.value === "add",
            onTrigger: (option) => {
              dialog.replace(() => (
                <DialogPrompt
                  title={t("main.account.rename")}
                  placeholder={t("main.account.name")}
                  value={
                    credentialConnections(current() ?? integration).find((item) => item.id === option.value)?.label
                  }
                  onConfirm={(value) => {
                    const label = value.trim()
                    if (!label) return
                    void client.api.credential
                      .update({ credentialID: option.value, label })
                      .then(() => manageConnections(integration, methods, location, dialog, onConnected))
                      .catch(toast.error)
                  }}
                />
              ))
            },
          },
          {
            command: "dialog.integration.delete",
            title: newDesigns() ? t("main.integration.removeAccount") : t("main.delete"),
            hidden: selected() === "add",
            disabled: (option) => !option || option.value === "add",
            onTrigger: (option) => {
              if (deleting() !== option.value) return setDeleting(option.value)
              const final = credentialConnections(current() ?? integration).length === 1
              void client.api.credential
                .remove({ credentialID: option.value })
                .then(() => {
                  setDeleting(undefined)
                  if (!final) return
                  toast.show({
                    variant: "success",
                    message: t("main.integration.disconnected", { name: integration.name }),
                  })
                  dialog.clear()
                })
                .catch((error) => {
                  setDeleting(undefined)
                  toast.error(error)
                })
            },
          },
        ]}
      />
    )
  })
}

function selectMethod(
  integration: IntegrationInfo,
  methods: ConnectMethod[],
  location: LocationRef,
  dialog: ReturnType<typeof useDialog>,
  t: Translator<Key>,
  onConnected?: OnIntegrationConnected,
) {
  if (methods.length === 1) return openMethod(integration, methods[0], location, dialog, t, onConnected)
  dialog.replace(() => {
    const newDesigns = useNewDesigns()
    return (
      <DialogSelect
        title={t("main.integration.connect", { name: integration.name })}
        renderFilter={!newDesigns()}
        options={methods.map((method) => ({
          title: method.type === "key" ? (method.label ?? t("main.apiKey")) : method.label,
          value: method.type === "key" ? "key" : method.id,
          onSelect: () => openMethod(integration, method, location, dialog, t, onConnected),
        }))}
      />
    )
  })
}

function openMethod(
  integration: IntegrationInfo,
  method: ConnectMethod,
  location: LocationRef,
  dialog: ReturnType<typeof useDialog>,
  t: Translator<Key>,
  onConnected?: OnIntegrationConnected,
) {
  if (method.type === "key") {
    void beginKey(integration, method, location, dialog, t, onConnected)
    return
  }
  if (method.type === "command") {
    dialog.replace(() => (
      <CommandStarting integration={integration} method={method} location={location} onConnected={onConnected} />
    ))
    return
  }
  if (method.type === "external") {
    void beginExternal(integration, method, location, dialog, t, onConnected)
    return
  }
  void beginOAuth(integration, method, location, dialog, t, onConnected)
}

async function beginExternal(
  integration: IntegrationInfo,
  method: Extract<ConnectMethod, { type: "external" }>,
  location: LocationRef,
  dialog: ReturnType<typeof useDialog>,
  t: Translator<Key>,
  onConnected?: OnIntegrationConnected,
) {
  const answer = method.form ? await formAnswer(dialog, method.label, method.form, t) : undefined
  if (answer === null) return
  dialog.replace(() => (
    <ExternalStarting
      integration={integration}
      method={method}
      location={location}
      answer={answer}
      onConnected={onConnected}
    />
  ))
}

function ExternalStarting(props: {
  integration: IntegrationInfo
  method: Extract<ConnectMethod, { type: "external" }>
  location: LocationRef
  answer?: FormAnswer
  onConnected?: OnIntegrationConnected
}) {
  const { t } = useI18n()
  const data = useData()
  const dialog = useDialog()
  const client = useClient()
  const toast = useToast()

  onMount(() => {
    void client.api.integration.connect
      .external({
        integrationID: props.integration.id,
        location: locationQuery(props.location),
        methodID: props.method.id,
        ...(props.answer ? { answer: props.answer } : {}),
      })
      .then(() => connected(props.integration, props.location, data, dialog, toast, t, props.onConnected))
      .catch((cause) => {
        toast.show({ variant: "error", message: errorMessage(cause) })
        dialog.clear()
      })
  })
  return <OAuthView title={props.method.label} message={t("main.integration.connecting")} />
}

async function beginKey(
  integration: IntegrationInfo,
  method: Extract<ConnectMethod, { type: "key" }>,
  location: LocationRef,
  dialog: ReturnType<typeof useDialog>,
  t: Translator<Key>,
  onConnected?: OnIntegrationConnected,
) {
  const answer = method.form
    ? await formAnswer(
        dialog,
        method.label ?? t("main.integration.connect", { name: integration.name }),
        method.form,
        t,
      )
    : undefined
  if (answer === null) return
  dialog.replace(() => (
    <KeyMethod
      integration={integration}
      method={method}
      location={location}
      answer={answer}
      onConnected={onConnected}
    />
  ))
}

function CommandStarting(props: {
  integration: IntegrationInfo
  method: Extract<ConnectMethod, { type: "command" }>
  location: LocationRef
  onConnected?: OnIntegrationConnected
}) {
  const { t } = useI18n()
  const dialog = useDialog()
  const client = useClient()
  const toast = useToast()
  let closed = false
  let handedOff = false

  onMount(() => {
    void client.api.integration.command
      .connect({
        integrationID: props.integration.id,
        methodID: props.method.id,
        location: locationQuery(props.location),
      })
      .then((result) => {
        if (closed) {
          void client.api.integration.command.cancel({
            integrationID: props.integration.id,
            attemptID: result.data.attemptID,
            location: locationQuery(props.location),
          })
          return
        }
        handedOff = true
        dialog.replace(() => (
          <CommandPending
            integration={props.integration}
            title={props.method.label}
            attempt={result.data}
            location={props.location}
            onConnected={props.onConnected}
          />
        ))
      })
      .catch((cause) => {
        if (closed) return
        toast.show({ variant: "error", message: errorMessage(cause) })
        dialog.clear()
      })
  })
  onCleanup(() => {
    if (!handedOff) closed = true
  })

  return <CommandView title={props.method.label} output="" message={t("main.integration.commandStarting")} />
}

function CommandPending(props: {
  integration: IntegrationInfo
  title: string
  attempt: CommandAttempt
  location: LocationRef
  onConnected?: OnIntegrationConnected
}) {
  const { t } = useI18n()
  const data = useData()
  const dialog = useDialog()
  const client = useClient()
  const toast = useToast()
  const [output, setOutput] = createSignal("")
  let timer: ReturnType<typeof setTimeout> | undefined
  let settled = false

  const poll = () => {
    void client.api.integration.command
      .status({
        integrationID: props.integration.id,
        attemptID: props.attempt.attemptID,
        location: locationQuery(props.location),
      })
      .then((result) => {
        const status = result.data
        if (status.status === "pending") {
          setOutput(status.message ?? "")
          timer = setTimeout(poll, 500)
          return
        }
        settled = true
        if (status.status === "complete") {
          void connected(props.integration, props.location, data, dialog, toast, t, props.onConnected)
          return
        }
        toast.show({
          variant: "error",
          message: status.status === "failed" ? status.message : t("main.integration.authExpired"),
        })
        dialog.clear()
      })
      .catch((cause) => {
        settled = true
        toast.show({ variant: "error", message: errorMessage(cause) })
        dialog.clear()
      })
  }

  onMount(poll)
  onCleanup(() => {
    if (timer) clearTimeout(timer)
    if (settled) return
    void client.api.integration.command.cancel({
      integrationID: props.integration.id,
      attemptID: props.attempt.attemptID,
      location: locationQuery(props.location),
    })
  })

  return <CommandView title={props.title} output={output()} message={t("main.integration.commandWaiting")} />
}

function CommandView(props: { title: string; output: string; message: string }) {
  const { t } = useI18n()
  const dialog = useDialog()
  const theme = useTheme().surface("dialog")
  const overlayTheme = useTheme()
  onMount(() => dialog.setSize("large"))
  return (
    <DialogLayout header={<DialogHeader title={props.title} closeLabel={` ×  ${t("main.close")}`} />}>
      <box gap={1}>
        <DialogBleed>
          <box
            backgroundColor={overlayTheme.background.raised.high}
            paddingLeft={DIALOG_INSET}
            paddingRight={DIALOG_INSET}
            paddingTop={1}
            paddingBottom={1}
          >
            <text fg={overlayTheme.text.base}>{props.output.trim()}</text>
          </box>
        </DialogBleed>
        <text fg={theme.text.muted}>{props.message}</text>
      </box>
    </DialogLayout>
  )
}

function KeyMethod(props: {
  integration: IntegrationInfo
  method: Extract<ConnectMethod, { type: "key" }>
  location: LocationRef
  answer?: FormAnswer
  onConnected?: OnIntegrationConnected
}) {
  const { t } = useI18n()
  const data = useData()
  const dialog = useDialog()
  const client = useClient()
  const toast = useToast()
  const theme = useTheme().surface("dialog")
  const [error, setError] = createSignal<string>()

  return (
    <DialogPrompt
      title={props.method.label ?? t("main.integration.connect", { name: props.integration.name })}
      placeholder={t("main.apiKey")}
      onConfirm={(key) => {
        if (!key) return
        void client.api.integration.connect
          .key({
            integrationID: props.integration.id,
            location: locationQuery(props.location),
            key,
            ...(props.answer ? { answer: props.answer } : {}),
          })
          .then(() => connected(props.integration, props.location, data, dialog, toast, t, props.onConnected))
          .catch((cause) => setError(errorMessage(cause)))
      }}
      description={() => (
        <Show when={error()}>{(value) => <text fg={theme.text.feedback.error.base}>{value()}</text>}</Show>
      )}
    />
  )
}

async function beginOAuth(
  integration: IntegrationInfo,
  method: IntegrationOAuthMethod,
  location: LocationRef,
  dialog: ReturnType<typeof useDialog>,
  t: Translator<Key>,
  onConnected?: OnIntegrationConnected,
) {
  const answer = method.form ? await formAnswer(dialog, method.label, method.form, t) : undefined
  if (answer === null) return
  dialog.replace(() => (
    <OAuthStarting
      integration={integration}
      method={method}
      location={location}
      answer={answer}
      onConnected={onConnected}
    />
  ))
}

function OAuthStarting(props: {
  integration: IntegrationInfo
  method: IntegrationOAuthMethod
  location: LocationRef
  answer?: FormAnswer
  onConnected?: OnIntegrationConnected
}) {
  const { t } = useI18n()
  const dialog = useDialog()
  const client = useClient()
  const toast = useToast()

  onMount(() => {
    void client.api.integration.oauth
      .connect({
        integrationID: props.integration.id,
        location: locationQuery(props.location),
        methodID: props.method.id,
        ...(props.answer ? { answer: props.answer } : {}),
      })
      .then((result) => {
        if (result.data.mode === "code") {
          dialog.replace(() => (
            <OAuthCode
              integration={props.integration}
              title={props.method.label}
              attempt={result.data}
              location={props.location}
              onConnected={props.onConnected}
            />
          ))
          return
        }
        dialog.replace(() => (
          <OAuthAuto
            integration={props.integration}
            title={props.method.label}
            attempt={result.data}
            location={props.location}
            onConnected={props.onConnected}
          />
        ))
      })
      .catch((cause) => {
        toast.show({ variant: "error", message: errorMessage(cause) })
        dialog.clear()
      })
  })

  return <OAuthView title={props.method.label} message={t("main.integration.authStarting")} />
}

function OAuthAuto(props: {
  integration: IntegrationInfo
  title: string
  attempt: IntegrationAttempt
  location: LocationRef
  onConnected?: OnIntegrationConnected
}) {
  const { t } = useI18n()
  const data = useData()
  const dialog = useDialog()
  const client = useClient()
  const toast = useToast()
  const clipboard = useClipboard()
  const newDesigns = useNewDesigns()
  let timer: ReturnType<typeof setTimeout> | undefined
  let settled = false

  const open = () => {
    openUrl(props.attempt.url).catch(() =>
      toast.show({
        message: t("main.integration.browserFailed"),
        variant: "error",
      }),
    )
  }

  const copy = () => {
    const value = props.attempt.instructions.match(OAUTH_CODE)?.[0] ?? props.attempt.url
    clipboard
      .write(value)
      .then(() => toast.show({ message: t("main.copied"), variant: "info" }))
      .catch(toast.error)
  }

  Keymap.createLayer(() => ({
    mode: "modal",
    commands: [
      {
        bind: newDesigns() ? "return" : "o",
        title: t("main.integration.authOpen"),
        group: t("main.group.dialog"),
        run: open,
      },
      { bind: "c", title: t("main.integration.authCopy"), group: t("main.group.dialog"), run: copy },
    ],
  }))

  const poll = () => {
    void client.api.integration.oauth
      .status({
        integrationID: props.integration.id,
        attemptID: props.attempt.attemptID,
        location: locationQuery(props.location),
      })
      .then((result) => {
        const status = result.data
        if (status.status === "pending") {
          timer = setTimeout(poll, 500)
          return
        }
        settled = true
        if (status.status === "complete") {
          void connected(props.integration, props.location, data, dialog, toast, t, props.onConnected)
          return
        }
        toast.show({
          variant: "error",
          message: status.status === "failed" ? status.message : t("main.integration.authorizationExpired"),
        })
        dialog.clear()
      })
      .catch((cause) => {
        settled = true
        toast.show({ variant: "error", message: errorMessage(cause) })
        dialog.clear()
      })
  }

  onMount(poll)
  onCleanup(() => {
    if (timer) clearTimeout(timer)
    if (settled) return
    void client.api.integration.oauth.cancel({
      integrationID: props.integration.id,
      attemptID: props.attempt.attemptID,
      location: locationQuery(props.location),
    })
  })

  return (
    <OAuthView
      title={props.title}
      url={props.attempt.url}
      instructions={props.attempt.instructions}
      message={t("main.integration.authWaiting")}
      onCopy={copy}
      onOpen={open}
    />
  )
}

function OAuthCode(props: {
  integration: IntegrationInfo
  title: string
  attempt: IntegrationAttempt
  location: LocationRef
  onConnected?: OnIntegrationConnected
}) {
  const { t } = useI18n()
  const data = useData()
  const dialog = useDialog()
  const client = useClient()
  const toast = useToast()
  const theme = useTheme().surface("dialog")
  const newDesigns = useNewDesigns()
  const [error, setError] = createSignal<string>()
  let settled = false

  onCleanup(() => {
    if (settled) return
    void client.api.integration.oauth.cancel({
      integrationID: props.integration.id,
      attemptID: props.attempt.attemptID,
      location: locationQuery(props.location),
    })
  })

  return (
    <DialogPrompt
      title={props.title}
      subtitle={props.attempt.instructions}
      placeholder={t("main.integration.authCode")}
      onConfirm={(code) => {
        if (!code) return
        void client.api.integration.oauth
          .complete({
            integrationID: props.integration.id,
            attemptID: props.attempt.attemptID,
            location: locationQuery(props.location),
            code,
          })
          .then(() => {
            settled = true
            return connected(props.integration, props.location, data, dialog, toast, t, props.onConnected)
          })
          .catch((cause) => setError(errorMessage(cause)))
      }}
      description={() => (
        <box gap={1}>
          <Show when={!newDesigns()}>
            <text fg={theme.text.muted}>{props.attempt.instructions}</text>
          </Show>
          <Link href={props.attempt.url} fg={theme.markdown.link} />
          <Show when={error()}>{(value) => <text fg={theme.text.feedback.error.base}>{value()}</text>}</Show>
        </box>
      )}
    />
  )
}

function OAuthView(props: {
  title: string
  url?: string
  instructions?: string
  message: string
  onCopy?: () => void
  onOpen?: () => void
}) {
  const { t } = useI18n()
  const theme = useTheme().surface("dialog")
  return (
    <DialogLayout
      header={<DialogHeader title={props.title} />}
      footer={{
        actions: {
          primary: [
            ...(props.onCopy
              ? [
                  {
                    title: props.instructions?.match(OAUTH_CODE)
                      ? t("main.integration.copyCode")
                      : t("main.integration.copyLink"),
                    key: "c",
                    onTrigger: props.onCopy,
                  },
                ]
              : []),
            ...(props.onOpen ? [{ title: t("main.integration.openLink"), key: "enter", onTrigger: props.onOpen }] : []),
          ],
        },
      }}
      legacyFooter={
        <DialogFooter
          actions={{
            secondary: [
              ...(props.onOpen ? [{ title: t("main.open"), key: "o" }] : []),
              ...(props.onCopy ? [{ title: t("main.copy"), key: "c" }] : []),
            ],
          }}
        />
      }
    >
      <box gap={1}>
        <Show when={props.url}>
          {(url) => (
            <box gap={1}>
              <Link href={url()} fg={theme.markdown.link} />
              <Show when={props.instructions}>
                {(instructions) => <text fg={theme.text.muted}>{instructions()}</text>}
              </Show>
            </box>
          )}
        </Show>
        <text fg={theme.text.muted}>{props.message}</text>
      </box>
    </DialogLayout>
  )
}

async function formAnswer(dialog: ReturnType<typeof useDialog>, title: string, fields: FormFields, t: Translator<Key>) {
  const answer: FormAnswer = {}
  for (const field of fields) {
    if (!active(field, answer)) continue
    const value = field.type !== "external" && field.hidden ? field.default : await fieldAnswer(dialog, title, field, t)
    if (value === CANCELLED) return null
    if (value !== undefined) answer[field.key] = value
  }
  return answer
}

function active(field: FormField, answer: FormAnswer) {
  if (field.type === "external" || !field.when) return true
  return field.when.every((when) => {
    const value = answer[when.key]
    if (value === undefined) return false
    const hit = Array.isArray(value) ? value.includes(String(when.value)) : value === when.value
    return when.op === "eq" ? hit : !hit
  })
}

function fieldAnswer(
  dialog: ReturnType<typeof useDialog>,
  title: string,
  field: FormField,
  t: Translator<Key>,
): Promise<FormValue | undefined | typeof CANCELLED> {
  if (field.type === "external") return externalAnswer(dialog, title, field, t)
  if (field.type === "multiselect") return multiselectAnswer(dialog, title, field, t)
  if (field.type === "boolean" || (field.type === "string" && field.options)) {
    return selectAnswer(dialog, title, field, t)
  }
  return textAnswer(dialog, title, field, t)
}

async function selectAnswer(
  dialog: ReturnType<typeof useDialog>,
  title: string,
  field: Extract<FormAnswerField, { type: "boolean" | "string" }>,
  t: Translator<Key>,
): Promise<FormValue | undefined | typeof CANCELLED> {
  if (field.type === "string" && field.custom)
    return new Promise((resolve) => {
      dialog.replace(
        () => <StringChoiceField field={field} onSubmit={resolve} />,
        () => resolve(CANCELLED),
      )
    })
  const options = () =>
    field.type === "boolean"
      ? field.default === false
        ? [
            { title: t("main.no"), value: false as FormValue },
            { title: t("main.yes"), value: true as FormValue },
          ]
        : [
            { title: t("main.yes"), value: true as FormValue },
            { title: t("main.no"), value: false as FormValue },
          ]
      : (field.options ?? []).map((option) => ({
          title: option.label,
          value: option.value as FormValue,
          description: option.description,
        }))
  return new Promise<FormValue | undefined | typeof CANCELLED>((resolve) => {
    dialog.replace(
      () => (
        <DialogSelect<FormValue | undefined>
          title={formLabel(field) || title}
          options={[...options(), ...(!field.required ? [{ title: t("main.skip"), value: undefined }] : [])]}
          current={field.type === "string" ? field.default : undefined}
          onSelect={(option) => resolve(option.value)}
        />
      ),
      () => resolve(CANCELLED),
    )
  })
}

function StringChoiceField(props: {
  field: Extract<FormAnswerField, { type: "string" }>
  onSubmit: (value: string | undefined) => void
}) {
  const { t } = useI18n()
  const dialog = useDialog()
  const theme = useTheme().surface("dialog")
  const dimensions = useTerminalDimensions()
  const rows = formRows(props.field)
  const count = rows.length + (props.field.required ? 1 : 2)
  const [store, setStore] = createStore({
    selected: formSelected(props.field, props.field.default),
    editing: false,
    text: formInitialValues([props.field]).custom[props.field.key] ?? "",
    error: "",
  })
  const [textarea, setTextarea] = createSignal<TextareaRenderable>()
  let scroll: ScrollBoxRenderable | undefined
  createEffect(() => {
    const row = scroll?.getChildren()[store.selected]
    if (row) scroll?.scrollChildIntoView(row.id)
  })
  const fg = (index: number) => (store.selected === index ? theme.text.formfield.focused : theme.text.formfield.base)
  const submit = (value: string | undefined) => {
    const invalid = formValidateValue(props.field, value, t)
    if (invalid) return setStore("error", invalid)
    props.onSubmit(value)
  }
  const select = (index: number) => {
    setStore({ selected: index, error: "" })
    if (index === rows.length) return setStore("editing", true)
    submit(index < rows.length ? String(rows[index].value) : undefined)
  }
  const back = () => setStore({ editing: false, text: textarea()?.plainText ?? store.text, error: "" })
  Keymap.createLayer(() => ({
    mode: "modal",
    enabled: !store.editing,
    commands: [
      {
        id: "dialog.select.prev",
        title: t("session.previousAnswer"),
        group: t("session.form"),
        run: () => setStore("selected", (store.selected + count - 1) % count),
      },
      {
        id: "dialog.select.next",
        title: t("session.nextAnswer"),
        group: t("session.form"),
        run: () => setStore("selected", (store.selected + 1) % count),
      },
      {
        id: "dialog.select.submit",
        title: t("session.selectAnswer"),
        group: t("session.form"),
        run: () => select(store.selected),
      },
    ],
  }))
  Keymap.createLayer(() => ({
    mode: "modal",
    priority: 1,
    target: textarea,
    enabled: store.editing,
    commands: [
      {
        id: "dialog.prompt.submit",
        title: t("main.answer.submit"),
        group: t("session.form"),
        run: () => submit(textarea()?.plainText.trim() || undefined),
      },
      { bind: "escape", title: t("main.answer.back"), group: t("session.form"), run: back },
    ],
  }))
  return (
    <DialogLayout
      header={<DialogHeader title={formLabel(props.field)} onClose={() => (store.editing ? back() : dialog.clear())} />}
      footer={{
        actions: {
          secondary: store.editing
            ? [
                {
                  title: t("main.submit"),
                  key: "enter",
                  onTrigger: () => submit(textarea()?.plainText.trim() || undefined),
                },
                { title: t("main.back"), key: "esc", onTrigger: back },
              ]
            : [
                { title: t("main.select"), key: "↑/↓" },
                { title: t("main.confirm"), key: "enter", onTrigger: () => select(store.selected) },
                { title: t("main.cancel"), key: "esc", onTrigger: () => dialog.clear() },
              ],
        },
      }}
    >
      <box gap={1}>
        <Show when={props.field.description}>
          {(description) => <text fg={theme.text.muted}>{description()}</text>}
        </Show>
        <scrollbox
          gap={1}
          height={Math.min(
            count + rows.filter((row) => row.description).length,
            Math.max(3, Math.floor(dimensions().height / 2) - 6),
          )}
          scrollbarOptions={{ visible: false }}
          ref={(value: ScrollBoxRenderable) => {
            scroll = value
          }}
        >
          <For each={rows}>
            {(row, index) => (
              <box onMouseUp={() => select(index())}>
                <text fg={fg(index())}>
                  {index() + 1}. {row.label}
                </text>
                <Show when={row.description}>
                  {(description) => (
                    <box paddingLeft={3}>
                      <text fg={theme.text.muted}>{description()}</text>
                    </box>
                  )}
                </Show>
              </box>
            )}
          </For>
          <box flexDirection="row" gap={1} onMouseUp={() => select(rows.length)}>
            <text fg={fg(rows.length)}>{rows.length + 1}.</text>
            <Show
              when={store.editing}
              fallback={<text fg={fg(rows.length)}>{store.text || t("main.answer.custom")}</text>}
            >
              <textarea
                height={1}
                flexGrow={1}
                wrapMode="none"
                initialValue={store.text}
                placeholder={props.field.placeholder ?? t("main.answer.custom")}
                placeholderColor={theme.text.muted}
                textColor={theme.text.formfield.focused}
                focusedTextColor={theme.text.formfield.focused}
                cursorColor={theme.text.formfield.focused}
                ref={(value: TextareaRenderable) => {
                  setTextarea(value)
                  value.traits = { status: "ANSWER" }
                  queueMicrotask(() => {
                    if (value.isDestroyed) return
                    value.focus()
                    value.gotoLineEnd()
                  })
                }}
                onContentChange={() => {
                  const text = textarea()?.plainText ?? ""
                  setStore("text", text)
                  if (store.error && !formValidateValue(props.field, text.trim() || undefined, t)) setStore("error", "")
                }}
              />
            </Show>
          </box>
          <Show when={!props.field.required}>
            <text fg={fg(rows.length + 1)} onMouseUp={() => select(rows.length + 1)}>
              {rows.length + 2}. {t("main.skip")}
            </text>
          </Show>
        </scrollbox>
        <Show when={store.error}>{(error) => <text fg={theme.text.feedback.error.base}>{error()}</text>}</Show>
      </box>
    </DialogLayout>
  )
}

function textAnswer(
  dialog: ReturnType<typeof useDialog>,
  title: string,
  field: Extract<FormAnswerField, { type: "string" | "number" | "integer" }>,
  t: Translator<Key>,
): Promise<FormValue | undefined | typeof CANCELLED> {
  return new Promise<FormValue | undefined | typeof CANCELLED>((resolve) => {
    dialog.replace(
      () => {
        const theme = useTheme().surface("dialog")
        const [error, setError] = createSignal<string>()
        return (
          <DialogPrompt
            title={formLabel(field) || title}
            placeholder={field.type === "string" ? field.placeholder : undefined}
            value={field.default === undefined ? undefined : String(field.default)}
            onConfirm={(input) => {
              const text = input.trim()
              const value = text === "" && !field.required ? undefined : field.type === "string" ? text : Number(text)
              const invalid = formValidateValue(field, value, t)
              if (invalid) {
                setError(invalid)
                return
              }
              resolve(value)
            }}
            description={() => (
              <box gap={1}>
                <Show when={field.description}>
                  {(description) => <text fg={theme.text.muted}>{description()}</text>}
                </Show>
                <Show when={error()}>{(value) => <text fg={theme.text.feedback.error.base}>{value()}</text>}</Show>
              </box>
            )}
          />
        )
      },
      () => resolve(CANCELLED),
    )
  })
}

async function multiselectAnswer(
  dialog: ReturnType<typeof useDialog>,
  title: string,
  field: Extract<FormAnswerField, { type: "multiselect" }>,
  t: Translator<Key>,
): Promise<FormValue | typeof CANCELLED> {
  const selected = field.default ? [...field.default] : []
  while (true) {
    const invalid = () => formValidateValue(field, selected, t)
    const choice = await new Promise<string | typeof CUSTOM | typeof SUBMIT | typeof CANCELLED>((resolve) => {
      dialog.replace(
        () => (
          <DialogSelect<string | typeof CUSTOM | typeof SUBMIT>
            title={formLabel(field) || title}
            options={[
              ...field.options.map((option) => ({
                title: `[${selected.includes(option.value) ? "x" : " "}] ${option.label}`,
                value: option.value,
                description: option.description,
                disabled:
                  !selected.includes(option.value) && field.maxItems !== undefined && selected.length >= field.maxItems,
              })),
              ...(field.custom ? [{ title: t("main.answer.custom"), value: CUSTOM as typeof CUSTOM }] : []),
              {
                title: t("main.continue"),
                value: SUBMIT as typeof SUBMIT,
                description: invalid(),
                disabled: invalid() !== undefined,
              },
            ]}
            onSelect={(option) => resolve(option.value)}
          />
        ),
        () => resolve(CANCELLED),
      )
    })
    if (choice === CANCELLED) return CANCELLED
    if (choice === SUBMIT) return selected
    if (choice === CUSTOM) {
      const value = await customAnswer(dialog, title, field, t)
      if (value === CANCELLED) return CANCELLED
      if (value && !selected.includes(value)) selected.push(value)
      continue
    }
    selected.splice(0, selected.length, ...formToggleMultiselect(selected, choice))
  }
}

function customAnswer(
  dialog: ReturnType<typeof useDialog>,
  title: string,
  field: Extract<FormAnswerField, { type: "multiselect" }>,
  t: Translator<Key>,
): Promise<string | typeof CANCELLED> {
  return new Promise<string | typeof CANCELLED>((resolve) => {
    dialog.replace(
      () => (
        <DialogPrompt
          title={formLabel(field) || title}
          placeholder={t("main.answer.custom")}
          onConfirm={(value) => {
            if (value) resolve(value)
          }}
        />
      ),
      () => resolve(CANCELLED),
    )
  })
}

async function externalAnswer(
  dialog: ReturnType<typeof useDialog>,
  title: string,
  field: Extract<FormField, { type: "external" }>,
  t: Translator<Key>,
): Promise<true | typeof CANCELLED> {
  let opened = false
  while (true) {
    const choice = await new Promise<true | typeof OPEN | typeof CANCELLED>((resolve) => {
      dialog.replace(
        () => (
          <DialogSelect<true | typeof OPEN>
            title={formLabel(field) || title}
            options={[
              {
                title: opened ? t("main.link.openAgain") : t("main.link.open"),
                value: OPEN as typeof OPEN,
                description: field.url,
              },
              { title: t("main.finished"), value: true as const, description: field.description, disabled: !opened },
            ]}
            onSelect={(option) => resolve(option.value)}
          />
        ),
        () => resolve(CANCELLED),
      )
    })
    if (choice === CANCELLED) return CANCELLED
    if (choice === true) return true
    const result = await new Promise<boolean | typeof CANCELLED>((resolve) => {
      dialog.replace(
        () => <OAuthView title={formLabel(field) || title} message={t("main.link.opening")} />,
        () => resolve(CANCELLED),
      )
      void openUrl(field.url).then(
        () => resolve(true),
        () => resolve(false),
      )
    })
    if (result === CANCELLED) return CANCELLED
    opened ||= result
  }
}

async function connected(
  integration: IntegrationInfo,
  location: LocationRef,
  data: ReturnType<typeof useData>,
  dialog: ReturnType<typeof useDialog>,
  toast: ReturnType<typeof useToast>,
  t: Translator<Key>,
  onConnected?: OnIntegrationConnected,
) {
  data.location.integration.invalidate(location)
  data.location.model.invalidate(location)
  data.location.provider.invalidate(location)
  await Promise.all([
    data.location.integration.sync(location),
    data.location.model.sync(location),
    data.location.provider.sync(location),
  ])
  toast.show({ variant: "success", message: t("main.integration.connected", { name: integration.name }) })
  if (onConnected && integration.metadata?.source !== "mcp") {
    onConnected(providerID(data, location, integration.id))
    return
  }
  dialog.clear()
}

function providerID(data: ReturnType<typeof useData>, location: LocationRef, integrationID: string) {
  const models = data.location.model.list(location) ?? []
  const matches = (data.location.provider.list(location) ?? []).filter(
    (provider) => provider.integrationID === integrationID || provider.id === integrationID,
  )
  return (
    matches.find((provider) =>
      models.some((model) => model.providerID === provider.id && model.status !== "deprecated"),
    )?.id ?? matches[0]?.id
  )
}

function locationQuery(location: LocationRef) {
  return { directory: location.directory }
}
