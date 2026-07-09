// A tiny live reference to the active scene's customAssetTypes map.
// `getPorts` (machineLibrary) and `getStateSchema` (stateSchemas) are called from
// many sites that don't have the map in hand; threading it everywhere is noisy and
// risks import cycles (those libs can't import the store). sceneStore keeps this
// ref in sync on every customAssetTypes change, so those pure lookups can resolve
// a custom type's ports/states without a store dependency.
let _types = {}
export const setCustomTypes = (m) => { _types = m || {} }
export const getCustomTypes = () => _types
