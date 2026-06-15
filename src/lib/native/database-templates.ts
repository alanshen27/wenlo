export type DatabaseTemplateId = "tasks" | "contacts" | "roadmap";

export type DatabaseTemplate = {
  id: DatabaseTemplateId;
  label: string;
  title: string;
  /** Shown on the template card thumbnail. */
  preview: string;
};

export const DATABASE_TEMPLATES: DatabaseTemplate[] = [
  {
    id: "tasks",
    label: "Task tracker",
    title: "Tasks",
    preview:
      "Launch checklist · In progress\nTemplate polish · Todo\nBilling QA · Todo\nBeta invites · Done",
  },
  {
    id: "contacts",
    label: "Contacts",
    title: "Contacts",
    preview:
      "Morgan Chen · morgan@design.co · Studio North\nPriya Patel · priya@acme.io · Acme\nAlex Kim · alex@example.com · Acme",
  },
  {
    id: "roadmap",
    label: "Roadmap",
    title: "Roadmap",
    preview:
      "Native app homes · Shipped · Q1\nTemplate gallery · In progress · Q2\nBilling v1 · Planned · Q2",
  },
];

export function getDatabaseTemplate(id: string) {
  return DATABASE_TEMPLATES.find((t) => t.id === id) ?? DATABASE_TEMPLATES[0];
}
