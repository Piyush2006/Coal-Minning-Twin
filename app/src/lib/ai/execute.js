// Execute a MANIPULATE command list (from the assistant) against the live store.
// Maps each op 1:1 to a sceneStore action and resolves "ref:" aliases created by
// add_asset/add_group earlier in the same list. Each op is guarded; returns a
// summary { applied, errors }.
import { useSceneStore } from '../../store/sceneStore'
import { defaultLayerForType } from '../machineLibrary'

export function applyCommands(commands) {
  if (!Array.isArray(commands)) return { applied: 0, errors: ['Commands must be an array.'] }
  const refs = {}
  const rid = (v) => (typeof v === 'string' && v.startsWith('ref:') ? refs[v.slice(4)] : v) ?? null
  let applied = 0
  const errors = []

  for (const cmd of commands) {
    const s = useSceneStore.getState()
    try {
      switch (cmd.op) {
        case 'add_group': {
          const id = s.addGroup(cmd.name || 'New Group', rid(cmd.parentId))
          if (cmd.ref) refs[cmd.ref] = id
          break
        }
        case 'add_asset': {
          const id = s.addObject(cmd.type, cmd.position || [0, 0, 0], defaultLayerForType(cmd.type), cmd.config || {}, rid(cmd.parentId))
          if (cmd.name) s.updateObject(id, { name: cmd.name })
          if (cmd.parameters) for (const [k, v] of Object.entries(cmd.parameters)) s.updateParameter(id, k, v)
          if (cmd.ref) refs[cmd.ref] = id
          break
        }
        case 'connect': {
          const connId = s.addConnection(rid(cmd.sourceId), cmd.sourcePort, rid(cmd.targetId), cmd.targetPort, cmd.connectorType)
          // Apply any connectorConfig overrides (e.g. colour a pipe by fluid
          // medium, thicken a main via radius, flowing) onto the new edge.
          if (connId && cmd.connectorConfig && typeof cmd.connectorConfig === 'object') {
            for (const [k, v] of Object.entries(cmd.connectorConfig)) s.updateConnectionConfig(connId, k, v)
          }
          break
        }
        case 'disconnect':
          if (cmd.connectionId) s.removeConnectionById(cmd.connectionId)
          else s.removeConnection(rid(cmd.sourceId), rid(cmd.targetId))
          break
        case 'set_config':
          s.updateConfig(rid(cmd.id), cmd.key, cmd.value); break
        case 'set_parameter':
          s.updateParameter(rid(cmd.id), cmd.key, cmd.value); break
        case 'bind_uns':
          // Bind a parameter to a live UNS topic (canonical uns:wsId://path:last).
          s.setParamTopic(rid(cmd.id), cmd.key, cmd.topic); break
        case 'set_state':
          s.setState(rid(cmd.id), cmd.state); break
        case 'set_tooltip':
          // Enable/disable a hover tooltip and choose which params it shows.
          s.setObjectTooltip(rid(cmd.id), { enabled: cmd.enabled !== false, params: cmd.params || [] }); break
        case 'add_rule':
          s.addRule(rid(cmd.id), cmd.rule || {}); break
        case 'remove_rule':
          s.removeRule(rid(cmd.id), cmd.ruleId); break
        case 'move': {
          const id = rid(cmd.id), o = s.objects[id]
          if (!o) throw new Error(`move: unknown id ${id}`)
          const pos = cmd.position ?? (cmd.delta ? [o.position[0] + cmd.delta[0], o.position[1] + cmd.delta[1], o.position[2] + cmd.delta[2]] : o.position)
          s.updateObject(id, { position: pos }); s.commitTransform(); break
        }
        case 'move_group':
          s.translateGroupBy(rid(cmd.groupId), cmd.delta || [0, 0, 0]); s.commitTransform(); break
        case 'reparent':
          s.moveNode(rid(cmd.nodeId), rid(cmd.parentId), rid(cmd.beforeNodeId)); break
        case 'rename': {
          const id = rid(cmd.id)
          if (s.groups[id]) s.renameGroup(id, cmd.name)
          else s.updateObject(id, { name: cmd.name })
          break
        }
        case 'duplicate': {
          const id = s.duplicateObject(rid(cmd.id))
          if (cmd.ref && id) refs[cmd.ref] = id
          break
        }
        case 'duplicate_group': {
          s.copyGroup(rid(cmd.groupId))
          const id = s.pasteGroup()
          if (id && cmd.name) s.renameGroup(id, cmd.name)
          if (cmd.ref && id) refs[cmd.ref] = id
          break
        }
        case 'delete':
          s.removeObject(rid(cmd.id)); break
        case 'delete_group':
          s.removeGroup(rid(cmd.groupId)); break
        case 'frame':
          if (cmd.groupId) s.flyToGroup(rid(cmd.groupId)); else s.flyToObject(rid(cmd.id)); break
        default:
          throw new Error(`Unknown op "${cmd.op}"`)
      }
      applied++
    } catch (err) {
      errors.push(`${cmd.op}: ${err.message}`)
    }
  }
  return { applied, errors }
}
