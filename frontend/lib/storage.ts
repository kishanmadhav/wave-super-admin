import { supabase } from './supabase'
import { api } from './api'

// Bucket names:
// - "images" public bucket (cover art, profile photos)
// - "audio" private bucket (stream via signed URLs)

export const storagePath = {
  coverArt:     (releaseId: string, filename: string) => `covers/${releaseId}/${filename}`,
  profilePhoto: (userId: string,   filename: string)  => `profiles/${userId}/${filename}`,
  bannerPhoto:  (userId: string,   filename: string)  => `banners/${userId}/${filename}`,
  track:        (releaseId: string, filename: string) => `tracks/${releaseId}/${filename}`,
}

interface SignedUploadResponse {
  signedUrl: string
  token: string
  path: string
}

async function getSignedUploadUrl(bucket: 'audio' | 'images', path: string): Promise<SignedUploadResponse> {
  return api.post<SignedUploadResponse>('/storage/sign', { bucket, path })
}

async function uploadWithSignedUrl(signedUrl: string, file: File): Promise<void> {
  const res = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`)
}

export async function uploadImage(path: string, file: File): Promise<string> {
  const { signedUrl } = await getSignedUploadUrl('images', path)
  await uploadWithSignedUrl(signedUrl, file)
  const { data } = supabase.storage.from('images').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadAudio(path: string, file: File): Promise<string> {
  const { signedUrl } = await getSignedUploadUrl('audio', path)
  await uploadWithSignedUrl(signedUrl, file)
  return `audio/${path}`
}

export async function getAudioStreamUrl(key: string, expiresIn = 3600): Promise<string> {
  const { url } = await api.post<{ url: string }>('/storage/sign/read', { key, expiresIn })
  return url
}

