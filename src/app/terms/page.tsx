import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of service",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-12 md:px-10">
      <article className="prose prose-neutral dark:prose-invert mx-auto max-w-2xl">
        <h1>Terms of service</h1>
        <p className="lead text-muted-foreground">Last updated: June 2026</p>

        <h2>Service</h2>
        <p>
          wenlo provides cloud storage, notes, and AI-powered search across your libraries. By using
          the service you agree to these terms.
        </p>

        <h2>Your content</h2>
        <p>
          You retain ownership of files and pages you upload. You grant wenlo a limited license to
          store, process, and index your content solely to operate the service — including AI
          features you enable.
        </p>

        <h2>Acceptable use</h2>
        <p>
          Do not upload unlawful content, attempt to abuse API rate limits, or interfere with other
          users. We may suspend accounts that violate these rules.
        </p>

        <h2>Data retention</h2>
        <p>
          Deleted items are kept in trash for 30 days before permanent removal. You may export or
          delete your account at any time from Settings.
        </p>

        <h2>Disclaimer</h2>
        <p>
          The service is provided &quot;as is&quot; without warranties. AI-generated answers may be
          inaccurate — verify important information independently.
        </p>

        <p>
          <Link href="/login" className="text-primary">
            Back to sign in
          </Link>
        </p>
      </article>
    </div>
  );
}
