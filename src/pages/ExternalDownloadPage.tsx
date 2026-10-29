import { useState } from 'react'
import Toast from '../components/Toast'
import ar from '../locales/ar'
import en from '../locales/en'
import * as api from '../services/api'
import type { ExternalLanguage } from '../types'
import { startDownload } from '../utils/files'

type ExternalDownloadPageProps = {
  token: string
}

export default function ExternalDownloadPage({ token }: ExternalDownloadPageProps) {
  const [externalDownloading, setExternalDownloading] = useState(false)
  const [externalDownloadMessage, setExternalDownloadMessage] =
    useState('')

  const [externalLanguage, setExternalLanguage] =
    useState<ExternalLanguage>(() => {
      const savedLanguage =
        localStorage.getItem('lisco-external-language')

      if (savedLanguage === 'ar' || savedLanguage === 'en') {
        return savedLanguage
      }

      return navigator.language
        .toLowerCase()
        .startsWith('ar')
        ? 'ar'
        : 'en'
    })

  const changeExternalLanguage = (
    language: ExternalLanguage,
  ) => {
    setExternalLanguage(language)
    localStorage.setItem(
      'lisco-external-language',
      language,
    )
  }

  const externalText = externalLanguage === 'ar'
    ? ar.externalDownload
    : en.externalDownload

  const handleExternalDownload = async () => {
    if (!token) {
      return
    }

    setExternalDownloading(true)
    setExternalDownloadMessage('')

    try {
      const data = await api.getExternalDownload(token)
      startDownload(data.downloadUrl)

      setExternalDownloadMessage(
        externalText.started(data.downloadCount, data.maxDownloads),
      )
    } catch (error) {
      console.error(error)

      const rawMessage =
        error instanceof Error
          ? error.message
          : en.externalDownload.unknownError

      setExternalDownloadMessage(
        externalLanguage === 'ar'
          ? ar.externalDownload.errors[rawMessage] ||
              ar.externalDownload.unknownError
          : rawMessage,
      )
    } finally {
      setExternalDownloading(false)
    }
  }

  return (
    <div
      className="public-page"
      dir={externalLanguage === 'ar' ? 'rtl' : 'ltr'}
      lang={externalLanguage}
    >
      <div className="public-card">
        <div className="language-switch">
          <button
            className={
              externalLanguage === 'ar'
                ? 'language-btn active'
                : 'language-btn'
            }
            onClick={() => changeExternalLanguage('ar')}
          >
            العربية
          </button>

          <button
            className={
              externalLanguage === 'en'
                ? 'language-btn active'
                : 'language-btn'
            }
            onClick={() => changeExternalLanguage('en')}
          >
            English
          </button>
        </div>

        <div className="public-brand">
          <div className="brand-mark">LISCO</div>

          <div>
            <strong>{externalText.company}</strong>
            <span>{externalText.portal}</span>
          </div>
        </div>

        <div className="public-icon">↓</div>

        <h1>{externalText.title}</h1>

        <p className="public-description">
          {externalText.description}
        </p>

        <p className="public-hint">
          {externalText.hint}
        </p>

        <button
          className="btn btn-primary btn-large"
          onClick={handleExternalDownload}
          disabled={externalDownloading}
        >
          {externalDownloading
            ? externalText.preparing
            : externalText.download}
        </button>

        {externalDownloadMessage && (
          <Toast message={externalDownloadMessage} variant="external-message" />
        )}

        <div className="security-note">
          🔒 {externalText.security}
        </div>
      </div>
    </div>
  )
}
