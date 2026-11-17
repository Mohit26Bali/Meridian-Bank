import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 text-xl font-semibold tracking-tight"
      >
        <Image src="/logo-mark.png" alt="" width={32} height={32} className="size-8" priority />
        Meridian Bank
      </Link>
      <div id="main-content" className="w-full max-w-md">{children}</div>
    </div>
  );
}
