import type { Player as PlayerData, PlayerState } from 'shared'

export class Player implements PlayerData {
  id: string
  name: string
  state: PlayerState
  score: number
  lastScore: number
  rank: number
  connected: boolean
  ip: string
  visitorId: string

  constructor(id: string, name: string, ip: string, visitorId: string) {
    this.id = id
    this.name = name.trim().slice(0, 20) || 'Player'
    this.state = 'standby'
    this.score = 0
    this.lastScore = 0
    this.rank = 0
    this.connected = true
    this.ip = ip
    this.visitorId = visitorId
  }

  toJSON(): PlayerData {
    return {
      id: this.id,
      name: this.name,
      state: this.state,
      score: this.score,
      lastScore: this.lastScore,
      rank: this.rank,
      connected: this.connected,
    }
  }
}
