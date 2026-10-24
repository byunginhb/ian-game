// The renderer's imperative boundary. React components call methods; saveable state stays immutable.
export function createTreasureBridge(progress) {
  const bridge = { progress, input: {}, blocked: false, ready: false, worldId: 0, onEvent: () => {}, onReady: () => {}, onContext: () => {} }
  bridge.setProgress = (next) => { bridge.progress = next }
  bridge.setInput = (action, value, clearTarget = false) => {
    bridge.input = { ...bridge.input, [action]: value, ...(clearTarget ? { target: null, path: [], pointerActive: false } : {}) }
  }
  bridge.resetInput = () => { bridge.input = {} }
  bridge.setBlocked = (value) => { bridge.blocked = value; bridge.resetInput() }
  bridge.setWorld = (worldId) => { bridge.worldId = worldId; bridge.setBlocked(false) }
  bridge.setHandlers = (handlers) => Object.assign(bridge, handlers)
  return bridge
}
