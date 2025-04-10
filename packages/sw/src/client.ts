import type { FixtureSWType } from './fixture.js'
import type { ConfigurationType } from '@dynamock/core'
import type {
  DeleteConfig,
  DeleteFixture,
  DeleteFixtures,
  GetConfig,
  MessageType,
  PostFixture,
  PostFixtures,
  PutConfig,
} from './message.js'

export type DynamockSW = {
  unregister: () => Promise<boolean>
  getConfiguration: () => Promise<GetConfig['response']['data']>
  updateConfiguration: (configuration: Partial<ConfigurationType>) => Promise<PutConfig['response']['data']>
  deleteConfiguration: () => Promise<DeleteConfig['response']['data']>
  addFixture: (fixture: FixtureSWType) => Promise<PostFixture['response']['data']>
  removeFixture: (id: string) => Promise<DeleteFixture['response']['data']>
  addFixtures: (fixtures: FixtureSWType[]) => Promise<PostFixtures['response']['data']>
  removeFixtures: () => Promise<DeleteFixtures['response']['data']>
}

export async function dynamock(filepath: string): Promise<DynamockSW | undefined> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('serviceWorker not supported')
  }

  let registration = undefined

  try {
    registration = await navigator.serviceWorker.register(filepath, { scope: '/' })
  } catch (error) {
    // @ts-ignore
    console.error('Service worker registration failed:', error?.message)
    return
  }

  await navigator.serviceWorker.ready

  // navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
  //   console.log('message from sw', JSON.stringify(event.data))
  // })

  const postMessage = <M extends MessageType<unknown, unknown, unknown>>(
    requestMessage: M['request'],
  ): Promise<M['response']['data']> => {
    return new Promise((resolve, reject) => {
      navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
        const responseMessage = event.data as M['response']

        if (responseMessage?.type === requestMessage.type) {
          resolve(responseMessage.data)
        }
      })

      registration.active?.postMessage(requestMessage)
    })
  }

  return {
    unregister: () => registration.unregister(),
    getConfiguration: () => postMessage<GetConfig>({ type: 'GET_CONFIG', data: undefined }),
    updateConfiguration: (configuration: Partial<ConfigurationType>) =>
      postMessage<PutConfig>({ type: 'PUT_CONFIG', data: configuration }),
    deleteConfiguration: () => postMessage<DeleteConfig>({ type: 'DELETE_CONFIG', data: undefined }),
    addFixture: (fixture: FixtureSWType) => postMessage<PostFixture>({ type: 'POST_FIXTURE', data: fixture }),
    removeFixture: (id: string) => postMessage<DeleteFixture>({ type: 'DELETE_FIXTURE', data: id }),
    addFixtures: (fixtures: FixtureSWType[]) => postMessage<PostFixtures>({ type: 'POST_FIXTURES', data: fixtures }),
    removeFixtures: () => postMessage<DeleteFixtures>({ type: 'DELETE_FIXTURES', data: undefined }),
  }
}
