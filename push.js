// Push notifications module
// Depends on globals: sb, SUPABASE_URL
// Exposes: subscribePushNotifications, sendPushToUser, urlBase64ToUint8Array, VAPID_PUBLIC_KEY

const VAPID_PUBLIC_KEY = 'BMAMPjPS9Hb4yfjMpaku-69Cuwlot-lrBl53uF1JDF3OMzuEUckskFCS77Y534VT2PSf0S68ZSOJjfjXUqVU8-Q';

async function subscribePushNotifications() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const sj = sub.toJSON();
    await sb.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sj.keys?.p256dh,
      auth: sj.keys?.auth,
      keys: sj.keys,
    }, { onConflict: 'endpoint' });
    return true;
  } catch(e) { console.error('Push subscribe error:', e); return false; }
}

// Send a push to a user (fire-and-forget, failures are silent)
async function sendPushToUser(userId, title, body, extra) {
  if (!userId) return;
  try {
    const session = (await sb.auth.getSession()).data.session;
    await fetch(SUPABASE_URL + '/functions/v1/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (session?.access_token || '') },
      body: JSON.stringify({ user_id: userId, title, body, url: extra?.url || '/', tag: extra?.tag }),
    });
  } catch(e) { console.error('sendPushToUser:', e); }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// Export to window
window.VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY;
window.subscribePushNotifications = subscribePushNotifications;
window.sendPushToUser = sendPushToUser;
window.urlBase64ToUint8Array = urlBase64ToUint8Array;
