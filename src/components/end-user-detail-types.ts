export type EndUserDetailInitialUser = {
  id: string
  email: string | null
  identifier: string | null
  name: string | null
  plan: string
  banned: boolean
  country: string | null
  startDate: string
  endDate: string | null
  createdAt: string
  updatedAt: string
}

export type EndUserPaymentListItem = {
  id: string
  endUserId: string
  amount: number
  currency: string
  status: string
  description: string | null
  paymentDate: string
  createdAt: string
}

export type EndUserApiRow = {
  id: string
  email: string | null
  identifier: string | null
  name: string | null
  plan: string
  banned: boolean
  country: string | null
  startDate: Date | string | null | undefined
  endDate: Date | string | null
  createdAt: Date | string | null | undefined
  updatedAt: Date | string | null | undefined
}
