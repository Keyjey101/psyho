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

export const isTMA = (): boolean =>
  typeof window !== "undefined" &&
  (Boolean(window.Telegram?.WebApp?.initData) || Boolean(window.Telegram?.WebApp?.initDataUnsafe?.user?.id))

export const getTelegramUser = () =>
  window.Telegram?.WebApp?.initDataUnsafe?.user

export const getInitData = (): string =>
  window.Telegram?.WebApp?.initData ?? ""

export const initTelegramApp = () => {
  if (!isTMA()) return
  window.Telegram!.WebApp!.ready()
  window.Telegram!.WebApp!.expand()
}
