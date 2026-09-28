import { groupID } from "./anchors"
import {
  collapsedActivityEntries,
  executionEntries,
  executionVisible,
  groupLeaves,
  groupTools,
  isPending,
  type GroupKind,
  type GroupToolLookup,
  type PartRef,
  type SessionNode,
  type SessionRow,
} from "./grouping/session"

/**
 * Budget summary headers and mounted entries, including leaves kept visible by
 * collapsed execution/activity groups. Permissions partitioned outside a root
 * group count once, independently of disclosure.
 */
export function rowWeight(
  row: SessionRow,
  input: {
    expanded: (groupID: string, kind: GroupKind) => boolean
    grouped: (kind: GroupKind) => boolean
    tool: GroupToolLookup
    pendingTools: readonly string[]
    activityVisible: (node: Extract<SessionNode, { type: "group" }>, pending: readonly PartRef[]) => boolean
  },
) {
  if (row.type !== "group") return 1
  const pending = row.kind === "exploration" || row.kind === "activity" ? row.pending : []
  const visit = (node: Extract<SessionNode, { type: "group" }>, level: number): number => {
    const children = () =>
      node.children.reduce(
        (total, child) =>
          total + (child.type === "group" ? visit(child, level + 1) : isPending(child.entry, pending) ? 0 : 1),
        0,
      )
    const executions = node.kind === "execution" ? executionEntries(node, input.tool) : []
    if (!input.grouped(node.kind) || (node.kind === "execution" && executions.length <= 1)) return children()
    const id = groupID(node, level)
    const expanded = Boolean(id && input.expanded(id, node.kind))
    if (node.kind === "execution")
      return 1 + executions.filter(({ part }) => expanded || executionVisible(part, input.pendingTools)).length
    if (node.kind === "activity") {
      const header = input.activityVisible(node, pending) ? 1 : 0
      if (expanded) return header ? header + children() : 0
      return (
        header +
        collapsedActivityEntries(node, { ...input, pending }).filter((entry) => !isPending(entry, pending)).length
      )
    }
    if (node.kind === "exploration" && groupTools(node, input.tool, pending).length === 0) return 0
    if (expanded) return 1 + children()
    return 1
  }
  return visit(row, 0) + groupLeaves(row).filter((entry) => isPending(entry, pending)).length
}

/** First row index such that rows [index, end) spend at least `budget`. */
export function rowsBefore(weights: readonly number[], end: number, budget: number) {
  let index = end
  let spent = 0
  while (index > 0 && spent < budget) spent += weights[--index]
  return index
}

/** End row index such that rows [start, index) spend at least `budget`. */
export function rowsAfter(weights: readonly number[], start: number, budget: number) {
  let index = start
  let spent = 0
  while (index < weights.length && spent < budget) spent += weights[index++]
  return index
}
