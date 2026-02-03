import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

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

// Schema for push subscription
const pushSubscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }).optional(),
  }),
})

// Server function to request notification permission
// and subscribe to push notifications
export const subscribePush = createServerFn()
  .handler(async (ctx) => {
    // Parse the input - for now just accept it
    // In a real app, store this subscription in a database
    console.log('Push subscription received')

    return { success: true }
  })
