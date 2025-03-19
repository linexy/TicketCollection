import axios from 'axios';
import { toast } from 'react-hot-toast';

// 将 Base64 VAPID public key 转换为 Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const subscribeToPush = async () => {
  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });
    await navigator.serviceWorker.ready;

    // 先检查并取消现有订阅
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      await existingSubscription.unsubscribe();
    //  console.log('Unsubscribed from existing subscription');
    }

    // 创建新订阅
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.REACT_APP_VAPID_PUBLIC_KEY || '')
    });

    //console.log('New subscription created:', subscription);
    
    const subJson = subscription.toJSON() as PushSubscriptionJSON;
    const subscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subJson.keys?.p256dh ?? '',
        auth: subJson.keys?.auth ?? ''
      }
    };
    
    const token = localStorage.getItem('token');
    const response = await axios.post('/api/push/subscribe', subscriptionData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

   // console.log('Server response:', response.data);
    return response.data.success;
  } catch (error) {
    console.error('推送订阅失败:', error);
    if (axios.isAxiosError(error)) {
      console.error('Axios error:', error.response?.data);
      toast.error(`订阅失败: ${error.response?.data?.message || error.message}`);
    }
    return false;
  }
}; 