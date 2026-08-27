import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gen-accent/10 border border-gen-accent/20 flex items-center justify-center mb-5">
        <Compass className="w-8 h-8 text-gen-accent" />
      </div>
      <p className="text-6xl font-black gen-gradient-text">404</p>
      <h1 className="text-xl font-semibold text-gen-fg mt-3">
        الصفحة غير موجودة · Page not found
      </h1>
      <p className="text-sm text-gen-muted mt-2 max-w-sm leading-relaxed">
        الرابط الذي فتحته غير صحيح أو تم نقل الصفحة. جرّب البحث عن جهازك من
        الصفحة الرئيسية — قاعدة البيانات تنتظرك.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-gen-accent text-white text-sm font-semibold hover:bg-gen-accent-light transition-colors"
      >
        العودة للرئيسية
      </Link>
    </main>
  );
}
