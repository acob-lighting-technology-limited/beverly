import { onMounted, ref, type Ref } from 'vue'

export interface Resource<T> { data: Ref<T | null>; loading: Ref<boolean>; error: Ref<string>; reload: () => Promise<void> }

/** Loads data on mount and exposes loading and error state, so every screen handles failure the same way. */
export function useResource<T>(load: () => Promise<T>): Resource<T> {
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(true)
  const error = ref('')
  async function reload(): Promise<void> {
    loading.value = true
    error.value = ''
    try { data.value = await load() }
    catch (e) { error.value = e instanceof Error ? e.message : 'Something went wrong.' }
    finally { loading.value = false }
  }
  onMounted(reload)
  return { data, loading, error, reload }
}
