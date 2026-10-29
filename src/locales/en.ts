const en = {
  externalDownload: {
    company: 'Libyan Iron and Steel Company',
    portal: 'Secure File Sharing Portal',
    title: 'Secure file download',
    description:
      'A file has been securely shared with you by the Libyan Iron and Steel Company.',
    hint:
      'This link may be limited by an expiration time or a maximum number of downloads.',
    download: 'Download file',
    preparing: 'Preparing download...',
    security: 'Secure connection • Files are protected and encrypted',
    started: (downloadCount: number, maxDownloads: number) =>
      `Download started. ${downloadCount} of ${maxDownloads} allowed downloads used.`,
    unknownError: 'Unable to download shared file.',
  },
}

export default en
