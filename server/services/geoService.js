import fetch from 'node-fetch'

export async function lookupIpGeo(ip) {
  // Skip private/local addresses
  if (!ip || ip.startsWith('127.') || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.')) return null

  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,isp,query`)
    if (!res.ok) return null
    const data = await res.json()
    if (data?.status !== 'success') return null
    return {
      country: data.country ?? null,
      region: data.regionName ?? null,
      city: data.city ?? null,
      isp: data.isp ?? null,
    }
  } catch {
    return null
  }
}

