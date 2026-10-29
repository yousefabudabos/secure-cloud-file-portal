type HeaderProps = {
  email: string | undefined
  onSignOut: () => Promise<void>
}

export default function Header({
  email,
  onSignOut,
}: HeaderProps) {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="company-brand">
            <div className="brand-mark">LISCO</div>

            <div className="company-text">
              <strong>الشركة الليبية للحديد والصلب</strong>
              <span>LIBYAN IRON AND STEEL COMPANY</span>
            </div>

            <div className="brand-divider" />

            <div className="portal-title">
              <strong>بوابة مشاركة الملفات الآمنة</strong>
              <span>Secure File Sharing Portal</span>
            </div>
          </div>

          <div className="user-area">
            <div className="user-avatar">
              {(email || 'U')
                .toString()
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="user-info">
              <strong>المستخدم</strong>
              <span
                className="ltr-value"
                dir="ltr"
              >
                {email}
              </span>
            </div>

            <button
              className="btn btn-header"
              onClick={onSignOut}
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </header>

      <nav className="portal-nav">
        <div className="nav-inner">
          <a href="#my-files" className="nav-link active">
            ملفاتي
          </a>

          <a href="#shared-with-me" className="nav-link">
            تمت مشاركتها معي
          </a>

          <a href="#external-shares" className="nav-link">
            المشاركات الخارجية
          </a>
        </div>
      </nav>
    </>
  )
}
