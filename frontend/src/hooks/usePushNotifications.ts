import api from "@/api/client";

export function usePushNotifications() {
  const subscribe = async (): Promise<PushSubscription | null> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return null;

      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) return null;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      await api.post("/notifications/subscribe", subscription);
      return subscription;
    } catch {
      return null;
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    if (!("serviceWorker" in navigator)) return false;
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      if (!registration) return false;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return false;
      await subscription.unsubscribe();
      await api.post("/notifications/unsubscribe");
      return true;
    } catch {
      return false;
    }
  };

  const isSupported = () =>
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  return { subscribe, unsubscribe, isSupported };
}
