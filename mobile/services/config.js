// Override via .env: EXPO_PUBLIC_SIGNAL_HOST=192.168.x.x:8080
export const SIGNAL_HOST = process.env.EXPO_PUBLIC_SIGNAL_HOST || '10.5.245.116:8080'
export const SIGNAL_WS   = `ws://${SIGNAL_HOST}`
export const SIGNAL_HTTP = `http://${SIGNAL_HOST}`
