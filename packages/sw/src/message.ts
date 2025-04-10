import type {
  ConfigurationType,
  createServiceFixture,
  createServiceFixtures,
  deleteServiceConfiguration,
  deleteServiceFixture,
  deleteServiceFixtures,
  getServiceConfiguration,
  updateServiceConfiguration,
} from '@dynamock/core'
import type { FixtureSWType } from './fixture.js'
import { z } from 'zod'

export const messageSchema = z
  .object({
    type: z.string().nonempty(),
    data: z.unknown(),
  })
  .strict()

export type MessageType<MessageType, Payload, Response> = {
  request: { type: MessageType; data: Payload }
  response: { type: MessageType; data: Response }
}

export type GetConfig = MessageType<`GET_CONFIG`, undefined, ReturnType<typeof getServiceConfiguration>>
export type PutConfig = MessageType<
  'PUT_CONFIG',
  Partial<ConfigurationType>,
  ReturnType<typeof updateServiceConfiguration>
>
export type DeleteConfig = MessageType<`DELETE_CONFIG`, undefined, ReturnType<typeof deleteServiceConfiguration>>
export type PostFixture = MessageType<`POST_FIXTURE`, FixtureSWType, ReturnType<typeof createServiceFixture>>
export type DeleteFixture = MessageType<`DELETE_FIXTURE`, string, ReturnType<typeof deleteServiceFixture>>
export type PostFixtures = MessageType<`POST_FIXTURES`, FixtureSWType[], ReturnType<typeof createServiceFixtures>>
export type DeleteFixtures = MessageType<`DELETE_FIXTURES`, undefined, ReturnType<typeof deleteServiceFixtures>>
