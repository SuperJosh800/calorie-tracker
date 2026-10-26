import PocketBase, { ClientResponseError, LocalAuthStore, type RecordModel } from 'pocketbase'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Backup } from './components/SettingsView'
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from './types'
import { usePersistentState } from './util'

/*
 * Account sync with your own PocketBase server (see server/README.md).
 *
 * Each account has one record holding the whole diary. Every device remembers a fingerprint of what it last
 * synced, so it can tell which side changed each entry, weigh-in, food and setting since then (a three-way
 * merge). Edits and deletions made on two devices in between syncs are both kept; if the same item was changed
 * on both, this device's version wins.
 */

type Fingerprint = Record<keyof Backup, Record<string, string>>

/** JSON with object keys sorted, so the same data always gives the same text. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** Short FNV-1a hash. */
function hash(value: unknown): string {
  let h = 0x811c9dc5
  const s = stable(value)
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}

const byKey = <T>(list: T[], key: (t: T) => string) => new Map(list.map((x) => [key(x), x]))
const fieldsOf = (o: object) => new Map(Object.entries(o).filter(([, v]) => v !== undefined))

export function fingerprint(data: Backup): Fingerprint {
  const prints = (m: Map<string, unknown>) => Object.fromEntries([...m].map(([k, v]) => [k, hash(v)]))
  return {
    entries: prints(byKey(data.entries, (e) => e.id)),
    foods: prints(byKey(data.foods, (f) => f.id)),
    weights: prints(byKey(data.weights, (w) => w.date)),
    settings: prints(fieldsOf(data.settings)),
    profile: prints(fieldsOf(data.profile)),
  }
}

/**
 * Picks one item from this device's and the server's versions. `undefined` means deleted or never existed.
 * Without a fingerprint (first sync on this device), `firstSync` decides.
 */
function pick<T>(local: T | undefined, remote: T | undefined, base: Record<string, string> | undefined, key: string, firstSync: 'local' | 'remote') {
  if (!base) return firstSync === 'local' ? (local ?? remote) : (remote ?? local)
  const was = base[key]
  const localChanged = (local === undefined ? undefined : hash(local)) !== was
  if (!localChanged) return remote
  const remoteChanged = (remote === undefined ? undefined : hash(remote)) !== was
  if (!remoteChanged) return local
  // Changed on both: keep this device's edit, and don't let a deletion on one side lose an edit on the other.
  return local ?? remote
}

function mergeMaps<T>(local: Map<string, T>, remote: Map<string, T>, base: Record<string, string> | undefined, firstSync: 'local' | 'remote') {
  const out: [string, T][] = []
  for (const k of new Set([...local.keys(), ...remote.keys()])) {
    const v = pick(local.get(k), remote.get(k), base, k, firstSync)
    if (v !== undefined) out.push([k, v])
  }
  return out
}

/**
 * Merges this device's data with the server's. On the first sync of a device, diaries are combined and the
 * account's goals and profile win (so signing in on a new phone brings your setup with it).
 */
export function merge(local: Backup, remote: Backup, base?: Fingerprint): Backup {
  const list = <T>(name: 'entries' | 'foods' | 'weights', key: (t: T) => string) =>
    mergeMaps(byKey(local[name] as T[], key), byKey(remote[name] as T[], key), base?.[name], 'local').map(([, v]) => v)
  const object = <T extends object>(name: 'settings' | 'profile') =>
    Object.fromEntries(mergeMaps(fieldsOf(local[name]), fieldsOf(remote[name]), base?.[name], 'remote')) as T
  return {
    entries: list<Backup['entries'][number]>('entries', (e) => e.id),
    foods: list<Backup['foods'][number]>('foods', (f) => f.id),
    weights: list<Backup['weights'][number]>('weights', (w) => w.date),
    settings: object('settings'),
    profile: object('profile'),
  }
}

/** Fills anything missing from data saved by an older version. */
function normalize(data: Partial<Backup>): Backup {
  return {
    entries: data.entries ?? [],
    foods: data.foods ?? [],
    weights: data.weights ?? [],
    settings: { ...DEFAULT_SETTINGS, ...data.settings },
    profile: { ...DEFAULT_PROFILE, ...data.profile },
  }
}

/** Accepts "joshserver1.tail1234.ts.net" as well as a full URL. */
export function normalizeServer(input: string) {
  const s = input.trim().replace(/\/+(_\/?)?$/, '')
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

/** Turns a PocketBase error into a sentence for the user. */
export function describeError(e: unknown, action: 'signin' | 'signup' | 'sync'): string {
  if (e instanceof ClientResponseError) {
    if (e.status === 0) {
      if (location.protocol === 'https:' && e.url.startsWith('http:')) return 'Use the https:// address from Tailscale Serve, not http://.'
      return "Couldn't reach your server. Check the address, and that Tailscale is switched on on this device."
    }
    const fields = e.response?.data as Record<string, { code?: string; message?: string }> | undefined
    if (action === 'signup' && fields?.email?.code === 'validation_not_unique') return 'There is already an account with that email. Sign in instead.'
    if (action === 'signup' && fields?.password) return 'Your password needs to be at least 8 characters.'
    if (action === 'signup' && fields?.email) return 'That email address doesn’t look right.'
    if (action === 'signin' && e.status === 400) return 'Wrong email or password.'
    if (e.status === 401 || e.status === 403) return 'You have been signed out. Sign in again.'
    if (e.status === 429) return 'Too many attempts. Wait a minute and try again.'
    if (e.status === 404 && action !== 'sync') return "That address isn't a Calorie Tracker server. Check it's the right one."
    return e.message
  }
  return e instanceof Error ? e.message : String(e)
}

export type SyncStatus =
  | { state: 'idle' }
  | { state: 'syncing' }
  | { state: 'ok'; at: number }
  | { state: 'error'; message: string }

const BASE_KEY = 'ct.syncBase'
const readBase = (userId: string): Fingerprint | undefined => {
  try {
    const saved = JSON.parse(localStorage.getItem(BASE_KEY) ?? 'null') as { user: string; fp: Fingerprint } | null
    return saved?.user === userId ? saved.fp : undefined
  } catch {
    return undefined
  }
}
const writeBase = (userId: string, fp?: Fingerprint) =>
  fp ? localStorage.setItem(BASE_KEY, JSON.stringify({ user: userId, fp })) : localStorage.removeItem(BASE_KEY)

const client = (url: string) => {
  const pb = new PocketBase(url, new LocalAuthStore('ct.auth'))
  pb.autoCancellation(false)
  return pb
}

/** Signs in to your server and keeps this device's data in sync with it while signed in. */
export function useSync(data: Backup, apply: (data: Backup) => void) {
  const [server, setServer] = usePersistentState('ct.server', '')
  const pb = useMemo(() => (server ? client(server) : undefined), [server])
  const [email, setEmail] = useState<string | undefined>(() => (pb?.authStore.isValid ? (pb.authStore.record?.email as string) : undefined))
  const [status, setStatus] = useState<SyncStatus>({ state: 'idle' })
  const dataRef = useRef(data)
  dataRef.current = data
  const applyRef = useRef(apply)
  applyRef.current = apply
  const running = useRef<Promise<void> | undefined>(undefined)
  const again = useRef(false)
  /** The data as of the last successful sync, so applying it doesn't trigger another sync. */
  const lastSynced = useRef<string | undefined>(undefined)

  const signOut = useCallback(() => {
    if (pb?.authStore.record) writeBase(pb.authStore.record.id)
    pb?.authStore.clear()
    setEmail(undefined)
    setStatus({ state: 'idle' })
  }, [pb])

  const runSync = useCallback(async (client: PocketBase): Promise<void> => {
    const userId = client.authStore.record?.id
    if (!userId) return
    setStatus({ state: 'syncing' })
    try {
      const backups = client.collection('backups')
      const record = await backups.getFirstListItem<RecordModel>(client.filter('user = {:userId}', { userId })).catch((e) => {
        if (e instanceof ClientResponseError && e.status === 404) return undefined
        throw e
      })
      const local = dataRef.current
      const base = readBase(userId)
      const remote = record ? normalize(record.data as Partial<Backup>) : undefined
      const merged = remote ? merge(local, remote, base) : local
      if (!record) await backups.create({ user: userId, data: merged })
      else if (stable(remote) !== stable(merged)) await backups.update(record.id, { data: merged })

      // If something was logged while this sync was running, keep it and send it next time.
      const now = dataRef.current
      const next = now === local ? merged : merge(now, merged, base)
      if (stable(next) !== stable(now)) applyRef.current(next)
      if (now !== local) again.current = true
      writeBase(userId, fingerprint(merged))
      lastSynced.current = stable(next)
      setStatus({ state: 'ok', at: Date.now() })
    } catch (e) {
      if (e instanceof ClientResponseError && e.status === 401) signOut()
      setStatus({ state: 'error', message: describeError(e, 'sync') })
    }
  }, [signOut])

  /** Runs a sync, or queues one if a sync is already running. */
  const sync = useCallback(async () => {
    if (!pb?.authStore.isValid) return
    if (running.current) {
      again.current = true
      return running.current
    }
    running.current = (async () => {
      do {
        again.current = false
        await runSync(pb)
      } while (again.current)
    })().finally(() => (running.current = undefined))
    return running.current
  }, [pb, runSync])

  const signIn = useCallback(
    async (serverInput: string, emailInput: string, password: string, create: boolean) => {
      const url = normalizeServer(serverInput)
      const next = client(url)
      try {
        if (create) await next.collection('users').create({ email: emailInput, password, passwordConfirm: password })
      } catch (e) {
        throw new Error(describeError(e, 'signup'))
      }
      try {
        await next.collection('users').authWithPassword(emailInput, password)
      } catch (e) {
        throw new Error(describeError(e, 'signin'))
      }
      setStatus({ state: 'syncing' })
      await runSync(next)
      setServer(url)
      setEmail(emailInput)
    },
    [runSync, setServer],
  )

  // When the app opens: renew the sign-in (it lasts a week otherwise), then sync.
  useEffect(() => {
    if (!pb?.authStore.isValid) return
    pb.collection('users')
      .authRefresh()
      .catch((e) => {
        if (e instanceof ClientResponseError && (e.status === 401 || e.status === 404)) signOut()
      })
      .finally(() => void sync())
  }, [pb, signOut, sync])

  // Sync a couple of seconds after something changes, and whenever the app comes back to the front.
  const { entries, foods, settings, profile, weights } = data
  useEffect(() => {
    if (!email || stable({ entries, foods, settings, profile, weights }) === lastSynced.current) return
    const timer = setTimeout(() => void sync(), 2000)
    return () => clearTimeout(timer)
  }, [email, sync, entries, foods, settings, profile, weights])
  useEffect(() => {
    if (!email) return
    const onShow = () => document.visibilityState === 'visible' && void sync()
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [email, sync])

  return { server, email, status, signIn, signOut, sync }
}

export type Sync = ReturnType<typeof useSync>
