export function resetViewPreferences(storage: Storage) {
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
  for (const key of keys) {
    if (
      key?.startsWith('patmi:view:') ||
      key?.startsWith('patmi:calendar-period:')
    )
      storage.removeItem(key);
  }
}
