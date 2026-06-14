import { useCallback } from 'react'
import { useSocket } from '../context/SocketContext'
import { useRoom } from './useRoom'

export function usePlayer() {
  const { socket, isConnected } = useSocket()
  const { currentPlayer, isOwner, playerId } = useRoom()

  const changeName = useCallback((name: string) => {
    if (!isConnected || !name.trim()) return
    socket.emit('name-change', { name: name.trim().slice(0, 20) })
  }, [socket, isConnected])

  const toggleSpectate = useCallback(() => {
    if (!isConnected) return
    socket.emit('toggle-spectate')
  }, [socket, isConnected])

  return {
    currentPlayer,
    playerId,
    isOwner,
    changeName,
    toggleSpectate,
  }
}
