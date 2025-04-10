import type { FixtureRequestType, FixtureResponseType } from '@dynamock/core'

export type FixtureSWType = {
  request: Omit<FixtureRequestType, 'path' | 'origin'> & {
    url: string
  }
  response: FixtureResponseType
}
