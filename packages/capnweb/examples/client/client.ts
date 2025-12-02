import type { RpcStub } from 'capnweb';
import { newWebSocketRpcSession } from 'capnweb'
import type { PublicApi } from '../src/my-api-server'

using stub: RpcStub<PublicApi> = newWebSocketRpcSession<PublicApi>('ws://localhost:8787/api')

console.log(await stub.hello("Cap'n Web"))
