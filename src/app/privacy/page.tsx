import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy policy",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-12 md:px-10">
      <article className="prose prose-neutral dark:prose-invert mx-auto max-w-2xl">
        <h1>Privacy policy</h1>
        <p className="lead text-muted-foreground">Last updated: June 2026</p>

        <h2>What we collect</h2>
        <p>
          Account email, profile name, files you upload, pages you write, and usage data (AI token
          consumption, storage used).
        </p>

        <h2>How we use data</h2>
        <p>
          To provide storage, search, collaboration, and AI features. When you use Recall or
          contextual suggestions, relevant excerpts are sent to our AI provider to generate
          embeddings and answers.
        </p>

        <h2>Third parties</h2>
        <p>
          We use Supabase (auth &amp; storage), hosting on Vercel, OpenAI (embeddings &amp; chat),
          and optional payment processing. Data is not sold to advertisers.
        </p>

        <h2>Your rights (GDPR)</h2>
        <ul>
          <li>Export all data from Settings → Account</li>
          <li>Delete your account and associated data permanently</li>
          <li>Contact us to request access or correction</li>
        </ul>

        <h2>Retention</h2>
        <p>
          Active data is kept while your account exists. Trash items are purged after 30 days.
          Backups may persist briefly after deletion.
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
