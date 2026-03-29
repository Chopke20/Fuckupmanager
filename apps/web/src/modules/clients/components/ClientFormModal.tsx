import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Download, X } from 'lucide-react'
import { CreateClientSchema, UpdateClientSchema, type Client } from '@lama-stage/shared-types'
import { apiNipCompanyLookup } from '../../../shared/api/nip-lookup.api'
import { useCreateClient, useUpdateClient } from '../hooks/useClients'

interface ClientFormModalProps {
  isOpen: boolean
  onClose: () => void
  client: Client | null
  /** Po utworzeniu nowego klienta (tylko przy create) */
  onSuccess?: (client: Client) => void
}

type FormData = {
  companyName: string
  contactName?: string
  address?: string
  nip?: string
  email?: string
  phone?: string
  notes?: string
}

export default function ClientFormModal({ isOpen, onClose, client, onSuccess }: ClientFormModalProps) {
  const createMutation = useCreateClient()
  const updateMutation = useUpdateClient()
  const [apiError, setApiError] = useState<string | null>(null)
  const [nipFetchError, setNipFetchError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(client ? UpdateClientSchema : CreateClientSchema),
    defaultValues: {
      companyName: '',
      contactName: '',
      address: '',
      nip: '',
      email: '',
      phone: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (client) {
      reset({
        companyName: client.companyName,
        contactName: client.contactName || '',
        address: client.address || '',
        nip: client.nip || '',
        email: client.email || '',
        phone: client.phone || '',
        notes: client.notes || '',
      })
    } else {
      reset({
        companyName: '',
        contactName: '',
        address: '',
        nip: '',
        email: '',
        phone: '',
        notes: '',
      })
    }
  }, [client, reset])

  const nipValue = watch('nip')

  const nipFetchMut = useMutation({
    mutationFn: () => apiNipCompanyLookup(nipValue ?? ''),
    onSuccess: (data) => {
      setValue('companyName', data.companyName, { shouldValidate: true })
      setValue('address', data.address, { shouldValidate: true })
      setValue('nip', data.nip, { shouldValidate: true })
      setNipFetchError(null)
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: { message?: string } } } }
      setNipFetchError(ax?.response?.data?.error?.message ?? 'Nie udało się pobrać danych po NIP.')
    },
  })

  const onSubmit = async (data: FormData) => {
    setApiError(null)
    try {
      if (client) {
        await updateMutation.mutateAsync({ id: client.id, data })
      } else {
        const result = await createMutation.mutateAsync(data)
        const created = (result as any)?.data ?? result
        if (created?.id) {
          onSuccess?.(created as Client)
        }
      }
      onClose()
    } catch (err: any) {
      const data = err?.response?.data
      const msg =
        (typeof data?.error === 'object' && data?.error?.message) ??
        data?.message ??
        data?.error ??
        (typeof err?.message === 'string' ? err.message : 'Nie udało się zapisać klienta.')
      setApiError(String(msg))
      console.error('Błąd zapisu klienta:', err)
    }
  }

  if (!isOpen) return null

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2.5">
      <div className="bg-surface rounded-xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-3 border-b border-border">
          <h2 className="text-lg font-bold">
            {client ? 'Edytuj klienta' : 'Nowy klient'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-2 rounded-lg"
          >
            <X size={24} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.stopPropagation()
            handleSubmit(onSubmit)(e)
          }}
          className="p-3 space-y-3"
          noValidate
        >
          {(errors.companyName || errors.email || apiError || nipFetchError) && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-600">
              {errors.companyName?.message ?? errors.email?.message ?? nipFetchError ?? apiError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Nazwa firmy *
              </label>
              <input
                {...register('companyName')}
                className="w-full px-2.5 py-1.5 text-sm bg-surface-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Nazwa firmy"
              />
              {errors.companyName && (
                <p className="text-red-500 text-sm mt-1">{errors.companyName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Osoba kontaktowa
              </label>
              <input
                {...register('contactName')}
                className="w-full px-2.5 py-1.5 text-sm bg-surface-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Imię i nazwisko"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">NIP</label>
              <div className="flex gap-1">
                <input
                  {...register('nip', {
                    onChange: () => setNipFetchError(null),
                  })}
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-sm bg-surface-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="10 cyfr"
                />
                <button
                  type="button"
                  title="Pobierz nazwę i adres z GUS (DataPort.pl)"
                  disabled={
                    nipFetchMut.isPending || createMutation.isPending || updateMutation.isPending
                  }
                  onClick={() => nipFetchMut.mutate()}
                  className="shrink-0 px-2.5 py-1.5 text-xs border border-border rounded hover:bg-surface-2 flex items-center gap-1 whitespace-nowrap"
                >
                  <Download size={14} />
                  Pobierz
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Dane z rejestru GUS (DataPort). E-mail i telefon uzupełnij ręcznie.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                {...register('email')}
                type="text"
                autoComplete="email"
                className="w-full px-2.5 py-1.5 text-sm bg-surface-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="email@example.com"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Telefon</label>
              <input
                {...register('phone')}
                className="w-full px-2.5 py-1.5 text-sm bg-surface-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="+48 123 456 789"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Adres</label>
              <input
                {...register('address')}
                className="w-full px-2.5 py-1.5 text-sm bg-surface-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Ulica, kod pocztowy, miasto"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Notatki</label>
              <textarea
                {...register('notes')}
                rows={2}
                className="w-full px-2.5 py-1.5 text-sm bg-surface-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Dodatkowe informacje"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-2"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-3 py-1.5 text-sm border-2 border-primary text-primary bg-transparent rounded font-medium hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Zapisywanie...'
                : client
                ? 'Zapisz zmiany'
                : 'Utwórz klienta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}