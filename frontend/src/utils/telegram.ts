export const TG_TOKEN_KEY = "tg_access_token"
export const TG_REFRESH_KEY = "tg_refresh_token"

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string
        initDataUnsafe: {
          user?: {
            id: number
            first_name: string
            last_name?: string
            username?: string
          }
        }
        ready: () => void
        expand: () => void
        close: () => void
      }
    }
  }
}

// Telegram appends `#tgWebAppData=...&tgWebAppVersion=...&...` to the URL
// fragment when launching a Mini App. We can read this even when
// telegram-web-app.js hasn't loaded (slow CDN, blocked by ROM, embedded
// Android webview without the JS bridge — confirmed on a few stock builds).
function getHashParam(name: string): string | null {
  if (typeof window === "undefined") return null
  const hash = window.location.hash || ""
  if (!hash) return null
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash)
  return params.get(name)
}

function getInitDataFromHash(): string {
  return getHashParam("tgWebAppData") || ""
}

function parseUserFromInitData(initData: string): {
  id: number
  first_name: string
  last_name?: string
  username?: string
} | null {
  if (!initData) return null
  try {
    const params = new URLSearchParams(initData)
    const userJson = params.get("user")
    if (!userJson) return null
    const user = JSON.parse(userJson)
    if (typeof user?.id !== "number") return null
    return user
  } catch {
    return null
  }
}

// Detect Mini App context. Either the SDK populated WebApp (best case) OR
// the URL fragment carries Telegram's tgWebApp* params (works without SDK).
export const isTMA = (): boolean => {
  if (typeof window === "undefined") return false
  if (window.Telegram?.WebApp?.initData) return true
  if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) return true
  if (getHashParam("tgWebAppData")) return true
  if (getHashParam("tgWebAppVersion")) return true
  return false
}

export const getTelegramUser = () => {
  const sdkUser = window.Telegram?.WebApp?.initDataUnsafe?.user
  if (sdkUser?.id) return sdkUser
  // Fallback: parse user out of the raw hash initData when SDK is missing
  const hashInitData = getInitDataFromHash()
  const parsed = parseUserFromInitData(hashInitData)
  return parsed ?? undefined
}

export const getInitData = (): string => {
  const sdkData = window.Telegram?.WebApp?.initData
  if (sdkData) return sdkData
  return getInitDataFromHash()
}

// Wait up to `timeoutMs` for `window.Telegram.WebApp` to appear. The SDK
// script is loaded `async defer`, so on slow networks it can take a couple
// of seconds — falling straight through to OTP made TMA logins flaky on
// some Android builds.
export const waitForTelegramSdk = (timeoutMs = 3000): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Telegram?.WebApp) {
      resolve(true)
      return
    }
    const start = Date.now()
    const interval = setInterval(() => {
      if (window.Telegram?.WebApp) {
        clearInterval(interval)
        resolve(true)
        return
      }
      if (Date.now() - start >= timeoutMs) {
        clearInterval(interval)
        resolve(false)
      }
    }, 100)
  })
}

export const initTelegramApp = () => {
  const wa = window.Telegram?.WebApp
  if (!wa) return
  try { wa.ready() } catch { /* ignore — older clients */ }
  try { wa.expand() } catch { /* ignore */ }
}
