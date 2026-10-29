const ar = {
  externalDownload: {
    company: 'الشركة الليبية للحديد والصلب',
    portal: 'بوابة مشاركة الملفات الآمنة',
    title: 'تنزيل ملف آمن',
    description:
      'تمت مشاركة ملف معك بأمان من خلال الشركة الليبية للحديد والصلب.',
    hint:
      'قد يكون هذا الرابط محدودًا بمدة صلاحية أو بعدد معين من مرات التنزيل.',
    download: 'تنزيل الملف',
    preparing: 'جارٍ تجهيز الملف...',
    security: 'اتصال آمن • الملفات محمية ومشفرة',
    started: (downloadCount: number, maxDownloads: number) =>
      `بدأ التنزيل. تم استخدام ${downloadCount} من أصل ${maxDownloads} مرات تنزيل مسموح بها.`,
    unknownError: 'تعذر تنزيل الملف المشترك.',
    errors: {
      'Invalid sharing link': 'رابط المشاركة غير صالح.',
      'This sharing link has been revoked': 'تم إلغاء رابط المشاركة.',
      'This sharing link has expired': 'انتهت صلاحية رابط المشاركة.',
      'Download limit reached': 'تم الوصول إلى الحد الأقصى للتنزيلات.',
      'Sharing link is no longer available': 'رابط المشاركة لم يعد متاحًا.',
      'Unable to download shared file.': 'تعذر تنزيل الملف المشترك.',
    } as Record<string, string>,
  },
}

export default ar
