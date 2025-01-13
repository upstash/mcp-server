export function pruneFalsy(obj: Record<string, any>) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value));
}
