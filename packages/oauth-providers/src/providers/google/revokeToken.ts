export async function revokeToken(token: string): Promise<boolean> {
  const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
    method: 'POST',
    headers: { 'Content-type': 'application/x-www-form-urlencoded' },
  })

  return response.status === 200
}
