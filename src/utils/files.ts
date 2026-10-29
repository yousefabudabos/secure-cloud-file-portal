export function getDisplayName(key: string) {
  const filePart = key.split('/').pop() ?? key

  if (filePart.length > 37) {
    return filePart.slice(37)
  }

  return filePart
}

export function startDownload(url: string) {
  const link = document.createElement('a')
  link.href = url
  document.body.appendChild(link)
  link.click()
  link.remove()
}
