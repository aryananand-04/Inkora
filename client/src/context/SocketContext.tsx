import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from 'shared'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface SocketContextValue {
  socket: TypedSocket
  isConnected: boolean
}

const SocketContext = createContext<SocketContextValue | null>(null)

let globalSocket: TypedSocket | null = null

function getOrCreateVisitorId(): string {
  const key = 'inkora-visitor-id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

function getSocket(): TypedSocket {
  if (!globalSocket) {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'
    console.log('[Socket] Creating socket connection to:', socketUrl)
    // Default transport order (polling, then silent upgrade to websocket) avoids
    // the noisy "websocket error" that forcing websocket-first produced.
    globalSocket = io(socketUrl, {
      autoConnect: true,
      auth: { visitorId: getOrCreateVisitorId() },
    })
  }
  return globalSocket
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [socket] = useState<TypedSocket>(getSocket)

  useEffect(() => {
    console.log('[Socket] Setting up event listeners')

    const onConnect = () => {
      console.log('[Socket] Connected! ID:', socket.id)
      setIsConnected(true)
    }

    const onDisconnect = (reason: string) => {
      console.log('[Socket] Disconnected:', reason)
      setIsConnected(false)
    }

    const onConnectError = (error: Error) => {
      // Transient during reconnect/upgrade; warn rather than error-spam the console
      console.warn('[Socket] Connection issue:', error.message)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)

    // Check if already connected
    if (socket.connected) {
      console.log('[Socket] Already connected! ID:', socket.id)
      setIsConnected(true)
    }

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
    }
  }, [socket])

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}
