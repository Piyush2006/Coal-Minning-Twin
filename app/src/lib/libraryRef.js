// A tiny live reference to the shared component LIBRARY (cloud-synced custom asset
// types available to every project). sceneStore reads it (loadScene merge,
// getSceneSnapshot exclusion) without importing libraryStore — avoids an import
// cycle, mirroring customTypesRef.
let _lib = {}
export const setLibraryComponents = (m) => { _lib = m || {} }
export const getLibraryComponents = () => _lib
