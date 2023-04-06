import {
  Callback,
  ILLA_WEBSOCKET_CONTEXT,
  ILLA_WEBSOCKET_STATUS,
} from "@/api/ws/interface"
import { getIsOnline } from "@/redux/config/configSelector"
import { configActions } from "@/redux/config/configSlice"
import { cursorActions } from "@/redux/currentApp/cursor/cursorSlice"
import store from "@/store"
import { MovingMessageBin } from "./ILLA_PROTO"

const HEARTBEAT_PING_TIMEOUT = 2 * 1000
const HEARTBEAT_PONG_TIMEOUT = 5 * 1000
const RECONNECT_TIMEOUT = 5 * 1000
const REPEAT_LIMIT = 5

export class ILLABinaryWebsocket {
  url: string
  ws: WebSocket | null = null
  repeat: number = 0
  lockReconnect: boolean = false
  forbidReconnect: boolean = false
  pingTimeoutId: number = -1
  pongTimeoutId: number = -1
  isOnline: boolean = getIsOnline(store.getState())
  // messageQueue: Uint8Array[] = []
  status: ILLA_WEBSOCKET_STATUS = ILLA_WEBSOCKET_STATUS.INIT
  context: ILLA_WEBSOCKET_CONTEXT = ILLA_WEBSOCKET_CONTEXT.DASHBOARD

  constructor(url: string, context: ILLA_WEBSOCKET_CONTEXT) {
    this.url = url
    this.context = context
    this.createWebsocket()
  }

  private createWebsocket() {
    try {
      store.dispatch(
        configActions.updateWSStatusReducer({
          context: this.context,
          wsStatus: ILLA_WEBSOCKET_STATUS.CONNECTING,
        }),
      )
      this.ws = new WebSocket(this.url)
      this.ws.binaryType = "arraybuffer"

      this.initEventHandle()
    } catch (e) {
      this.reconnect()
      throw e
    }
  }

  private initEventHandle() {
    if (this.ws) {
      this.ws.onclose = () => {
        this.reconnect()
        store.dispatch(
          configActions.updateWSStatusReducer({
            context: this.context,
            wsStatus: ILLA_WEBSOCKET_STATUS.CLOSED,
          }),
        )
      }
      this.ws.onerror = () => {
        this.reconnect()
        store.dispatch(
          configActions.updateWSStatusReducer({
            context: this.context,
            wsStatus: ILLA_WEBSOCKET_STATUS.FAILED,
          }),
        )
      }
      this.ws.onopen = () => {
        console.log(`[WS OPENED](${this.url}) connection succeeded`)

        store.dispatch(configActions.updateDevicesOnlineStatusReducer(true))
        store.dispatch(
          configActions.updateWSStatusReducer({
            context: this.context,
            wsStatus: ILLA_WEBSOCKET_STATUS.CONNECTED,
          }),
        )
        this.isOnline = true
        this.repeat = 0
        // this.heartCheck()
        // while (this.messageQueue.length > 0) {
        //   this.send(this.messageQueue.shift() as Uint8Array)
        // }
      }
      this.ws.onmessage = (event) => {
        this.onMessage(event)
        // this.heartCheck()
      }
    }
  }

  private split(byteBuf: Uint8Array) {
    let start = 0
    const result: Uint8Array[] = []
    for (let i = 0; i < byteBuf.length; i++) {
      if (byteBuf[i] === 10) {
        const current = byteBuf.slice(start, i)
        result.push(current)
        start = i + 1
        continue
      }
    }
    const current = byteBuf.slice(start)
    result.push(current)
    return result
  }

  private reconnect() {
    if (this.forbidReconnect) return
    if (this.isOnline) {
      store.dispatch(configActions.updateDevicesOnlineStatusReducer(false))
      this.isOnline = false
    }
    if (REPEAT_LIMIT <= this.repeat) return
    if (this.lockReconnect) return
    this.lockReconnect = true
    this.repeat++
    setTimeout(() => {
      this.createWebsocket()
      this.lockReconnect = false
    }, RECONNECT_TIMEOUT)
  }

  // private heartCheck() {
  //   this.heartReset()
  //   this.heartStart()
  // }

  // private heartStart() {
  //   if (this.forbidReconnect) return
  //   this.pingTimeoutId = window.setTimeout(() => {
  //     this.ws?.send(pingMessage)
  //     this.pongTimeoutId = window.setTimeout(() => {
  //       if (this.isOnline) {
  //         store.dispatch(configActions.updateDevicesOnlineStatusReducer(false))
  //         this.isOnline = false
  //       }
  //       this.ws?.close()
  //     }, HEARTBEAT_PONG_TIMEOUT)
  //   }, HEARTBEAT_PING_TIMEOUT)
  // }

  // private heartReset() {
  //   clearTimeout(this.pingTimeoutId)
  //   clearTimeout(this.pongTimeoutId)
  // }
  public close() {
    this.forbidReconnect = true
    // this.heartReset()
    this.ws?.close()
  }
  public onMessage(event: MessageEvent) {
    const message = event.data
    if (!(message instanceof ArrayBuffer)) {
      return
    }

    const unit8ArrayMessage = new Uint8Array(message)
    const groupUnit8ArrayMessage = this.split(unit8ArrayMessage)
    groupUnit8ArrayMessage.forEach((message) => {
      try {
        const payload = MovingMessageBin.fromBinary(unit8ArrayMessage)
        if (payload.status === 1 || payload.status === -1) {
          const lastUpdateTime = new Date().getTime()
          store.dispatch(
            cursorActions.updateCursorReducer({
              userID: payload.userID,
              nickname: payload.nickname,
              parentDisplayName: payload.parentDisplayName,
              status: payload.status,
              x: payload.x,
              y: payload.y,
              w: payload.w,
              h: payload.h,
              lastUpdateTime,
            }),
          )
        }
      } catch (e) {
        console.debug("[debug] message is not a MovingMessageBin")
      }
    })
  }

  public send(message: Uint8Array) {
    if (this.ws?.readyState !== 1) {
      // this.messageQueue.push(message)
      return
    }
    try {
      this.ws?.send(message)
    } catch (e) {
      console.error(e)
    }
  }
}