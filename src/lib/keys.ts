// API keys the Admin can enter on the Admin page; the environment variable wins when both are set.
import { getSetting } from './db'

export const absKey = () => process.env.ABS_API_KEY || getSetting<string>('absKey') || undefined
export const tmdbKey = () => process.env.TMDB_API_KEY || getSetting<string>('tmdbKey') || undefined
