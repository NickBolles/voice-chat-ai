import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

// Server function to get API key securely
export const getApiConfig = createServerFn().handler(async () => {
  console.log('[Server] getApiConfig called')
  
  const apiKey = process.env.GEMINI_API_KEY
  
  if (!apiKey) {
    console.error('[Server] GEMINI_API_KEY is not set!')
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }
  
  // Log that we have a key (but not the key itself!)
  console.log('[Server] GEMINI_API_KEY found, length:', apiKey.length)
  console.log('[Server] Key prefix:', apiKey.substring(0, 10) + '...')
  
  return {
    apiKey,
  }
})

// Server function for push subscription (placeholder)
export const subscribePush = createServerFn().handler(async () => {
  console.log('[Server] Push subscription received')
  return { success: true }
})
