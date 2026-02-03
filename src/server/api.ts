import { createServerFn } from '@tanstack/react-start'

// Server function to get API key securely
// In production, you might also validate sessions, rate limit, etc.
export const getApiConfig = createServerFn().handler(async () => {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  return {
    apiKey,
  }
})

// Server function to request notification permission
// and subscribe to push notifications
export const subscribePush = createServerFn()
  .validator((data: { subscription: PushSubscriptionJSON }) => data)
  .handler(async ({ data }) => {
    // In a real app, store this subscription in a database
    // For now, just log it
    console.log('Push subscription received:', data.subscription)

    return { success: true }
  })
