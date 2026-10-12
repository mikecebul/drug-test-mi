import { useQuery, useQueryClient } from '@tanstack/react-query'

// Local acknowledgements survive Back navigation. Reset clears the guided cache.
export function useGuidedConfirmations(
  scope: 'verified-client-identities' | 'created-lab-reports',
  adminId?: string | number,
) {
  const queryClient = useQueryClient()
  const queryKey = ['guided', scope, adminId] as const
  const { data: keys = [] } = useQuery<string[]>({
    queryKey,
    queryFn: () => queryClient.getQueryData<string[]>(queryKey) ?? [],
    enabled: false,
    initialData: [],
  })
  return { keys, queryKey }
}
