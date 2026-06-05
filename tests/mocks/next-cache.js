function unstable_cache(fn) {
  if (typeof fn !== 'function') return fn
  return fn
}
function unstable_noStore() {}
function revalidateTag(_tag, _profile) {}
function revalidatePath(_originalPath, _type) {}
function updateTag(_tag) {}
function refresh() {}
function cacheTag(_tag) {}
function cacheLife(_profile) {}
function unstable_cacheLife(...args) { return cacheLife(args[0]) }
function unstable_cacheTag(tag) { return cacheTag(tag) }

const exports = {
  unstable_cache,
  unstable_noStore,
  revalidateTag,
  revalidatePath,
  updateTag,
  refresh,
  cacheTag,
  cacheLife,
  unstable_cacheLife,
  unstable_cacheTag,
}

Object.keys(exports).forEach(key => { module.exports[key] = exports[key] })
module.exports = exports
